"""
agents/diff_agent.py
─────────────────────
LLM-based policy change interpretation using Groq.

This agent is intentionally NOT the first line of defense. The monitor should
only call it after local gating proves that:
  - the cleaned source hash changed,
  - the diff is not just ads/nav/footer/layout churn,
  - and the changed snippets contain policy-like terms.

Rate-limit strategy:
  - The monitor paces Groq calls over a 10-minute run budget.
  - This module also handles 429 with Retry-After/exponential backoff.
  - 429s return status="deferred_rate_limited" rather than pretending the
    source is unchanged.

Model note:
  - llama-3.3-70b-versatile supports JSON object mode in Groq's OpenAI-style API.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
from datetime import datetime, timezone
from typing import Any

import httpx


GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
DETECT_MAX_TOKENS = int(os.getenv("GROQ_DETECT_MAX_TOKENS", "900"))
GROQ_MAX_RETRIES = int(os.getenv("GROQ_MAX_RETRIES", "4"))
GROQ_TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "75"))


class GroqRateLimited(RuntimeError):
    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def _base_result(
    *,
    status: str,
    changed: bool = False,
    summary: str,
    confidence: str = "low",
    new_content: str = "",
    valid_as_of: str | None = None,
    source_matches_article: bool | None = None,
    evidence: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "status": status,
        "changed": changed,
        "change_summary": summary,
        "new_content": new_content,
        "confidence": confidence,
        "valid_as_of": valid_as_of,
        "source_matches_article": source_matches_article,
        "evidence": evidence or [],
    }


def _safe_retry_after(response: httpx.Response) -> float | None:
    raw = response.headers.get("retry-after") or response.headers.get("Retry-After")
    if not raw:
        return None
    try:
        return max(0.0, float(raw))
    except ValueError:
        return None


async def _call_llm_json(system: str, user: str, *, max_tokens: int = DETECT_MAX_TOKENS) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")

    payload = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=GROQ_TIMEOUT_SECONDS) as client:
        for attempt in range(GROQ_MAX_RETRIES):
            try:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if response.status_code == 429:
                    retry_after = _safe_retry_after(response)
                    wait_for = retry_after if retry_after is not None else min(90, (2 ** attempt) * 10)
                    wait_for += random.uniform(1.0, 4.0)
                    last_error = GroqRateLimited(f"Groq 429 rate limit; retrying in {wait_for:.1f}s", retry_after=retry_after)
                    await asyncio.sleep(wait_for)
                    continue

                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    retry_after = _safe_retry_after(exc.response)
                    wait_for = retry_after if retry_after is not None else min(90, (2 ** attempt) * 10)
                    wait_for += random.uniform(1.0, 4.0)
                    last_error = GroqRateLimited(str(exc), retry_after=retry_after)
                    await asyncio.sleep(wait_for)
                    continue
                raise
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                await asyncio.sleep(min(60, (2 ** attempt) * 5) + random.uniform(1.0, 3.0))

    if isinstance(last_error, GroqRateLimited):
        raise GroqRateLimited("Groq rate limit persisted after retries", retry_after=last_error.retry_after)
    if last_error:
        raise last_error
    raise RuntimeError("Groq call failed without a captured error")


_DIFF_SYSTEM = """You are a travel rewards policy analyst monitoring official and trusted source pages for a RAG knowledge base.

You will receive:
1. ARTICLE METADATA — title, article_id, category, focus, source URL
2. CURRENT KB CONTENT — the existing knowledge-base article content
3. CHANGED SOURCE SNIPPETS — old/new source snippets produced by a local diff gate
4. SOURCE LAST UPDATED METADATA — reliability context from the source page when available

Your job:
1. First decide whether the source content matches the expected article/topic.
2. Then decide whether the changed snippets show a meaningful factual/policy change.
3. Only flag changes for factual differences: fee amounts, rates, thresholds, benefits, partner additions/removals, award chart numbers, access rules, deadlines, expiration rules, or eligibility rules.
4. Do not flag wording-only, marketing-only, navigation, ad, footer, or last-updated-only changes as policy changes.
5. Do not invent facts not present in the changed source snippets.
6. If the source is incomplete or ambiguous, set changed=false and confidence=low or medium.

Return ONLY valid JSON with exactly these keys:
{
  "source_matches_article": true,
  "changed": false,
  "change_summary": "No meaningful policy changes detected",
  "new_content": "",
  "confidence": "high",
  "evidence": []
}

