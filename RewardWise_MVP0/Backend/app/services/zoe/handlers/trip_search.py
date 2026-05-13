"""
zoe/handlers/trip_search.py
────────────────────────────
Handles trip planning conversations.

NEW ARCHITECTURE:
  This handler no longer decides what to ask or manages state extraction.
  It receives:
    - The confirmed trip state (from session + slot machine)
    - The next slot to ask about (from slot machine) — or None if ready
    - The conversation history (from session — real message objects)
    - The wallet (for grounding)
    - Resolution notes (from slot machine, e.g. "Resolved 'New York' → JFK")

  It builds a system prompt with all ground truth injected and calls
  call_llm_with_history() so Zoe has real conversation context.

  The handler tells the LLM *what* to communicate.
  The LLM decides *how* to say it naturally.
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_with_history
from app.services.zoe.grounding import build_ground_truth_block
from app.services.zoe.slot_machine import SlotDecision, format_confirmed_state, format_missing_slots
from app.services.zoe.session import TripState


# ── Personality + base instructions ──────────────────────────────────────────

_BASE_SYSTEM = """You are Zoe — a warm, sharp travel friend who works for MyTravelWallet.
You help people plan flights and figure out the best way to use their points.

Your personality: knowledgeable, direct, genuinely interested in the trip.
Not a form. Not a bot. A friend who happens to know a lot about travel.

RESPONSE RULES:
- Respond naturally and conversationally — like texting a well-traveled friend
- Under 80 words for collection turns (when still gathering trip info)
- Under 150 words for explanatory turns (when search is ready or explaining something)
- No bullet points, no numbered lists, no markdown headers
- No sycophantic openers ("Great choice!", "Awesome!", "Of course!")
- Never ask more than one question per response — this is enforced, not optional
- Never list what you still need ("I still need X and Y")
- Never enumerate missing fields
- Lead with something genuine about the trip when you have destination context
"""


def _build_system_prompt(
    decision: SlotDecision,
    wallet: list[dict],
    verdict_context: str | None,
    is_voice: bool,
) -> str:
    """Build the full system prompt for the respond call."""

    state_str = format_confirmed_state(decision.trip_state)
    missing_str = format_missing_slots(decision.trip_state)

    # Ground truth block (wallet, verdict, resolution notes)
    ground_truth = build_ground_truth_block(
        wallet=wallet,
        verdict_context=verdict_context,
        resolution_notes=decision.resolution_notes or [],
    )

    # What to communicate on this turn
    if decision.ready_to_search:
        task = """TASK FOR THIS TURN:
All required trip fields are now confirmed. Tell the user you've filled in the search form
and invite them to hit Search when they're ready. Be natural — don't make it a big announcement.
One sentence is enough. Example: "Perfect — I've filled that in, just hit Search when you're ready!"
Do NOT ask any questions. Do NOT say "shall I search?". The user presses Search."""
    elif decision.next_slot:
        slot_label = {
            "origin":      "where they're flying FROM (their departure city or airport)",
            "destination": "where they're flying TO (their destination city or airport)",
            "depart_date": "when they want to depart (a specific date or timeframe)",
            "trip_type":   "whether it's a one-way trip or round-trip",
            "return_date": "when they want to return (their return date)",
        }.get(decision.next_slot, decision.next_slot)

        task = f"""TASK FOR THIS TURN:
The next required piece of information is: {slot_label}

Ask about this ONE field naturally, woven into a genuine response.
You may share a brief interesting fact or tip about the destination/route if you have it.
Then ask your single question.

DO NOT ask about any other fields.
DO NOT mention what other fields are missing.
DO NOT list or enumerate what you still need."""
    else:
        task = """TASK FOR THIS TURN:
Continue the conversation naturally. The user is providing more context about their trip."""

    voice_note = "\n[VOICE MODE: plain text only, under 40 words, no markdown]" if is_voice else ""

    return f"""{_BASE_SYSTEM}

CONFIRMED TRIP STATE:
{state_str}

STILL MISSING:
{missing_str}

{ground_truth}

{task}{voice_note}"""


# ── Main handler ──────────────────────────────────────────────────────────────

async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    decision: SlotDecision,
    *,
    verdict_context: str | None = None,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Generate Zoe's response for a trip planning turn.

    Args:
        message:        The user's latest message
        history:        Conversation history from session (real message objects)
        wallet:         User's wallet programs and balances
        decision:       SlotDecision from the slot machine
        verdict_context: Active verdict if any
        is_voice:       True for voice interactions

    Returns:
        {
          "message": str,
          "prefill": dict | None,
        }
    """
    system = _build_system_prompt(decision, wallet, verdict_context, is_voice)

    # Use call_llm_with_history so the model has real conversation context
    reply = await call_llm_with_history(
        system,
        history,
        message,
        temperature=0.45,
        max_tokens=120 if (is_voice or not decision.ready_to_search) else 300,
    )

    return {
        "message": reply or (decision.fallback_question or "Tell me more about your trip!"),
        "prefill": decision.prefill,
    }
