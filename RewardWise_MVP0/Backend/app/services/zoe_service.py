from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
import json
import re

from fastapi import HTTPException

from app.api.search import run_search
from app.api.validators import SearchParams
from app.rag.flights_retriever import retrieve
from app.services.llm import generate_json, generate_text
from app.validators.airport_codes import is_valid_airport_code

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

MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

TRIP_FIELDS = {"origin", "destination", "date", "tripType", "travelers", "cabin", "return_date"}
META_KEY = "__zoe_meta"
MISSING_ORDER = ["destination", "origin", "date", "tripType", "travelers", "cabin"]
YES_WORDS = {"yes", "yeah", "yep", "yup", "sure", "correct", "right", "ok", "okay", "sounds good", "do it", "use it"}
NO_WORDS = {"no", "nope", "nah", "wrong", "not that", "don't", "dont"}

IATA_STOP_WORDS = YES_WORDS | NO_WORDS | {
    "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "no", "nope", "nah",
    "the", "and", "for", "you", "use", "can", "why", "what", "who", "how",
}


def _today() -> date:
    return date.today()


def _strip(text: Any) -> str:
    return str(text or "").strip()


def _compact(value: Any) -> Optional[str]:
    text = _strip(value)
    return text or None


def _normalize_code(value: Any) -> Optional[str]:
    raw = _strip(value)
    if raw.lower() in IATA_STOP_WORDS:
        return None
    code = raw.upper()
    if re.fullmatch(r"[A-Z]{3}", code) and is_valid_airport_code(code):
        return code
    return None


def _extract_iata_codes(text: str) -> list[str]:
    codes: list[str] = []
    for match in re.findall(r"\b[A-Za-z]{3}\b", text):
        if match.lower() in IATA_STOP_WORDS:
            continue
        code = match.upper()
        if is_valid_airport_code(code) and code not in codes:
            codes.append(code)
    return codes


def _normalize_trip_type(value: Any) -> Optional[str]:
    v = _strip(value).lower().replace("-", " ")
    if not v:
        return None
    if "one" in v or "single" in v or v == "ow":
        return "oneway"
    if "round" in v or "return" in v or v == "rt":
        return "roundtrip"
    return None


def _normalize_cabin(value: Any) -> Optional[str]:
    v = _strip(value).lower().replace("-", " ")
    if not v:
        return None
    if "premium" in v:
        return "premium_economy"
    if "business" in v or v in {"biz", "j"}:
        return "business"
    if "first" in v or v in {"f"}:
        return "first"
    if "economy" in v or "coach" in v or v in {"econ", "y"}:
        return "economy"
    return None


def _extract_travelers(text: str) -> Optional[int]:
    t = text.strip().lower()
    number_words = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9,
    }
    if t in number_words:
        return number_words[t]
    if t.isdigit():
        value = int(t)
        return value if 1 <= value <= 9 else None
    match = re.search(r"\b(\d+)\b", t)
    if match and any(k in t for k in ["traveler", "traveller", "passenger", "people", "person", "adults", "adult"]):
        value = int(match.group(1))
        return value if 1 <= value <= 9 else None
    for word, value in number_words.items():
        if re.search(rf"\b{word}\b", t) and any(k in t for k in ["traveler", "traveller", "passenger", "people", "person", "adults", "adult"]):
            return value
    return None


def _next_future_month_day(month: int, day: int) -> Optional[str]:
    current = _today()
    year = current.year
    for _ in range(3):
        try:
            candidate = date(year, month, day)
        except ValueError:
            return None
        if candidate >= current:
            return candidate.isoformat()
        year += 1
    return None


