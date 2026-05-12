"""
zoe/handlers/trip_search.py
────────────────────────────
Handles all trip-planning conversations:
  - Origin / destination extraction
  - Date, travelers, cabin collection
  - Smart follow-up questions (one at a time, only when needed)
  - PREFILL generation for the search form
  - Flexible date range detection
  - Round-trip vs one-way detection

Ticket coverage:
  ✅ Partial requests needing follow-up (missing dates, travelers, cabin)
  ✅ Ask ONE question max — never a list
  ✅ Round-trip vs one-way detection
  ✅ Flexible date range requests
  ✅ Auto-fill form when enough info is present
  ✅ Voice mode: short speakable replies
"""

from __future__ import annotations

from typing import Any

from app.services.zoe.llm_caller import call_llm_json

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = """You are Zoe, a sharp and warm travel assistant for MyTravelWallet.
Your job right now: help the user plan a flight and collect enough info to fill a search form.

REQUIRED to search: origin, destination, departure date.
OPTIONAL (use defaults if not given): travelers (default 1), cabin (default economy), return_date (for round-trips).

RULES:
- Lead with a helpful, friendly response first. Then ask ONE clarifying question if needed.
- Never ask more than one question in a single message.
- Never list the fields you need. Weave the question naturally into the reply.
- If you have origin + destination + date, fill the form and tell the user conversationally. 
  Example: "Perfect — JFK to Tokyo on June 12, economy. I've filled that in, just hit Search when ready!"
- If the date is vague ("this summer", "next month"), pick a reasonable specific date and mention it.
- Detect round-trip intent from phrases like "and back", "return", "round trip".
- Detect flexible dates from phrases like "cheapest time", "best time", "flexible on dates".
- For flexible searches, set date to the first day of the range and date_end to the last.
- Keep replies under 80 words. Never use bullet points.
- If the user is in voice mode, keep the reply under 40 words, plain text only.

WALLET CONTEXT (if provided): Use this to personalize suggestions — e.g., if they have Chase points, mention that.

OUTPUT FORMAT — always return valid JSON:
{
  "message": "Zoe's conversational reply",
  "prefill": {
    "origin": "JFK" or null,
    "destination": "NRT" or null,
    "date": "YYYY-MM-DD" or null,
    "return_date": "YYYY-MM-DD" or null,
    "date_end": "YYYY-MM-DD" or null,
    "travelers": 1,
    "cabin": "economy" | "business" | "first" | "premium_economy",
    "tripType": "oneway" | "roundtrip"
  } or null,
  "ready_to_search": true | false,
  "follow_up_slot": "date" | "origin" | "destination" | "travelers" | "cabin" | "trip_type" | null
}

Set prefill to null if you don't have enough to fill anything useful.
Set ready_to_search to true ONLY when origin + destination + date are all present.
"""


async def handle(
    message: str,
    history: list[dict],
    wallet: list[dict],
    *,
    is_voice: bool = False,
) -> dict[str, Any]:
    """
    Returns:
      {
        "message": str,
        "prefill": dict | None,
        "ready_to_search": bool,
      }
    """
    wallet_str = _format_wallet(wallet)
    voice_note = "\n[VOICE MODE: keep reply under 40 words, plain text, no markdown]" if is_voice else ""

    history_text = _format_history(history)

    user_prompt = f"""{f'USER WALLET:{chr(10)}{wallet_str}{chr(10)}' if wallet_str else ''}
CONVERSATION SO FAR:
{history_text}

USER: {message}
{voice_note}

Return JSON only:"""

    result = await call_llm_json(_SYSTEM, user_prompt, temperature=0.3, max_tokens=500)

    return {
        "message": result.get("message", "Tell me more about your trip and I'll help you search!"),
        "prefill": result.get("prefill"),
        "ready_to_search": bool(result.get("ready_to_search", False)),
    }


def _format_wallet(wallet: list[dict]) -> str:
    if not wallet:
        return ""
    lines = [f"  - {w.get('program', 'Unknown')}: {w.get('points', 0):,} pts" for w in wallet]
    return "\n".join(lines)


def _format_history(history: list[dict]) -> str:
    if not history:
        return "(fresh conversation)"
    lines = []
    for turn in history[-8:]:
        role = "Zoe" if turn.get("role") == "assistant" else "User"
        content = str(turn.get("content", "")).strip()[:300]
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines) or "(fresh conversation)"