If changed=true, new_content should be a concise suggested replacement paragraph or bullet section for the affected KB content, not a full article rewrite unless the changed snippets are sufficient to support that. Evidence should be short quotes or paraphrases from the changed source snippets only."""


def _strip_json_noise(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).rstrip("` ").strip()
    # Remove invalid control chars except common whitespace.
    raw = "".join(ch for ch in raw if ch in "\n\r\t" or ord(ch) >= 32)
    return raw


def _parse_json(raw: str) -> dict[str, Any]:
    cleaned = _strip_json_noise(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Last-resort extraction if the provider wrapped text around JSON anyway.
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if match:
            return json.loads(match.group(0))
        raise


def _validate_result(result: dict[str, Any]) -> dict[str, Any]:
    changed = bool(result.get("changed", False))
    source_matches_article = bool(result.get("source_matches_article", True))
    confidence = str(result.get("confidence", "low")).lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "low"

    if not source_matches_article:
        return _base_result(
            status="source_mismatch",
            changed=False,
            summary=str(result.get("change_summary") or "Source did not match expected article/topic"),
            confidence="low",
            source_matches_article=False,
            evidence=result.get("evidence") if isinstance(result.get("evidence"), list) else [],
        )

    valid_as_of = datetime.now(timezone.utc).strftime("%Y-%m") if changed else None
    return _base_result(
        status="changed" if changed else "unchanged",
        changed=changed,
        summary=str(result.get("change_summary") or ("Meaningful change detected" if changed else "No meaningful policy changes detected")),
        new_content=str(result.get("new_content") or "") if changed else "",
        confidence=confidence,
        valid_as_of=valid_as_of,
        source_matches_article=True,
        evidence=result.get("evidence") if isinstance(result.get("evidence"), list) else [],
    )


async def detect_changes(
    current_content: str,
    scraped_content: str,
    focus: str,
    article_title: str,
    *,
    article_id: str | None = None,
    category: str | None = None,
    source_url: str | None = None,
    changed_snippets: list[str] | None = None,
    source_last_updated: str | None = None,
    source_last_updated_raw: str | None = None,
) -> dict[str, Any]:
    """Use Groq to interpret a locally-gated meaningful source diff.

    Backward compatible with the previous signature: the first four positional
    arguments are unchanged. New metadata kwargs make false positives less likely.
    """
    if not scraped_content.strip() and not changed_snippets:
        return _base_result(
            status="scrape_empty",
            changed=False,
            summary="Scraping returned no content",
            confidence="low",
            source_matches_article=None,
        )

    snippet_text = "\n\n---\n\n".join(changed_snippets or [])
    if not snippet_text:
        snippet_text = scraped_content[:3500]

    user_prompt = (
        f"ARTICLE_ID: {article_id or 'unknown'}\n"
        f"ARTICLE_TITLE: {article_title}\n"
        f"CATEGORY: {category or 'unknown'}\n"
        f"SOURCE_URL: {source_url or 'unknown'}\n"
        f"FOCUS: {focus}\n\n"
        f"SOURCE_LAST_UPDATED: {source_last_updated or 'not found'}\n"
        f"SOURCE_LAST_UPDATED_RAW: {source_last_updated_raw or 'not found'}\n\n"
        f"CURRENT KB CONTENT EXCERPT:\n{current_content[:2500]}\n\n"
        f"CHANGED SOURCE SNIPPETS:\n{snippet_text[:5500]}\n\n"
        "Analyze whether the changed source snippets reveal a meaningful factual/policy update."
    )

    try:
        raw = await _call_llm_json(_DIFF_SYSTEM, user_prompt)
        parsed = _parse_json(raw)
        return _validate_result(parsed)

    except GroqRateLimited as exc:
        print(f"⚠️ Diff agent rate limited: {exc}")
        return _base_result(
            status="deferred_rate_limited",
            changed=False,
            summary="Deferred because Groq rate limit persisted after retries",
            confidence="low",
            source_matches_article=None,
        )
    except json.JSONDecodeError as exc:
        print(f"⚠️ Diff agent JSON parse error: {exc}")
        return _base_result(
            status="llm_parse_failed",
            changed=False,
            summary=f"JSON parse error: {exc}",
            confidence="low",
            source_matches_article=None,
        )
    except Exception as exc:
        print(f"⚠️ Diff agent error: {exc}")
        return _base_result(
            status="llm_error",
            changed=False,
            summary=f"Error: {exc}",
            confidence="low",
            source_matches_article=None,
        )
