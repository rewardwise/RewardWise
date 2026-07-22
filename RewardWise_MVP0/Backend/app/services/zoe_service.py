"""
app/services/zoe_service.py
────────────────────────────
Main Zoe entry point — Xpectrum-only pipeline (v3).

ARCHITECTURE (v3 — clean break from NVIDIA):
  Zoe is powered end-to-end by the Xpectrum Toolkit "TravelAgent". The agent
  owns intent understanding, the system prompt, the model, the knowledge base,
  and the searchFlight tool (cash + award + verdict + deep link). The backend's
  only job is to forward the user's message + per-user context and stream the
  answer back, persisting the upstream conversation id for multi-turn continuity.

  Removed in v3: local regex intent routing, RAG retrieval, grounded prompt
  building, per-intent handlers, the NVIDIA NIM completion path, and the
  provider switch. All of that now lives inside the Xpectrum agent.

Steps every request takes:
  1. Load session from Redis
  2. Fetch wallet from DB (passed to the agent as context)
  3. Forward to the Xpectrum TravelAgent + stream the answer
  4. Save session (incl. Xpectrum conversation id) + log interaction

Response shape (frontend-compatible, unchanged):
  {
    "type":           "followup",
    "message":        str,
    "intent":         str,
    "interaction_id": str | None,
  }
"""

from __future__ import annotations

import json
import re

from typing import Any, Dict, Optional

from app.db.client import get_db_client
from app.services.zoe import session as session_store
from app.services.zoe.interaction_logger import log as log_interaction
from app.services.zoe.xpectrum_caller import call_xpectrum


# ── Context helpers ───────────────────────────────────────────────────────────

def _wallet_inputs(wallet: list[dict]) -> str:
    """Compact, model-friendly summary of the user's points wallet."""
    if not wallet:
        return "No reward programs on file."
    parts = []
    for w in wallet:
        program = w.get("program") or "Unknown"
        pts = w.get("points") or 0
        parts.append(f"{program}: {pts:,}")
    return "; ".join(parts)


NEW_TRIP_INSTRUCTION = (
    "[Instructions] The user just stated a NEW trip in this message. The app is "
    "already running a live engine search for it, and the verdict card next to "
    "this chat will show exact cash and points pricing. Do NOT price this or any "
    "trip yourself: no cash prices, award amounts, point costs, cents-per-point, "
    "and no availability claims — not from tools, not from memory, not as "
    "estimates. Reply with ONE short, friendly sentence telling them you're "
    "pulling it up and the verdict will appear beside the chat. "
    "No numbers of any kind in your reply."
)


def _compose_xpectrum_query(
    text: str,
    wallet_summary: str,
    verdict_context: Optional[str],
    is_new_trip: bool = False,
) -> str:
    """
    Fold per-user context into the query for the Xpectrum agent.

    Until the Xpectrum "TravelAgent" template declares {{wallet}} /
    {{verdict_context}} input variables, passing context only via `inputs` would
    be silently dropped. So we prepend a compact, clearly-delimited context block
    so the model reliably sees the user's wallet and the result they clicked
    "Ask Zoe" on. Once the template consumes the `inputs` variables, this
    preamble can be removed in favor of pure `inputs`.
    """
    preamble: list[str] = []
    if is_new_trip:
        # A new-trip message makes any on-screen verdict stale for THIS trip;
        # suppress it and forbid agent-side pricing (dual-source guard).
        preamble.append(NEW_TRIP_INSTRUCTION)
        verdict_context = None
    if verdict_context:
        preamble.append(
            "[Live search result — the user is looking at this verdict right now]\n"
            f"{verdict_context}\n"
            "[Instructions] Answer the user's question USING THE NUMBERS ABOVE. "
            "They are live engine data for this exact trip. Never invent, estimate, "
            "or substitute your own cash prices, award prices, or point amounts; "
            "never claim pricing is unavailable when it appears above. Keep your "
            "usual short, friendly format."
        )
    if wallet_summary and wallet_summary != "No reward programs on file.":
        preamble.append(f"[User's points wallet] {wallet_summary}")
    if not preamble:
        return text
    return "\n\n".join(preamble) + "\n\n[User] " + text


TRIP_PARAM_FIELDS = {"origin", "destination", "date", "return_date", "travelers", "tripType"}


def extract_trip_params_block(text: str) -> tuple[str, Optional[dict]]:
    """Parse Xpectrum's [[TRIP_PARAMS]] {json} block out of a reply.

    Returns (visible_text_without_block, whitelisted_prefill_or_None).
    UNTESTED AGAINST A REAL VENDOR REPLY until the template ships the block —
    the vendor's FIRST real delivery gets a live verification, not assumed.
    """
    m = re.search(r"\[\[TRIP_PARAMS\]\]\s*(\{.*?\})", text, re.S)
    if not m:
        return text, None
    try:
        candidate = json.loads(m.group(1))
    except (ValueError, TypeError):
        return text, None
    if not isinstance(candidate, dict):
        return text, None
    prefill = {k: v for k, v in candidate.items() if k in TRIP_PARAM_FIELDS} or None
    clean = (text[: m.start()] + text[m.end():]).strip()
    return clean, prefill


