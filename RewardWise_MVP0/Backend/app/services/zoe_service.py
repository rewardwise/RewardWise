from __future__ import annotations

from typing import Any, Dict, List

from fastapi import HTTPException

from app.api.search import run_search
from app.rag.flights_retriever import retrieve
from app.services.airport_resolver import is_airport_options_request, resolve_airport_text
from app.services.llm import generate_text
from app.services.zoe_intents import detect_general_question, detect_reset_intent, looks_like_replacement_trip
from app.services.zoe_reconciler import reconcile_turn
from app.services.zoe_response import (
    build_collecting_response,
    build_reset_response,
    build_suggestions,
    build_zoe_verdict_message,
    welcome_response,
)
from app.services.zoe_state import (
    META_KEY,
    apply_active_slot_answer,
    apply_airport_resolution,
    apply_basic_updates,
    clean_after_update,
    extract_travelers,
    fresh_state,
    get_meta,
    handle_airport_options_request,
    handle_pending_confirmation,
    next_missing_slot,
    normalize_cabin,
    normalize_incoming_state,
    normalize_trip_type,
    parse_date_text,
    prompt_for_missing,
    public_params,
    set_last_requested,
    validate_ready_state,
    validation_message,
)


PROGRAM_ALIASES: dict[str, list[str]] = {
    "united": ["United MileagePlus"],
    "delta": ["Delta SkyMiles"],
    "american": ["Citi ThankYou Points", "Chase Ultimate Rewards"],
    "aeroplan": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "virginatlantic": ["Chase Ultimate Rewards", "Capital One Miles"],
    "flyingblue": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "british": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "singapore": ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "cathay": ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "emirates": ["Chase Ultimate Rewards", "Amex Membership Rewards"],
    "turkish": ["Chase Ultimate Rewards"],
    "qantas": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "avianca": ["Capital One Miles"],
    "lifemiles": ["Capital One Miles"],
    "etihad": ["Amex Membership Rewards"],
    "qatar": ["Amex Membership Rewards"],
    "ana": ["Amex Membership Rewards"],
    "air_france": ["Chase Ultimate Rewards", "Amex Membership Rewards", "Capital One Miles"],
    "hyatt": ["World of Hyatt"],
    "marriott": ["Marriott Bonvoy"],
}


def _format_wallet_context(wallet: list) -> str:
    if not wallet:
        return "User has no wallet data."
    lines = []
    for card in wallet:
        program = card.get("program") or card.get("name")
        points = int(card.get("points") or card.get("balance") or 0)
        if program and points:
            lines.append(f"{program}: {points:,} points")
    return "\n".join(lines) if lines else "User has no points yet."


async def _retrieve_context(query: str) -> str:
    results = await retrieve(query, top_k=3)
    if not results:
        return "No relevant knowledge found."
    return "\n".join([f"{r.title}\n{r.snippet}" for r in results])


async def _handle_question(text: str, wallet: list) -> dict[str, Any]:
    text_lower = text.lower()
    if "points" in text_lower or "balance" in text_lower or "miles" in text_lower:
        if not wallet:
            return {"type": "answer", "message": "You haven’t added any loyalty programs yet. Add your cards in Wallet to track your points."}
        lines, total = [], 0
        for card in wallet:
            program = card.get("program") or card.get("name")
            points = int(card.get("points") or card.get("balance") or 0)
            if program:
                lines.append(f"{program}: {points:,} points")
                total += points
        return {
            "type": "answer",
            "message": "Here’s your current points balance:\n\n" + "\n".join(lines) + f"\n\nTotal: {total:,} points",
        }

    context = await _retrieve_context(text)
    wallet_context = _format_wallet_context(wallet)
    prompt = f"""You are Zoe, a practical travel rewards assistant.
USER WALLET:\n{wallet_context}
KNOWLEDGE:\n{context}
RULES:
- Be concise and grounded.
- Do not invent live prices or award availability.
- If the user asks a non-trip question, answer directly.
USER QUESTION:\n{text}"""
    answer = await generate_text(prompt)
    return {"type": "answer", "message": answer or "I couldn’t answer that. Try asking differently."}