def _parse_date_text(text: str, *, base_date: Optional[str] = None) -> dict[str, Any]:
    t = text.strip().lower()
    result: dict[str, Any] = {}
    current = _today()

    if not t:
        return result

    if "day earlier" in t and base_date:
        try:
            dep = datetime.strptime(base_date, "%Y-%m-%d").date()
            result["date"] = (dep - timedelta(days=1)).isoformat()
            return result
        except ValueError:
            pass
    if "day later" in t and base_date:
        try:
            dep = datetime.strptime(base_date, "%Y-%m-%d").date()
            result["date"] = (dep + timedelta(days=1)).isoformat()
            return result
        except ValueError:
            pass
    if "week earlier" in t and base_date:
        try:
            dep = datetime.strptime(base_date, "%Y-%m-%d").date()
            result["date"] = (dep - timedelta(days=7)).isoformat()
            return result
        except ValueError:
            pass
    if "week later" in t and base_date:
        try:
            dep = datetime.strptime(base_date, "%Y-%m-%d").date()
            result["date"] = (dep + timedelta(days=7)).isoformat()
            return result
        except ValueError:
            pass

    if re.search(r"\btomorrow\b", t):
        result["date"] = (current + timedelta(days=1)).isoformat()
        return result
    if re.search(r"\btoday\b", t):
        result["date"] = current.isoformat()
        return result
    if re.search(r"\bnext week\b", t):
        result["date"] = (current + timedelta(days=7)).isoformat()
        return result

    iso = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
    if iso:
        result["date"] = iso.group(1)
        return result

    md = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", t)
    if md:
        month = int(md.group(1))
        day = int(md.group(2))
        year_text = md.group(3)
        if year_text:
            year = int(year_text)
            if year < 100:
                year += 2000
            try:
                result["date"] = date(year, month, day).isoformat()
            except ValueError:
                return result
        else:
            resolved = _next_future_month_day(month, day)
            if resolved:
                result["date"] = resolved
        return result

    month_names = "|".join(sorted(MONTHS.keys(), key=len, reverse=True))
    month_day = re.search(rf"\b({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b", t)
    if month_day:
        month = MONTHS[month_day.group(1)]
        day = int(month_day.group(2))
        explicit_year = month_day.group(3)
        if explicit_year:
            try:
                result["date"] = date(int(explicit_year), month, day).isoformat()
            except ValueError:
                return result
        else:
            resolved = _next_future_month_day(month, day)
            if resolved:
                result["date"] = resolved
        return result

    month_only = re.search(rf"\b({month_names})\b", t)
    if month_only:
        result["month_hint"] = month_only.group(1).title()
        return result

    return result


def _format_wallet_context(wallet: list) -> str:
    if not wallet:
        return "User has no wallet data."
    lines = []
    for card in wallet:
        program = card.get("program") or card.get("name")
        points = int(card.get("points") or card.get("balance") or 0)
        if program and points:
            lines.append(f"{program}: {points} points")
    return "\n".join(lines) if lines else "User has no points yet."


