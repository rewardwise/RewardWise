"""
zoe/session.py
──────────────
Redis session schema, load/save helpers.

ARCHITECTURE CHANGE (v2):
  TripState and slot-filling state are REMOVED.
  Zoe no longer collects form fields — the search form handles that directly.
  Session now only tracks conversation history and voice mode.

Session key format: zoe:session:{user_id}:conv:{conversation_id}
TTL: 2 hours (rolling — refreshed on every write)

State structure:
  history          — last 20 conversation turns as [{role, content}]
  conversation_mode — "standard" | "voice"
"""

from __future__ import annotations

import json
import os
from typing import Literal

from pydantic import BaseModel, Field


# ── Redis client (lazy import) ────────────────────────────────────────────────

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    url = os.getenv("REDIS_URL")
    if not url:
        return None

    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(url, decode_responses=True)
        return _redis_client
    except ImportError:
        print("⚠️ Redis not installed — using in-memory Zoe session store")
        return None
    except Exception as exc:
        print(f"⚠️ Redis init error — using in-memory: {exc}")
        return None


# ── In-memory fallback ────────────────────────────────────────────────────────

_memory_store: dict[str, str] = {}

SESSION_TTL_SECONDS = 60 * 60 * 2  # 2 hours rolling


# ── Session model ─────────────────────────────────────────────────────────────

class ZoeSession(BaseModel):
    """
    Zoe's full session state.

    history         — conversation turns, capped at MAX_HISTORY
    conversation_mode — "standard" | "voice"
    """

    history: list[dict] = Field(default_factory=list)
    conversation_mode: Literal["standard", "voice"] = "standard"

    MAX_HISTORY: int = 20

    def add_turn(self, role: str, content: str) -> None:
        self.history.append({"role": role, "content": content})
        if len(self.history) > self.MAX_HISTORY:
            self.history = self.history[-self.MAX_HISTORY:]


# ── Serialize / Deserialize ───────────────────────────────────────────────────

def _serialize(session: ZoeSession) -> str:
    return session.model_dump_json()


def _deserialize(raw: str) -> ZoeSession:
    try:
        data = json.loads(raw)
        return ZoeSession(**data)
    except Exception:
        return ZoeSession()


# ── Load / Save ───────────────────────────────────────────────────────────────

async def load(session_id: str) -> ZoeSession:
    key = f"zoe:session:{session_id}"
    r = _get_redis()

    try:
        if r:
            raw = await r.get(key)
        else:
            raw = _memory_store.get(key)

        if raw:
            return _deserialize(raw)
    except Exception as exc:
        print(f"⚠️ Session load error: {exc}")

    return ZoeSession()


async def save(session_id: str, session: ZoeSession) -> None:
    key = f"zoe:session:{session_id}"
    raw = _serialize(session)
    r = _get_redis()

    try:
        if r:
            await r.set(key, raw, ex=SESSION_TTL_SECONDS)
        else:
            _memory_store[key] = raw
    except Exception as exc:
        print(f"⚠️ Session save error: {exc}")


async def delete(session_id: str) -> None:
    key = f"zoe:session:{session_id}"
    r = _get_redis()
    try:
        if r:
            await r.delete(key)
        else:
            _memory_store.pop(key, None)
    except Exception as exc:
        print(f"⚠️ Session delete error: {exc}")