def _has_trip_state(state: dict[str, Any]) -> bool:
    if any(state.get(k) for k in ["origin", "destination", "date", "tripType", "travelers", "cabin", "return_date"]):
        return True
    meta = get_meta(state)
    return bool(
        meta.get("last_requested_slot")
        or meta.get("pending_confirmation")
        or meta.get("origin_hint")
        or meta.get("destination_hint")
        or meta.get("month_hint")
        or meta.get("airport_options_slot")
        or meta.get("airport_options")
    )


def _looks_trip_like(text: str, state: dict[str, Any]) -> bool:
    if _has_trip_state(state):
        return True
    t = text.lower()
    keywords = [
        "flight", "fly", "flying", "go to", "travel", "trip", "cash", "points", "miles", "award",
        "one way", "round trip", "roundtrip", "business", "economy", "first", "traveler", "passenger",
        "tomorrow", "next week", "next weekend", "weekend", "earlier", "later",
    ]
    return any(k in t for k in keywords)


def _maybe_reset_for_replacement_trip(text: str, state: dict[str, Any]) -> dict[str, Any]:
    meta = get_meta(state)
    if meta.get("conversation_mode") == "post_verdict" and looks_like_replacement_trip(text):
        return fresh_state()
    return state


def _apply_airport_text_delta(state: dict[str, Any], slot: str, value: Any) -> dict[str, Any] | None:
    text = str(value or "").strip()
    if not text:
        return None
    result = apply_airport_resolution(state, slot, text)
    if result and result.get("question"):
        return build_collecting_response(result["question"], state)
    return None


