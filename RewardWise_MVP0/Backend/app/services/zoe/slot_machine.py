"""
zoe/slot_machine.py
────────────────────
The slot-filling state machine. Pure Python — no LLM.

This is the mechanism that enforces the one-question-per-response guarantee.
It decides WHAT to communicate next. The LLM decides HOW to say it.

Responsibilities:
  - Identify the next required slot to ask about
  - Transition between stages
  - Merge newly extracted entities into trip state
  - Resolve text → IATA codes and normalize dates

The result of run() is a SlotDecision that gets handed to the handler
which then builds the respond-call context.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

from app.services.zoe.session import TripState, ZoeSession
from app.services.zoe import iata, date_normalizer


# ── Slot labels (human-readable for use in respond-call context) ──────────────

_SLOT_QUESTIONS: dict[str, str] = {
    "origin":      "where they're flying from",
    "destination": "where they're flying to",
    "depart_date": "what date they want to depart",
    "trip_type":   "whether it's one-way or round-trip",
    "return_date": "what date they want to return",
}

_SLOT_PROMPT: dict[str, str] = {
    "origin":      "Where will you be flying from?",
    "destination": "Where are you headed?",
    "depart_date": "When are you looking to fly?",
    "trip_type":   "Is this a one-way trip or round-trip?",
    "return_date": "And when are you coming back?",
}


@dataclass
class SlotDecision:
    """The output of the slot machine — what to do on this turn."""

    # Updated trip state after merging entities
    trip_state: TripState

    # Stage after this turn
    stage: Literal["collecting", "searching", "explaining_verdict", "off_trip", "reset"]

    # The next slot to ask about, if any. None = all required fields confirmed.
    next_slot: Optional[str] = None

    # Human-readable description of what we're asking for (for the LLM)
    next_slot_description: Optional[str] = None

    # Fallback question string if LLM can't be reached
    fallback_question: Optional[str] = None

    # True when all required fields are present and search can fire
    ready_to_search: bool = False

    # Prefill dict for the frontend (only set when ready_to_search)
    prefill: Optional[dict] = None

    # Any entity resolution notes (for LLM context)
    resolution_notes: list[str] = field(default_factory=list)


def run(
    session: ZoeSession,
    intent: str,
    entities: dict,
    *,
    is_voice: bool = False,
) -> SlotDecision:
    """
    Run the slot machine for one turn.

    Args:
        session:   Current session (loaded from Redis)
        intent:    Classified intent from the parse call
        entities:  Extracted entities from the parse call
        is_voice:  True if this is a voice interaction

    Returns:
        SlotDecision describing what to do next
    """

    # ── Non-trip intents bypass the slot machine ──────────────────────────────
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

    # ── Merge entities into current trip state ────────────────────────────────
    resolved_entities, notes = _resolve_entities(entities)
    new_state = session.trip_state.merge(resolved_entities)

    # ── Determine next action ─────────────────────────────────────────────────
    missing = new_state.missing_required()

    if not missing:
        # All required fields confirmed — ready to search
        prefill = new_state.to_prefill()
        return SlotDecision(
            trip_state=new_state,
            stage="searching",
            next_slot=None,
            ready_to_search=True,
            prefill=prefill,
            resolution_notes=notes,
        )

    # Still collecting — identify the next slot
    next_slot = missing[0]

    # Don't re-ask the same slot we asked last turn (unless entities changed)
    # Only skip re-ask prevention if nothing was resolved this turn
    if next_slot == session.last_asked and not resolved_entities:
        # Rotate to the next missing slot if available
        if len(missing) > 1:
            next_slot = missing[1]
        # Otherwise stay on the same slot — the user may have just not answered

    return SlotDecision(
        trip_state=new_state,
        stage="collecting",
        next_slot=next_slot,
        next_slot_description=_SLOT_QUESTIONS.get(next_slot, next_slot),
        fallback_question=_SLOT_PROMPT.get(next_slot),
        ready_to_search=False,
        resolution_notes=notes,
    )


# ── Entity resolution ─────────────────────────────────────────────────────────

def _resolve_entities(entities: dict) -> tuple[dict, list[str]]:
    """
    Resolve raw entity values from the parse call:
    - Airport text → IATA code (where possible)
    - Date text → ISO 8601

    Returns (resolved_entities, notes) where notes are human-readable
    resolution annotations for the LLM context.
    """
    resolved: dict = {}
    notes: list[str] = []

    # ── Origin ────────────────────────────────────────────────────────────────
    origin_text = entities.get("origin_text") or entities.get("origin")
    if origin_text and origin_text not in (None, "null", ""):
        code = iata.lookup(str(origin_text))
        if code:
            resolved["origin"] = code
            city = iata.city_name(code)
            if city.lower() != str(origin_text).lower():
                notes.append(f"Resolved origin '{origin_text}' → {code} ({city})")
            else:
                resolved["origin"] = code
        else:
            # Keep raw text — backend will handle it
            resolved["origin"] = str(origin_text)

    # ── Destination ───────────────────────────────────────────────────────────
    dest_text = entities.get("destination_text") or entities.get("destination")
    if dest_text and dest_text not in (None, "null", ""):
        code = iata.lookup(str(dest_text))
        if code:
            resolved["destination"] = code
            city = iata.city_name(code)
            if city.lower() != str(dest_text).lower():
                notes.append(f"Resolved destination '{dest_text}' → {code} ({city})")
        else:
            resolved["destination"] = str(dest_text)

    # ── Departure date ────────────────────────────────────────────────────────
    date_text = entities.get("date_text") or entities.get("depart_date") or entities.get("date")
    if date_text and date_text not in (None, "null", ""):
        iso = date_normalizer.normalize(str(date_text))
        if iso:
            resolved["depart_date"] = iso
            if iso != str(date_text):
                notes.append(f"Normalized date '{date_text}' → {iso}")
        # If normalization fails, don't set — leave slot open

    # ── Return date ───────────────────────────────────────────────────────────
    return_text = entities.get("return_date_text") or entities.get("return_date")
    if return_text and return_text not in (None, "null", ""):
        iso = date_normalizer.normalize(str(return_text))
        if iso:
            resolved["return_date"] = iso

    # ── Trip type ─────────────────────────────────────────────────────────────
    trip_type = entities.get("trip_type")
    if trip_type and trip_type not in (None, "null", ""):
        t = str(trip_type).lower().strip()
        if t in ("roundtrip", "round-trip", "round trip", "return"):
            resolved["trip_type"] = "roundtrip"
        elif t in ("oneway", "one-way", "one way"):
            resolved["trip_type"] = "oneway"

    # If return_date was set and trip_type wasn't, infer roundtrip
    if resolved.get("return_date") and not resolved.get("trip_type"):
        if not _session_trip_type_already_set(entities):
            resolved["trip_type"] = "roundtrip"

    # ── Cabin ─────────────────────────────────────────────────────────────────
    cabin = entities.get("cabin")
    if cabin and cabin not in (None, "null", ""):
        c = str(cabin).lower().strip()
        cabin_map = {
            "economy": "economy",
            "coach": "economy",
            "business": "business",
            "biz": "business",
            "first": "first",
            "first class": "first",
            "premium economy": "premium_economy",
            "premium": "premium_economy",
            "premium_economy": "premium_economy",
        }
        resolved["cabin"] = cabin_map.get(c, c)

    # ── Travelers ─────────────────────────────────────────────────────────────
    travelers = entities.get("travelers")
    if travelers is not None and travelers not in (None, "null", ""):
        try:
            n = int(travelers)
            if 1 <= n <= 9:
                resolved["travelers"] = n
        except (ValueError, TypeError):
            pass

    return resolved, notes


def _session_trip_type_already_set(entities: dict) -> bool:
    """Check if the entity dict contained an explicit trip type."""
    return bool(entities.get("trip_type"))


def format_confirmed_state(state: TripState) -> str:
    """
    Format the confirmed trip state as a readable string for LLM context.
    Used in the respond-call system prompt.
    """
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
    """
    Format missing required slots for LLM context.
    """
    missing = state.missing_required()
    if not missing:
        return "none — all required fields confirmed!"
    return ", ".join(_SLOT_QUESTIONS.get(s, s) for s in missing)
