"""Baseline coverage for verdict_service.generate_verdict (ticket 86b9x8qg5).

Captures CURRENT behavior as the baseline so the threshold-restructure PR can
flip specific assertions while keeping the data-fallback branches stable.

The async generate_verdict is driven via asyncio.run() so pytest-asyncio does
not become a hidden dep. The logic is pure given inputs, so no mocking.
"""

import asyncio
from datetime import date, timedelta

import pytest

from app.services.verdict_service import (
    CASH_HORIZON_DAYS,
    TIER_EXPLANATION_MARGINAL,
    TIER_EXPLANATION_PREMIUM,
    TIER_EXPLANATION_SOLID,
    _build_next_step,
    _classify_tier,
    _is_past_cash_horizon,
    generate_verdict,
)


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


def test_T3_cpp_1p25_lower_gray_zone_returns_pay_cash():
    """Flipped in Phase 3: 1.25 <= cpp < 1.5 is now pay_cash gray zone."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.25)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"
    assert result["confidence"] == "medium"
    assert "preserves your points" in result["explanation"]


def test_T4_cpp_1p5_gray_zone_midpoint_returns_use_points():
    """Flipped in Phase 3: 1.5 <= cpp < 1.8 is now use_points gray zone."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.5)])
    assert result["recommendation"] == "use_points"
    assert result["verdict_label"] == "Use Points"
    assert result["confidence"] == "medium"
    assert "beats paying cash" in result["explanation"]


def test_T5_cpp_1p79_upper_gray_zone_returns_use_points():
    """Flipped in Phase 3: 1.5 <= cpp < 1.8 is now use_points gray zone."""
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.79)])
    assert result["recommendation"] == "use_points"
    assert result["verdict_label"] == "Use Points"
    assert result["confidence"] == "medium"
    assert "beats paying cash" in result["explanation"]


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
    """Default _award (points=60000, taxes=50) + cash=800, one-way × 1 traveler.

    metrics.cpp is matched-scope, computed from cash − taxes / points_cost:
        (800 - 50) / 60000 × 100 = 1.25¢
    This is intentionally distinct from winner.cpp (2.0) — winner.cpp is the
    per-pax / one-way score that still drives the recommendation gate, and
    is preserved on the winner payload, but metrics.cpp is the user-facing
    matched-scope number that reconciles with savings.
    """
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
    assert result["metrics"]["cpp"] == pytest.approx(1.25)
    assert result["metrics"]["points_cost"] == 60000
    assert result["metrics"]["points_cost_per_traveler"] == 60000
    assert result["metrics"]["travelers"] == 1
    assert result["pay_cash"] is False


# ---- Cash-cheap override (documented sharp boundary at $251) -----------------

