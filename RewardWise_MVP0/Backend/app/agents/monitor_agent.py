"""
agents/monitor_agent.py
───────────────────────
Scheduled KB source monitor.

Optimized flow:
  1. Scrape configured source URLs with fallbacks.
  2. Clean visible text and preserve source "last updated" metadata.
  3. Compare normalized meaningful-content hash to prior snapshot.
  4. Run local diff/keyword gate.
  5. Call Groq only for meaningful policy-change candidates.
  6. Save update candidates for human review. Do not rewrite KB files directly.

Default runtime target: <= 10 minutes.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import os
import random
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType
from urllib.parse import urlparse

import httpx

from app.agents.change_gate import (
    MIN_USEFUL_CHARS,
    ChangeGateDecision,
    clean_content,
    evaluate_change,
    is_useful_scrape,
)
from app.agents.diff_agent import detect_changes
from app.agents.snapshot_store import SnapshotStore, append_candidate, build_snapshot
from app.agents.sources import KBSource, SOURCES


MAX_RUNTIME_SECONDS = int(os.getenv("MONITOR_MAX_RUNTIME_SECONDS", "600"))
SCRAPE_CONCURRENCY = int(os.getenv("MONITOR_SCRAPE_CONCURRENCY", "3"))
DOMAIN_DELAY_SECONDS = float(os.getenv("MONITOR_DOMAIN_DELAY_SECONDS", "4"))
HTTP_TIMEOUT_SECONDS = float(os.getenv("MONITOR_HTTP_TIMEOUT_SECONDS", "25"))
GROQ_MIN_DELAY_SECONDS = float(os.getenv("MONITOR_GROQ_MIN_DELAY_SECONDS", "30"))
GROQ_MAX_CALLS_PER_RUN = int(os.getenv("MONITOR_GROQ_MAX_CALLS_PER_RUN", "12"))
FIRST_RUN_COMPARE_KB = os.getenv("MONITOR_FIRST_RUN_COMPARE_KB", "false").lower() in {"1", "true", "yes"}

USER_AGENT = os.getenv(
    "MONITOR_USER_AGENT",
    "RewardWiseKBMonitor/1.0 (+https://mytravelwallet.ai; policy freshness monitor)",
)


@dataclass(slots=True)
class ScrapeResult:
    source: KBSource
    ok: bool
    url: str | None
    raw_content: str
    clean_text: str
    normalized_text: str
    clean_hash: str | None
    chars: int
    source_last_updated: str | None
    source_last_updated_raw: str | None
    last_updated_hash_component: str | None
    status: str
    errors: list[str]
    attempts: list[str] = field(default_factory=list)


class RuntimeBudget:
    def __init__(self, seconds: int) -> None:
        self.started = time.monotonic()
        self.seconds = seconds

    def elapsed(self) -> float:
        return time.monotonic() - self.started

    def remaining(self) -> float:
        return max(0.0, self.seconds - self.elapsed())

    def expired(self, reserve_seconds: float = 0.0) -> bool:
        return self.remaining() <= reserve_seconds


class DomainPacer:
    def __init__(self, delay_seconds: float) -> None:
        self.delay_seconds = delay_seconds
        self._last_by_domain: dict[str, float] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def wait(self, url: str) -> None:
        domain = urlparse(url).netloc.lower()
        if not domain:
            return
        lock = self._locks.setdefault(domain, asyncio.Lock())
        async with lock:
            last = self._last_by_domain.get(domain, 0.0)
            elapsed = time.monotonic() - last
            wait_for = self.delay_seconds - elapsed
            if wait_for > 0:
                await asyncio.sleep(wait_for + random.uniform(0.1, 0.8))
            self._last_by_domain[domain] = time.monotonic()


class GroqPacer:
    def __init__(self, min_delay_seconds: float, max_calls: int) -> None:
        self.min_delay_seconds = min_delay_seconds
        self.max_calls = max_calls
        self.calls = 0
        self._last_call = 0.0

    def can_call(self) -> bool:
        return self.calls < self.max_calls

    async def wait(self) -> None:
        elapsed = time.monotonic() - self._last_call
        wait_for = self.min_delay_seconds - elapsed
        if wait_for > 0:
            await asyncio.sleep(wait_for + random.uniform(0.5, 2.0))
        self._last_call = time.monotonic()
        self.calls += 1


def utc_label() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _safe_import(module_name: str) -> ModuleType | None:
    try:
        return importlib.import_module(module_name)
    except Exception:
        return None


def _iter_kb_article_dicts() -> list[dict]:
    modules = [
        "app.rag.kb.airline_policies",
        "app.rag.kb.program_rules",
        "app.rag.kb.route_intelligence",
        "app.rag.kb.historical_patterns",
        "rag.kb.airline_policies",
        "rag.kb.program_rules",
        "rag.kb.route_intelligence",
        "rag.kb.historical_patterns",
    ]
    articles: list[dict] = []
    for module_name in modules:
        module = _safe_import(module_name)
        if not module:
            continue
        for value in vars(module).values():
            if isinstance(value, list):
                articles.extend(item for item in value if isinstance(item, dict) and "id" in item)
    return articles


def load_current_kb_content(article_id: str) -> str:
    for article in _iter_kb_article_dicts():
        if article.get("id") == article_id:
            content = article.get("content") or ""
            if isinstance(content, str):
                return content
    return ""


def source_priority(source: KBSource) -> int:
    category_score = {
        "program_rules": 0,
        "airline_policies": 1,
        "elite_status": 2,
        "credit_cards": 3,
        "airport_lounges": 4,
    }.get(source.category, 5)
    cadence_score = {"weekly": 0, "monthly": 1, "quarterly": 2}.get(source.cadence, 3)
    return category_score * 10 + cadence_score


async def fetch_url(client: httpx.AsyncClient, pacer: DomainPacer, url: str) -> tuple[int, str]:
    await pacer.wait(url)
    response = await client.get(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        follow_redirects=True,
    )
    return response.status_code, response.text




def _host(url: str | None) -> str:
    if not url:
        return "unknown"
    parsed = urlparse(url)
    return parsed.netloc.replace("www.", "") or url


def _trim_url(url: str, max_len: int = 86) -> str:
    if len(url) <= max_len:
        return url
    return url[: max_len - 1] + "…"


def format_scrape_block(index: int, total: int, result: ScrapeResult) -> str:
    """Return one complete, per-source scrape log block.

    Scraping runs concurrently, so printing line-by-line from inside each
    network task makes warnings appear under the wrong source. This buffers
    every attempt for a source and emits a single block after that source
    finishes.
    """
    source = result.source
    lines = [f"  [{index}/{total}] {source.article_title}"]

    if result.attempts:
        lines.extend(f"    {line}" for line in result.attempts)

    if result.ok:
        last_updated = f" | last updated: {result.source_last_updated}" if result.source_last_updated else ""
        lines.append(f"    ✅ Final: {result.chars:,} chars via {_host(result.url)}{last_updated}")
    elif result.status == "deferred_runtime_budget":
        lines.append("    ⏭️ Final: deferred — runtime budget")
    else:
        lines.append(f"    ❌ Final: {result.status}")

    return "\n".join(lines)


async def scrape_source(source: KBSource, client: httpx.AsyncClient, pacer: DomainPacer) -> ScrapeResult:
    errors: list[str] = []
    attempts: list[str] = []
    best_soft: ScrapeResult | None = None

    for url in source.urls:
        host = _host(url)
        try:
            status_code, body = await fetch_url(client, pacer, url)
            if status_code >= 400:
                message = f"HTTP {status_code}: {url}"
                errors.append(message)
                attempts.append(f"⚠️ {host} — HTTP {status_code} ({_trim_url(url)})")
                continue

            cleaned = clean_content(body)
            useful, reason = is_useful_scrape(cleaned, MIN_USEFUL_CHARS)
            result = ScrapeResult(
                source=source,
                ok=useful,
                url=url,
                raw_content=body,
                clean_text=cleaned.clean_text,
                normalized_text=cleaned.normalized_text,
                clean_hash=cleaned.clean_hash,
                chars=cleaned.char_count,
                source_last_updated=cleaned.source_last_updated,
                source_last_updated_raw=cleaned.source_last_updated_raw,
                last_updated_hash_component=cleaned.last_updated_hash_component,
                status="ok" if useful else "too_short",
                errors=errors + ([] if useful else [reason]),
                attempts=attempts.copy(),
            )

            if useful:
                attempts.append(f"✓ {host} — {cleaned.char_count:,} chars")
                result.attempts = attempts.copy()
                return result

            errors.append(f"{reason}: {url}")
            attempts.append(f"⚠️ {host} — low-content ({cleaned.char_count:,} chars)")
            if best_soft is None or cleaned.char_count > best_soft.chars:
                result.attempts = attempts.copy()
                best_soft = result

        except httpx.TimeoutException:
            errors.append(f"timeout: {url}")
            attempts.append(f"⚠️ {host} — timeout")
        except httpx.TransportError as exc:
            errors.append(f"transport error {exc}: {url}")
            attempts.append(f"⚠️ {host} — transport error: {exc}")
        except Exception as exc:
            errors.append(f"error {exc}: {url}")
            attempts.append(f"⚠️ {host} — error: {exc}")

    if best_soft:
        # Return best soft failure so caller can decide/log with real content length.
        best_soft.ok = False
        best_soft.status = "too_short_all_fallbacks"
        best_soft.errors = errors
        best_soft.attempts = attempts.copy()
        return best_soft

    return ScrapeResult(
        source=source,
        ok=False,
        url=None,
        raw_content="",
        clean_text="",
        normalized_text="",
        clean_hash=None,
        chars=0,
        source_last_updated=None,
        source_last_updated_raw=None,
        last_updated_hash_component=None,
        status="scrape_failed",
        errors=errors or ["all URLs failed"],
        attempts=attempts.copy() or ["⚠️ no URLs were attempted"],
    )

async def scrape_all(sources: list[KBSource], budget: RuntimeBudget) -> list[ScrapeResult]:
    semaphore = asyncio.Semaphore(SCRAPE_CONCURRENCY)
    pacer = DomainPacer(DOMAIN_DELAY_SECONDS)
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    results: list[ScrapeResult] = []

    async with httpx.AsyncClient(timeout=timeout) as client:
        async def run_one(index: int, source: KBSource) -> None:
            async with semaphore:
                if budget.expired(reserve_seconds=120):
                    result = ScrapeResult(
                        source=source,
                        ok=False,
                        url=None,
                        raw_content="",
                        clean_text="",
                        normalized_text="",
                        clean_hash=None,
                        chars=0,
                        source_last_updated=None,
                        source_last_updated_raw=None,
                        last_updated_hash_component=None,
                        status="deferred_runtime_budget",
                        errors=["scrape deferred due to runtime budget"],
                        attempts=["⏭️ skipped before scrape because runtime budget is nearly exhausted"],
                    )
                    print(format_scrape_block(index, len(sources), result))
                    results.append(result)
                    return
                result = await scrape_source(source, client, pacer)
                print(format_scrape_block(index, len(sources), result))
                results.append(result)

        await asyncio.gather(*(run_one(i, s) for i, s in enumerate(sources, start=1)))

    # Preserve source order for predictable diff output.
    order = {s.article_id: i for i, s in enumerate(sources)}
    return sorted(results, key=lambda r: order.get(r.source.article_id, 9999))


async def process_diffs(results: list[ScrapeResult], *, dry_run: bool, budget: RuntimeBudget) -> list[dict]:
    store = SnapshotStore()
    groq = GroqPacer(GROQ_MIN_DELAY_SECONDS, GROQ_MAX_CALLS_PER_RUN)
    reports: list[dict] = []

    for index, scrape in enumerate(results, start=1):
        source = scrape.source
        print(f"\n  [{index}/{len(results)}] {source.article_title}")

        if not scrape.ok or not scrape.clean_hash:
            print(f"   ⏭️  Skipped — {scrape.status}")
            reports.append({
                "article_id": source.article_id,
                "status": scrape.status,
                "changed": False,
                "errors": scrape.errors,
            })
            continue

        previous = store.get(source.article_id)
        decision = evaluate_change(
            previous_clean_text=previous.clean_text if previous else None,
            previous_hash=previous.clean_hash if previous else None,
            previous_last_updated_component=previous.last_updated_hash_component if previous else None,
            new_cleaned=clean_content(scrape.clean_text),
        )

        if decision.status == "baseline_missing" and FIRST_RUN_COMPARE_KB:
            current_kb = load_current_kb_content(source.article_id)
            if current_kb:
                # First-run KB audit mode: use Groq sparingly to compare current KB to source.
                decision = ChangeGateDecision(
                    status="first_run_kb_audit_candidate",
                    should_call_llm=True,
                    reason="No previous source snapshot; MONITOR_FIRST_RUN_COMPARE_KB=true and KB content exists.",
                    old_hash=None,
                    new_hash=scrape.clean_hash,
                    changed_lines=[],
                    changed_snippets=[f"CURRENT KB EXCERPT:\n{current_kb[:1800]}\n\nSCRAPED SOURCE EXCERPT:\n{scrape.clean_text[:2600]}"],
                    policy_keyword_hits=["first_run_audit"],
                    source_last_updated=scrape.source_last_updated,
                    source_last_updated_raw=scrape.source_last_updated_raw,
                    last_updated_changed=False,
                    confidence="medium",
                )

        report = {
            "article_id": source.article_id,
            "article_title": source.article_title,
            "source_url": scrape.url,
            "gate_status": decision.status,
            "gate_reason": decision.reason,
            "source_last_updated": decision.source_last_updated,
            "source_last_updated_raw": decision.source_last_updated_raw,
            "last_updated_changed": decision.last_updated_changed,
            "policy_keyword_hits": decision.policy_keyword_hits,
            "changed": False,
        }

        if not decision.should_call_llm:
            label = "✅" if decision.status == "unchanged" else "ℹ️"
            if decision.status == "baseline_missing":
                print("   ℹ️  Baseline missing — save this source snapshot before future diffs")
            elif decision.status == "metadata_or_boilerplate_only":
                print("   ℹ️  Only metadata/boilerplate changed; last-updated preserved")
            else:
                print(f"   {label} {decision.reason}")

            if not dry_run:
                snapshot = build_snapshot(
                    article_id=source.article_id,
                    article_title=source.article_title,
                    category=source.category,
                    url=scrape.url or "",
                    clean_hash=scrape.clean_hash,
                    clean_text=scrape.clean_text,
                    normalized_text=scrape.normalized_text,
                    content_chars=scrape.chars,
                    source_last_updated=scrape.source_last_updated,
                    source_last_updated_raw=scrape.source_last_updated_raw,
                    last_updated_hash_component=scrape.last_updated_hash_component,
                    status=decision.status,
                )
                store.put(snapshot)
            else:
                print("   🔍 DRY RUN — snapshot not written")
            reports.append(report)
            continue

        if budget.expired(reserve_seconds=45):
            print("   ⏭️  Deferred — runtime budget nearly exhausted")
            report.update({"status": "deferred_runtime_budget"})
            reports.append(report)
            continue

        if not groq.can_call():
            print("   ⏭️  Deferred — Groq per-run call budget reached")
            report.update({"status": "deferred_groq_budget"})
            reports.append(report)
            continue

        print(f"   🔎 Local gate passed: {', '.join(decision.policy_keyword_hits[:8]) or 'policy-like diff'}")
        await groq.wait()

        current_content = load_current_kb_content(source.article_id)
        result = await detect_changes(
            current_content=current_content,
            scraped_content=scrape.clean_text,
            focus=source.focus,
            article_title=source.article_title,
            article_id=source.article_id,
            category=source.category,
            source_url=scrape.url,
            changed_snippets=decision.changed_snippets,
            source_last_updated=scrape.source_last_updated,
            source_last_updated_raw=scrape.source_last_updated_raw,
        )

        report.update(result)

        if result.get("changed"):
            print(f"   🔄 [{result.get('confidence')}] {result.get('change_summary')}")
            candidate = {
                "article_id": source.article_id,
                "article_title": source.article_title,
                "category": source.category,
                "source_url": scrape.url,
                "focus": source.focus,
                "source_last_updated": scrape.source_last_updated,
                "source_last_updated_raw": scrape.source_last_updated_raw,
                "gate": decision.as_dict(),
                "llm_result": result,
                "clean_hash": scrape.clean_hash,
            }
            if dry_run:
                print("   🔍 DRY RUN — would create update candidate")
            else:
                append_candidate(candidate)
        elif result.get("status", "") == "deferred_rate_limited":
            print("   ⏭️  Deferred — Groq rate limited")
        elif result.get("status", "") == "source_mismatch":
            print(f"   ⚠️ Source mismatch: {result.get('change_summary')}")
        else:
            print(f"   ✅ [{result.get('confidence')}] {result.get('change_summary')}")

        if not dry_run and result.get("status") not in {"deferred_rate_limited", "llm_error", "llm_parse_failed"}:
            snapshot = build_snapshot(
                article_id=source.article_id,
                article_title=source.article_title,
                category=source.category,
                url=scrape.url or "",
                clean_hash=scrape.clean_hash,
                clean_text=scrape.clean_text,
                normalized_text=scrape.normalized_text,
                content_chars=scrape.chars,
                source_last_updated=scrape.source_last_updated,
                source_last_updated_raw=scrape.source_last_updated_raw,
                last_updated_hash_component=scrape.last_updated_hash_component,
                status=str(result.get("status") or decision.status),
            )
            store.put(snapshot)

        reports.append(report)

    print(f"\n   Groq calls used: {groq.calls}/{GROQ_MAX_CALLS_PER_RUN}")
    return reports


async def run_monitor(*, dry_run: bool = False, cadence: str | None = None, category: str | None = None) -> int:
    sources = SOURCES
    if cadence:
        sources = [s for s in sources if s.cadence == cadence]
    if category:
        sources = [s for s in sources if s.category == category]
    sources = sorted(sources, key=source_priority)

    budget = RuntimeBudget(MAX_RUNTIME_SECONDS)

    print("🤖 KB Monitor Agent")
    print(f"   Sources: {len(sources)} | dry_run: {dry_run}")
    print(f"   Runtime budget: {MAX_RUNTIME_SECONDS}s")
    print(f"   Started: {utc_label()}\n")

    print(f"📡 Phase 1: Scraping {len(sources)} sources...")
    scrape_results = await scrape_all(sources, budget)
    successful = sum(1 for r in scrape_results if r.ok)
    print(f"  Scraping complete: {successful}/{len(scrape_results)} successful")

    print("\n🧠 Phase 2: Local hash/diff gate + paced Groq analysis...")
    reports = await process_diffs(scrape_results, dry_run=dry_run, budget=budget)

    changed = [r for r in reports if r.get("changed")]
    unchanged = [r for r in reports if r.get("status") == "unchanged" or r.get("gate_status") == "unchanged"]
    deferred = [r for r in reports if str(r.get("status", "")).startswith("deferred")]
    failed = [r for r in reports if "failed" in str(r.get("status", "")) or r.get("status") in {"scrape_failed", "too_short_all_fallbacks"}]

    print("\n" + "─" * 50)
    print(f"🏁 Done in {budget.elapsed():.0f}s")
    print(f"   {len(changed)} changed | {len(unchanged)} unchanged | {len(deferred)} deferred | {len(failed)} failed")

    if changed:
        print("\n📋 Changes:")
        for item in changed:
            print(f"  • [{item.get('confidence')}] {item.get('article_id')}: {item.get('change_summary')}")

    if deferred:
        print("\n⏭️ Deferred:")
        for item in deferred[:10]:
            print(f"  • {item.get('article_id')}: {item.get('status')}")

    return 0 if not failed else 1


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the RewardWise KB monitor agent.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write snapshots or update candidates")
    parser.add_argument("--cadence", choices=["weekly", "monthly", "quarterly"], help="Only run sources with this cadence")
    parser.add_argument("--category", help="Only run sources in this category")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    return asyncio.run(run_monitor(dry_run=args.dry_run, cadence=args.cadence, category=args.category))


if __name__ == "__main__":
    raise SystemExit(main())
