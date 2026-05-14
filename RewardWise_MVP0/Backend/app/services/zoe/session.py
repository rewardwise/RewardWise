"""
zoe/session.py
──────────────
Redis session schema, load/save helpers, and the TripState Pydantic model.

Session key format: zoe:session:{user_id_or_anon_id}
TTL: 2 hours (rolling — refreshed on every write)

State structure:
  trip_state   — the fields Zoe is collecting (origin, dest, dates, etc.)
  stage        — where we are in the conversation lifecycle
  last_asked   — which slot Zoe asked about most recently
  history      — last 12 conversation turns as [{role, content}]
  conversation_mode — "standard" | "voice"
"""

from __future__ import annotations

import json
import os
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Redis client (lazy import — Redis may not be available in all envs) ───────

_redis_client = None


def _get_redis():
    """
    Return Redis client only when REDIS_URL is explicitly configured.

    Important:
    - Local dev should NOT try redis://localhost:6379 unless you actually set REDIS_URL.
    - If Redis is unavailable, Zoe falls back to the in-memory store.
    """
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
        print("⚠️ Redis package not installed — using in-memory Zoe session store")
        return None
    except Exception as exc:
        print(f"⚠️ Redis init error — using in-memory Zoe session store: {exc}")
        return None


# ── In-memory fallback (dev/test environments without Redis) ──────────────────

_memory_store: dict[str, str] = {}


# ── Session TTL ───────────────────────────────────────────────────────────────

SESSION_TTL_SECONDS = 60 * 60 * 2  # 2 hours, rolling


# ── Data models ───────────────────────────────────────────────────────────────

class TripState(BaseModel):
    """The fields Zoe is collecting for a flight search."""

    origin: Optional[str] = None
    destination: Optional[str] = None
    depart_date: Optional[str] = None
    return_date: Optional[str] = None
    trip_type: Optional[Literal["oneway", "roundtrip"]] = None
    cabin: Optional[str] = None
    travelers: Optional[int] = None

    def missing_required(self) -> list[str]:
        """Return required fields that are not yet confirmed, in priority order."""
        required: list[str] = []

        if not self.origin:
            required.append("origin")
        if not self.destination:
            required.append("destination")
        if not self.depart_date:
            required.append("depart_date")
        if not self.trip_type:
            required.append("trip_type")
        if self.trip_type == "roundtrip" and not self.return_date:
            required.append("return_date")
        if not self.travelers:
            required.append("travelers")
        if not self.cabin:
            required.append("cabin")

        return required

    def is_complete(self) -> bool:
        """True when all required fields are confirmed and search can be triggered."""
        return len(self.missing_required()) == 0

    def to_prefill(self) -> dict | None:
        """Return frontend prefill only when the full required search state exists."""
        if not self.is_complete():
            return None

        return {
            "origin": self.origin,
            "destination": self.destination,
            "date": self.depart_date,
            "return_date": self.return_date,
            "travelers": self.travelers,
            "cabin": self.cabin,
            "tripType": self.trip_type,
        }

    def merge(self, entities: dict) -> "TripState":
        """
        Return a new TripState with `entities` merged in.

        Only overwrites a field if the new value is non-null/non-empty.
        This preserves session memory across turns.
        """
        data = self.model_dump()

        field_map = {
            "origin": "origin",
            "destination": "destination",
            "depart_date": "depart_date",
            "date": "depart_date",
            "return_date": "return_date",
            "trip_type": "trip_type",
            "cabin": "cabin",
            "travelers": "travelers",
        }

        for key, model_key in field_map.items():
            val = entities.get(key)
            if val is not None and val != "null" and val != "":
                data[model_key] = val

        return TripState(**data)


Stage = Literal[
    "collecting",
    "searching",
    "explaining_verdict",
    "off_trip",
    "reset",
]


class ZoeSession(BaseModel):
    """Full session state stored in Redis or memory fallback."""

    user_id: Optional[str] = None
    trip_state: TripState = Field(default_factory=TripState)
    stage: Stage = "collecting"
    last_asked: Optional[str] = None
    history: list[dict] = Field(default_factory=list)
    conversation_mode: Literal["standard", "voice"] = "standard"

    def add_turn(self, role: str, content: str) -> None:
        """Append a turn and trim to the last 12 turns."""
        self.history.append({"role": role, "content": content})
        if len(self.history) > 12:
            self.history = self.history[-12:]

    def reset_trip(self) -> None:
        """Reset trip state and stage but keep history."""
        self.trip_state = TripState()
        self.stage = "collecting"
        self.last_asked = None


# ── Key helpers ───────────────────────────────────────────────────────────────

def _session_key(session_id: str) -> str:
    return f"zoe:session:{session_id}"


# ── Load / Save ───────────────────────────────────────────────────────────────

async def load(session_id: str) -> ZoeSession:
    """
    Load session from Redis or memory fallback.

    If Redis exists but fails, fall back to memory instead of losing the session.
    """
    key = _session_key(session_id)
    raw: str | None = None

    redis = _get_redis()

    if redis:
        try:
            raw = await redis.get(key)
        except Exception as exc:
            print(f"⚠️ Redis read error ({key}) — falling back to memory: {exc}")
            raw = _memory_store.get(key)
    else:
        raw = _memory_store.get(key)

    if not raw:
        return ZoeSession(user_id=session_id)

    try:
        data = json.loads(raw)
        return ZoeSession(**data)
    except Exception as exc:
        print(f"⚠️ Session parse error ({key}) — starting fresh: {exc}")
        return ZoeSession(user_id=session_id)


async def save(session_id: str, session: ZoeSession) -> None:
    """
    Save session to Redis or memory fallback.

    If Redis exists but fails, save to memory so local/dev sessions still persist
    across turns during the current server process.
    """
    key = _session_key(session_id)
    raw = session.model_dump_json()

    redis = _get_redis()

    if redis:
        try:
            await redis.setex(key, SESSION_TTL_SECONDS, raw)
            return
        except Exception as exc:
            print(f"⚠️ Redis write error ({key}) — saving to memory: {exc}")

    _memory_store[key] = raw


async def delete(session_id: str) -> None:
    """Delete a session from Redis or memory fallback."""
    key = _session_key(session_id)

    redis = _get_redis()

    if redis:
        try:
            await redis.delete(key)
        except Exception as exc:
            print(f"⚠️ Redis delete error ({key}) — deleting memory fallback: {exc}")

    _memory_store.pop(key, None)