def _apply_reconciler_result(state: dict[str, Any], result: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(result, dict):
        return None

    # Never honor model reset here. Deterministic reset is handled before this.
    for field in result.get("clear_fields") or []:
        if field in {"origin", "destination", "date", "tripType", "travelers", "cabin", "return_date"}:
            state.pop(field, None)

    airport_text = result.get("airport_text") or {}
    if isinstance(airport_text, dict):
        # Resolve origin/destination text through the resolver, not the model.
        for slot in ["origin", "destination"]:
            if airport_text.get(slot):
                response = _apply_airport_text_delta(state, slot, airport_text[slot])
                if response:
                    return response

    updates = result.get("updates") or {}
    if isinstance(updates, dict):
        if updates.get("date"):
            parsed = parse_date_text(str(updates["date"]), base_date=state.get("date"), slot="date")
            if parsed.get("date"):
                state["date"] = parsed["date"]
            elif parsed.get("month_hint"):
                get_meta(state)["month_hint"] = parsed["month_hint"]
        if updates.get("tripType"):
            trip_type = normalize_trip_type(updates["tripType"])
            if trip_type:
                state["tripType"] = trip_type
        if updates.get("travelers") is not None:
            travelers = extract_travelers(str(updates["travelers"]))
            if travelers:
                state["travelers"] = travelers
        if updates.get("cabin"):
            cabin = normalize_cabin(updates["cabin"])
            if cabin:
                state["cabin"] = cabin
        if updates.get("return_date"):
            parsed = parse_date_text(str(updates["return_date"]), base_date=state.get("date"), slot="return_date")
            if parsed.get("date"):
                state["return_date"] = parsed["date"]

    clean_after_update(state)
    return None


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text = (payload.get("message") or "").strip()
    wallet = payload.get("wallet", [])
    incoming = payload.get("slots", {}) or {}
    history = payload.get("history", []) or []
    explicit_slot = payload.get("slot")

    print("📩 USER:", text)
    print("📦 INCOMING SLOTS:", incoming)

    if not text:
        return build_collecting_response("Tell me the trip you want to check.", normalize_incoming_state(incoming))

    if text.lower() == "start":
        return welcome_response()

    state = normalize_incoming_state(incoming)
    state = _maybe_reset_for_replacement_trip(text, state)
    meta = get_meta(state)

    # Deterministic reset only. Do not trust the LLM to reset state.
    if detect_reset_intent(text):
        return build_reset_response(fresh_state())

    # User is asking for airport options, not trying to change a hint to that full sentence.
    options_response = handle_airport_options_request(state, text)
    if options_response:
        print("🧠 STATE AFTER OPTIONS:", state)
        return options_response

    # Pending confirmations must resolve transactionally before AI or other parsing.
    pending_response = handle_pending_confirmation(state, text)
    if pending_response:
        if pending_response.get("type") == "followup":
            print("🧠 STATE AFTER PENDING:", state)
            return pending_response

    # If frontend explicitly says which slot is being answered, honor that.
    if explicit_slot:
        meta["last_requested_slot"] = explicit_slot

    # Active requested slot gets first shot. This prevents date answers from reopening airport choices.
    active_response = apply_active_slot_answer(state, text)
    if active_response:
        if active_response.get("type") == "followup":
            print("🧠 STATE AFTER ACTIVE SLOT:", state)
            return active_response
        print("🧠 STATE AFTER ACTIVE SLOT:", state)
    else:
        apply_basic_updates(state, text)

        # AI is a delta interpreter only. It cannot reset or directly decide verdict.
        ai_result = await reconcile_turn(text, state, history)
        print("🤖 AI STATE DELTA:", ai_result)
        response = _apply_reconciler_result(state, ai_result)
        if response:
            print("🧠 STATE AFTER AI AIRPORT:", state)
            return response

        if ai_result.get("intent") == "general_question" and not _looks_trip_like(text, state):
            answer = await _handle_question(text, wallet)
            answer["params"] = public_params(state)
            return answer

    clean_after_update(state)
    print("🧠 STATE AFTER MERGE:", state)

    if not _looks_trip_like(text, state):
        answer = await _handle_question(text, wallet)
        answer["params"] = public_params(state)
        return answer

    missing = next_missing_slot(state)
    if missing:
        question = prompt_for_missing(state, missing)
        return build_collecting_response(question, state)

    try:
        params = validate_ready_state(state)
    except Exception as exc:
        question = validation_message(exc, state)
        return build_collecting_response(question, state)

    if request is None:
        return {
            "type": "error",
            "message": "I need a live session before I can run a search. Please reload and try again.",
            "params": public_params(state),
        }

    try:
        search_data = await run_search(request=request, params=params)
        verdict = search_data.get("verdict") or {}
        message = build_zoe_verdict_message(search_data)
        meta = get_meta(state)
        meta["conversation_mode"] = "post_verdict"
        set_last_requested(state, None, None)
        return {
            "type": "search_result",
            "message": message,
            "data": verdict,
            "search_data": search_data,
            "search_id": search_data.get("search_id"),
            "verdict_id": search_data.get("verdict_id"),
            "params": public_params(state),
            "suggestions": build_suggestions(state, verdict, stage="post_verdict"),
        }
    except HTTPException as exc:
        friendly = str(exc.detail) if getattr(exc, "detail", None) else "I hit a search error."
        if "Missing authorization header" in friendly or "Invalid or expired session" in friendly:
            friendly = "Please log in again so I can run a live search for you."
        elif "Date" in friendly:
            friendly = validation_message(Exception(friendly), state)
        else:
            friendly = "Sorry, I ran into an issue fetching live results. Please try again."
        return {"type": "error", "message": friendly, "params": public_params(state), "suggestions": []}
    except Exception as exc:
        print("❌ SEARCH ERROR:", repr(exc))
        return {
            "type": "error",
            "message": "Sorry, I ran into an issue fetching live results. Please try again.",
            "params": public_params(state),
            "suggestions": [],
        }
