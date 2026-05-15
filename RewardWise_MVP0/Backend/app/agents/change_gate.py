"""
agents/change_gate.py
─────────────────────
Local, non-LLM change detection gate for KB source monitoring.

This module answers the cheap questions before Groq is involved:
  1. Did the cleaned page text materially change?
  2. Is the scrape useful enough to trust?
  3. Is the change likely policy/benefit/rate related?
  4. Did only the source's "last updated" metadata change?

Important: "last updated" is preserved as reliability metadata, but it is
removed from the hash/diff trigger so a date-only update does not burn an LLM
call or create a false policy-change candidate.
"""

from __future__ import annotations

import difflib
import hashlib
import html
import os
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Iterable


MIN_USEFUL_CHARS = int(os.getenv("MONITOR_MIN_USEFUL_CHARS", "1500"))
HARD_MIN_CHARS = int(os.getenv("MONITOR_HARD_MIN_CHARS", "500"))
MAX_NORMALIZED_CHARS = int(os.getenv("MONITOR_MAX_NORMALIZED_CHARS", "50000"))
MAX_CHANGED_SNIPPETS = int(os.getenv("MONITOR_MAX_CHANGED_SNIPPETS", "8"))
SNIPPET_CONTEXT_LINES = int(os.getenv("MONITOR_SNIPPET_CONTEXT_LINES", "2"))


POLICY_KEYWORDS = {
    "fee", "fees", "annual fee", "surcharge", "carrier-imposed", "yq",
    "bag", "baggage", "checked bag", "carry-on", "carry on",
    "award", "awards", "miles", "mile", "points", "point",
    "transfer", "partner", "partners", "ratio", "bonus", "bonuses",
    "redeposit", "change", "cancel", "cancellation", "refund",
    "elite", "status", "mqd", "pqp", "pqf", "loyalty points", "tier",
    "threshold", "qualification", "qualify", "qualifying",
    "lounge", "guest", "visit", "visits", "access",
    "credit", "benefit", "benefits", "earning", "earn", "multiplier",
    "expires", "expiration", "valid through", "effective", "devaluation",
    "blackout", "companion", "upgrade", "certificate", "chart",
    "$", "%", "1:", "x points", "x miles",
}

# These lines are useful as reliability metadata but should not trigger Groq by themselves.
LAST_UPDATED_PATTERNS = [
    re.compile(r"\b(last\s+updated|updated|reviewed|last\s+reviewed|published|posted)\b\s*[:\-]?\s*[^\n]{0,100}", re.I),
    re.compile(r"\b(effective|valid\s+as\s+of)\b\s*[:\-]?\s*[^\n]{0,100}", re.I),
]

BOILERPLATE_LINE_PATTERNS = [
    r"^advertisement$",
    r"^advertiser disclosure",
    r"^terms apply",
    r"^editorial note",
    r"^subscribe",
    r"^sign up",
    r"^log in$",
    r"^privacy policy$",
    r"^cookie",
    r"^related articles?$",
    r"^recommended cards?$",
    r"^table of contents$",
    r"^share this article$",
    r"^facebook$|^twitter$|^x$|^linkedin$|^email$",
    r"^©|^copyright",
    r"^all rights reserved",
    r"^skip to",
    r"^menu$",
    r"^search$",
    r"^more from",
    r"^learn more$",
    r"^apply now$",
    r"^rates and fees$",
]
BOILERPLATE_RE = re.compile("|".join(f"(?:{p})" for p in BOILERPLATE_LINE_PATTERNS), re.I)


@dataclass(slots=True)
class CleanedContent:
    raw_text: str
    clean_text: str
    normalized_text: str
    clean_hash: str
    char_count: int
    source_last_updated: str | None = None
    source_last_updated_raw: str | None = None
    last_updated_hash_component: str | None = None


