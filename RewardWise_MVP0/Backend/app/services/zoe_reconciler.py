from __future__ import annotations

import json
from typing import Any

from app.services.llm import generate_json
from app.services.zoe_state import today


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return "{}"


def _history_text(history: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    # Last 5 turns — enough context without bloating the prompt.
    for msg in history[-5:]:
        role = msg.get("role", "user")
        content = str(msg.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content[:400]}")
    return "\n".join(lines)


def _clean_suggestions(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw[:3]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()[:32]
        query = str(item.get("query") or "").strip()[:120]
        emoji = str(item.get("emoji") or "💬").strip()[:4]
        if label and query:
            out.append({"emoji": emoji, "label": label, "query": query})
    return out


def _normalize_result(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        return {}
    result.setdefault("intent", "trip")
    result.setdefault("updates", {})
    result.setdefault("airport_text", {})
    result.setdefault("clear_fields", [])
    result["message"] = str(result.get("message") or "").strip()
    result["suggestions"] = _clean_suggestions(result.get("suggestions"))
    return result


async def reconcile_turn(text: str, state: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any]:
    """Single NVIDIA call per turn: extract state deltas AND write Zoe's reply.

    One call. Two jobs:
    1. Structured state delta (updates, airport_text, intent, clear_fields)
    2. Zoe's next conversational message — used directly, no second call.

    Backend owns validation, airport resolution, search trigger, and verdict.
    """
    visible_state = {k: v for k, v in state.items() if not str(k).startswith("__")}
    meta = state.get("__zoe_meta") or {}

    system_prompt = f"""You are Zoe, MyTravelWallet's conversational flight assistant. Today is {today().isoformat()}.

You have TWO jobs this turn — both in one JSON response:
1. Extract only what changed in the user's message as a structured delta.
2. Write Zoe's next reply — warm, concise, like a smart travel friend texting you.

RULES:
- Never invent airport codes, live prices, award availability, or verdicts. The backend handles all of that.
- Keep confirmed state intact unless the user clearly changes something.
- Airport city names go in airport_text — backend resolves to IATA. Only put a code in airport_text if you're 100% sure.
- Natural date phrases are fine (tomorrow, next Friday, next weekend, June 15, a week earlier) — backend normalizes them.
- Do not turn yes/no/ok/sure into airport/date/cabin/traveler values.
- Only set intent=reset if the user explicitly says "start over", "new search", "new trip", or similar.
- If the user has NO destination or trip in mind yet ("I'm not sure", "help me decide", "I don't know where to go"), set intent=exploring. Chat naturally, ask a light question about vibe/budget/region. Do NOT jump to collecting fields.
- If the user asks a general travel/points question AND there is zero active trip state, set intent=general_question and answer in message.
- If there IS active trip state (any field filled), keep intent=trip and stay trip-focused.
- intent=trip means the user HAS given or is actively giving trip details. Do NOT set intent=trip when updates and airport_text are both empty.
- message must be under 60 words, one question max. Never say field names like "origin", "tripType", "cabin".
- If all required fields appear present after your updates, leave message empty — backend will trigger search.
- Good tone: "Got it — Newark to Miami next Friday. One-way or round trip?" Bad tone: "Please provide trip type."

INTENT GUIDE:
- "I want to fly from Newark to Miami next Friday" → intent=trip, fill airport_text + updates.date
- "i don't have a trip yet, help me" → intent=exploring, message asks a light vibe/destination question
- "should I use points or cash?" (no state) → intent=general_question, answer directly
- "start over" → intent=reset

CURRENT TRIP STATE:
{_safe_json(visible_state)}

SESSION META (hidden from user):
last_requested_slot: {meta.get('last_requested_slot')}
conversation_mode: {meta.get('conversation_mode', 'collecting')}
origin_hint: {meta.get('origin_hint')}
destination_hint: {meta.get('destination_hint')}

Return ONLY valid JSON — no markdown, no preamble:
{{
  "intent": "trip" | "general_question" | "exploring" | "reset",
  "updates": {{"date": null, "tripType": null, "travelers": null, "cabin": null, "return_date": null}},
  "airport_text": {{"origin": null, "destination": null}},
  "clear_fields": [],
  "message": "Zoe's reply here, or empty string if backend should search now",
  "suggestions": [{{"emoji": "✈️", "label": "short label", "query": "user-style reply"}}],
  "notes": "private reasoning"
}}"""

    user_prompt = f"""RECENT CHAT:
{_history_text(history)}

USER: {text}

JSON only:"""

    result = await generate_json(system_prompt, user_prompt, temperature=0.3)
    return _normalize_result(result)
