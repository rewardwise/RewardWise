from __future__ import annotations

import re
from typing import Any

from app.services.zoe_state import META_KEY


def welcome_response() -> dict[str, Any]:
    state = {META_KEY: {}}
    return {
        "type": "followup",
        "message": "Tell me the trip you have in mind and I’ll turn it into a clear points-vs-cash verdict. I’ll keep track of the details and only ask for what’s missing.",
        "params": state,
        "suggestions": [
            {"emoji": "✈️", "label": "Start with a route", "query": "I want to compare a flight"},
            {"emoji": "💬", "label": "Ask points vs cash", "query": "Should I use points or pay cash for a trip?"},
        ],
    }


def build_collecting_response(message: str, state: dict[str, Any]) -> dict[str, Any]:
    return {"type": "followup", "message": message, "params": {k: v for k, v in state.items() if v is not None}, "suggestions": []}


def build_reset_response(state: dict[str, Any]) -> dict[str, Any]:
    return {"type": "followup", "message": "Of course. What route do you want to check next?", "params": state, "suggestions": []}


def _strip_redundant_verdict_lead(explanation: str, recommendation: str) -> str:
    if not explanation:
        return ""
    normalized = explanation.strip()
    for pattern in [
        rf"^{re.escape(recommendation)}[:.!\-\s]+",
        rf"^{re.escape(recommendation.lower())}[:.!\-\s]+",
        rf"^{re.escape(recommendation.title())}[:.!\-\s]+",
    ]:
        cleaned = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()
        if cleaned != normalized:
            return cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned
    return normalized


def build_zoe_verdict_message(search_data: dict[str, Any]) -> str:
    verdict = search_data.get("verdict") or {}
    recommendation = verdict.get("verdict_label") or ("Pay Cash" if verdict.get("pay_cash") else "Use Points")
    confidence = (verdict.get("confidence") or "medium").title()
    confidence_reason = verdict.get("confidence_reason") or ""
    explanation = _strip_redundant_verdict_lead(verdict.get("explanation") or verdict.get("verdict") or "", recommendation)
    metrics = verdict.get("metrics") or {}
    next_step = verdict.get("next_step") or {}
    data_quality = verdict.get("data_quality") or "full"

    trip_bits = [
        f"I checked {search_data.get('origin')} to {search_data.get('destination')}",
        f"for {search_data.get('travelers', 1)} traveler{'s' if search_data.get('travelers', 1) != 1 else ''}",
        str(search_data.get("cabin", "economy")).replace("_", " "),
        "round trip" if search_data.get("is_roundtrip") else "one way",
        f"on {search_data.get('date')}",
    ]

    lines = [" ".join(trip_bits) + ".", "", f"**Verdict: {recommendation}**"]
    if explanation:
        lines.append(explanation)
    lines.append(f"**Confidence:** {confidence}")
    if confidence_reason:
        lines.append(confidence_reason)

    metric_bits: list[str] = []
    if metrics.get("cash_price") is not None:
        metric_bits.append(f"Cash ${float(metrics['cash_price']):.0f}")
    if metrics.get("points_cost"):
        metric_bits.append(f"Points {int(metrics['points_cost']):,}")
    if metrics.get("taxes"):
        metric_bits.append(f"Taxes ${float(metrics['taxes']):.0f}")
    if metrics.get("estimated_savings"):
        metric_bits.append(f"Savings about ${float(metrics['estimated_savings']):.0f}")
    if metric_bits:
        lines.extend(["", "**Details:** " + " · ".join(metric_bits)])

    if data_quality != "full":
        missing = verdict.get("missing_sources") or []
        missing_text = ", ".join(str(m).replace("_", " ") for m in missing) if missing else "some live data"
        lines.extend(["", f"**Heads up:** this answer used partial data. Missing: {missing_text}."])

    if next_step.get("label"):
        lines.extend(["", f"**Next step:** {next_step['label']}"])
    return "\n".join(lines)


def build_suggestions(state: dict[str, Any], verdict: dict[str, Any] | None = None, *, stage: str = "post_verdict") -> list[dict[str, str]]:
    if stage != "post_verdict":
        return []
    suggestions: list[dict[str, str]] = []
    next_step = (verdict or {}).get("next_step") or {}
    if next_step.get("label") and next_step.get("prompt"):
        suggestions.append({"emoji": "✨", "label": next_step["label"], "query": next_step["prompt"]})
    if state.get("date") and state.get("origin") and state.get("destination"):
        suggestions.append({"emoji": "🗓️", "label": "Check a week earlier", "query": "What about a week earlier?"})
    if state.get("cabin") != "business":
        suggestions.append({"emoji": "💺", "label": "Check business", "query": "What if I do business instead?"})
    if state.get("tripType") != "roundtrip":
        suggestions.append({"emoji": "🔁", "label": "Make it round trip", "query": "What if I make this round trip?"})
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, str]] = []
    for item in suggestions:
        key = (item.get("label", "").lower(), item.get("query", "").lower())
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out[:3]
