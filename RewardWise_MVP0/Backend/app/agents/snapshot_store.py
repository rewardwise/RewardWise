"""
agents/snapshot_store.py
────────────────────────
Supabase-backed snapshot store for KB monitor source checks.

Replaces the former local JSON file store.

Tables used:
  kb_monitor_snapshots   — one row per article_id (upserted on each check)
  kb_update_candidates   — append-only candidate rows when a change is detected

Field mapping (SourceSnapshot → kb_monitor_snapshots):
  article_id                → article_id           (upsert key)
  article_title             → article_title
  category                  → category
  url                       → source_url
  (derived from url)        → source_domain
  clean_hash                → content_hash
  clean_text                → clean_text
  source_last_updated_raw   → last_updated_text
  content_chars             → content_chars
  status                    → scrape_status
  checked_at                → checked_at

  normalized_text / source_last_updated / last_updated_hash_component
  are intermediate/derived values with no column — intentionally dropped.

Field mapping (candidate dict → kb_update_candidates):
  article_id                        → article_id
  article_title                     → article_title
  category                          → category
  source_url                        → source_url
  (derived)                         → source_domain
  gate["old_hash"]                  → old_content_hash
  gate["new_hash"] or clean_hash    → new_content_hash
  first changed_snippet OLD section → old_content_excerpt  (2 000 char cap)
  first changed_snippet NEW section → new_content_excerpt  (2 000 char cap)
  llm_result["change_summary"]      → change_summary
  llm_result["confidence"]          → confidence
  llm_result["new_content"]         → suggested_content
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


# ── helpers ───────────────────────────────────────────────────────────────────

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        return urlparse(url).netloc or None
    except Exception:
        return None


def _get_db():
    from app.db.client import get_db_client
    return get_db_client()


# ── SourceSnapshot dataclass (unchanged public API) ───────────────────────────

@dataclass(slots=True)
class SourceSnapshot:
    article_id: str
    article_title: str
    category: str
    url: str
    clean_hash: str
    clean_text: str
    normalized_text: str
    content_chars: int
    source_last_updated: str | None
    source_last_updated_raw: str | None
    last_updated_hash_component: str | None
    checked_at: str
    status: str = "ok"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SourceSnapshot":
        return cls(
            article_id=str(data.get("article_id", "")),
            article_title=str(data.get("article_title", "")),
            category=str(data.get("category", "")),
            url=str(data.get("url", data.get("source_url", ""))),
            clean_hash=str(data.get("clean_hash", data.get("content_hash", ""))),
            clean_text=str(data.get("clean_text", "")),
            normalized_text=str(data.get("normalized_text", "")),
            content_chars=int(data.get("content_chars", 0) or 0),
            source_last_updated=data.get("source_last_updated"),
            source_last_updated_raw=data.get(
                "source_last_updated_raw", data.get("last_updated_text")
            ),
            last_updated_hash_component=data.get("last_updated_hash_component"),
            checked_at=str(data.get("checked_at", utc_now_iso())),
            status=str(data.get("status", data.get("scrape_status", "ok"))),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_db_row(self) -> dict[str, Any]:
        """Map to kb_monitor_snapshots column names."""
        return {
            "article_id": self.article_id,
            "article_title": self.article_title or None,
            "category": self.category or None,
            "source_url": self.url,
            "source_domain": _domain(self.url),
            "content_hash": self.clean_hash,
            "clean_text": self.clean_text,
            "last_updated_text": self.source_last_updated_raw,
            "content_chars": self.content_chars or None,
            "scrape_status": self.status or "ok",
            "checked_at": self.checked_at,
        }


# ── SnapshotStore ─────────────────────────────────────────────────────────────

class SnapshotStore:
    """
    Supabase-backed store.  Reads/writes kb_monitor_snapshots.

    The old file-based store loaded everything into memory on __init__
    and flushed on put().  This implementation fetches lazily on get()
    and upserts immediately on put(), keeping the same public interface.

    load() and save() are retained for API compatibility but are no-ops
    because Supabase is the source of truth.
    """

    def __init__(self, path: Any = None) -> None:
        # `path` accepted but ignored — kept for call-site compatibility.
        pass

    # ── compatibility stubs ───────────────────────────────────────────────────

    def load(self) -> None:
        pass

    def save(self) -> None:
        pass

    @staticmethod
    def key(article_id: str) -> str:
        return article_id

    # ── core API ──────────────────────────────────────────────────────────────

    def get(self, article_id: str) -> SourceSnapshot | None:
        try:
            db = _get_db()
            result = (
                db.table("kb_monitor_snapshots")
                .select("*")
                .eq("article_id", article_id)
                .order("checked_at", desc=True)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if not rows:
                return None
            return SourceSnapshot.from_dict(rows[0])
        except Exception as exc:
            print(f"⚠️ SnapshotStore.get failed for {article_id!r}: {exc}")
            return None

    def put(self, snapshot: SourceSnapshot, *, save: bool = True) -> None:
        """Upsert snapshot into kb_monitor_snapshots (keyed on article_id)."""
        try:
            db = _get_db()
            row = snapshot.to_db_row()
            # Supabase upsert on article_id — update existing row if present.
            db.table("kb_monitor_snapshots").upsert(
                row,
                on_conflict="article_id",
            ).execute()
        except Exception as exc:
            print(f"⚠️ SnapshotStore.put failed for {snapshot.article_id!r}: {exc}")

    def all(self) -> list[SourceSnapshot]:
        try:
            db = _get_db()
            result = db.table("kb_monitor_snapshots").select("*").execute()
            return [SourceSnapshot.from_dict(r) for r in (result.data or [])]
        except Exception as exc:
            print(f"⚠️ SnapshotStore.all failed: {exc}")
            return []


# ── build_snapshot (unchanged public API) ─────────────────────────────────────

def build_snapshot(
    *,
    article_id: str,
    article_title: str,
    category: str,
    url: str,
    clean_hash: str,
    clean_text: str,
    normalized_text: str,
    content_chars: int,
    source_last_updated: str | None,
    source_last_updated_raw: str | None,
    last_updated_hash_component: str | None,
    status: str = "ok",
) -> SourceSnapshot:
    return SourceSnapshot(
        article_id=article_id,
        article_title=article_title,
        category=category,
        url=url,
        clean_hash=clean_hash,
        clean_text=clean_text,
        normalized_text=normalized_text,
        content_chars=content_chars,
        source_last_updated=source_last_updated,
        source_last_updated_raw=source_last_updated_raw,
        last_updated_hash_component=last_updated_hash_component,
        checked_at=utc_now_iso(),
        status=status,
    )


# ── append_candidate ──────────────────────────────────────────────────────────

_EXCERPT_LIMIT = 2_000  # chars stored per excerpt


def _extract_excerpts(
    changed_snippets: list[str],
) -> tuple[str | None, str | None]:
    """
    Pull the first OLD/NEW block out of gate.changed_snippets.
    Snippets look like:
        "OLD:\n<text>\n\nNEW:\n<text>"
    """
    if not changed_snippets:
        return None, None
    first = changed_snippets[0]
    old_excerpt = new_excerpt = None
    if "OLD:" in first and "NEW:" in first:
        parts = first.split("\n\nNEW:\n", 1)
        old_raw = parts[0].removeprefix("OLD:\n")
        old_excerpt = old_raw[:_EXCERPT_LIMIT] if old_raw else None
        new_excerpt = parts[1][:_EXCERPT_LIMIT] if len(parts) > 1 else None
    else:
        old_excerpt = first[:_EXCERPT_LIMIT]
    return old_excerpt, new_excerpt


def append_candidate(
    candidate: dict[str, Any],
    # path argument accepted but ignored — kept for call-site compatibility
    path: Any = None,
) -> None:
    """
    Insert a KB update candidate row into kb_update_candidates.

    candidate keys (from monitor_agent.py):
      article_id, article_title, category, source_url,
      clean_hash, gate (dict), llm_result (dict)
    """
    try:
        db = _get_db()
        gate: dict = candidate.get("gate") or {}
        llm: dict = candidate.get("llm_result") or {}

        # Extract old/new content excerpts from gate.changed_snippets
        snippets: list[str] = gate.get("changed_snippets") or []
        old_excerpt, new_excerpt = _extract_excerpts(snippets)

        # Normalise confidence to the DB check constraint values
        raw_confidence = str(llm.get("confidence") or "low").lower()
        confidence = raw_confidence if raw_confidence in {"low", "medium", "high"} else "low"

        row = {
            "article_id": candidate.get("article_id"),
            "article_title": candidate.get("article_title"),
            "category": candidate.get("category"),
            "source_url": candidate.get("source_url"),
            "source_domain": _domain(candidate.get("source_url")),
            "old_content_hash": gate.get("old_hash"),
            "new_content_hash": gate.get("new_hash") or candidate.get("clean_hash"),
            "old_content_excerpt": old_excerpt,
            "new_content_excerpt": new_excerpt,
            "change_summary": llm.get("change_summary") or "",
            "confidence": confidence,
            "suggested_content": llm.get("new_content"),
            "status": "pending",
        }

        db.table("kb_update_candidates").insert(row).execute()

    except Exception as exc:
        print(f"⚠️ append_candidate failed (non-fatal): {exc}")
