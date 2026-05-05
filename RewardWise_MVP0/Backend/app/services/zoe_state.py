from __future__ import annotations

from datetime import date, datetime, timedelta
import re
from typing import Any, Optional

from app.api.validators import SearchParams
from app.services.airport_resolver import (
    AirportOption,
    AirportResolution,
    format_airport_options,
    is_airport_options_request,
    options_for_hint,
    resolve_airport_text,
)
from app.validators.airport_codes import is_valid_airport_code

META_KEY = "__zoe_meta"
TRIP_FIELDS = {"origin", "destination", "date", "tripType", "travelers", "cabin", "return_date"}
MISSING_ORDER = ["destination", "origin", "date", "tripType", "travelers", "cabin"]
YES_WORDS = {"yes", "yeah", "yep", "yup", "sure", "correct", "right", "ok", "okay", "sounds good", "do it", "use it", "yea"}
NO_WORDS = {"no", "nope", "nah", "wrong", "not that", "don't", "dont"}

MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10, "november": 11, "nov": 11, "december": 12, "dec": 12,
}


def today() -> date:
    return date.today()


def strip_text(value: Any) -> str:
    return str(value or "").strip()


def normalize_code(value: Any) -> Optional[str]:
    raw = strip_text(value).upper()
    if re.fullmatch(r"[A-Z]{3}", raw) and is_valid_airport_code(raw):
        return raw
    return None


def empty_meta() -> dict[str, Any]:
    return {
        "last_requested_slot": None,
        "pending_confirmation": None,
        "origin_hint": None,
        "destination_hint": None,
        "month_hint": None,
        "last_question": None,
        "airport_options_slot": None,
        "airport_options_hint": None,
        "airport_options": None,
        "conversation_mode": "collecting",
    }


def fresh_state() -> dict[str, Any]:
    return {META_KEY: empty_meta()}


def get_meta(state: dict[str, Any]) -> dict[str, Any]:
    meta = state.get(META_KEY)
    merged = empty_meta()
    if isinstance(meta, dict):
        merged.update(meta)
    state[META_KEY] = merged
    return merged


def public_params(state: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in state.items() if v is not None}


def normalize_incoming_state(incoming: dict[str, Any]) -> dict[str, Any]:
    state: dict[str, Any] = {}
    meta = empty_meta()
    if isinstance(incoming.get(META_KEY), dict):
        meta.update(incoming[META_KEY])
    for key in meta.keys():
        if incoming.get(key) is not None:
            meta[key] = incoming[key]
    for key, value in incoming.items():
        if key == META_KEY or str(key).startswith("__") or value in (None, ""):
            continue
        if key in {"origin", "destination"}:
            code = normalize_code(value)
            if code:
                state[key] = code
        elif key in {"date", "return_date"}:
            state[key] = strip_text(value)
        elif key == "tripType":
            trip_type = normalize_trip_type(value)
            if trip_type:
                state[key] = trip_type
        elif key == "travelers":
            try:
                travelers = int(value)
                if 1 <= travelers <= 9:
                    state[key] = travelers
            except Exception:
                pass
        elif key == "cabin":
            cabin = normalize_cabin(value)
            if cabin:
                state[key] = cabin
        elif key == "program_hints" and isinstance(value, list):
            state[key] = value
    state[META_KEY] = meta
    return state


def set_last_requested(state: dict[str, Any], slot: Optional[str], question: Optional[str] = None) -> None:
    meta = get_meta(state)
    meta["last_requested_slot"] = slot
    if question is not None:
        meta["last_question"] = question


def clear_airport_options(state: dict[str, Any], slot: str | None = None) -> None:
    meta = get_meta(state)
    if slot is None or meta.get("airport_options_slot") == slot:
        meta["airport_options_slot"] = None
        meta["airport_options_hint"] = None
        meta["airport_options"] = None


