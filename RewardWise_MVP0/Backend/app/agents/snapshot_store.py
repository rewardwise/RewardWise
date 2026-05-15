"""
agents/snapshot_store.py
────────────────────────
Small local JSON snapshot store for KB monitor source checks.

MVP purpose:
  - Keep the previous cleaned source text/hash for local change detection.
  - Preserve source freshness metadata such as "last updated" lines.
  - Avoid Groq calls when a source has not meaningfully changed.

This can later be swapped for Supabase without changing monitor_agent's core flow.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_SNAPSHOT_PATH = Path(os.getenv("MONITOR_SNAPSHOT_PATH", "app/agents/.monitor_snapshots.json"))
DEFAULT_CANDIDATE_PATH = Path(os.getenv("MONITOR_CANDIDATE_PATH", "app/agents/.monitor_candidates.jsonl"))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


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
            url=str(data.get("url", "")),
            clean_hash=str(data.get("clean_hash", "")),
            clean_text=str(data.get("clean_text", "")),
            normalized_text=str(data.get("normalized_text", "")),
            content_chars=int(data.get("content_chars", 0) or 0),
            source_last_updated=data.get("source_last_updated"),
            source_last_updated_raw=data.get("source_last_updated_raw"),
            last_updated_hash_component=data.get("last_updated_hash_component"),
            checked_at=str(data.get("checked_at", "")),
            status=str(data.get("status", "ok")),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class SnapshotStore:
    def __init__(self, path: Path | str = DEFAULT_SNAPSHOT_PATH) -> None:
        self.path = Path(path)
        self._data: dict[str, dict[str, Any]] = {}
        self.load()

    @staticmethod
    def key(article_id: str) -> str:
        return article_id

    def load(self) -> None:
        if not self.path.exists():
            self._data = {}
            return
        try:
            with self.path.open("r", encoding="utf-8") as f:
                loaded = json.load(f)
            self._data = loaded if isinstance(loaded, dict) else {}
        except Exception:
            # Corrupt snapshot file should not crash the monitor. Keep a backup.
            backup = self.path.with_suffix(self.path.suffix + ".corrupt")
            try:
                self.path.replace(backup)
            except Exception:
                pass
            self._data = {}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, sort_keys=True, ensure_ascii=False)
        tmp.replace(self.path)

    def get(self, article_id: str) -> SourceSnapshot | None:
        raw = self._data.get(self.key(article_id))
        return SourceSnapshot.from_dict(raw) if raw else None

    def put(self, snapshot: SourceSnapshot, *, save: bool = True) -> None:
        self._data[self.key(snapshot.article_id)] = snapshot.to_dict()
        if save:
            self.save()

    def all(self) -> list[SourceSnapshot]:
        return [SourceSnapshot.from_dict(v) for v in self._data.values()]


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


def append_candidate(candidate: dict[str, Any], path: Path | str = DEFAULT_CANDIDATE_PATH) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(candidate)
    payload.setdefault("created_at", utc_now_iso())
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")
