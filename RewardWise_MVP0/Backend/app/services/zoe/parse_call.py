"""
zoe/parse_call.py
──────────────────
The JSON-mode parse LLM call.

Responsibility: read the user's message + current trip state and output:
  - intent classification
  - extracted entities (raw text values, not resolved)

This call:
  - Uses temperature=0.0 for deterministic extraction
  - Never writes a user-facing response
  - Does NOT need conversation history (extraction only needs the current message + state)
  - Is cheap and fast (max 150 tokens output)

Intent taxonomy:
  trip        — flight search / planning ("I want to fly to Tokyo")
  destination — knowledge question about a place ("what's Kyoto like in March?")
  wallet      — wallet / product / balance questions ("how many Chase points do I have?")
  verdict     — verdict interpretation / points strategy ("is this a good deal?")
  exploring   — open-ended trip inspiration ("where should I go this summer?")
  reset       — explicit start-over ("let's start fresh", "new search")
  off_topic   — completely outside Zoe's domain
"""

from __future__ import annotations

from app.services.zoe.llm_caller import call_llm_json
from app.services.zoe.session import TripState

_PARSE_SYSTEM = """You are a precise intent classifier and entity extractor for a travel AI assistant.

Read the user's message and extract structured data. Return ONLY valid JSON — no markdown, no preamble.

## Intent options:
- "trip"        → user wants to search for flights or is giving trip planning info (origin, destination, dates)
- "destination" → user is asking about a place (things to do, best time to visit, visa, food, weather)
- "wallet"      → user is asking about their points balance, connected programs, or how MTW works
- "verdict"     → user is asking about a search result, whether to use points/cash, or loyalty strategy
- "exploring"   → user wants trip inspiration but has no specific destination yet
- "reset"       → user wants to start a new search or clear the current trip
- "off_topic"   → completely unrelated to travel, flights, or points (recipes, sports, etc.)

## Entity extraction rules:
- Extract ONLY what the user explicitly stated — never infer or assume
- Use null for any field the user did not mention
- Do not resolve airport codes — extract the user's raw words (e.g. "New York", not "JFK")
- Do not resolve dates — extract the user's raw words (e.g. "next Friday", not "2026-05-15")
- If the user said "yes" to something Zoe asked, do NOT extract that as a value

## Return format:
{
  "intent": "trip" | "destination" | "wallet" | "verdict" | "exploring" | "reset" | "off_topic",
  "entities": {
    "origin_text":       "<what the user said they're flying FROM>" | null,
    "destination_text":  "<what the user said they're flying TO>"   | null,
    "date_text":         "<what the user said about departure date>" | null,
    "return_date_text":  "<what the user said about return date>"   | null,
    "trip_type":         "oneway" | "roundtrip" | null,
    "cabin":             "economy" | "business" | "first" | "premium_economy" | null,
    "travelers":         <integer> | null
  }
}"""


async def parse(
    user_message: str,
    current_state: TripState,
    *,
    has_verdict_context: bool = False,
) -> dict:
    """
    Run the parse call and return structured intent + entities.

    Args:
        user_message:       The user's latest message
        current_state:      The current confirmed trip state
        has_verdict_context: True if a verdict is available in this session

    Returns:
        {
          "intent": str,
          "entities": dict
        }
    """
    # Build a compact state snapshot for context
    # The model only needs to know what's already confirmed to avoid re-extracting it
    state_lines = []
    if current_state.origin:
        state_lines.append(f"  origin: {current_state.origin}")
    if current_state.destination:
        state_lines.append(f"  destination: {current_state.destination}")
    if current_state.depart_date:
        state_lines.append(f"  depart_date: {current_state.depart_date}")
    if current_state.return_date:
        state_lines.append(f"  return_date: {current_state.return_date}")
    if current_state.trip_type:
        state_lines.append(f"  trip_type: {current_state.trip_type}")
    if current_state.cabin and current_state.cabin != "economy":
        state_lines.append(f"  cabin: {current_state.cabin}")
    if current_state.travelers and current_state.travelers != 1:
        state_lines.append(f"  travelers: {current_state.travelers}")

    state_str = "\n".join(state_lines) if state_lines else "  (no fields confirmed yet)"

    verdict_note = ""
    if has_verdict_context:
        verdict_note = "\nNote: a flight search verdict is available in this session."

    user_prompt = f"""CURRENT CONFIRMED TRIP STATE:
{state_str}
{verdict_note}
USER MESSAGE:
{user_message}

Extract intent and entities from the USER MESSAGE only. Return JSON."""

    result = await call_llm_json(
        _PARSE_SYSTEM,
        user_prompt,
        temperature=0.0,
        max_tokens=150,
    )

    if not isinstance(result, dict):
        return {"intent": "trip", "entities": {}}

    # Normalize intent
    raw_intent = str(result.get("intent", "trip")).lower().strip()
    intent_map = {
        "trip": "trip",
        "trip_search": "trip",
        "destination": "destination",
        "wallet": "wallet_support",
        "wallet_support": "wallet_support",
        "verdict": "verdict_strategy",
        "verdict_strategy": "verdict_strategy",
        "exploring": "exploring",
        "reset": "reset",
        "off_topic": "off_topic",
    }
    normalized_intent = intent_map.get(raw_intent, "trip")

    entities = result.get("entities", {})
    if not isinstance(entities, dict):
        entities = {}

    return {
        "intent": normalized_intent,
        "entities": entities,
    }