# ── Xpectrum conversation continuity (durable, Supabase-backed) ───────────────
# The upstream Xpectrum conversation id is stored on the zoe_conversations row
# (keyed by the frontend conversation_id) instead of Redis. Redis sessions were
# wiping every turn in prod (suspended instance), which started a fresh Xpectrum
# conversation on each message → no memory → re-asking. Postgres is durable and
# already holds a row per conversation. Both helpers degrade to None/no-op on any
# error so a transient DB issue never breaks the chat.

async def _get_xpectrum_conversation(conversation_id: Optional[str]) -> Optional[str]:
    """Read the stored upstream Xpectrum conversation id for this conversation."""
    if not conversation_id:
        return None
    try:
        db = get_db_client()
        res = (
            db.table("zoe_conversations")
            .select("xpectrum_conversation_id")
            .eq("id", conversation_id)
            .single()
            .execute()
        )
        return (res.data or {}).get("xpectrum_conversation_id")
    except Exception as exc:
        print("⚠️ Zoe xpectrum-conv read error:", exc)
        return None


async def _set_xpectrum_conversation(
    conversation_id: Optional[str], xpectrum_conv_id: Optional[str]
) -> None:
    """Persist (or clear) the upstream Xpectrum conversation id for this conversation."""
    if not conversation_id:
        return
    try:
        db = get_db_client()
        (
            db.table("zoe_conversations")
            .update({"xpectrum_conversation_id": xpectrum_conv_id})
            .eq("id", conversation_id)
            .execute()
        )
    except Exception as exc:
        print("⚠️ Zoe xpectrum-conv write error:", exc)


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
    intent: str = "xpectrum",
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
    text:            str           = (payload.get("message") or "").strip()
    user_id:         Optional[str] = payload.get("user_id")
    verdict_context: Optional[str] = payload.get("verdict_context") or None
    is_new_trip:     bool          = bool(payload.get("is_new_trip", False))
    is_voice:        bool          = bool(payload.get("is_voice", False))
    frontend_history: list[dict]   = payload.get("history") or []
    conversation_id: Optional[str] = payload.get("conversation_id")

    if not user_id:
        return _reply("Please sign in to use Zoe.", intent="auth_required")

    if not text:
        return _reply(
            "Hey! Ask me anything about flights, routes, or how to use your points.",
        )

    # ── STEP 1: Load session ──────────────────────────────────────────────────
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

    # ── STEP 2: Fetch wallet (passed to the agent as context) ─────────────────
    wallet = await _fetch_wallet(user_id)
    wallet_summary = _wallet_inputs(wallet)

    # ── STEP 3: Forward to the Xpectrum TravelAgent ───────────────────────────
    # The agent owns intent + prompt + model + knowledge + the searchFlight tool.
    # Continuity: source the upstream Xpectrum conversation id from Postgres
    # (durable), keyed by the frontend conversation_id. Fall back to the in-session
    # value only when there's no conversation_id (e.g. the voice path).
    xpectrum_conv = await _get_xpectrum_conversation(conversation_id)
    if xpectrum_conv is None:
        xpectrum_conv = session.xpectrum_conversation_id
    # Inject wallet context ONLY on the first turn of a conversation. Repeating
    # it every turn makes the agent comment on the wallet ("you've got quite the
    # collection!") and lose the user's actual thread — it retains the wallet via
    # conversation memory after turn 1. verdict_context (Ask-Zoe) is per-turn.
    first_turn = xpectrum_conv is None
    inputs: dict[str, Any] = {"wallet": wallet_summary}
    if verdict_context and not is_new_trip:
        inputs["verdict_context"] = verdict_context

    reply = await call_xpectrum(
        _compose_xpectrum_query(
            text,
            wallet_summary if first_turn else "",
            verdict_context,
            is_new_trip=is_new_trip,
        ),
        user=user_id,
        conversation_id=xpectrum_conv,
        inputs=inputs,
    )

    # Persist the upstream conversation id durably ONLY on success, so the next
    # turn resumes context. On an upstream "conversation not found" (TTL expiry),
    # clear it so the next turn self-heals with a fresh conversation instead of
    # wedging on the dead id forever. Keep the session copy in sync for the
    # no-conversation_id (voice) path.
    if reply.ok and reply.conversation_id:
        await _set_xpectrum_conversation(conversation_id, reply.conversation_id)
        session.xpectrum_conversation_id = reply.conversation_id
    elif not reply.ok and "conversation" in (reply.error or "").lower():
        await _set_xpectrum_conversation(conversation_id, None)
        session.xpectrum_conversation_id = None

    message_text = reply.answer or "Something went wrong — give me a second."

    message_text, prefill = extract_trip_params_block(message_text)

    # ── STEP 4: Save session + log interaction ────────────────────────────────
    session.add_turn("user", text)
    session.add_turn("assistant", message_text)
    await session_store.save(sess_id, session)

    interaction_id = await log_interaction(
        sess_id,
        user_id,
        "xpectrum",
        text,
        message_text,
        conversation_id=conversation_id,
        is_voice=is_voice,
        feedback_signal=None,
    )

    response = _reply(message_text, interaction_id=interaction_id)
    if prefill:
        response["prefill"] = prefill
    return response