def _format_history(history: List[Dict[str, Any]]) -> str:
    lines = []
    for msg in history[-8:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def _retrieve_context(query: str):
    results = await retrieve(query, top_k=3)
    if not results:
        return "No relevant knowledge found."
    return "\n".join([f"{r.title}\n{r.snippet}" for r in results])


async def _handle_question(text: str, wallet):
    text_lower = text.lower()
    if "points" in text_lower or "balance" in text_lower or "miles" in text_lower:
        if not wallet:
            return {"type": "answer", "message": "You haven't added any loyalty programs yet. Add your cards in Wallet to track your points."}
        lines, total = [], 0
        for card in wallet:
            program = card.get("program") or card.get("name")
            points = int(card.get("points") or card.get("balance") or 0)
            if program:
                lines.append(f"{program}: {points:,} points")
                total += points
        return {
            "type": "answer",
            "message": "Here's your current points balance:\n\n" + "\n".join(lines) + f"\n\nTotal: {total:,} points",
        }

    context = await _retrieve_context(text)
    wallet_context = _format_wallet_context(wallet)
    prompt = f"""You are Zoe, a practical travel rewards assistant.
USER WALLET:\n{wallet_context}\nKNOWLEDGE:\n{context}\nRULES:\n- Be concise and grounded.
- Do not invent live prices or award availability.
- If the user asks a non-trip question, answer directly.
USER QUESTION:\n{text}"""
    answer = await generate_text(prompt)
    return {"type": "answer", "message": answer or "I couldn't answer that. Try asking differently."}


def _empty_meta() -> dict[str, Any]:
    return {
        "last_requested_slot": None,
        "pending_confirmation": None,
        "origin_hint": None,
        "destination_hint": None,
        "month_hint": None,
        "last_question": None,
    }


def _normalize_incoming_state(incoming: Dict[str, Any]) -> Dict[str, Any]:
    state: Dict[str, Any] = {}
    meta = dict(_empty_meta())

    if isinstance(incoming.get(META_KEY), dict):
        meta.update(incoming.get(META_KEY) or {})

    # Backward compatibility with older params that carried these at top level.
    for meta_key in ["last_requested_slot", "pending_confirmation", "origin_hint", "destination_hint", "month_hint", "last_question"]:
        if incoming.get(meta_key) is not None:
            meta[meta_key] = incoming.get(meta_key)

    for key, value in incoming.items():
        if key == META_KEY or key.startswith("__"):
            continue
        if value is None or value == "":
            continue
        if key in ["origin", "destination"]:
            code = _normalize_code(value)
            if code:
                state[key] = code
        elif key == "travelers":
            try:
                travelers = int(value)
                if 1 <= travelers <= 9:
                    state[key] = travelers
            except (TypeError, ValueError):
                continue
        elif key == "tripType":
            normalized = _normalize_trip_type(value)
            if normalized:
                state[key] = normalized
        elif key == "cabin":
            normalized = _normalize_cabin(value)
            if normalized:
                state[key] = normalized
        elif key in ["date", "return_date"]:
            state[key] = _strip(value)
        elif key == "program_hints":
            if isinstance(value, list):
                state[key] = value

    state[META_KEY] = meta
    return state


def _public_params(state: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in state.items() if v is not None}


def _get_meta(state: Dict[str, Any]) -> Dict[str, Any]:
    meta = state.get(META_KEY)
    if not isinstance(meta, dict):
        meta = _empty_meta()
        state[META_KEY] = meta
    else:
        merged = _empty_meta()
        merged.update(meta)
        state[META_KEY] = merged
        meta = merged
    return meta


def _set_last_requested(state: Dict[str, Any], slot: Optional[str], question: Optional[str] = None) -> None:
    meta = _get_meta(state)
    meta["last_requested_slot"] = slot
    if question is not None:
        meta["last_question"] = question


def _clear_requested_if_filled(state: Dict[str, Any], slot: Optional[str]) -> None:
    if not slot:
        return
    meta = _get_meta(state)
    if meta.get("last_requested_slot") == slot and state.get(slot):
        meta["last_requested_slot"] = None
        meta["last_question"] = None


def _clean_state_after_update(state: Dict[str, Any]) -> None:
    meta = _get_meta(state)
    if state.get("origin"):
        meta["origin_hint"] = None
        if meta.get("last_requested_slot") == "origin":
            _clear_requested_if_filled(state, "origin")
    if state.get("destination"):
        meta["destination_hint"] = None
        if meta.get("last_requested_slot") == "destination":
            _clear_requested_if_filled(state, "destination")
    if state.get("date"):
        meta["month_hint"] = None
        if meta.get("last_requested_slot") == "date":
            _clear_requested_if_filled(state, "date")
    if state.get("tripType") == "oneway":
        state["return_date"] = None
    if state.get("return_date") and meta.get("last_requested_slot") == "return_date":
        _clear_requested_if_filled(state, "return_date")


def _is_affirmative(text: str) -> bool:
    t = text.strip().lower()
    return t in YES_WORDS or t.replace(".", "") in YES_WORDS


def _is_negative(text: str) -> bool:
    t = text.strip().lower()
    return t in NO_WORDS or any(t.startswith(word + " ") for word in NO_WORDS)


def _confirmation_question(slot: str, label: str) -> str:
    direction = "departure" if slot == "origin" else "arrival"
    return f"Do you want me to use {label} as your {direction} airport?"


def _candidate_label(candidate: Dict[str, Any]) -> str:
    return _strip(candidate.get("label")) or _strip(candidate.get("value")) or "that airport"


def _resolve_pending_confirmation(text: str, state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    meta = _get_meta(state)
    pending = meta.get("pending_confirmation")
    if not isinstance(pending, dict):
        return None

    slot = pending.get("slot")
    value = _normalize_code(pending.get("value"))
    label = _candidate_label(pending)

    if _is_affirmative(text) and slot in ["origin", "destination"] and value:
        state[slot] = value
        meta["pending_confirmation"] = None
        meta["last_requested_slot"] = None
        meta["last_question"] = None
        _clean_state_after_update(state)
        next_slot = _next_missing_slot(state)
        if next_slot:
            question = _prompt_for_missing(next_slot, state)
            return {
                "type": "followup",
                "message": question,
                "params": _public_params(state),
                "suggestions": _build_suggestions(state, stage="collecting"),
            }
        return {"type": "ready_after_confirmation", "params": _public_params(state)}

    if _is_negative(text):
        meta["pending_confirmation"] = None
        question = _prompt_for_missing(slot or "origin", state)
        _set_last_requested(state, slot, question)
        return {
            "type": "followup",
            "message": question,
            "params": _public_params(state),
            "suggestions": _build_suggestions(state, stage="collecting"),
        }

    # If user gives a different concrete airport code, use that instead of the pending candidate.
    codes = _extract_iata_codes(text)
    if slot in ["origin", "destination"] and codes:
        state[slot] = codes[0]
        meta["pending_confirmation"] = None
        meta["last_requested_slot"] = None
        meta["last_question"] = None
        _clean_state_after_update(state)
        next_slot = _next_missing_slot(state)
        if next_slot:
            question = _prompt_for_missing(next_slot, state)
            return {
                "type": "followup",
                "message": question,
                "params": _public_params(state),
                "suggestions": _build_suggestions(state, stage="collecting"),
            }
        return {"type": "ready_after_confirmation", "params": _public_params(state)}

    # User did not answer the confirmation. Keep the conversation pinned to it.
    question = _confirmation_question(slot or "origin", label)
    _set_last_requested(state, slot, question)
    return {
        "type": "followup",
        "message": question,
        "params": _public_params(state),
        "suggestions": _build_suggestions(state, stage="collecting"),
    }


def _apply_direct_answer_to_requested_slot(text: str, state: Dict[str, Any]) -> bool:
    meta = _get_meta(state)
    slot = meta.get("last_requested_slot")
    if not slot:
        return False

    t = text.strip()
    handled = False

    if slot in ["origin", "destination"]:
        codes = _extract_iata_codes(t)
        if codes:
            state[slot] = codes[0]
            handled = True
        # If no exact code, leave it for the AI interpreter to either ask a human-friendly
        # airport question or propose a confirmation. Do not hardcode city mappings here.

    elif slot in ["date", "return_date"]:
        parsed = _parse_date_text(t, base_date=state.get("date"))
        if parsed.get("date"):
            state[slot] = parsed["date"]
            handled = True
        elif parsed.get("month_hint") and slot == "date":
            meta["month_hint"] = parsed["month_hint"]
            handled = True

    elif slot == "tripType":
        trip_type = _normalize_trip_type(t)
        if trip_type:
            state["tripType"] = trip_type
            if trip_type == "oneway":
                state["return_date"] = None
            handled = True

    elif slot == "travelers":
        travelers = _extract_travelers(t)
        if travelers:
            state["travelers"] = travelers
            handled = True

    elif slot == "cabin":
        cabin = _normalize_cabin(t)
        if cabin:
            state["cabin"] = cabin
            handled = True

    if handled:
        _clean_state_after_update(state)
        return True
    return False


def _apply_deterministic_updates(text: str, state: Dict[str, Any]) -> None:
    t = text.strip()
    low = t.lower()

    # Explicit airport-code route patterns only. City handling belongs to the AI interpreter.
    route = re.search(r"\bfrom\s+([A-Za-z]{3})\s+to\s+([A-Za-z]{3})\b", t, re.IGNORECASE)
    if route:
        origin = _normalize_code(route.group(1))
        destination = _normalize_code(route.group(2))
        if origin:
            state["origin"] = origin
        if destination:
            state["destination"] = destination

    simple_route = re.search(r"\b([A-Za-z]{3})\s+to\s+([A-Za-z]{3})\b", t, re.IGNORECASE)
    if simple_route and not route:
        origin = _normalize_code(simple_route.group(1))
        destination = _normalize_code(simple_route.group(2))
        if origin:
            state["origin"] = origin
        if destination:
            state["destination"] = destination

    date_info = _parse_date_text(t, base_date=state.get("date"))
    if date_info.get("date"):
        if state.get("tripType") == "roundtrip" and _get_meta(state).get("last_requested_slot") == "return_date":
            state["return_date"] = date_info["date"]
        else:
            state["date"] = date_info["date"]
    elif date_info.get("month_hint") and not state.get("date"):
        _get_meta(state)["month_hint"] = date_info["month_hint"]

    trip_type = _normalize_trip_type(t)
    if trip_type:
        state["tripType"] = trip_type
        if trip_type == "oneway":
            state["return_date"] = None

    cabin = _normalize_cabin(t)
    if cabin:
        state["cabin"] = cabin

    travelers = _extract_travelers(t)
    if travelers:
        state["travelers"] = travelers

    if state.get("date"):
        try:
            current_date = datetime.strptime(state["date"], "%Y-%m-%d").date()
        except ValueError:
            current_date = None
        if current_date:
            if "week earlier" in low or "a week earlier" in low:
                state["date"] = (current_date - timedelta(days=7)).isoformat()
            elif "week later" in low or "a week later" in low:
                state["date"] = (current_date + timedelta(days=7)).isoformat()
            elif "day earlier" in low:
                state["date"] = (current_date - timedelta(days=1)).isoformat()
            elif "day later" in low:
                state["date"] = (current_date + timedelta(days=1)).isoformat()

    _clean_state_after_update(state)


def _safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, default=str)
    except TypeError:
        return "{}"


async def _interpret_turn_with_ai(text: str, state: Dict[str, Any], history: List[Dict[str, Any]]) -> Dict[str, Any]:
    meta = _get_meta(state)
    current_state = {k: v for k, v in state.items() if k != META_KEY}
    current_date = _today().isoformat()

    system_prompt = f"""You are Zoe's trip-state interpreter. Today is {current_date}.

Your only job is to read the user's latest message and return JSON deltas for the trip state needed by the verdict engine.

Verdict-required fields:
- origin: final IATA airport code, or null if unresolved
- destination: final IATA airport code, or null if unresolved
- date: departure date as YYYY-MM-DD, or null if unresolved
- tripType: "oneway" or "roundtrip", or null if unresolved
- travelers: integer 1-9, or null if unresolved
- cabin: "economy", "premium_economy", "business", or "first", or null if unresolved
- return_date: YYYY-MM-DD only if roundtrip, otherwise null

Strict rules:
1. Return DELTAS ONLY. Do not restate the entire current state.
2. Preserve existing confirmed fields unless the user clearly changes that field.
3. If the assistant most recently asked for a slot, interpret the user's message as an answer to that slot first. If that slot is already filled, do not ask it again unless the user clearly changes it.
4. Never guess a final airport from a city/region alone. If the user says a city/region such as "Seattle", "New York", "New Jersey", "London", or "Bay Area", set origin_hint or destination_hint and ask which airport. Do not invent or list bad candidates.
5. Only set origin/destination when the user gives a valid IATA code or clearly names one specific airport. If you are not certain, use pending_confirmation or a next_question. Never treat yes/yeah/yep/no/nope/ok/sure as airport codes, cities, or slot values.
6. Never silently invent dates. Month-only input is a month_hint. Month+day should resolve to the next future occurrence using today's date. Relative dates like tomorrow/next week should resolve using today's date.
7. If the user changes something mid-flow, return that field in updates and keep everything else.
8. Do not decide Pay Cash / Use Points / Wait. The backend verdict engine does that later.
9. Ask natural questions. Do not demand rigid formatting from the user.
10. Return valid JSON only.

JSON shape:
{{
  "intent": "trip" | "general_question" | "reset",
  "updates": {{
    "origin": null,
    "destination": null,
    "date": null,
    "tripType": null,
    "travelers": null,
    "cabin": null,
    "return_date": null
  }},
  "hints": {{
    "origin_hint": null,
    "destination_hint": null,
    "month_hint": null
  }},
  "pending_confirmation": {{
    "slot": "origin" | "destination",
    "value": "IATA_CODE",
    "label": "Airport name/code",
    "question": "natural confirmation question"
  }} | null,
  "clear_fields": [],
  "next_question": null,
  "notes": "short private reason"
}}"""

    user_prompt = f"""CURRENT CONFIRMED STATE:
{_safe_json(current_state)}

CONTROL META:
{_safe_json(meta)}

RECENT CHAT:
{_format_history(history)}

LATEST USER MESSAGE:
{text}

Return JSON deltas only."""

    result = await generate_json(system_prompt, user_prompt, temperature=0.0)
    return result if isinstance(result, dict) else {}


def _apply_ai_result(result: Dict[str, Any], state: Dict[str, Any]) -> None:
    meta = _get_meta(state)

    clear_fields = result.get("clear_fields") or []
    if isinstance(clear_fields, list):
        for field in clear_fields:
            if field in TRIP_FIELDS:
                state.pop(field, None)

    updates = result.get("updates") or {}
    if isinstance(updates, dict):
        for key, value in updates.items():
            if value is None or value == "":
                continue
            if key in ["origin", "destination"]:
                code = _normalize_code(value)
                if code:
                    state[key] = code
            elif key == "date":
                parsed = _parse_date_text(str(value), base_date=state.get("date"))
                if parsed.get("date"):
                    state["date"] = parsed["date"]
                elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value).strip()):
                    state["date"] = str(value).strip()
            elif key == "return_date":
                parsed = _parse_date_text(str(value), base_date=state.get("date"))
                if parsed.get("date"):
                    state["return_date"] = parsed["date"]
                elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value).strip()):
                    state["return_date"] = str(value).strip()
            elif key == "tripType":
                trip_type = _normalize_trip_type(value)
                if trip_type:
                    state["tripType"] = trip_type
                    if trip_type == "oneway":
                        state["return_date"] = None
            elif key == "travelers":
                try:
                    travelers = int(value)
                    if 1 <= travelers <= 9:
                        state["travelers"] = travelers
                except (TypeError, ValueError):
                    pass
            elif key == "cabin":
                cabin = _normalize_cabin(value)
                if cabin:
                    state["cabin"] = cabin

    hints = result.get("hints") or {}
    if isinstance(hints, dict):
        for key in ["origin_hint", "destination_hint", "month_hint"]:
            value = _compact(hints.get(key))
            if value:
                meta[key] = value

    pending = result.get("pending_confirmation")
    if isinstance(pending, dict):
        slot = pending.get("slot")
        value = _normalize_code(pending.get("value"))
        if slot in ["origin", "destination"] and value and not state.get(slot):
            meta["pending_confirmation"] = {
                "slot": slot,
                "value": value,
                "label": _strip(pending.get("label")) or value,
                "question": _strip(pending.get("question")) or _confirmation_question(slot, value),
            }

    _clean_state_after_update(state)