def set_airport_options(state: dict[str, Any], slot: str, hint: str, options: list[AirportOption]) -> None:
    meta = get_meta(state)
    meta["airport_options_slot"] = slot
    meta["airport_options_hint"] = hint
    meta["airport_options"] = [o.to_dict() for o in options]
    meta[f"{slot}_hint"] = hint
    set_last_requested(state, slot)


def clean_after_update(state: dict[str, Any]) -> None:
    meta = get_meta(state)
    if state.get("origin"):
        meta["origin_hint"] = None
        if meta.get("last_requested_slot") == "origin":
            set_last_requested(state, None, None)
        clear_airport_options(state, "origin")
    if state.get("destination"):
        meta["destination_hint"] = None
        if meta.get("last_requested_slot") == "destination":
            set_last_requested(state, None, None)
        clear_airport_options(state, "destination")
    if state.get("date"):
        meta["month_hint"] = None
        if meta.get("last_requested_slot") == "date":
            set_last_requested(state, None, None)
    if state.get("tripType") == "oneway":
        state["return_date"] = None
    if state.get("return_date") and meta.get("last_requested_slot") == "return_date":
        set_last_requested(state, None, None)


def is_affirmative(text: str) -> bool:
    return strip_text(text).lower().rstrip(".?!") in YES_WORDS


def is_negative(text: str) -> bool:
    t = strip_text(text).lower().rstrip(".?!")
    return t in NO_WORDS or any(t.startswith(word + " ") for word in NO_WORDS)


def normalize_trip_type(value: Any) -> Optional[str]:
    v = strip_text(value).lower().replace("-", " ")
    if not v:
        return None
    if "round" in v or "return" in v or v == "rt":
        return "roundtrip"
    if "one" in v or "single" in v or v == "ow":
        return "oneway"
    return None


def normalize_cabin(value: Any) -> Optional[str]:
    v = strip_text(value).lower().replace("-", " ")
    if not v:
        return None
    if "premium" in v:
        return "premium_economy"
    if "business" in v or v in {"biz", "j"}:
        return "business"
    if "first" in v or v == "f":
        return "first"
    if "economy" in v or "ecoomy" in v or "econ" in v or "coach" in v or v == "y":
        return "economy"
    return None


def extract_travelers(text: str) -> Optional[int]:
    t = strip_text(text).lower()
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9}
    if t in words:
        return words[t]
    if t.isdigit():
        value = int(t)
        return value if 1 <= value <= 9 else None
    m = re.search(r"\b([1-9])\b", t)
    if m:
        return int(m.group(1))
    for word, value in words.items():
        if re.search(rf"\b{word}\b", t):
            return value
    return None


def _next_future_month_day(month: int, day: int) -> Optional[str]:
    current = today()
    for year in [current.year, current.year + 1, current.year + 2]:
        try:
            candidate = date(year, month, day)
        except ValueError:
            return None
        if candidate >= current:
            return candidate.isoformat()
    return None


def _next_weekday(start: date, weekday: int, *, at_least_days: int = 1) -> date:
    target = start + timedelta(days=at_least_days)
    while target.weekday() != weekday:
        target += timedelta(days=1)
    return target