@dataclass(slots=True)
class ChangeGateDecision:
    status: str
    should_call_llm: bool
    reason: str
    old_hash: str | None = None
    new_hash: str | None = None
    changed_lines: list[str] = field(default_factory=list)
    changed_snippets: list[str] = field(default_factory=list)
    policy_keyword_hits: list[str] = field(default_factory=list)
    source_last_updated: str | None = None
    source_last_updated_raw: str | None = None
    last_updated_changed: bool = False
    confidence: str = "high"

    def as_dict(self) -> dict:
        return {
            "status": self.status,
            "should_call_llm": self.should_call_llm,
            "reason": self.reason,
            "old_hash": self.old_hash,
            "new_hash": self.new_hash,
            "changed_lines": self.changed_lines,
            "changed_snippets": self.changed_snippets,
            "policy_keyword_hits": self.policy_keyword_hits,
            "source_last_updated": self.source_last_updated,
            "source_last_updated_raw": self.source_last_updated_raw,
            "last_updated_changed": self.last_updated_changed,
            "confidence": self.confidence,
        }


class _TextExtractor(HTMLParser):
    """Small dependency-free HTML text extractor."""

    SKIP_TAGS = {"script", "style", "noscript", "svg", "canvas", "iframe"}
    BLOCK_TAGS = {
        "p", "div", "section", "article", "header", "footer", "nav", "main",
        "li", "ul", "ol", "table", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "br",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
            return
        if tag in self.BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
            return
        if tag in self.BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        if data and data.strip():
            self._parts.append(data.strip())
            self._parts.append(" ")

    def text(self) -> str:
        return "".join(self._parts)


def extract_text_from_html(raw: str) -> str:
    if not raw:
        return ""
    looks_like_html = "<html" in raw[:2000].lower() or "<body" in raw[:2000].lower() or re.search(r"<\w+[^>]*>", raw[:2000])
    if not looks_like_html:
        return html.unescape(raw)

    parser = _TextExtractor()
    try:
        parser.feed(raw)
        return html.unescape(parser.text())
    except Exception:
        stripped = re.sub(r"(?is)<(script|style|noscript|svg|iframe).*?</\1>", " ", raw)
        stripped = re.sub(r"(?s)<[^>]+>", " ", stripped)
        return html.unescape(stripped)


def _collapse_whitespace(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[\t\f\v ]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _line_is_boilerplate(line: str) -> bool:
    stripped = line.strip().lower()
    if not stripped:
        return True
    if len(stripped) <= 2:
        return True
    if BOILERPLATE_RE.search(stripped):
        return True
    # Remove common nav-like one-word lines that cause churn.
    if stripped in {"home", "travel", "cards", "news", "guides", "reviews", "best", "compare"}:
        return True
    return False


def extract_last_updated(text: str) -> tuple[str | None, str | None]:
    """Return (normalized date-ish text, raw matched line)."""
    if not text:
        return None, None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:120]:
        for pattern in LAST_UPDATED_PATTERNS:
            match = pattern.search(line)
            if match:
                raw = match.group(0).strip()
                normalized = re.sub(r"\s+", " ", raw).strip()
                return normalized, line[:240]

    # Fallback for compact pages where date text is inline.
    for pattern in LAST_UPDATED_PATTERNS:
        match = pattern.search(text[:5000])
        if match:
            raw = re.sub(r"\s+", " ", match.group(0)).strip()
            return raw, raw
    return None, None


def remove_last_updated_lines(text: str) -> str:
    kept: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if any(pattern.search(stripped) for pattern in LAST_UPDATED_PATTERNS):
            continue
        kept.append(line)
    return "\n".join(kept)


def clean_visible_text(raw_html_or_text: str) -> str:
    text = extract_text_from_html(raw_html_or_text)
    text = _collapse_whitespace(text)
    lines = []
    seen_short_lines: set[str] = set()
    for line in text.splitlines():
        line = _collapse_whitespace(line)
        if _line_is_boilerplate(line):
            continue
        # Deduplicate repeated nav/sidebar lines.
        key = line.lower()
        if len(key) < 80:
            if key in seen_short_lines:
                continue
            seen_short_lines.add(key)
        lines.append(line)
    return _collapse_whitespace("\n".join(lines))


def normalize_for_hash(clean_text: str) -> str:
    """Normalize meaningful content for stable hashing.

    Last-updated lines are intentionally removed from this hash path. They are
    stored separately so the system can judge source freshness without letting a
    date-only update trigger an LLM diff.
    """
    text = remove_last_updated_lines(clean_text)
    text = text.lower()
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\b\d{1,2}:\d{2}\s*(am|pm)?\b", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    if len(text) > MAX_NORMALIZED_CHARS:
        text = text[:MAX_NORMALIZED_CHARS]
    return text


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def clean_content(raw_html_or_text: str) -> CleanedContent:
    clean = clean_visible_text(raw_html_or_text)
    last_updated, raw_last_updated = extract_last_updated(clean)
    normalized = normalize_for_hash(clean)
    last_updated_hash_component = compute_hash(last_updated or "") if last_updated else None
    return CleanedContent(
        raw_text=extract_text_from_html(raw_html_or_text),
        clean_text=clean,
        normalized_text=normalized,
        clean_hash=compute_hash(normalized),
        char_count=len(clean),
        source_last_updated=last_updated,
        source_last_updated_raw=raw_last_updated,
        last_updated_hash_component=last_updated_hash_component,
    )


def is_useful_scrape(cleaned: CleanedContent, min_chars: int = MIN_USEFUL_CHARS) -> tuple[bool, str]:
    if cleaned.char_count < HARD_MIN_CHARS:
        return False, f"hard failure: only {cleaned.char_count} useful chars"
    if cleaned.char_count < min_chars:
        return False, f"soft failure: only {cleaned.char_count} useful chars; try fallback URL"
    if not cleaned.normalized_text:
        return False, "normalized content is empty"
    return True, "usable"


def _split_for_diff(text: str) -> list[str]:
    # Sentence-ish chunks diff more cleanly than one huge normalized line.
    text = re.sub(r"([.!?])\s+", r"\1\n", text)
    text = re.sub(r"\s*;\s*", ";\n", text)
    return [line.strip() for line in text.splitlines() if line.strip()]


def _keyword_hits(lines: Iterable[str]) -> list[str]:
    joined = "\n".join(lines).lower()
    hits = sorted({kw for kw in POLICY_KEYWORDS if kw in joined})
    return hits


def _only_boilerplate_or_last_updated(lines: Iterable[str]) -> bool:
    relevant = []
    for line in lines:
        clean = line.lstrip("+- ").strip()
        if not clean:
            continue
        if _line_is_boilerplate(clean):
            continue
        if any(pattern.search(clean) for pattern in LAST_UPDATED_PATTERNS):
            continue
        relevant.append(clean)
    return len(relevant) == 0


def build_changed_snippets(old_text: str, new_text: str, max_snippets: int = MAX_CHANGED_SNIPPETS) -> list[str]:
    old_lines = _split_for_diff(remove_last_updated_lines(old_text))
    new_lines = _split_for_diff(remove_last_updated_lines(new_text))
    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
    snippets: list[str] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        old_context_start = max(0, i1 - SNIPPET_CONTEXT_LINES)
        old_context_end = min(len(old_lines), i2 + SNIPPET_CONTEXT_LINES)
        new_context_start = max(0, j1 - SNIPPET_CONTEXT_LINES)
        new_context_end = min(len(new_lines), j2 + SNIPPET_CONTEXT_LINES)
        old_block = "\n".join(old_lines[old_context_start:old_context_end])
        new_block = "\n".join(new_lines[new_context_start:new_context_end])
        snippet = f"OLD:\n{old_block}\n\nNEW:\n{new_block}".strip()
        if snippet and snippet not in snippets:
            snippets.append(snippet[:2500])
        if len(snippets) >= max_snippets:
            break
    return snippets


def changed_lines(old_text: str, new_text: str, limit: int = 80) -> list[str]:
    old_lines = _split_for_diff(old_text)
    new_lines = _split_for_diff(new_text)
    diff = difflib.unified_diff(old_lines, new_lines, lineterm="", n=0)
    out: list[str] = []
    for line in diff:
        if line.startswith(("---", "+++", "@@")):
            continue
        if line.startswith(("+", "-")):
            out.append(line[:500])
        if len(out) >= limit:
            break
    return out


def evaluate_change(
    previous_clean_text: str | None,
    previous_hash: str | None,
    previous_last_updated_component: str | None,
    new_cleaned: CleanedContent,
) -> ChangeGateDecision:
    """Decide whether a scraped source should go to Groq."""
    if not previous_clean_text or not previous_hash:
        return ChangeGateDecision(
            status="baseline_missing",
            should_call_llm=False,
            reason="No previous source snapshot exists yet; save baseline before future diffs.",
            old_hash=previous_hash,
            new_hash=new_cleaned.clean_hash,
            source_last_updated=new_cleaned.source_last_updated,
            source_last_updated_raw=new_cleaned.source_last_updated_raw,
            last_updated_changed=False,
            confidence="medium",
        )

    last_updated_changed = (
        previous_last_updated_component is not None
        and new_cleaned.last_updated_hash_component is not None
        and previous_last_updated_component != new_cleaned.last_updated_hash_component
    )

    if previous_hash == new_cleaned.clean_hash:
        return ChangeGateDecision(
            status="unchanged",
            should_call_llm=False,
            reason="Normalized meaningful content hash unchanged.",
            old_hash=previous_hash,
            new_hash=new_cleaned.clean_hash,
            source_last_updated=new_cleaned.source_last_updated,
            source_last_updated_raw=new_cleaned.source_last_updated_raw,
            last_updated_changed=last_updated_changed,
            confidence="high",
        )

    lines = changed_lines(previous_clean_text, new_cleaned.clean_text)
    snippets = build_changed_snippets(previous_clean_text, new_cleaned.clean_text)

    if _only_boilerplate_or_last_updated(lines):
        return ChangeGateDecision(
            status="metadata_or_boilerplate_only",
            should_call_llm=False,
            reason="Only last-updated/boilerplate lines changed; source freshness metadata was preserved.",
            old_hash=previous_hash,
            new_hash=new_cleaned.clean_hash,
            changed_lines=lines,
            changed_snippets=snippets,
            source_last_updated=new_cleaned.source_last_updated,
            source_last_updated_raw=new_cleaned.source_last_updated_raw,
            last_updated_changed=last_updated_changed,
            confidence="high",
        )

    hits = _keyword_hits(lines + snippets)
    if not hits:
        return ChangeGateDecision(
            status="changed_non_policy",
            should_call_llm=False,
            reason="Content changed, but local diff did not contain policy-like keywords.",
            old_hash=previous_hash,
            new_hash=new_cleaned.clean_hash,
            changed_lines=lines,
            changed_snippets=snippets,
            policy_keyword_hits=[],
            source_last_updated=new_cleaned.source_last_updated,
            source_last_updated_raw=new_cleaned.source_last_updated_raw,
            last_updated_changed=last_updated_changed,
            confidence="medium",
        )

    return ChangeGateDecision(
        status="meaningful_candidate",
        should_call_llm=True,
        reason="Normalized content changed and local diff contains policy-like terms.",
        old_hash=previous_hash,
        new_hash=new_cleaned.clean_hash,
        changed_lines=lines,
        changed_snippets=snippets,
        policy_keyword_hits=hits,
        source_last_updated=new_cleaned.source_last_updated,
        source_last_updated_raw=new_cleaned.source_last_updated_raw,
        last_updated_changed=last_updated_changed,
        confidence="medium",
    )