def _is_trip_like(text: str, state: Dict[str, Any]) -> bool:
    t = text.strip().lower()
    if t in YES_WORDS or t in NO_WORDS:
        return any(state.get(k) for k in ["origin", "destination", "date", "tripType", "travelers", "cabin"])
    if any(state.get(k) for k in ["origin", "destination", "date", "tripType", "travelers", "cabin"]):
        return True
    keywords = [
        "flight", "fly", "flying", "go to", "travel", "trip", "cash", "points", "miles", "award",
        "one way", "round trip", "roundtrip", "business", "economy", "first", "traveler", "passenger",
        "tomorrow", "next week", "earlier", "later",
    ]
    if any(k in t for k in keywords):
        return True
    if _extract_iata_codes(text):
        return True
    return False


def _next_missing_slot(state: Dict[str, Any]) -> Optional[str]:
    meta = _get_meta(state)
    if meta.get("pending_confirmation"):
        return "pending_confirmation"
    for key in MISSING_ORDER:
        if key == "date" and not state.get("date"):
            return "date"
        if key != "date" and not state.get(key):
            return key
    if state.get("tripType") == "roundtrip" and not state.get("return_date"):
        return "return_date"
    return None


def _prompt_for_missing(slot: str, state: Dict[str, Any]) -> str:
    meta = _get_meta(state)

    if slot == "pending_confirmation":
        pending = meta.get("pending_confirmation") or {}
        return pending.get("question") or _confirmation_question(pending.get("slot", "origin"), _candidate_label(pending))

    if slot == "origin":
        hint = meta.get("origin_hint")
        question = f"Which airport are you flying from near {hint}?" if hint else "Where are you flying from?"
    elif slot == "destination":
        hint = meta.get("destination_hint")
        question = f"Which airport should I use for {hint}?" if hint else "Where do you want to fly to?"
    elif slot == "date":
        month_hint = meta.get("month_hint")
        question = f"What day in {month_hint} should I check?" if month_hint else "What departure date should I check?"
    elif slot == "tripType":
        question = "Is this one way or round trip?"
    elif slot == "return_date":
        question = "What return date should I check?"
    elif slot == "travelers":
        question = "How many travelers should I price?"
    elif slot == "cabin":
        question = "Which cabin should I price: economy, premium economy, business, or first?"
    else:
        question = "Tell me one more trip detail so I can finish this search."

    _set_last_requested(state, slot, question)
    return question


