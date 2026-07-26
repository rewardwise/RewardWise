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
    """Compact, model-friendly summary of the user's points wallet.

    One line PER PROGRAM (balances summed across cards), not per card —
    multi-card programs used to render "Chase: 301; Chase: 0; Chase: 0",
    which reads like three wallets. Insertion order preserved.
    """
    if not wallet:
        return "No reward programs on file."
    by_program: dict[str, int] = {}
    for w in wallet:
        program = w.get("program") or "Unknown"
        by_program[program] = by_program.get(program, 0) + (w.get("points") or 0)
    return "; ".join(f"{program}: {pts:,}" for program, pts in by_program.items())


# Deterministic dual-source kill (prod incident 2026-07-21, second round):
# instructing the agent not to price ("NEW_TRIP_INSTRUCTION") was IGNORED in
# live verification — its searchFlight tool priced the trip anyway. So a
# new-trip turn never reaches the agent at all; the backend answers with this
# fixed ack and the engine search stays the only pricing source.
# Ack copy tracks what ACTUALLY happens (2026-07-26 operator call: complete
# Zoe fills auto-run the search; incomplete fills stay fill-only + nudge).
# The frontend computes will_autorun/missing from the post-merge form state —
# the backend just says the honest sentence for that outcome.
NEW_TRIP_ACK_RUNNING = (
    "On it — I filled in your search and I'm running it now. "
    "Verdict in a few seconds. ✈️"
)

_MISSING_LABELS = {
    "origin": "where you're flying from",
    "destination": "where you're headed",
    "date": "what dates",
    "return_date": "your return date",
}


def new_trip_ack(will_autorun: bool, missing: list[str] | None = None) -> str:
    if will_autorun:
        return NEW_TRIP_ACK_RUNNING
    asks = [_MISSING_LABELS[m] for m in (missing or []) if m in _MISSING_LABELS]
    ask = " and ".join(asks) if asks else "the missing details"
    return (
        "Filled in what I got — {}? I'll run it the second you tell me. ✈️".format(ask)
    )


# Kept as the auto-run ack alias: the voice route and tests import NEW_TRIP_ACK.
NEW_TRIP_ACK = NEW_TRIP_ACK_RUNNING


def _compose_xpectrum_query(
    text: str,
    wallet_summary: str,
    verdict_context: Optional[str],
    pending_trip: Optional[str] = None,
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
    if pending_trip:
        preamble.append(
            "[The user's current trip request — they stated this in the app just "
            "before this message]\n"
            f"{pending_trip}\n"
            "[Instructions] Treat that as the trip under discussion. The app's "
            "verdict card handles all pricing for it — do NOT price it yourself."
        )
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
    will_autorun:    bool          = bool(payload.get("will_autorun", False))
    missing_fields:  list          = payload.get("missing") or []
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

    # ── Dual-source kill-switch ───────────────────────────────────────────────
    # A typed NEW-trip message (deterministic extractor fired on the frontend)
    # never reaches the Xpectrum agent: its searchFlight tool prices trips from
    # a second data source and ignored the no-pricing instruction in live
    # verification. Fixed ack only; the engine verdict is the single source.
    # The statement is PERSISTED so the next non-flagged turn can hand it to
    # the agent — without this the upstream conversation never hears the trip
    # and follow-ups get "please provide your details" (2026-07-26 incident).
    if is_new_trip:
        ack = new_trip_ack(will_autorun, missing_fields)
        session.pending_trip_statement = text
        session.add_turn("user", text)
        session.add_turn("assistant", ack)
        await session_store.save(sess_id, session)
        interaction_id = await log_interaction(
            sess_id,
            user_id,
            "new_trip_ack",
            text,
            ack,
            conversation_id=conversation_id,
            is_voice=is_voice,
            feedback_signal=None,
        )
        return _reply(ack, interaction_id=interaction_id)

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
    if verdict_context:
        inputs["verdict_context"] = verdict_context

    # Hand the kill-switched trip statement to the agent exactly once, then
    # clear it (cleared state persists via the STEP 4 session save).
    pending_trip = session.pending_trip_statement
    session.pending_trip_statement = None

    reply = await call_xpectrum(
        _compose_xpectrum_query(
            text,
            wallet_summary if first_turn else "",
            verdict_context,
            pending_trip=pending_trip,
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