def parse_date_text(text: str, *, base_date: Optional[str] = None, slot: str = "date") -> dict[str, Any]:
    t = strip_text(text).lower()
    result: dict[str, Any] = {}
    current = today()
    base: date | None = None
    if base_date:
        try:
            base = datetime.strptime(base_date, "%Y-%m-%d").date()
        except ValueError:
            base = None

    if not t:
        return result

    # Return-date relative phrases first.
    if slot == "return_date" and base:
        m = re.search(r"\b(\d+)\s+days?\s+(after|later)\b", t)
        if m:
            result["date"] = (base + timedelta(days=int(m.group(1)))).isoformat()
            return result
        word_days = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7}
        for word, days in word_days.items():
            if re.search(rf"\b{word}\s+days?\s+(after|later)\b", t) or re.search(rf"\b{word}\s+days?\s+after\s+i\s+leave\b", t):
                result["date"] = (base + timedelta(days=days)).isoformat()
                return result
        if "next to next weekend" in t or "weekend after next" in t:
            result["date"] = _next_weekday(base, 5, at_least_days=7).isoformat()
            return result

    if "week earlier" in t and base:
        result["date"] = (base - timedelta(days=7)).isoformat()
        return result
    if "week later" in t and base:
        result["date"] = (base + timedelta(days=7)).isoformat()
        return result
    if "day earlier" in t and base:
        result["date"] = (base - timedelta(days=1)).isoformat()
        return result
    if "day later" in t and base:
        result["date"] = (base + timedelta(days=1)).isoformat()
        return result

    if "tomorrow" in t:
        result["date"] = (current + timedelta(days=1)).isoformat()
        return result
    if "today" in t:
        result["date"] = current.isoformat()
        return result
    if "next to next weekend" in t or "weekend after next" in t:
        result["date"] = _next_weekday(current, 5, at_least_days=8).isoformat()
        return result
    if "next weekend" in t:
        result["date"] = _next_weekday(current, 5, at_least_days=1).isoformat()
        return result
    if "next week" in t:
        result["date"] = (current + timedelta(days=7)).isoformat()
        return result

    iso = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
    if iso:
        result["date"] = iso.group(1)
        return result

    slash = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", t)
    if slash:
        month, day = int(slash.group(1)), int(slash.group(2))
        year_text = slash.group(3)
        if year_text:
            year = int(year_text) + (2000 if int(year_text) < 100 else 0)
            try:
                result["date"] = date(year, month, day).isoformat()
            except ValueError:
                pass
        else:
            resolved = _next_future_month_day(month, day)
            if resolved:
                result["date"] = resolved
        return result

    month_names = "|".join(sorted(MONTHS.keys(), key=len, reverse=True))
    md = re.search(rf"\b({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b", t)
    if md:
        month = MONTHS[md.group(1)]
        day = int(md.group(2))
        if md.group(3):
            try:
                result["date"] = date(int(md.group(3)), month, day).isoformat()
            except ValueError:
                pass
        else:
            resolved = _next_future_month_day(month, day)
            if resolved:
                result["date"] = resolved
        return result

    mo = re.search(rf"\b({month_names})\b", t)
    if mo:
        result["month_hint"] = mo.group(1).title()
    return result


def _airport_slot_followup(slot: str, hint: str | None = None) -> str:
    cleaned_hint = strip_text(hint)
    direction = "from" if slot == "origin" else "to"
    if cleaned_hint:
        return f"Which city or airport in {cleaned_hint} are you flying {direction}?"
    return "Which airport are you flying from?" if slot == "origin" else "Which airport do you want to fly to?"


def _is_confusion_or_meta_reply(text: str) -> bool:
    t = strip_text(text).lower()
    if not t:
        return True
    exact_markers = {
        "what", "what?", "huh", "huh?", "why", "why?", "what do you mean",
        "i already told you", "already told you", "we just talked", "there",
        "fuck you", "wtf", "nigga what", "bro what", "bruh what",
    }
    if t in exact_markers:
        return True
    return any(marker in t for marker in ["already told", "what do you mean", "we just talked"])


def apply_airport_resolution(state: dict[str, Any], slot: str, text: str, *, allow_options: bool = True) -> dict[str, Any] | None:
    meta = get_meta(state)
    context = meta.get("airport_options") if meta.get("airport_options_slot") == slot else None
    resolution = resolve_airport_text(text, context_options=context)

    if resolution.status == "resolved" and resolution.airport:
        state[slot] = resolution.airport.iata
        clean_after_update(state)
        return {"handled": True}

    if resolution.status == "options" and allow_options:
        hint = resolution.hint or text
        set_airport_options(state, slot, hint, list(resolution.options))
        return {"handled": True, "question": airport_options_question(slot, hint, list(resolution.options))}

    # Broad locations such as countries, states, provinces, and continents are
    # valid location hints but not verdict-ready airports. Keep Zoe pinned to
    # the current origin/destination slot and ask for a city/airport instead of
    # falling through to generic Q&A.
    if resolution.status == "broad":
        hint = resolution.hint or text
        meta[f"{slot}_hint"] = hint
        clear_airport_options(state, slot)
        question = _airport_slot_followup(slot, hint)
        set_last_requested(state, slot, question)
        return {"handled": True, "question": question}

    # If Zoe is actively collecting an airport and the answer is unresolved, do
    # not let generic Q&A steal the turn. Preserve the existing hint unless the
    # user provided a new location-like answer.
    if meta.get("last_requested_slot") == slot or meta.get("airport_options_slot") == slot:
        if not _is_confusion_or_meta_reply(text):
            meta[f"{slot}_hint"] = resolution.hint or text
        hint = meta.get(f"{slot}_hint")
        question = _airport_slot_followup(slot, hint)
        set_last_requested(state, slot, question)
        return {"handled": True, "question": question}

    return None