def _friendly_validation_message(exc: Exception, state: Dict[str, Any]) -> str:
    detail = str(exc)
    meta = _get_meta(state)
    if "Date cannot be in the past" in detail:
        return "That date landed in the past. What future date should I check instead?"
    if "Date must be in" in detail:
        if meta.get("month_hint"):
            return f"What day in {meta['month_hint']} should I check?"
        return "What departure date should I check?"
    if "return_date must be after departure date" in detail:
        return "Your return date needs to be after the departure date. What return date should I use?"
    if "Origin and destination cannot be the same" in detail:
        state.pop("origin", None)
        return "The departure and arrival airport came out the same. Where are you flying from?"
    return "I still need one clean trip detail before I can run this search."


def _validate_ready_state(state: Dict[str, Any]) -> SearchParams:
    return SearchParams(
        origin=state["origin"],
        destination=state["destination"],
        date=state["date"],
        cabin=state["cabin"],
        travelers=int(state["travelers"]),
        return_date=state.get("return_date"),
    )


def _strip_redundant_verdict_lead(explanation: str, recommendation: str) -> str:
    if not explanation:
        return explanation
    normalized = explanation.strip()
    patterns = [
        rf"^{re.escape(recommendation)}[:.!\-\s]+",
        rf"^{re.escape(recommendation.lower())}[:.!\-\s]+",
        rf"^{re.escape(recommendation.title())}[:.!\-\s]+",
    ]
    for pattern in patterns:
        cleaned = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()
        if cleaned != normalized:
            return cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned
    return normalized


