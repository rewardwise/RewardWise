from __future__ import annotations

import json
import re
from typing import Any

from app.services.llm import generate_json
from app.services.zoe_state import today


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return "{}"


def _history_text(history: list[dict[str, Any]]) -> str:
    lines = []
    for msg in history[-8:]:
        role = msg.get("role", "user")
        content = msg.get("content") or ""
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _regex_route_hints(text: str) -> dict[str, Any]:
    raw = str(text or "").strip()
    low = raw.lower()
    out: dict[str, Any] = {"updates": {}, "airport_text": {}, "clear_fields": [], "intent": "trip", "notes": ""}

    # from X to Y, stopping before date/cabin clauses.
    m = re.search(r"\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+(?:on|in|for|next|tomorrow|one way|round trip|roundtrip|business|economy|first|premium)\b|[?.!]|$)", raw, re.I)
    if m:
        out["airport_text"]["origin"] = m.group(1).strip()
        out["airport_text"]["destination"] = m.group(2).strip()
        return out

    # I want to go/fly/travel to X. Capture destination only.
    m = re.search(r"\b(?:i\s+)?(?:want|wanna|would like|need|trying)\s+to\s+(?:go|fly|travel)\s+to\s+(.+?)(?:\s+(?:on|in|for|next|tomorrow|one way|round trip|roundtrip|business|economy|first|premium)\b|[?.!]|$)", raw, re.I)
    if m:
        out["airport_text"]["destination"] = m.group(1).strip()
        return out

    m = re.search(r"\b(?:fly|flight|trip)\s+to\s+(.+?)(?:\s+(?:on|in|for|next|tomorrow|one way|round trip|roundtrip|business|economy|first|premium)\b|[?.!]|$)", raw, re.I)
    if m:
        out["airport_text"]["destination"] = m.group(1).strip()
        return out

    return {}


async def reconcile_turn(text: str, state: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any]:
    """Return JSON deltas only. Code validates and applies these deltas."""
    route = _regex_route_hints(text)
    if route:
        return route

    system_prompt = f"""You are Zoe's trip-state interpreter. Today is {today().isoformat()}.

Return JSON deltas only. Do not decide the verdict. Do not restate the full state.

Fields needed later by code: origin airport, destination airport, departure date, trip type, travelers, cabin, return date if round trip.

Rules:
- Preserve confirmed fields unless the user clearly changes them.
- If the user gives a city/country/airport phrase, put it under airport_text.origin or airport_text.destination, not updates.origin/destination, unless it is a 3-letter airport code or a specific airport name you are highly sure of.
- If the user says "from X to Y", return airport_text.origin = X and airport_text.destination = Y.
- If the user says "go to/fly to/travel to X", return airport_text.destination = X.
- If the user changes a field, put only that field in updates/airport_text.
- Do not output reset unless the user literally asks to start over/new search/another route.
- Do not turn yes/no/ok/sure into airport/date/cabin/traveler values.
- Natural dates are allowed in updates.date or updates.return_date as the user's text; code will normalize them.
- For return phrases like "two days after I leave" or "next to next weekend", use updates.return_date with that natural text.

Return valid JSON with this shape:
{{
  "intent": "trip" | "general_question" | "reset",
  "updates": {{"date": null, "tripType": null, "travelers": null, "cabin": null, "return_date": null}},
  "airport_text": {{"origin": null, "destination": null}},
  "clear_fields": [],
  "notes": "short private note"
}}"""

    user_prompt = f"""CURRENT STATE:
{_safe_json({k: v for k, v in state.items() if not str(k).startswith('__')})}

META:
{_safe_json(state.get('__zoe_meta') or {})}

RECENT CHAT:
{_history_text(history)}

LATEST USER MESSAGE:
{text}

Return JSON deltas only."""
    result = await generate_json(system_prompt, user_prompt, temperature=0.0)
    return result if isinstance(result, dict) else {}
