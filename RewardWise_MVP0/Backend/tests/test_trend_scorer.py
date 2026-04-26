from app.services.price_intelligence.baseline_repository import BaselineMatch
from app.services.price_intelligence.trend_scorer import score_cash_price


def baseline():
    return BaselineMatch(
        has_baseline=True,
        match_level="exact_route",
        route_key="EWR-MIA",
        route_tier="hub_to_hub",
        confidence="high",
        sample_size=200,
        p25_cash_price=200,
        median_cash_price=300,
        p75_cash_price=400,
        p90_cash_price=500,
        source_mix="mock",
    )


def test_score_cash_price_labels():
    assert score_cash_price(180, baseline()).label == "cheap"
    assert score_cash_price(350, baseline()).label == "normal"
    assert score_cash_price(450, baseline()).label == "high"
    assert score_cash_price(650, baseline()).label == "unusually_high"
