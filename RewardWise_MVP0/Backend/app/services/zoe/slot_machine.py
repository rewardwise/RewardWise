"""
zoe/slot_machine.py
────────────────────
Deterministic slot-filling state machine for Zoe.

The LLM may parse entities, but this file is the authority for what gets
written to trip_state. It uses session memory, last_asked, IATA lookup, and
short-answer handling so replies like "MIA", "tomorrow", "one way", "2", or
"economy" fill the slot Zoe just asked for.

Key product rule:
LLM can suggest. Zoe memory decides. Slot machine writes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal, Optional

from app.services.zoe.session import TripState, ZoeSession
from app.services.zoe import iata, date_normalizer


# ── Slot labels ──────────────────────────────────────────────────────────────

_SLOT_QUESTIONS: dict[str, str] = {
    "origin": "where they're flying from",
    "destination": "where they're flying to",
    "depart_date": "what date they want to depart",
    "trip_type": "whether it's one-way or round-trip",
    "return_date": "what date they want to return",
    "travelers": "how many travelers are going",
    "cabin": "what cabin class they want",
}

_SLOT_PROMPT: dict[str, str] = {
    "origin": "Where will you be flying from?",
    "destination": "Where are you headed?",
    "depart_date": "When are you looking to fly?",
    "trip_type": "Is this a one-way trip or round-trip?",
    "return_date": "And when are you coming back?",
    "travelers": "How many travelers?",
    "cabin": "What cabin class do you want — economy, premium economy, business, or first?",
}


@dataclass
class SlotDecision:
    """The output of the slot machine — what to do on this turn."""

    trip_state: TripState
    stage: Literal["collecting", "searching", "explaining_verdict", "off_trip", "reset"]
    next_slot: Optional[str] = None
    next_slot_description: Optional[str] = None
    fallback_question: Optional[str] = None
    ready_to_search: bool = False
    prefill: Optional[dict] = None
    resolution_notes: list[str] = field(default_factory=list)


def run(
    session: ZoeSession,
    intent: str,
    entities: dict,
    *,
    user_message: str = "",
    is_voice: bool = False,
) -> SlotDecision:
    """
    Run the slot machine for one turn.

    Critical rule: session.last_asked wins for short/direct answers. The LLM
    parser can suggest values, but Zoe's memory decides where they belong.
    """

    # ── Non-trip intents bypass trip slot filling ────────────────────────────
    if intent in ("destination", "wallet_support", "verdict_strategy", "off_topic"):
        return SlotDecision(
            trip_state=session.trip_state,
            stage="off_trip",
            next_slot=None,
            ready_to_search=False,
        )

    if intent == "reset":
        return SlotDecision(
            trip_state=TripState(),
            stage="reset",
            next_slot=None,
            ready_to_search=False,
        )

    # ── Resolve + merge entities using current session context ───────────────
    resolved_entities, notes = _resolve_entities(
        entities,
        session=session,
        user_message=user_message,
    )

    new_state = session.trip_state.merge(resolved_entities)

    # Trip type correction: one-way means return date must be cleared.
    # TripState.merge intentionally does not clear fields, so do it here.
    if resolved_entities.get("trip_type") == "oneway" and new_state.return_date:
        new_state = new_state.model_copy(update={"return_date": None})
        notes.append("Cleared return date because trip type is one-way")

    # ── Determine next action ────────────────────────────────────────────────
    missing = new_state.missing_required()

    if not missing:
        prefill = new_state.to_prefill()
        return SlotDecision(
            trip_state=new_state,
            stage="searching",
            next_slot=None,
            ready_to_search=True,
            prefill=prefill,
            resolution_notes=notes,
        )

    next_slot = missing[0]

    # Do NOT rotate to another missing slot just because the user failed to
    # answer. That is how Zoe gets out of sync with what she actually asked.
    return SlotDecision(
        trip_state=new_state,
        stage="collecting",
        next_slot=next_slot,
        next_slot_description=_SLOT_QUESTIONS.get(next_slot, next_slot),
        fallback_question=_SLOT_PROMPT.get(next_slot),
        ready_to_search=False,
        resolution_notes=notes,
    )


# ── Entity resolution ────────────────────────────────────────────────────────

def _resolve_entities(
    entities: dict,
    *,
    session: ZoeSession | None = None,
    user_message: str = "",
) -> tuple[dict, list[str]]:
    """
    Resolve raw parse output into safe trip_state updates.

    Priority:
      1. Generic explicit entities from parse_call
      2. Deterministic phrase extraction from the raw message
      3. last_asked slot override for short/direct answers

    The override is the smart part: if Zoe asked for destination and the user
    says "MIA" or "I already told you Miami", it MUST write destination=MIA
    even if the parser mislabeled it.
    """
    resolved: dict = {}
    notes: list[str] = []
    raw = (user_message or "").strip()

    # First apply parser output normally.
    _apply_generic_entities(resolved, notes, entities)

    # Then patch parser gaps with deterministic route phrase extraction.
    _apply_raw_route_heuristics(resolved, notes, raw, session)

    # Finally let session memory override parser ambiguity.
    _apply_last_asked_override(resolved, notes, entities, raw, session)

    return resolved, notes


def _apply_generic_entities(resolved: dict, notes: list[str], entities: dict) -> None:
    """Apply explicit parser entities before context overrides."""

    origin_text = entities.get("origin_text") or entities.get("origin")
    if _has_value(origin_text):
        code = _lookup_airport(origin_text)
        if code:
            resolved["origin"] = code
            if iata.city_name(code).lower() != str(origin_text).lower():
                notes.append(f"Resolved origin '{origin_text}' → {code} ({iata.city_name(code)})")
        else:
            resolved["origin"] = str(origin_text)

    dest_text = entities.get("destination_text") or entities.get("destination")
    if _has_value(dest_text):
        code = _lookup_airport(dest_text)
        if code:
            resolved["destination"] = code
            if iata.city_name(code).lower() != str(dest_text).lower():
                notes.append(f"Resolved destination '{dest_text}' → {code} ({iata.city_name(code)})")
        else:
            resolved["destination"] = str(dest_text)

    date_text = entities.get("date_text") or entities.get("depart_date") or entities.get("date")
    if _has_value(date_text):
        iso = date_normalizer.normalize(str(date_text))
        if iso:
            resolved["depart_date"] = iso
            if iso != str(date_text):
                notes.append(f"Normalized date '{date_text}' → {iso}")

    return_text = entities.get("return_date_text") or entities.get("return_date")
    if _has_value(return_text):
        iso = date_normalizer.normalize(str(return_text))
        if iso:
            resolved["return_date"] = iso

    trip_type = _parse_trip_type(entities.get("trip_type"))
    if trip_type:
        resolved["trip_type"] = trip_type

    if resolved.get("return_date") and not resolved.get("trip_type"):
        resolved["trip_type"] = "roundtrip"

    cabin = _normalize_cabin(entities.get("cabin"))
    if cabin:
        resolved["cabin"] = cabin

    travelers = _parse_travelers(entities.get("travelers"))
    if travelers is not None:
        resolved["travelers"] = travelers


def _apply_raw_route_heuristics(
    resolved: dict,
    notes: list[str],
    raw: str,
    session: ZoeSession | None,
) -> None:
    """
    Deterministically recover obvious route info from raw text.

    This covers cases where the parse LLM misses phrases like:
      - "I want to go to miami"
      - "from newark"
      - "I already told you Miami"
    """
    if not raw:
        return

    current = session.trip_state if session else TripState()

    # Explicit origin phrases win origin.
    if "origin" not in resolved:
        origin_phrase = _extract_after_marker(
            raw,
            markers=(
                "from",
                "out of",
                "leaving from",
                "departing from",
                "flying from",
                "fly from",
            ),
        )
        code = _find_airport_in_text(origin_phrase) if origin_phrase else None
        if code:
            resolved["origin"] = code
            notes.append(f"Resolved origin from raw message → {code} ({iata.city_name(code)})")

    # Explicit destination phrases win destination.
    if "destination" not in resolved:
        dest_phrase = _extract_after_marker(
            raw,
            markers=(
                "to",
                "into",
                "headed to",
                "going to",
                "go to",
                "travel to",
                "traveling to",
                "flying to",
                "fly to",
                "visit",
                "visiting",
            ),
        )
        code = _find_airport_in_text(dest_phrase) if dest_phrase else None
        if code:
            resolved["destination"] = code
            notes.append(f"Resolved destination from raw message → {code} ({iata.city_name(code)})")

    # Memory-aware fallback: if exactly one side is missing, airport/city text
    # in a short correction/direct answer should fill the missing side.
    found_airport = _find_airport_in_text(raw)
    if found_airport:
        if current.origin and not current.destination and "destination" not in resolved:
            resolved.pop("origin", None)
            resolved["destination"] = found_airport
            notes.append(f"Used memory to fill missing destination → {found_airport} ({iata.city_name(found_airport)})")
        elif current.destination and not current.origin and "origin" not in resolved:
            resolved.pop("destination", None)
            resolved["origin"] = found_airport
            notes.append(f"Used memory to fill missing origin → {found_airport} ({iata.city_name(found_airport)})")


def _apply_last_asked_override(
    resolved: dict,
    notes: list[str],
    entities: dict,
    raw: str,
    session: ZoeSession | None,
) -> None:
    """Force direct answers into the slot Zoe just asked for."""
    if not session or not session.last_asked or not raw:
        return

    last_slot = session.last_asked

    if last_slot == "origin":
        value = (
            entities.get("origin_text")
            or entities.get("origin")
            or entities.get("destination_text")
            or entities.get("destination")
            or raw
        )
        code = _find_airport_in_text(str(value)) or _find_airport_in_text(raw)
        if code:
            # Remove any parser-misassigned destination from this turn only.
            resolved.pop("destination", None)
            resolved["origin"] = code
            notes.append(f"Used direct answer for origin → {code} ({iata.city_name(code)})")

    elif last_slot == "destination":
        value = (
            entities.get("destination_text")
            or entities.get("destination")
            or entities.get("origin_text")
            or entities.get("origin")
            or raw
        )
        code = _find_airport_in_text(str(value)) or _find_airport_in_text(raw)
        if code:
            # Remove any parser-misassigned origin from this turn only.
            resolved.pop("origin", None)
            resolved["destination"] = code
            notes.append(f"Used direct answer for destination → {code} ({iata.city_name(code)})")

    elif last_slot == "depart_date":
        value = entities.get("date_text") or entities.get("depart_date") or entities.get("date") or raw
        iso = date_normalizer.normalize(str(value)) if value else None
        if iso:
            resolved["depart_date"] = iso
            notes.append(f"Used direct answer for departure date → {iso}")

    elif last_slot == "return_date":
        value = entities.get("return_date_text") or entities.get("return_date") or entities.get("date_text") or raw
        iso = date_normalizer.normalize(str(value)) if value else None
        if iso:
            resolved["return_date"] = iso
            resolved["trip_type"] = "roundtrip"
            notes.append(f"Used direct answer for return date → {iso}")

    elif last_slot == "trip_type":
        value = entities.get("trip_type") or raw
        trip_type = _parse_trip_type(value)
        if trip_type:
            resolved["trip_type"] = trip_type
            if trip_type == "oneway":
                resolved.pop("return_date", None)
            notes.append(f"Used direct answer for trip type → {trip_type}")

    elif last_slot == "travelers":
        value = entities.get("travelers") or raw
        travelers = _parse_travelers(value)
        if travelers is not None:
            resolved["travelers"] = travelers
            notes.append(f"Used direct answer for travelers → {travelers}")

    elif last_slot == "cabin":
        value = entities.get("cabin") or raw
        cabin = _normalize_cabin(value)
        if cabin:
            resolved["cabin"] = cabin
            notes.append(f"Used direct answer for cabin → {cabin}")


def _has_value(value) -> bool:
    return value is not None and value != "null" and str(value).strip() != ""


def _strip_airport_prefix(text: str) -> str:
    """Remove common short-answer prefixes before IATA lookup."""
    cleaned = text.strip()
    cleaned = re.sub(
        r"^(?:from|leaving from|departing from|out of|to|into|headed to|going to|go to|fly(?:ing)? to|fly from|flying from|visit(?:ing)?)\s+",
        "",
        cleaned,
        flags=re.I,
    )
    return cleaned.strip(" .,!?")


def _extract_after_marker(text: str, *, markers: tuple[str, ...]) -> Optional[str]:
    """Extract the phrase immediately after a route marker like 'from' or 'to'."""
    if not text:
        return None

    # Longer markers first so "going to" beats "to".
    ordered = sorted(markers, key=len, reverse=True)
    marker_re = "|".join(re.escape(m) for m in ordered)
    match = re.search(rf"\b(?:{marker_re})\b\s+(.+)$", text, re.I)
    if not match:
        return None

    phrase = match.group(1).strip(" .,!?")

    # Cut off common trailing clauses.
    phrase = re.split(
        r"\b(?:next|this|on|in|for|with|round\s*trip|one\s*way|economy|business|first|premium)\b",
        phrase,
        maxsplit=1,
        flags=re.I,
    )[0].strip(" .,!?")

    return phrase or None


def _lookup_airport(value) -> Optional[str]:
    if not _has_value(value):
        return None
    return iata.lookup(_strip_airport_prefix(str(value)))


def _find_airport_in_text(text: str | None) -> Optional[str]:
    """
    Find an airport/city anywhere inside a sentence.

    iata.lookup("I already told you Miami") will not match, so this scans
    meaningful word n-grams and direct 3-letter IATA codes.
    """
    if not _has_value(text):
        return None

    cleaned = _strip_airport_prefix(str(text))

    # Direct whole-phrase lookup first.
    code = iata.lookup(cleaned)
    if code:
        return code

    # Direct IATA code inside sentence, e.g. "make it MIA".
    for m in re.finditer(r"\b([A-Za-z]{3})\b", cleaned):
        candidate = m.group(1).upper()
        if iata.validate(candidate):
            return candidate

    # Scan n-grams, longest first. This catches "new york", "fort lauderdale",
    # and simple single-token places like "Miami".
    words = re.findall(r"[A-Za-z][A-Za-z'.-]*", cleaned)
    stopwords = {
        "i", "already", "told", "you", "me", "my", "the", "a", "an", "please",
        "actually", "sorry", "meant", "mean", "it", "is", "was", "make", "change",
        "from", "to", "into", "go", "going", "headed", "flying", "fly", "travel",
        "want", "wanna", "need", "would", "like", "trip", "flight", "airport",
    }

    for size in range(min(4, len(words)), 0, -1):
        for i in range(0, len(words) - size + 1):
            chunk_words = words[i : i + size]
            if all(w.lower() in stopwords for w in chunk_words):
                continue
            phrase = " ".join(chunk_words)
            code = iata.lookup(phrase)
            if code:
                return code

    return None


def _parse_trip_type(value) -> Optional[Literal["oneway", "roundtrip"]]:
    if not _has_value(value):
        return None
    text = str(value).lower().strip()
    if re.search(r"\b(round\s*trip|round-trip|roundtrip|return)\b", text):
        return "roundtrip"
    if re.search(r"\b(one\s*way|one-way|oneway|single)\b", text):
        return "oneway"
    return None


def _normalize_cabin(value) -> Optional[str]:
    if not _has_value(value):
        return None
    text = str(value).lower().strip().replace("-", "_")
    cabin_map = {
        "economy": "economy",
        "coach": "economy",
        "main cabin": "economy",
        "business": "business",
        "biz": "business",
        "business class": "business",
        "first": "first",
        "first class": "first",
        "premium economy": "premium_economy",
        "premium": "premium_economy",
        "premium_economy": "premium_economy",
        "premiumeconomy": "premium_economy",
    }
    return cabin_map.get(text)


def _parse_travelers(value) -> Optional[int]:
    if not _has_value(value):
        return None

    text = str(value).lower().strip()
    word_map = {
        "one": 1,
        "solo": 1,
        "just me": 1,
        "me": 1,
        "two": 2,
        "couple": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
    }

    if text in word_map:
        return word_map[text]

    for phrase, n in word_map.items():
        if re.search(rf"\b{re.escape(phrase)}\b", text):
            return n

    match = re.search(r"\b([1-9])\b", text)
    if match:
        return int(match.group(1))

    try:
        n = int(value)
        if 1 <= n <= 9:
            return n
    except (ValueError, TypeError):
        pass

    return None


def format_confirmed_state(state: TripState) -> str:
    """Format confirmed trip state for prompt/context display."""
    lines = []
    if state.origin:
        city = iata.city_name(state.origin) if iata.validate(state.origin) else state.origin
        lines.append(f"  From: {state.origin} ({city})")
    if state.destination:
        city = iata.city_name(state.destination) if iata.validate(state.destination) else state.destination
        lines.append(f"  To: {state.destination} ({city})")
    if state.depart_date:
        lines.append(f"  Departing: {state.depart_date}")
    if state.return_date:
        lines.append(f"  Returning: {state.return_date}")
    if state.trip_type:
        lines.append(f"  Trip type: {state.trip_type}")
    if state.cabin:
        lines.append(f"  Cabin: {state.cabin}")
    if state.travelers:
        lines.append(f"  Travelers: {state.travelers}")
    return "\n".join(lines) if lines else "  (nothing confirmed yet)"


def format_missing_slots(state: TripState) -> str:
    """Format missing required slots for LLM context."""
    missing = state.missing_required()
    if not missing:
        return "none — all required fields confirmed!"
    return ", ".join(_SLOT_QUESTIONS.get(s, s) for s in missing)
