"""
app/services/zoe_service.py
────────────────────────────
Main Zoe entry point — simplified pipeline (v2).

ARCHITECTURE CHANGE (v2):
  Slot machine and form-filling logic REMOVED.
  Zoe is now a travel intelligence layer, not a form assistant.

Steps every request takes:
  1. Load session from Redis
  2. Classify intent via router (regex, no LLM call needed for routing)
  3. Fetch wallet from DB
  4. RAG retrieval — 3-layer, all intents
  5. Dispatch to handler with full context packet
  6. Save session + log interaction

Response shape (frontend-compatible):
  {
    "type":           "followup",
    "message":        str,
    "intent":         str,
    "interaction_id": str | None,
  }

Key invariants:
  - Zoe NEVER returns prefill — the search form is autonomous
  - Every factual claim is grounded via grounding.py + RAG
  - verdict_context injected on "Ask Zoe" button click
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.db.client import get_db_client
from app.services.zoe import session as session_store
from app.services.zoe.router import classify
from app.services.rag_service import retrieve_for_intent
from app.services.zoe.interaction_logger import log as log_interaction
from app.services.zoe.handlers import (
    trip_search,
    verdict_strategy,
    alt_dates,
    destination,
    wallet_support,
    off_topic,
    small_talk,
)


# ── Wallet fetcher ────────────────────────────────────────────────────────────

async def _fetch_wallet(user_id: str) -> list[dict]:
    """Fetch user wallet: cards → reward_programs join."""
    try:
        db = get_db_client()
        result = (
            db.table("cards")
            .select("points_balance, card_name, reward_programs(name, code, currency_type)")
            .eq("user_id", user_id)
            .execute()
        )
        wallet = []
        for r in (result.data or []):
            rp = r.get("reward_programs") or {}
            wallet.append({
                "program":       rp.get("name") or r.get("card_name") or "Unknown",
                "program_code":  rp.get("code"),
                "currency_type": rp.get("currency_type"),
                "points":        r.get("points_balance") or 0,
            })
        return wallet
    except Exception as exc:
        print("⚠️ Zoe wallet fetch error:", exc)
        return []


# ── Session ID ────────────────────────────────────────────────────────────────

def _session_id(payload: Dict[str, Any]) -> str:
    user_id = payload.get("user_id")
    if not user_id:
        raise ValueError("Zoe requires an authenticated user")
    conv_id = payload.get("conversation_id")
    if conv_id:
        return f"user:{user_id}:conv:{conv_id}"
    return f"user:{user_id}"


# ── Response helper ───────────────────────────────────────────────────────────

def _reply(
    message: str,
    *,
    intent: str = "trip_search",
    interaction_id: str | None = None,
) -> dict[str, Any]:
    r: dict[str, Any] = {
        "type":    "followup",
        "message": message,
        "intent":  intent,
    }
    if interaction_id:
        r["interaction_id"] = interaction_id
    return r


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    """
    Entry point for /api/zoe (text) and /api/zoe/voice.

    Payload keys:
      message         str   — user's message
      history         list  — frontend history (bootstraps fresh sessions)
      conversation_id str   — used as part of Redis session key
      user_id         str   — for wallet lookup + logging
      verdict_context str   — injected when user clicks "Ask Zoe" on a result
      is_voice        bool  — true for voice endpoint
    """

    # ── Unpack ────────────────────────────────────────────────────────────────
    text:            str          = (payload.get("message") or "").strip()
    user_id:         Optional[str] = payload.get("user_id")
    verdict_context: Optional[str] = payload.get("verdict_context") or None
    is_voice:        bool          = bool(payload.get("is_voice", False))
    frontend_history: list[dict]  = payload.get("history") or []
    conversation_id: Optional[str] = payload.get("conversation_id")

    if not user_id:
        return _reply("Please sign in to use Zoe.", intent="auth_required")

    if not text:
        return _reply(
            "Hey! Ask me anything about flights, routes, or how to use your points.",
            intent="trip_search",
        )

    # ── Small talk fast path (before session load) ────────────────────────────
    if small_talk.is_small_talk(text):
        result = await small_talk.handle(text, frontend_history, is_voice=is_voice)
        return _reply(result["message"], intent="small_talk")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Load session
    # ─────────────────────────────────────────────────────────────────────────
    sess_id = _session_id(payload)
    session = await session_store.load(sess_id)

    # Bootstrap history from frontend if session is fresh
    if not session.history and frontend_history:
        for turn in frontend_history[-20:]:
            role    = turn.get("role", "")
            content = str(turn.get("content", "")).strip()
            if role in ("user", "assistant") and content:
                session.history.append({"role": role, "content": content})

    if is_voice:
        session.conversation_mode = "voice"

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Classify intent (regex router — no LLM call needed)
    # ─────────────────────────────────────────────────────────────────────────

    # When verdict_context is present, the user clicked "Ask Zoe" on a
    # search result. Run the router with has_verdict_context=True so the
    # alt_dates intent can preempt verdict_strategy on phrases like
    # "any cheaper dates around this?" — otherwise it still falls through
    # to verdict_strategy as the default for the Ask-Zoe flow.
    route_result = classify(
        text,
        has_verdict_context=bool(verdict_context),
        is_voice=is_voice,
    )
    intent = route_result.intent
    if verdict_context and intent not in ("alt_dates", "verdict_strategy", "off_topic"):
        intent = "verdict_strategy"

    print(f"🧭 ZOE INTENT: {intent}")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Fetch wallet
    # ─────────────────────────────────────────────────────────────────────────
    wallet = await _fetch_wallet(user_id)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: RAG retrieval — all intents
    # ─────────────────────────────────────────────────────────────────────────
    rag = await retrieve_for_intent(intent, text, top_k=4)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: Dispatch to handler
    # ─────────────────────────────────────────────────────────────────────────
    result: dict[str, Any] = {}

    if intent == "verdict_strategy":
        result = await verdict_strategy.handle(
            text,
            session.history,
            wallet,
            verdict_context=verdict_context,
            rag_chunks=rag.kb_chunks,
            rag_examples=rag.examples,
            rag_corrections=rag.corrections,
            is_voice=is_voice,
        )

    elif intent == "alt_dates":
        result = await alt_dates.handle(
            text,
            session.history,
            wallet,
            verdict_context=verdict_context,
            rag_chunks=rag.kb_chunks,
            rag_examples=rag.examples,
            rag_corrections=rag.corrections,
            is_voice=is_voice,
        )

    elif intent in ("destination", "exploring"):
        result = await destination.handle(
            text,
            session.history,
            wallet,
            rag_chunks=rag.kb_chunks,
            rag_examples=rag.examples,
            rag_corrections=rag.corrections,
            is_voice=is_voice,
        )

    elif intent == "wallet_support":
        result = await wallet_support.handle(
            text,
            session.history,
            wallet,
            rag_chunks=rag.kb_chunks,
            rag_examples=rag.examples,
            rag_corrections=rag.corrections,
            is_voice=is_voice,
        )

    elif intent == "off_topic":
        result = await off_topic.handle(text, session.history, is_voice=is_voice)

    else:
        # trip_search (default) — travel intelligence
        result = await trip_search.handle(
            text,
            session.history,
            wallet,
            verdict_context=verdict_context,
            rag_chunks=rag.kb_chunks,
            rag_examples=rag.examples,
            rag_corrections=rag.corrections,
            is_voice=is_voice,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 6: Finalize, save session, log
    # ─────────────────────────────────────────────────────────────────────────
    message_text: str = result.get("message") or "Something went wrong — give me a second."

    # Append to session history
    session.add_turn("user", text)
    session.add_turn("assistant", message_text)

    # Save session (non-blocking failure)
    await session_store.save(sess_id, session)

    # Log interaction
    interaction_id = await log_interaction(
        sess_id,
        user_id,
        intent,
        text,
        message_text,
        conversation_id=conversation_id,
        is_voice=is_voice,
        feedback_signal=None,
    )

    return _reply(message_text, intent=intent, interaction_id=interaction_id)