def _build_zoe_message(search_data: Dict[str, Any]) -> str:
    verdict = search_data.get("verdict") or {}
    recommendation = verdict.get("verdict_label") or ("Pay Cash" if verdict.get("pay_cash") else "Use Points")
    confidence = (verdict.get("confidence") or "medium").title()
    confidence_reason = verdict.get("confidence_reason") or ""
    explanation = _strip_redundant_verdict_lead(
        verdict.get("explanation") or verdict.get("verdict") or "",
        recommendation,
    )
    metrics = verdict.get("metrics") or {}
    data_quality = verdict.get("data_quality") or "full"
    next_step = verdict.get("next_step") or {}

    summary_bits = [
        f"I checked {search_data.get('origin')} to {search_data.get('destination')}",
        f"for {search_data.get('travelers', 1)} traveler{'s' if search_data.get('travelers', 1) != 1 else ''}",
        search_data.get("cabin", "economy").replace("_", " "),
        "round trip" if search_data.get("is_roundtrip") else "one way",
        f"on {search_data.get('date')}",
    ]

    lines = [
        " ".join(summary_bits) + ".",
        "",
        f"**Verdict: {recommendation}**",
    ]

    if explanation:
        lines.append(explanation)

    lines.append(f"**Confidence:** {confidence}")
    if confidence_reason:
        lines.append(confidence_reason)

    cash_price = metrics.get("cash_price")
    points_cost = metrics.get("points_cost")
    taxes = metrics.get("taxes")
    savings = metrics.get("estimated_savings")

    # User-facing Zoe intentionally hides CPP. Keep simple, useful numbers only.
    metric_bits = []
    if cash_price is not None:
        metric_bits.append(f"Cash ${float(cash_price):.0f}")
    if points_cost:
        metric_bits.append(f"Points {int(points_cost):,}")
    if taxes:
        metric_bits.append(f"Taxes ${float(taxes):.0f}")
    if savings:
        metric_bits.append(f"Savings about ${float(savings):.0f}")
    if metric_bits:
        lines.extend(["", "**Details:** " + " · ".join(metric_bits)])

    if data_quality != "full":
        missing = verdict.get("missing_sources") or []
        pretty_missing = ", ".join(m.replace("_", " ") for m in missing) if missing else "some live data"
        lines.extend(["", f"**Heads up:** this answer used partial data. Missing: {pretty_missing}."])

    if next_step.get("label"):
        lines.extend(["", f"**Next step:** {next_step['label']}"])

    return "\n".join(lines)