def airport_options_question(slot: str, hint: str, options: list[AirportOption]) -> str:
    return format_airport_options(options, hint=hint)


def handle_airport_options_request(state: dict[str, Any], text: str) -> dict[str, Any] | None:
    if not is_airport_options_request(text):
        return None
    meta = get_meta(state)
    slot = meta.get("airport_options_slot") or meta.get("last_requested_slot")
    if slot not in {"origin", "destination"}:
        return None
    hint = meta.get("airport_options_hint") or meta.get(f"{slot}_hint")
    options = []
    if isinstance(meta.get("airport_options"), list):
        for item in meta["airport_options"]:
            if item.get("iata"):
                # Re-resolve code to a full option via context matching.
                res = resolve_airport_text(str(item["iata"]))
                if res.airport:
                    options.append(res.airport)
    if not options:
        options = options_for_hint(hint)
    if options:
        set_airport_options(state, slot, hint or "that place", options)
    question = format_airport_options(options, hint=hint)
    set_last_requested(state, slot, question)
    return {"type": "followup", "message": question, "params": public_params(state), "suggestions": []}


def apply_active_slot_answer(state: dict[str, Any], text: str) -> dict[str, Any] | None:
    meta = get_meta(state)
    slot = meta.get("last_requested_slot")
    if not slot:
        return None
    if slot in {"origin", "destination"}:
        result = apply_airport_resolution(state, slot, text)
        if result and result.get("question"):
            return {"type": "followup", "message": result["question"], "params": public_params(state), "suggestions": []}
        if result:
            return {"handled": True}
        return None
    if slot in {"date", "return_date"}:
        parsed = parse_date_text(text, base_date=state.get("date"), slot=slot)
        if parsed.get("date"):
            state[slot] = parsed["date"]
            clean_after_update(state)
            return {"handled": True}
        if parsed.get("month_hint") and slot == "date":
            meta["month_hint"] = parsed["month_hint"]
            return {"handled": True}
    if slot == "tripType":
        trip_type = normalize_trip_type(text)
        if trip_type:
            state["tripType"] = trip_type
            clean_after_update(state)
            return {"handled": True}
    if slot == "travelers":
        travelers = extract_travelers(text)
        if travelers:
            state["travelers"] = travelers
            clean_after_update(state)
            return {"handled": True}
    if slot == "cabin":
        cabin = normalize_cabin(text)
        if cabin:
            state["cabin"] = cabin
            clean_after_update(state)
            return {"handled": True}
    return None


def apply_basic_updates(state: dict[str, Any], text: str) -> None:
    # Exact code route patterns only; city route handled by reconciler + resolver.
    route = re.search(r"\bfrom\s+([A-Za-z]{3})\s+to\s+([A-Za-z]{3})\b", text, re.I)
    if route:
        origin = normalize_code(route.group(1))
        dest = normalize_code(route.group(2))
        if origin:
            state["origin"] = origin
        if dest:
            state["destination"] = dest
    date_info = parse_date_text(text, base_date=state.get("date"), slot="return_date" if get_meta(state).get("last_requested_slot") == "return_date" else "date")
    if date_info.get("date"):
        target = "return_date" if get_meta(state).get("last_requested_slot") == "return_date" else "date"
        state[target] = date_info["date"]
    elif date_info.get("month_hint") and not state.get("date"):
        get_meta(state)["month_hint"] = date_info["month_hint"]
    trip_type = normalize_trip_type(text)
    if trip_type:
        state["tripType"] = trip_type
    cabin = normalize_cabin(text)
    if cabin:
        state["cabin"] = cabin
    travelers = extract_travelers(text)
    if travelers:
        state["travelers"] = travelers
    clean_after_update(state)


