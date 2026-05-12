"""
app/services/zoe_service.py
────────────────────────────
Main Zoe entry point. Replaces the old monolithic handler with an
intent-routing architecture:

  1. Classify the message  →  router.classify()
  2. Load supporting context (wallet, verdict)
  3. Dispatch to the correct handler
  4. Return a unified response shape

Response shape (unchanged — frontend compatibility preserved):
  {
    "type": "followup",
    "message": str,
    "prefill": dict | None,
    "intent": str,          ← new, useful for analytics/debugging
  }
"""

from __future__ import annotations

import json
from typing import Any, Dict

from app.db.client import get_db_client
from app.services.zoe.router import classify

from app.services.zoe.handlers import (
    trip_search,
    verdict_strategy,
    destination,
    wallet_support,
    off_topic,
)


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _fetch_user_context(user_id: str) -> list[dict]:
    """Return the user's wallet as a list of {program, points} dicts."""
    try:
        db = get_db_client()
        rows = (
            db.table("wallet_programs")
            .select("program_name, points_balance")
            .eq("user_id", user_id)
            .execute()
        )
        return [
            {"program": r["program_name"], "points": r.get("points_balance", 0)}
            for r in (rows.data or [])
        ]
    except Exception as exc:
        print("⚠️ Zoe wallet fetch error:", exc)
        return []


# ── Main handler ──────────────────────────────────────────────────────────────

async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    """
    Entry point called by /api/zoe (text) and /api/zoe/voice.

    Payload keys:
      message         str   – the user's message
      history         list  – recent conversation turns [{role, content}]
      conversation_id str   – DB conversation ID (optional)
      user_id         str   – for wallet lookup (optional)
      wallet          list  – pre-loaded wallet from frontend (optional)
      verdict_context str   – stringified verdict injected when user clicks "Ask Zoe"
      is_voice        bool  – true when coming from the voice endpoint
    """
    text = (payload.get("message") or "").strip()
    history: list[dict] = payload.get("history") or []
    user_id: str | None = payload.get("user_id")
    verdict_context: str | None = payload.get("verdict_context") or None
    is_voice: bool = bool(payload.get("is_voice", False))

    # Pre-loaded wallet from the frontend (sent by ZoeChat)
    frontend_wallet: list[dict] = payload.get("wallet") or []

    # ── Guard: empty message ──────────────────────────────────────────────────
    if not text:
        return _reply("Hey! What's on your travel radar?", intent="trip_search")

    # ── Guard: greeting ───────────────────────────────────────────────────────
    if text.lower().strip() in ("start", "hi", "hello", "hey", "hey zoe"):
        return _reply(
            "Hey, I'm Zoe! I can help you plan a trip, figure out whether your points are worth using, "
            "or just answer travel questions. What's on your mind?",
            intent="trip_search",
        )

    # ── 1. Load wallet ────────────────────────────────────────────────────────
    # Frontend sends wallet for speed; fall back to DB fetch if empty
    wallet = frontend_wallet
    if not wallet and user_id:
        wallet = await _fetch_user_context(user_id)

    # ── 2. Classify intent ────────────────────────────────────────────────────
    route = classify(
        text,
        has_verdict_context=bool(verdict_context),
        is_voice=is_voice,
    )

    print(f"🧭 ZOE ROUTER: intent={route.intent} voice={is_voice} verdict={route.needs_verdict}")

    # ── 3. Dispatch ───────────────────────────────────────────────────────────
    result: dict[str, Any] = {}

    if route.intent == "trip_search":
        result = await trip_search.handle(
            text,
            history,
            wallet if route.needs_wallet else [],
            is_voice=is_voice,
        )

    elif route.intent == "verdict_strategy":
        result = await verdict_strategy.handle(
            text,
            history,
            wallet if route.needs_wallet else [],
            verdict_context=verdict_context if route.needs_verdict else None,
            is_voice=is_voice,
        )

    elif route.intent == "destination":
        result = await destination.handle(
            text,
            history,
            wallet if route.needs_wallet else [],
            is_voice=is_voice,
        )

    elif route.intent == "wallet_support":
        result = await wallet_support.handle(
            text,
            history,
            wallet if route.needs_wallet else [],
            is_voice=is_voice,
        )

    elif route.intent == "off_topic":
        result = await off_topic.handle(text, is_voice=is_voice)

    else:
        # Should never happen but safe fallback
        result = await trip_search.handle(text, history, wallet, is_voice=is_voice)

    # ── 4. Normalise + return ─────────────────────────────────────────────────
    message = result.get("message") or "Give me a second — something went wrong on my end."
    prefill = result.get("prefill") or None

    # Validate prefill has minimum required fields
    if prefill and not (prefill.get("origin") and prefill.get("destination")):
        prefill = None

    return _reply(message, prefill=prefill, intent=route.intent)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reply(
    message: str,
    *,
    prefill: dict | None = None,
    intent: str = "trip_search",
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "type": "followup",
        "message": message,
        "intent": intent,
    }
    if prefill:
        response["prefill"] = prefill
    return response