def _build_suggestions(state: Dict[str, Any], verdict: Optional[Dict[str, Any]] = None, stage: str = "post_verdict") -> list[dict]:
    if stage != "post_verdict":
        return []

    suggestions: list[dict] = []
    next_step = (verdict or {}).get("next_step") or {}
    if next_step.get("label") and next_step.get("prompt"):
        suggestions.append({"emoji": "✨", "label": next_step["label"], "query": next_step["prompt"]})

    if state.get("date") and state.get("origin") and state.get("destination"):
        suggestions.append({
            "emoji": "🗓️",
            "label": "Check a week earlier",
            "query": "What about a week earlier?",
        })
    if state.get("cabin") != "business":
        suggestions.append({"emoji": "💺", "label": "Check business", "query": "What if I do business instead?"})
    if state.get("tripType") != "roundtrip":
        suggestions.append({"emoji": "🔁", "label": "Make it round trip", "query": "What if I make this round trip?"})

    deduped = []
    seen = set()
    for item in suggestions:
        key = (item.get("label", "").lower(), item.get("query", "").lower())
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped[:3]


def _get_zoe_summary(state: Dict[str, Any]) -> str:
    parts = []
    for key in ["origin", "destination", "date", "tripType", "travelers", "cabin", "return_date"]:
        if state.get(key):
            parts.append(f"{key}={state[key]}")
    return ", ".join(parts)


