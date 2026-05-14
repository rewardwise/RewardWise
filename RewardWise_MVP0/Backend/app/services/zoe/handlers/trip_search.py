"""
zoe/handlers/trip_search.py
────────────────────────────
Handles trip planning conversations.

Important: collection turns are deterministic. The slot machine decides the
next slot, and this handler asks exactly that one question. We do not let the
LLM improvise collection questions because that can desync last_asked from what
Zoe actually says to the user.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history
from app.services.zoe.grounding import build_ground_truth_block
from app.services.zoe.slot_machine import SlotDecision, format_confirmed_state, format_missing_slots
from app.services.zoe import iata

_BASE_SYSTEM = """You are Zoe — a warm, sharp, excited travel friend who works for MyTravelWallet.
You help people plan flights and figure out the best way to use their points.

Your personality:
- Knowledgeable, direct, and genuinely interested in the trip
- Upbeat without being fake or over-the-top
- A friend who happens to know a lot about travel, flights, points, and good redemptions
- Not a form. Not a bot. Not a customer support script.

Your vibe:
- Make the trip feel fun, easy, and exciting
- Briefly react to the user's destination, route, or choice when it feels natural
- Use casual travel energy, but keep it concise
- Avoid sounding like you are interrogating the user
- Do not say “Got it” every turn
- Do not overuse the same opener
- Vary your phrasing so the conversation feels alive

RESPONSE RULES:
- Respond naturally and conversationally — like texting a well-traveled friend
- Ask exactly one question when collecting trip info
- Under 70 words for collection turns
- Under 150 words for explanatory turns
- No bullet points, no numbered lists, no markdown headers
- No sycophantic openers
- Never ask more than one question per response
- Never list what you still need
- Never enumerate missing fields
- Never mention internal fields, slots, state, or missing_required
- If the next field is obvious, ask for it casually and move on

Good collection examples:
- "Vancouver is a great pick — mountains, water, food, all of it. Where are you flying from?"
- "ATL to Vancouver, nice. When do you want to fly?"
- "Love it. Is this one-way or round trip?"
- "Easy. How many travelers?"
- "Solo trip, nice. What cabin are we looking at — economy, business, or first?"
- "Perfect — ATL to YVR next weekend, one-way in economy. I’m running that search now."

Bad collection examples:
- "Please provide your departure airport."
- "I still need your departure date, trip type, travelers, and cabin."
- "Got it. What is your cabin class?"
- "To proceed, please provide the next required field."
"""


def _city(code_or_text: str | None) -> str | None:
    if not code_or_text:
        return None
    code = str(code_or_text).upper()
    if iata.validate(code):
        return iata.city_name(code)
    return str(code_or_text)


def _route_phrase(decision: SlotDecision) -> str:
    origin = decision.trip_state.origin
    dest = decision.trip_state.destination
    if origin and dest:
        return f"{origin} to {dest}"
    if dest:
        return _city(dest) or dest
    if origin:
        return f"from {origin}"
    return "your trip"


def _collecting_reply(decision: SlotDecision) -> str:
    """Ask exactly the next slot. No LLM, no drift."""
    slot = decision.next_slot
    state = decision.trip_state
    route = _route_phrase(decision)

    if slot == "origin":
        if state.destination:
            return f"Got it — {_city(state.destination)}. Where are you flying from?"
        return "Where are you flying from?"

    if slot == "destination":
        if state.origin:
            return f"Got it — flying from {state.origin}. Where are you headed?"
        return "Where are you headed?"

    if slot == "depart_date":
        return f"Got it — {route}. When do you want to fly?"

    if slot == "trip_type":
        return "Is this one-way or round trip?"

    if slot == "return_date":
        return "When are you coming back?"

    if slot == "travelers":
        return "How many travelers?"

    if slot == "cabin":
        return "What cabin class do you want — economy, business, or first?"

    return decision.fallback_question or "Tell me one more detail for the search."


def _ready_reply(decision: SlotDecision) -> str:
    state = decision.trip_state
    trip_type = "round trip" if state.trip_type == "roundtrip" else "one way"
    travelers = f"{state.travelers} traveler" if state.travelers == 1 else f"{state.travelers} travelers"
    cabin = str(state.cabin).replace("_", " ") if state.cabin else ""

    if state.return_date:
        return (
            f"Perfect — I filled in {state.origin} to {state.destination}, {trip_type}, "
            f"{state.depart_date} to {state.return_date}, {travelers}, {cabin}. Starting the search now."
        )

    return (
        f"Perfect — I filled in {state.origin} to {state.destination}, {trip_type}, "
        f"{state.depart_date}, {travelers}, {cabin}. Starting the search now."
    )


def _build_system_prompt(
    decision: SlotDecision,
    wallet: list[dict],
    verdict_context: str | None,
    is_voice: bool,
) -> str:
    """Build prompt for non-collection fallback/explanatory turns."""

    state_str = format_confirmed_state(decision.trip_state)
    missing_str = format_missing_slots(decision.trip_state)
    ground_truth = build_ground_truth_block(
        wallet=wallet,
        verdict_context=verdict_context,
        resolution_notes=decision.resolution_notes or [],
    )

    task = """TASK FOR THIS TURN:
Continue the trip conversation naturally, but do not invent trip fields.
If a specific field is needed, ask only one question."""

    voice_note = "\n[VOICE MODE: plain text only, under 40 words, no markdown]" if is_voice else ""

    return f"""{_BASE_SYSTEM}

CONFIRMED TRIP STATE:
{state_str}

STILL MISSING:
{missing_str}

{ground_truth}

{task}{voice_note}"""


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    decision: SlotDecision,
    *,
    verdict_context: str | None = None,
    is_voice: bool = False,
) -> dict[str, Any]:
    """Generate Zoe's response for a trip planning turn."""

    # Hard guarantee: if the slot machine says ask a slot, ask exactly that slot.
    if decision.next_slot and not decision.ready_to_search:
        return {
            "message": _collecting_reply(decision),
            "prefill": None,
        }

    # Hard guarantee: if search-ready, do not ask anything.
    if decision.ready_to_search:
        return {
            "message": _ready_reply(decision),
            "prefill": decision.prefill,
        }

    # Rare fallback only.
    system = _build_system_prompt(decision, wallet, verdict_context, is_voice)
    reply = await call_llm_with_history(
        system,
        history,
        message,
        temperature=0.35,
        max_tokens=100 if is_voice else 160,
    )

    return {
        "message": reply or (decision.fallback_question or "Tell me more about your trip."),
        "prefill": decision.prefill,
    }
