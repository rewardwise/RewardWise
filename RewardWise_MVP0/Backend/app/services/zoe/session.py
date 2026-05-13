"""
zoe/session.py
──────────────
Redis session schema, load/save helpers, and the TripState Pydantic model.

Session key format: zoe:session:{user_id_or_anon_id}
TTL: 2 hours (rolling — refreshed on every write)

State structure:
  trip_state   — the fields Zoe is collecting (origin, dest, dates, etc.)
  stage        — where we are in the conversation lifecycle
  last_asked   — which slot Zoe asked about most recently (prevents re-asking)
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
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            url = os.getenv("REDIS_URL", "redis://localhost:6379")
            _redis_client = aioredis.from_url(url, decode_responses=True)
        except ImportError:
            pass  # Redis not available — fall back to in-memory
    return _redis_client


# ── In-memory fallback (dev/test environments without Redis) ──────────────────

_memory_store: dict[str, str] = {}


# ── Session TTL ───────────────────────────────────────────────────────────────

SESSION_TTL_SECONDS = 60 * 60 * 2  # 2 hours, rolling


# ── Data models ───────────────────────────────────────────────────────────────

class TripState(BaseModel):
    """The fields Zoe is collecting for a flight search."""

    origin: Optional[str] = None          # IATA code or city name, as user said
    destination: Optional[str] = None     # IATA code or city name, as user said
    depart_date: Optional[str] = None     # ISO 8601: YYYY-MM-DD
    return_date: Optional[str] = None     # ISO 8601: YYYY-MM-DD
    trip_type: Optional[Literal["oneway", "roundtrip"]] = None
    cabin: Optional[str] = "economy"
    travelers: Optional[int] = 1

    def missing_required(self) -> list[str]:
        """Return required fields that are not yet confirmed, in priority order."""
        required = []
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
        return required

    def is_complete(self) -> bool:
        """True when all required fields are confirmed and search can be triggered."""
        return len(self.missing_required()) == 0

    def to_prefill(self) -> dict | None:
        """
        Return a prefill dict for the frontend search form.
        Returns None if any required field is missing.
        """
        if not self.is_complete():
            return None
        return {
            "origin": self.origin,
            "destination": self.destination,
            "date": self.depart_date,
            "return_date": self.return_date,
            "travelers": self.travelers or 1,
            "cabin": self.cabin or "economy",
            "tripType": self.trip_type or "oneway",
        }

    def merge(self, entities: dict) -> "TripState":
        """
        Return a new TripState with `entities` merged in.
        Only overwrites a field if the new value is non-null/non-empty.
        Never clears a field that was already set.
        """
        data = self.model_dump()
        field_map = {
            "origin": "origin",
            "destination": "destination",
            "depart_date": "depart_date",
            "date": "depart_date",          # alias
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
    "collecting",           # gathering required trip fields
    "searching",            # all fields collected, search in progress
    "explaining_verdict",   # verdict returned, Zoe is explaining
    "off_trip",             # handling non-trip intent (destination, wallet, etc.)
    "reset",                # user wants to start fresh
]


class ZoeSession(BaseModel):
    """Full session state stored in Redis."""

    user_id: Optional[str] = None
    trip_state: TripState = Field(default_factory=TripState)
    stage: Stage = "collecting"
    last_asked: Optional[str] = None       # slot name Zoe most recently asked about
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
    Load session from Redis (or memory fallback).
    Returns a fresh ZoeSession if no session exists.
    """
    key = _session_key(session_id)
    raw: str | None = None

    redis = _get_redis()
    if redis:
        try:
            raw = await redis.get(key)
        except Exception as exc:
            print(f"⚠️ Redis read error ({key}):", exc)
    else:
        raw = _memory_store.get(key)

    if not raw:
        session = ZoeSession(user_id=session_id)
        return session

    try:
        data = json.loads(raw)
        return ZoeSession(**data)
    except Exception as exc:
        print(f"⚠️ Session parse error ({key}):", exc)
        return ZoeSession(user_id=session_id)


async def save(session_id: str, session: ZoeSession) -> None:
    """
    Save session to Redis (or memory fallback) with rolling TTL.
    """
    key = _session_key(session_id)
    raw = session.model_dump_json()

    redis = _get_redis()
    if redis:
        try:
            await redis.setex(key, SESSION_TTL_SECONDS, raw)
        except Exception as exc:
            print(f"⚠️ Redis write error ({key}):", exc)
    else:
        _memory_store[key] = raw


async def delete(session_id: str) -> None:
    """Delete a session (used on reset)."""
    key = _session_key(session_id)
    redis = _get_redis()
    if redis:
        try:
            await redis.delete(key)
        except Exception as exc:
            print(f"⚠️ Redis delete error ({key}):", exc)
    else:
        _memory_store.pop(key, None)