async def handle_zoe(payload: Dict[str, Any], request=None) -> Dict[str, Any]:
    text = (payload.get("message") or "").strip()
    wallet = payload.get("wallet", [])
    incoming = payload.get("slots", {}) or {}
    history = payload.get("history", []) or []
    explicit_slot = payload.get("slot")

    print("📩 USER:", text)
    print("📦 INCOMING SLOTS:", incoming)

    state = _normalize_incoming_state(incoming)
    meta = _get_meta(state)

    if text.lower() == "start":
        fresh_state: Dict[str, Any] = {META_KEY: _empty_meta()}
        return {
            "type": "followup",
            "message": "Tell me the trip you have in mind and I’ll turn it into a clear points-vs-cash verdict. I’ll keep track of the details and only ask for what’s missing.",
            "params": _public_params(fresh_state),
            "suggestions": [
                {"emoji": "✈️", "label": "Start with a route", "query": "I want to compare a flight"},
                {"emoji": "💬", "label": "Ask points vs cash", "query": "Should I use points or pay cash for a trip?"},
            ],
        }

    pending_result = _resolve_pending_confirmation(text, state)
    if pending_result is not None and pending_result.get("type") != "ready_after_confirmation":
        print("🧠 STATE AFTER PENDING:", state)
        return pending_result

    handled_active_slot = bool(pending_result and pending_result.get("type") == "ready_after_confirmation")
    if explicit_slot:
        meta["last_requested_slot"] = explicit_slot
        handled_active_slot = _apply_direct_answer_to_requested_slot(text, state)
    elif meta.get("last_requested_slot"):
        handled_active_slot = _apply_direct_answer_to_requested_slot(text, state)

    if not handled_active_slot:
        _apply_deterministic_updates(text, state)

        ai_result = await _interpret_turn_with_ai(text, state, history)
        print("🤖 AI STATE DELTA:", ai_result)
        if ai_result.get("intent") == "reset":
            state = {META_KEY: _empty_meta()}
        else:
            _apply_ai_result(ai_result, state)

        # If AI marked this as a general non-trip question and there is no active trip,
        # answer it directly instead of forcing the travel flow.
        if ai_result.get("intent") == "general_question" and not _is_trip_like(text, state):
            answer = await _handle_question(text, wallet)
            answer["params"] = _public_params(state)
            return answer

    _clean_state_after_update(state)
    print("🧠 STATE AFTER MERGE:", state)

    # If there is no trip signal at all, use the regular Q&A path.
    if not _is_trip_like(text, state):
        answer = await _handle_question(text, wallet)
        answer["params"] = _public_params(state)
        return answer

    missing = _next_missing_slot(state)
    if missing:
        question = _prompt_for_missing(missing, state)
        return {
            "type": "followup",
            "message": question,
            "params": _public_params(state),
            "suggestions": _build_suggestions(state, stage="collecting"),
        }

    try:
        params = _validate_ready_state(state)
    except Exception as exc:
        question = _friendly_validation_message(exc, state)
        # Ask the slot that validation exposed, but keep it natural.
        if "Date" in str(exc):
            _set_last_requested(state, "date", question)
        return {
            "type": "followup",
            "message": question,
            "params": _public_params(state),
            "suggestions": _build_suggestions(state, stage="collecting"),
        }

    if request is None:
        return {
            "type": "error",
            "message": "I need a live session before I can run a search. Please reload and try again.",
            "params": _public_params(state),
        }

    try:
        search_data = await run_search(request=request, params=params)
        verdict = search_data.get("verdict") or {}
        message = _build_zoe_message(search_data)
        _set_last_requested(state, None, None)
        return {
            "type": "search_result",
            "message": message,
            "data": verdict,
            "search_data": search_data,
            "search_id": search_data.get("search_id"),
            "verdict_id": search_data.get("verdict_id"),
            "params": _public_params(state),
            "suggestions": _build_suggestions(state, verdict, stage="post_verdict"),
        }
    except HTTPException as exc:
        friendly = str(exc.detail) if getattr(exc, "detail", None) else "I hit a search error."
        if "Missing authorization header" in friendly or "Invalid or expired session" in friendly:
            friendly = "Please log in again so I can run a live search for you."
        elif "Date" in friendly:
            friendly = _friendly_validation_message(Exception(friendly), state)
        else:
            friendly = "Sorry, I ran into an issue fetching live results. Please try again."
        return {
            "type": "error",
            "message": friendly,
            "params": _public_params(state),
            "suggestions": _build_suggestions(state, stage="collecting"),
        }
    except Exception as exc:
        print("❌ SEARCH ERROR:", repr(exc))
        return {
            "type": "error",
            "message": "Sorry, I ran into an issue fetching live results. Please try again.",
            "params": _public_params(state),
            "suggestions": _build_suggestions(state, stage="collecting"),
        }
