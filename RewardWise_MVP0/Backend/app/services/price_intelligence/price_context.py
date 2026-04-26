from __future__ import annotations

from typing import Any

from app.services.price_intelligence.baseline_repository import get_baseline_repository
from app.services.price_intelligence.route_features import build_route_features
from app.services.price_intelligence.trend_scorer import score_cash_price


def build_price_context(
    *,
    origin: str,
    destination: str,
    departure_date: str,
    cabin: str = "economy",
    trip_type: str = "roundtrip",
    current_cash_price: float | int | None = None,
) -> dict[str, Any]:
    """Build compact historical price context for Zoe.

    This function is safe to call in production. If the artifact is missing or
    no baseline matches, it returns a no-baseline payload and does not raise.
    """
    features = build_route_features(origin, destination, departure_date, cabin, trip_type)
    baseline = get_baseline_repository().get_best_baseline(features)
    trend = score_cash_price(current_cash_price, baseline)

    context = {
        "has_baseline": baseline.has_baseline,
        "route_key": features.route_key,
        "route_tier": features.route_tier,
        "market_segment": features.market_segment,
        "season": features.season,
        "cabin": features.cabin,
        "trip_type": features.trip_type,
        "match_level": baseline.match_level,
        "confidence": baseline.confidence,
        "sample_size": baseline.sample_size,
        "current_cash_price": current_cash_price,
        "cash_price_label": trend.label,
        "percent_vs_median": trend.percent_vs_median,
        "median_cash_price": baseline.median_cash_price,
        "normal_range": [baseline.p25_cash_price, baseline.p75_cash_price] if baseline.has_baseline else None,
        "p90_cash_price": baseline.p90_cash_price,
        "source_mix": baseline.source_mix,
        "summary": trend.summary,
    }
    if not baseline.has_baseline:
        context["summary"] = "No historical fare baseline was available for this route context."
    return context