def handle_pending_confirmation(state: dict[str, Any], text: str) -> dict[str, Any] | None:
    meta = get_meta(state)
    pending = meta.get("pending_confirmation")
    if not isinstance(pending, dict):
        return None
    slot = pending.get("slot")
    value = normalize_code(pending.get("value"))
    if is_affirmative(text) and slot in {"origin", "destination"} and value:
        state[slot] = value
        meta["pending_confirmation"] = None
        set_last_requested(state, None, None)
        clean_after_update(state)
        return {"handled": True}
    if is_negative(text):
        meta["pending_confirmation"] = None
        set_last_requested(state, slot, None)
        return {"handled": True}
    # Concrete code/name overrides pending candidate.
    if slot in {"origin", "destination"}:
        result = apply_airport_resolution(state, slot, text)
        if result:
            meta["pending_confirmation"] = None
            return {"handled": True}
    question = pending.get("question") or f"Should I use {pending.get('label') or value} for {slot}?"
    set_last_requested(state, slot, question)
    return {"type": "followup", "message": question, "params": public_params(state), "suggestions": []}


def next_missing_slot(state: dict[str, Any]) -> Optional[str]:
    meta = get_meta(state)
    if meta.get("pending_confirmation"):
        return "pending_confirmation"
    for slot in MISSING_ORDER:
        if not state.get(slot):
            return slot
    if state.get("tripType") == "roundtrip" and not state.get("return_date"):
        return "return_date"
    return None


def prompt_for_missing(state: dict[str, Any], slot: str) -> str:
    meta = get_meta(state)
    if slot == "pending_confirmation":
        pending = meta.get("pending_confirmation") or {}
        return pending.get("question") or "Please confirm that airport."
    if slot == "origin":
        hint = meta.get("origin_hint")
        q = f"Which airport are you flying from near {hint}?" if hint else "Where are you flying from?"
    elif slot == "destination":
        hint = meta.get("destination_hint")
        q = f"Which airport should I use for {hint}?" if hint else "Where do you want to fly to?"
    elif slot == "date":
        hint = meta.get("month_hint")
        q = f"What day in {hint} should I check?" if hint else "What departure date should I check?"
    elif slot == "tripType":
        q = "Is this one way or round trip?"
    elif slot == "travelers":
        q = "How many travelers should I price?"
    elif slot == "cabin":
        q = "Which cabin should I price: economy, business, or first?"
    elif slot == "return_date":
        q = "When are you coming back?"
    else:
        q = "Tell me one more trip detail so I can finish this search."
    set_last_requested(state, slot, q)
    return q


def validation_message(exc: Exception, state: dict[str, Any]) -> str:
    detail = str(exc)
    if "Date cannot be in the past" in detail:
        return "That date landed in the past. What future date should I check instead?"
    if "return_date must be after departure date" in detail:
        set_last_requested(state, "return_date", None)
        return "That return date is before the departure. When are you coming back?"
    if "Origin and destination cannot be the same" in detail:
        state.pop("origin", None)
        set_last_requested(state, "origin", None)
        return "The departure and arrival came out the same. Where are you flying from?"
    return "I still need one clean trip detail before I can run this search."


def validate_ready_state(state: dict[str, Any]) -> SearchParams:
    return SearchParams(
        origin=state["origin"],
        destination=state["destination"],
        date=state["date"],
        cabin=state["cabin"],
        travelers=int(state["travelers"]),
        return_date=state.get("return_date"),
    )
