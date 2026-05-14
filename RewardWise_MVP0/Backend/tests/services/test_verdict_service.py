"""Baseline coverage for verdict_service.generate_verdict (ticket 86b9x8qg5).

Captures CURRENT behavior as the baseline so the threshold-restructure PR can
flip specific assertions while keeping the data-fallback branches stable.

The async generate_verdict is driven via asyncio.run() so pytest-asyncio does
not become a hidden dep. The logic is pure given inputs, so no mocking.
"""

import asyncio

from app.services.verdict_service import generate_verdict


def _run(**overrides):
    """Invoke generate_verdict with sensible defaults plus per-test overrides."""
    kwargs = {
        "origin": "SFO",
        "destination": "NRT",
        "date": "2026-09-15",
        "cabin": "economy",
        "travelers": 1,
        "is_roundtrip": False,
        "return_date": None,
        "cash_price": 800.0,
        "award_options": [],
        "return_award_options": [],
        "user_programs": None,
    }
    kwargs.update(overrides)
    return asyncio.run(generate_verdict(**kwargs))


def _award(*, program="united", points=60000, taxes=50.0, cpp=1.5, direct=True, remaining_seats=4):
    return {
        "program": program,
        "points": points,
        "taxes": taxes,
        "cpp": cpp,
        "direct": direct,
        "remaining_seats": remaining_seats,
        "trip_ids": ["abc"],
        "origin_airport": "SFO",
        "destination_airport": "NRT",
    }


# ---- CPP threshold branches ---------------------------------------------------

def test_T1_cpp_1p0_returns_pay_cash():
    """cpp=1.0 sits in pay_cash with medium confidence; high-confidence band is cpp<1.0 OR cash<=200."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.0)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"
    assert result["confidence"] == "medium"


def test_T1b_cpp_0p9_with_high_cash_returns_pay_cash_high_confidence():
    """Locks the high-confidence band boundary (cpp strictly < 1.0)."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=0.9)])
    assert result["recommendation"] == "pay_cash"
    assert result["confidence"] == "high"


def test_T2_cpp_1p24_just_below_threshold_returns_pay_cash():
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.24)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"


def test_T3_cpp_1p25_lower_gray_zone_returns_wait_BASELINE():
    """Will flip to pay_cash in Phase 3."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.25)])
    assert result["recommendation"] == "wait"
    assert result["verdict_label"] == "Wait"
    assert result["confidence"] == "medium"


def test_T4_cpp_1p5_gray_zone_midpoint_returns_wait_BASELINE():
    """Will flip to use_points in Phase 3."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.5)])
    assert result["recommendation"] == "wait"
    assert result["verdict_label"] == "Wait"
    assert result["confidence"] == "medium"


def test_T5_cpp_1p79_upper_gray_zone_returns_wait_BASELINE():
    """Will flip to use_points in Phase 3."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.79)])
    assert result["recommendation"] == "wait"
    assert result["verdict_label"] == "Wait"


def test_T6_cpp_1p8_exact_returns_use_points_high_confidence():
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.8)])
    assert result["recommendation"] == "use_points"
    assert result["verdict_label"] == "Use Points"
    assert result["confidence"] == "high"


def test_T7_cpp_2p0_returns_use_points_high_confidence():
    result = _run(cash_price=800.0, award_options=[_award(cpp=2.0)])
    assert result["recommendation"] == "use_points"
    assert result["confidence"] == "high"


# ---- Data-fallback branches (PRESERVED across Phase 3) -----------------------

def test_T8_no_cash_no_awards_returns_wait_with_data_unavailable_headline():
    result = _run(cash_price=None, award_options=[])
    assert result["recommendation"] == "wait"
    assert result["verdict_label"] == "Wait"
    assert "do not have enough live data" in result["headline"]
    assert result["confidence"] == "low"
    assert result["safe_fallback_used"] is True


def test_T9_cash_only_no_awards_returns_pay_cash():
    result = _run(cash_price=300.0, award_options=[])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"


def test_T10_awards_not_in_wallet_with_cash_returns_pay_cash():
    result = _run(
        cash_price=300.0,
        award_options=[_award(program="aeroplan", cpp=1.6)],
        user_programs=["united"],
    )
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"


def test_T11_awards_not_in_wallet_without_cash_returns_wait():
    result = _run(
        cash_price=None,
        award_options=[_award(program="aeroplan", cpp=1.6)],
        user_programs=["united"],
    )
    assert result["recommendation"] == "wait"
    assert result["verdict_label"] == "Wait"


def test_T12_awards_only_no_cash_in_wallet_match_returns_wait():
    result = _run(
        cash_price=None,
        award_options=[_award(program="united", cpp=1.9)],
        user_programs=["united"],
    )
    assert result["recommendation"] == "wait"
    assert result["verdict_label"] == "Wait"
    assert "do not have a live cash fare" in result["headline"]


# ---- Response shape ----------------------------------------------------------

def test_T13_response_shape_contains_critical_fields():
    result = _run(cash_price=800.0, award_options=[_award(cpp=2.0)])
    for key in (
        "recommendation",
        "verdict_label",
        "headline",
        "explanation",
        "verdict",
        "confidence",
        "confidence_reason",
        "booking_note",
        "booking_link",
        "metrics",
        "data_quality",
        "missing_sources",
        "safe_fallback_used",
        "next_step",
        "winner",
        "pay_cash",
    ):
        assert key in result, f"missing field: {key}"
    assert result["metrics"]["cpp"] == 2.0
    assert result["pay_cash"] is False


# ---- Cash-cheap override (documented sharp boundary at $251) -----------------

def test_T14_cash_under_250_overrides_use_points_cpp_returns_pay_cash():
    """cash_price <= 250 forces pay_cash even when cpp would otherwise pick use_points.

    Pre-existing sharp boundary at $251 documented but out of scope for this PR.
    """
    result = _run(cash_price=200.0, award_options=[_award(cpp=1.6)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"