def test_T14_cash_under_250_overrides_use_points_cpp_returns_pay_cash():
    """cash_price <= 250 forces pay_cash even when cpp would otherwise pick use_points.

    Pre-existing sharp boundary at $251 documented but out of scope for this PR.
    """
    result = _run(cash_price=200.0, award_options=[_award(cpp=1.6)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"


# ---- Gray-zone messaging (new in Phase 3) -----------------------------------

def test_T15_cpp_1p3_pay_cash_gray_zone_messaging():
    """1.25 <= cpp < 1.5: pay_cash with gray-zone framing."""
    result = _run(cash_price=800.0, award_options=[_award(program="united", points=70000, cpp=1.3)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_label"] == "Pay Cash"
    assert result["confidence"] == "medium"
    assert "Pay cash" in result["headline"]
    assert "below the threshold" in result["explanation"]
    assert "United" in result["explanation"]
    assert "70,000 points" in result["explanation"]
    assert result["next_step"] is None


def test_T16_cpp_1p7_use_points_gray_zone_messaging():
    """1.5 <= cpp < 1.8: use_points with gray-zone framing."""
    result = _run(cash_price=800.0, award_options=[_award(program="aeroplan", points=55000, cpp=1.7)])
    assert result["recommendation"] == "use_points"
    assert result["verdict_label"] == "Use Points"
    assert result["confidence"] == "medium"
    assert "Use points" in result["headline"]
    assert "beats paying cash" in result["explanation"]
    assert "Aeroplan" in result["explanation"]
    assert "55,000 points" in result["explanation"]
    assert result["next_step"] is None


# ---- premium_economy is_premium branch (86ba25eq0) ---------------------------

def test_premium_economy_treated_as_premium_for_pay_cash_low_cpp():
    """premium_economy + pay_cash + cpp<1.25 hits the premium next-step,
    not the economy 'save your points for a bigger trip' branch."""
    step = _build_next_step(
        "pay_cash", "JFK", "LHR", "premium_economy",
        cpp=1.0, cash_price=1800.0,
    )
    assert step is not None
    assert step["label"] == "There's probably a better deal"
    assert "Premium awards" in step["prompt"]


def test_premium_economy_skips_economy_cash_floor():
    """premium_economy + pay_cash + cash<=250 must NOT hit the economy
    early-return (None). Should fall through to the is_premium branch when
    cpp is also low, or return None otherwise. Asserting it doesn't take
    the economy-only short-circuit by giving it a low cpp and verifying
    the premium next-step fires."""
    step = _build_next_step(
        "pay_cash", "JFK", "LHR", "premium_economy",
        cpp=1.0, cash_price=200.0,
    )
    assert step is not None
    assert step["label"] == "There's probably a better deal"


def test_economy_baseline_unchanged_uses_save_for_bigger_trip():
    """Sanity: bare economy still routes to the economy branch."""
    step = _build_next_step(
        "pay_cash", "JFK", "LHR", "economy",
        cpp=1.0, cash_price=1800.0,
    )
    assert step is not None
    assert step["label"] == "Save your points for a bigger trip"


# ---- Cause-aware missing_cash split (PR-α) ----------------------------------
#
# Splits the legacy "missing_cash" data_quality into two causes so the UI can
# stop blaming the user's date when the failure is on our side. Bug repro:
# Trip B in the audit (NYC→LON PE, +60d) rendered the "~10 months out" copy
# even though it was nowhere near the horizon.

def _date_offset(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def test_is_past_cash_horizon_within_returns_false():
    """+60d depart (Trip B from the audit) must NOT trip the horizon path."""
    assert _is_past_cash_horizon(_date_offset(60)) is False


def test_is_past_cash_horizon_beyond_returns_true():
    """One day past the horizon flips to True. Boundary documented in PR #140."""
    assert _is_past_cash_horizon(_date_offset(CASH_HORIZON_DAYS + 1)) is True


def test_is_past_cash_horizon_at_boundary_inclusive():
    """Equal to today+horizon is NOT past — only strictly greater flips."""
    assert _is_past_cash_horizon(_date_offset(CASH_HORIZON_DAYS)) is False


def test_is_past_cash_horizon_invalid_returns_false():
    """Unparseable input defaults to 'upstream' interpretation, not 'horizon'.

    Reason: we'd rather render the upstream copy on a malformed date than
    falsely claim horizon when we don't actually know.
    """
    assert _is_past_cash_horizon("not-a-date") is False
    assert _is_past_cash_horizon("") is False


@pytest.mark.parametrize(
    "cash_price,has_awards,depart_offset,expected_quality",
    [
        # both present -> full
        (800.0, True, 60, "full"),
        # cash only -> missing_awards (no horizon split for award absence)
        (800.0, False, 60, "missing_awards"),
        (800.0, False, CASH_HORIZON_DAYS + 5, "missing_awards"),
        # awards only, within horizon -> upstream (cash provider failure)
        (None, True, 60, "missing_cash_upstream"),
        # awards only, past horizon -> horizon (provider has no data this far out)
        (None, True, CASH_HORIZON_DAYS + 5, "missing_cash_horizon"),
        # neither -> missing_both (not split this PR; queued)
        (None, False, 60, "missing_both"),
        (None, False, CASH_HORIZON_DAYS + 5, "missing_both"),
    ],
)
def test_data_quality_cause_aware_assignment(
    cash_price, has_awards, depart_offset, expected_quality
):
    """The full data_quality assignment table after the missing_cash split.

    The Trip B audit bug surfaces here as row 4 (None, True, 60): pre-fix this
    bucketed into legacy "missing_cash" and rendered the horizon copy. Post-fix
    it must produce "missing_cash_upstream" so the UI can render honest copy.
    """
    awards = [_award(cpp=1.6)] if has_awards else []
    result = _run(
        cash_price=cash_price,
        award_options=awards,
        date=_date_offset(depart_offset),
    )
    assert result["data_quality"] == expected_quality


def test_missing_cash_horizon_passes_into_response_payload():
    """End-to-end: the new value lands in the response data_quality field."""
    result = _run(
        cash_price=None,
        award_options=[_award(cpp=1.6)],
        date=_date_offset(CASH_HORIZON_DAYS + 30),
    )
    assert result["data_quality"] == "missing_cash_horizon"
    assert result["missing_sources"] == ["cash_price"]


def test_missing_cash_upstream_passes_into_response_payload():
    """End-to-end: the upstream cause lands in the response data_quality field.

    This is the path that fixes the Trip B (+60d NYC→LON) bug — backend now
    distinguishes upstream failure from horizon exceedance, frontend renders
    honest copy.
    """
    result = _run(
        cash_price=None,
        award_options=[_award(cpp=1.6)],
        date=_date_offset(60),
    )
    assert result["data_quality"] == "missing_cash_upstream"
    assert result["missing_sources"] == ["cash_price"]


# ---- Verdict tier badge + explanation (ticket 86b9v4aft) --------------------

@pytest.mark.parametrize(
    "cpp,expected_tier,expected_copy",
    [
        (2.4, "premium", TIER_EXPLANATION_PREMIUM),
        (1.8, "premium", TIER_EXPLANATION_PREMIUM),
        (1.6, "solid", TIER_EXPLANATION_SOLID),
        (1.5, "solid", TIER_EXPLANATION_SOLID),
        (1.3, "marginal", TIER_EXPLANATION_MARGINAL),
        (1.25, "marginal", TIER_EXPLANATION_MARGINAL),
    ],
)
def test_classify_tier_maps_cpp_to_tier_and_copy(cpp, expected_tier, expected_copy):
    tier, explanation = _classify_tier(cpp)
    assert tier == expected_tier
    assert explanation == expected_copy


@pytest.mark.parametrize("cpp", [None, 0.5, 1.0, 1.24])
def test_classify_tier_below_floor_returns_none(cpp):
    """cpp below pay_cash threshold (or missing) yields no tier label."""
    tier, explanation = _classify_tier(cpp)
    assert tier is None
    assert explanation is None


def test_use_points_strong_emits_premium_tier():
    """cpp >= 1.8 with use_points: verdict_tier=premium, full explanation copy.

    Cash chosen so matched-scope metrics.cpp lands at 2.4¢ with the default
    award (points=60000, taxes=50): (1490 − 50) / 60000 × 100 = 2.4¢.
    winner.cpp=2.4 still drives the strong recommendation path.
    """
    result = _run(cash_price=1490.0, award_options=[_award(cpp=2.4)])
    assert result["recommendation"] == "use_points"
    assert result["verdict_tier"] == "premium"
    assert result["tier_explanation"] == TIER_EXPLANATION_PREMIUM
    assert result["metrics"]["cpp"] == pytest.approx(2.4)


def test_use_points_gray_zone_emits_solid_tier():
    """1.5 <= cpp < 1.8 with use_points: verdict_tier=solid.

    Cash chosen so matched-scope metrics.cpp lands at 1.6¢ with the default
    award (points=60000, taxes=50): (1010 − 50) / 60000 × 100 = 1.6¢.
    winner.cpp=1.6 still drives the gray-zone use_points recommendation.
    """
    result = _run(cash_price=1010.0, award_options=[_award(cpp=1.6)])
    assert result["recommendation"] == "use_points"
    assert result["verdict_tier"] == "solid"
    assert result["tier_explanation"] == TIER_EXPLANATION_SOLID
    assert result["metrics"]["cpp"] == pytest.approx(1.6)


# ---- Round-trip × multi-traveler reference (matched-scope metrics) ----------

def test_metrics_cpp_reconciles_rt_multi_traveler_reference_case():
    """SFO → SIN PE round-trip × 3 travelers — the prod case that motivated this PR.

    Both legs cost 79,000 points per pax on Singapore KrisFlyer. Cash savings
    versus the live KLM/Delta fare came in at ~$9,499 grand-total. Honest
    redemption cost is:
        points_cost              = (79,000 + 79,000) × 3 = 474,000
        points_cost_per_traveler = 79,000 + 79,000       = 158,000
        cpp (matched scope)      = 9499 / 474000 × 100   ≈ 2.00¢

    Pre-fix surface rendered points_cost = 79,000 × 3 = 237,000 (one-way × pax)
    and cpp = 4.01¢ (the per-pax / one-way score). Both numbers were wrong on
    the user's actual booking scope. This reference test pins the corrected
    numbers and the cpp × points_cost / 100 ≈ savings reconciliation so the
    bias cannot silently come back.
    """
    outbound = _award(
        program="singapore",
        points=79000,
        taxes=0.0,
        cpp=4.0,  # per-pax / one-way score from seats.aero; recommendation gate reads this
    )
    inbound = _award(
        program="singapore",
        points=79000,
        taxes=0.0,
        cpp=4.0,
    )
    result = _run(
        cash_price=9499.0,
        award_options=[outbound],
        return_award_options=[inbound],
        is_roundtrip=True,
        return_date="2026-09-29",
        travelers=3,
        user_programs=["singapore"],
    )
    metrics = result["metrics"]
    assert result["recommendation"] == "use_points"
    assert metrics["points_cost"] == 474_000
    assert metrics["points_cost_per_traveler"] == 158_000
    assert metrics["travelers"] == 3
    assert metrics["cpp"] == pytest.approx(2.00, abs=0.01)
    assert metrics["estimated_savings"] == pytest.approx(9499.0, abs=0.01)
    # Matched-scope cpp must reconcile with savings: cpp × points / 100 ≈ savings.
    assert (
        metrics["cpp"] * metrics["points_cost"] / 100
        == pytest.approx(metrics["estimated_savings"], abs=1.0)
    )
    # Matched-scope cpp ≈ 2.0¢ → premium tier band.
    assert result["verdict_tier"] == "premium"
    # winner.cpp (per-pax / one-way) is preserved on the payload for the
    # recommendation gate; metrics.cpp is the matched-scope display value.
    assert result["winner"]["cpp"] == pytest.approx(4.0)


def test_pay_cash_omits_tier_fields():
    """pay_cash recommendation: verdict_tier and tier_explanation both None.

    The marginal cpp band (1.25-1.49) currently routes to pay_cash, so verdict_tier
    must be None on the wire even though _classify_tier would return 'marginal'.
    """
    result = _run(cash_price=800.0, award_options=[_award(cpp=1.3)])
    assert result["recommendation"] == "pay_cash"
    assert result["verdict_tier"] is None
    assert result["tier_explanation"] is None


def test_wait_omits_tier_fields():
    """Wait verdicts (no data) emit no tier fields."""
    result = _run(cash_price=None, award_options=[])
    assert result["recommendation"] == "wait"
    assert result["verdict_tier"] is None
    assert result["tier_explanation"] is None


def test_tier_explanation_contains_no_jargon():
    """ELI5 ribbon: tier copy must never include 'redemption rate', 'cents per
    point', or the literal 'cpp' token. The full sentence may mention the word
    'redemption' (e.g. 'top-tier redemption') — guard against the compound
    jargon phrases only.
    """
    forbidden = ["redemption rate", "cents per point", "cpp"]
    for copy in (TIER_EXPLANATION_PREMIUM, TIER_EXPLANATION_SOLID, TIER_EXPLANATION_MARGINAL):
        lowered = copy.lower()
        for phrase in forbidden:
            assert phrase not in lowered, f"tier copy leaked jargon '{phrase}': {copy}"


def test_legacy_missing_cash_literal_no_longer_emitted():
    """Regression guard: the bare 'missing_cash' string was renamed outright.

    Anything still emitting it would route to the defensive variant on the
    frontend (silent UX degradation), so make the rename load-bearing.
    """
    for offset in (60, CASH_HORIZON_DAYS + 5):
        result = _run(
            cash_price=None,
            award_options=[_award(cpp=1.6)],
            date=_date_offset(offset),
        )
        assert result["data_quality"] != "missing_cash"
