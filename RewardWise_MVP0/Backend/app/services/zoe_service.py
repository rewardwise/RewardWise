"""
app/services/zoe_service.py
────────────────────────────
Main Zoe entry point — the 8-step production pipeline, all phases active.

Steps every request takes, in order:
  1. Load session state from Redis
  2. Parse call — extract intent + entities (JSON-mode, temp=0, no history needed)
  3. Merge entities + run slot machine (pure Python — LLM never decides what to ask)
  4. Load wallet from DB (correct join: cards → reward_programs)
  5. RAG retrieval — 3-layer (KB chunks, corpus examples, PM corrections)
  6. Dispatch to handler with full context packet
  7. Respond call — multi-turn with real message history (call_llm_with_history)
  8. Save session to Redis + log interaction to DB

Response shape (frontend-compatible):
  {
    "type":    "followup",
    "message": str,
    "prefill": dict | None,
    "intent":  str,
  }

Key invariants:
  - Zoe never invents field values — only confirmed user input reaches prefill
  - Prefill is dropped unless origin + destination + date are all present
  - The slot machine picks what to ask — never the LLM
  - Every factual claim is grounded via grounding.py
  - wallet fetched from cards → reward_programs join (real schema)
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.db.client import get_db_client
from app.services.zoe import session as session_store
from app.services.zoe.parse_call import parse as parse_intent
from app.services.zoe.slot_machine import run as slot_machine_run
from app.services.zoe.rag.retriever import retrieve as rag_retrieve, should_retrieve
from app.services.zoe.interaction_logger import log as log_interaction
from app.services.zoe.handlers import (
    trip_search,
    verdict_strategy,
    destination,
    wallet_support,
    off_topic,
    small_talk,
)


# ── Wallet fetcher (uses correct schema: cards → reward_programs) ─────────────

async def _fetch_wallet(user_id: str) -> list[dict]:
    """
    Fetch user wallet from the database.
    Correct join: cards.reward_program_id → reward_programs.id
    (Not wallet_programs — that table doesn't exist.)
    """
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
                "program": rp.get("name") or r.get("card_name") or "Unknown",
                "program_code": rp.get("code"),
                "currency_type": rp.get("currency_type"),
                "points": r.get("points_balance") or 0,
            })
        return wallet
    except Exception as exc:
        print("⚠️ Zoe wallet fetch error:", exc)
        return []


# ── Session ID resolver ───────────────────────────────────────────────────────

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
    prefill: dict | None = None,
    intent: str = "trip",
    interaction_id: str | None = None,
) -> dict[str, Any]:
    r: dict[str, Any] = {"type": "followup", "message": message, "intent": intent}
    if prefill:
        r["prefill"] = prefill
    if interaction_id:
        r["interaction_id"] = interaction_id
    return r


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    """
    Entry point for /api/zoe (text) and /api/zoe/voice.

    Payload keys:
      message         str   – user's message
      history         list  – frontend history (session is authoritative; this bootstraps)
      conversation_id str   – DB conversation ID (used as Redis session key)
      user_id         str   – for wallet lookup + interaction logging
      wallet          list  – frontend wallet override (used if provided)
      verdict_context str   – stringified verdict when user clicks "Ask Zoe"
      is_voice        bool  – true for voice endpoint
      interaction_id  str   – if provided, used for feedback recording
    """

    # ── Unpack ────────────────────────────────────────────────────────────────
    text: str = (payload.get("message") or "").strip()
    user_id: Optional[str] = payload.get("user_id")
    if not user_id:
        return _reply("Please sign in to use Zoe.", intent="auth_required")
    verdict_context: Optional[str] = payload.get("verdict_context") or None
    is_voice: bool = bool(payload.get("is_voice", False))
    frontend_wallet: list[dict] = payload.get("wallet") or []
    frontend_history: list[dict] = payload.get("history") or []
    conversation_id: Optional[str] = payload.get("conversation_id")

    # ── Guard: empty ──────────────────────────────────────────────────────────
    if not text:
        return _reply("Hey! What trip are you thinking about?", intent="trip")

    # ── Guard: casual greeting / small talk only ──────────────────────────────
    # This intentionally runs before the full pipeline, but small_talk.is_small_talk()
    # excludes real trip/search/verdict requests like "hey I want to go to Vancouver".
    if small_talk.is_small_talk(text):
        result = await small_talk.handle(
            text,
            frontend_history,
            is_voice=is_voice,
        )
        return _reply(result["message"], intent="small_talk")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Load session state from Redis
    # ─────────────────────────────────────────────────────────────────────────
    sess_id = _session_id(payload)
    session = await session_store.load(sess_id)

    # Bootstrap history from frontend if session is fresh (Redis TTL expired)
    if not session.history and frontend_history:
        for turn in frontend_history[-12:]:
            role = turn.get("role", "")
            content = str(turn.get("content", "")).strip()
            if role in ("user", "assistant") and content:
                session.history.append({"role": role, "content": content})

    if is_voice:
        session.conversation_mode = "voice"

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Parse call — intent + entities (JSON-mode, temp=0, no history)
    # ─────────────────────────────────────────────────────────────────────────
    parse_result = await parse_intent(
        text,
        session.trip_state,
        has_verdict_context=bool(verdict_context),
    )
    intent: str = parse_result.get("intent", "trip")
    entities: dict = parse_result.get("entities", {})

    # If Zoe just asked for a specific slot, the next reply is part of trip collection.
    # This prevents the parse LLM from misrouting answers like:
    # "economy sounds good" -> verdict_strategy
    # "just me" -> off_topic/wallet/etc.
    # "MIA" -> destination
    if session.last_asked:
        if intent != "trip":
            print(f"🧭 ZOE INTENT OVERRIDE: {intent} → trip because last_asked={session.last_asked}")
        intent = "trip"

    print(f"🧭 ZOE PARSE: intent={intent} entities={list(k for k,v in entities.items() if v)}")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Slot machine — merge entities, decide next action (pure Python)
    # ─────────────────────────────────────────────────────────────────────────
    decision = slot_machine_run(
        session,
        intent,
        entities,
        user_message=text,
        is_voice=is_voice,
    )

    print("🧠 ZOE STATE:", decision.trip_state.model_dump())
    print("📝 ZOE NOTES:", decision.resolution_notes)
    print("❓ ZOE LAST_ASKED BEFORE UPDATE:", session.last_asked)
    print("🎰 ZOE SLOT:", decision.stage, decision.next_slot, decision.ready_to_search)

    session.trip_state = decision.trip_state
    session.stage = decision.stage
    if decision.next_slot:
        session.last_asked = decision.next_slot
    else:
        session.last_asked = None

    print(f"🎰 ZOE SLOT: stage={decision.stage} next={decision.next_slot} ready={decision.ready_to_search}")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: Load wallet (frontend payload or DB fetch)
    # ─────────────────────────────────────────────────────────────────────────
    wallet = await _fetch_wallet(user_id) if user_id else []

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: RAG retrieval — all 3 layers
    # ─────────────────────────────────────────────────────────────────────────
    rag_result: dict = {"kb_chunks": [], "examples": [], "corrections": []}
    if should_retrieve(intent):
        rag_result = await rag_retrieve(intent, text, top_k=3)

    kb_chunks: list[dict] = rag_result.get("kb_chunks", [])
    rag_examples: list[dict] = rag_result.get("examples", [])
    rag_corrections: list[dict] = rag_result.get("corrections", [])

    print(
    "📚 ZOE RAG:",
    intent,
    "kb=", len(kb_chunks),
    "examples=", len(rag_examples),
    "corrections=", len(rag_corrections),
)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 6 + 7: Dispatch to handler → respond call
    # ─────────────────────────────────────────────────────────────────────────
    result: dict[str, Any] = {}

    if decision.stage == "reset":
        session.reset_trip()
        result = {"message": "Sure! Let's start fresh — where are you thinking of going?", "prefill": None}

    elif intent in ("trip", "trip_search") or decision.stage in ("collecting", "searching"):
        result = await trip_search.handle(
            text,
            session.history,
            wallet,
            decision,
            verdict_context=verdict_context,
            is_voice=is_voice,
        )

    elif intent == "verdict_strategy":
        result = await verdict_strategy.handle(
            text,
            session.history,
            wallet,
            verdict_context=verdict_context,
            rag_chunks=kb_chunks,
            rag_examples=rag_examples,
            rag_corrections=rag_corrections,
            is_voice=is_voice,
        )

    elif intent in ("destination", "exploring"):
        result = await destination.handle(
            text,
            session.history,
            wallet,
            rag_chunks=kb_chunks,
            rag_examples=rag_examples,
            rag_corrections=rag_corrections,
            is_voice=is_voice,
        )

    elif intent == "wallet_support":
        result = await wallet_support.handle(
            text,
            session.history,
            wallet,
            rag_chunks=kb_chunks,
            rag_examples=rag_examples,
            rag_corrections=rag_corrections,
            is_voice=is_voice,
        )

    elif intent == "off_topic":
        result = await off_topic.handle(text, session.history, is_voice=is_voice)

    else:
        result = await trip_search.handle(
            text,
            session.history,
            wallet,
            decision,
            verdict_context=verdict_context,
            is_voice=is_voice,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 8: Finalize, save state, log interaction
    # ─────────────────────────────────────────────────────────────────────────
    message_text: str = result.get("message") or "Give me a second — something went wrong on my end."
    prefill: dict | None = result.get("prefill") or None

    # Hard guard: drop prefill if any required field is missing.
    # Cabin and travelers are product-required, so they must be present too.
    if prefill and not (
        prefill.get("origin")
        and prefill.get("destination")
        and prefill.get("date")
        and prefill.get("tripType")
        and prefill.get("travelers")
        and prefill.get("cabin")
    ):
        prefill = None
        print("⚠️ ZOE: Prefill dropped — required fields missing")

    # Append turns to session history
    session.add_turn("user", text)
    session.add_turn("assistant", message_text)

    # Save session to Redis (non-blocking failure)
    await session_store.save(sess_id, session)

    # Log interaction (non-blocking — failure never breaks user experience)
    feedback_signal = "search_triggered" if prefill else None
    interaction_id = await log_interaction(
        sess_id,
        user_id,
        intent,
        text,
        message_text,
        conversation_id=conversation_id,
        is_voice=is_voice,
        feedback_signal=feedback_signal,
    )

    return _reply(message_text, prefill=prefill, intent=intent, interaction_id=interaction_id)