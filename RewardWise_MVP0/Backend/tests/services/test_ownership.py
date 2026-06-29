"""Deterministic ownership fork — the prototype's b2 / b3 states.

compute_ownership is a pure function of (use_points verdict, wallet balances).
It must NOT touch the 1.25/1.8 recommendation thresholds — it only answers
"can the caller actually book the points option, and if short, is buying the
gap rational?" Buying is gated cpp-relative: redemption cpp must beat the
program's buy rate, otherwise pay cash outright.
"""

import asyncio

from app.services.ownership import (
    BUY_RATE_CPP,
    compute_ownership,
    transferable_balance,
)
from app.services.verdict_service import generate_verdict


def _use_points_verdict(*, program="united", points_cost=30000, cpp=2.0, savings=600.0):
    """Minimal use_points verdict shaped like _base_response output."""
    return {
        "recommendation": "use_points",
        "winner": {"program": program, "points": points_cost},
        "metrics": {
            "points_cost": points_cost,
            "cpp": cpp,
            "estimated_savings": savings,
        },
    }


# ---- transferable_balance: real ratios, not 1:1 -------------------------------

def test_transferable_balance_one_to_one():
    """Chase UR → United is 1:1."""
    total, reachable = transferable_balance("united", {"Chase Ultimate Rewards": 40000})
    assert total == 40000
    assert any(p["sourceCard"] == "Chase Ultimate Rewards" for p in reachable)


def test_transferable_balance_applies_non_unity_ratio():
    """Amex MR → JetBlue is 5:4 — 25,000 MR lands 20,000 TrueBlue (floored)."""
    total, _ = transferable_balance("jetblue", {"Amex Membership Rewards": 25000})
    assert total == 20000


def test_transferable_balance_sums_multiple_sources():
    total, _ = transferable_balance(
        "united", {"Chase Ultimate Rewards": 30000, "Bilt Rewards": 10000}
    )
    assert total == 40000


def test_transferable_balance_counts_native_miles_for_transferless_program():
    """A native holder of a program with empty PROGRAM_ALIASES (JetBlue) still
    counts — not shown as short. Native miles count 1:1."""
    total, reachable = transferable_balance("jetblue", {"JetBlue TrueBlue": 25000})
    assert total == 25000
    assert any(p["native"] and p["sourceCard"] == "JetBlue TrueBlue" for p in reachable)


def test_transferable_balance_no_double_count_native_plus_alias():
    """Native miles counted once even when the program also has a partner display."""
    total, _ = transferable_balance("united", {"United MileagePlus": 30000})
    assert total == 30000


# ---- b2: owned >= needed -> use_points ---------------------------------------

def test_b2_owned_meets_need_recommends_use_points():
    v = _use_points_verdict(program="united", points_cost=30000, cpp=2.0)
    own = compute_ownership(v, {"Chase Ultimate Rewards": 40000})
    assert own is not None
    assert own["can_afford"] is True
    assert own["shortfall"] == 0
    assert own["fork_recommendation"] == "use_points"
    assert own["fork_reason"] == "owned_sufficient"


def test_b2_exact_balance_is_affordable():
    v = _use_points_verdict(points_cost=30000)
    own = compute_ownership(v, {"Chase Ultimate Rewards": 30000})
    assert own["can_afford"] is True
    assert own["fork_recommendation"] == "use_points"


# ---- b3: short AND cpp < buy_rate -> pay_cash (the honesty moment) ------------

def test_b3_short_and_cpp_below_buy_rate_forks_to_pay_cash():
    # United buy rate is 3.85¢; a 1.6¢ redemption is below it, so buying the
    # 25k gap is irrational — recommend cash and keep the points.
    assert BUY_RATE_CPP["united"] == 3.85
    v = _use_points_verdict(program="united", points_cost=40000, cpp=1.6, savings=500.0)
    own = compute_ownership(v, {"Chase Ultimate Rewards": 15000})
    assert own["shortfall"] == 25000
    assert own["can_afford"] is False
    assert own["buyable"] is True
    assert own["buy_gap_cost"] == round(25000 * 3.85 / 100, 2)  # 962.50
    assert own["buy_gap_worth_it"] is False
    assert own["fork_recommendation"] == "pay_cash"
    assert own["fork_reason"] == "short_buy_not_worth_it"


def test_b3_short_hotel_forks_to_pay_cash_via_cpp_rule_not_cant_buy():
    # Hotels DO sell points -> buyable. A weak hotel redemption (cpp below the
    # buy rate) routes to pay_cash with the TRUTHFUL "not worth it" reason,
    # never the false "you can't buy these" (short_cant_buy).
    v = _use_points_verdict(program="hyatt", points_cost=30000, cpp=1.6, savings=300.0)
    own = compute_ownership(v, {})
    assert own["buyable"] is True
    assert own["buy_rate_cpp"] == 2.4
    assert own["fork_recommendation"] == "pay_cash"
    assert own["fork_reason"] == "short_buy_not_worth_it"
    assert own["fork_reason"] != "short_cant_buy"


def test_short_cant_buy_only_fires_for_flexible_currency():
    # The one genuinely-can't-buy category: flexible bank currencies.
    v = _use_points_verdict(program="amex_mr", points_cost=30000, cpp=2.5)
    own = compute_ownership(v, {})
    assert own["buyable"] is False
    assert own["buy_gap_cost"] is None
    assert own["fork_recommendation"] == "pay_cash"
    assert own["fork_reason"] == "short_cant_buy"


def test_unlisted_airline_defaults_to_buyable_not_cant_buy():
    # An airline NOT in the override table must default to buyable at ~3.0¢ —
    # never the false "you can't buy these" statement (korean/ana/smiles/azul).
    for program in ("korean", "ana", "smiles", "azul", "saudia"):
        v = _use_points_verdict(program=program, points_cost=30000, cpp=1.6, savings=400.0)
        own = compute_ownership(v, {})
        assert own["buyable"] is True, f"{program} should be buyable"
        assert own["buy_rate_cpp"] == 3.0
        assert own["buy_gap_cost"] == round(30000 * 3.0 / 100, 2)  # no shortfall fabrication, real rate
        # cpp 1.6 < 3.0 buy rate -> still pay cash, but for the right reason
        assert own["fork_reason"] == "short_buy_not_worth_it"


# ---- conservative bias: worth_it only when cpp beats the buy rate -------------

def test_buy_gap_worth_it_only_when_cpp_exceeds_buy_rate():
    # Tiny shortfall, premium 4.5¢ redemption (> 3.85¢ buy rate), big savings:
    # buying the gap is rational, so the points path holds (de-emphasized buy).
    v = _use_points_verdict(program="united", points_cost=40000, cpp=4.5, savings=1000.0)
    own = compute_ownership(v, {"Chase Ultimate Rewards": 38000})
    assert own["shortfall"] == 2000
    assert own["buy_gap_worth_it"] is True
    assert own["fork_recommendation"] == "use_points"
    assert own["fork_reason"] == "short_buy_worth_it"


def test_worth_it_false_when_buy_cost_exceeds_savings():
    # cpp beats buy rate, but the buy cost is larger than the cash savings —
    # the secondary guard keeps it conservative (still pay cash).
    v = _use_points_verdict(program="united", points_cost=40000, cpp=4.0, savings=50.0)
    own = compute_ownership(v, {"Chase Ultimate Rewards": 10000})
    assert own["buy_gap_worth_it"] is False
    assert own["fork_recommendation"] == "pay_cash"


def test_worth_it_fails_closed_when_savings_unknown():
    # Unknown savings must NOT let buying clear on cpp alone (conservative bias).
    v = _use_points_verdict(program="united", points_cost=40000, cpp=4.5, savings=None)
    own = compute_ownership(v, {"Chase Ultimate Rewards": 38000})
    assert own["buy_gap_worth_it"] is False
    assert own["fork_recommendation"] == "pay_cash"


# ---- not applicable ----------------------------------------------------------

def test_pay_cash_verdict_has_no_ownership_fork():
    assert compute_ownership({"recommendation": "pay_cash"}, {"Chase Ultimate Rewards": 99999}) is None


def test_missing_winner_returns_none():
    v = {"recommendation": "use_points", "winner": {}, "metrics": {}}
    assert compute_ownership(v, {}) is None


# ---- integration: real engine verdict -> ownership ---------------------------

def test_integration_generate_verdict_feeds_ownership():
    """Drive the real engine to a use_points verdict, then fork on a wallet."""
    # cash 800, taxes 50, target matched cpp 2.0 -> points = (800-50)/2.0*100 = 37500
    award = {
        "program": "united", "points": 37500, "taxes": 50.0, "cpp": 2.0,
        "direct": True, "remaining_seats": 4, "trip_ids": ["abc"],
        "origin_airport": "SFO", "destination_airport": "NRT",
    }
    verdict = asyncio.run(generate_verdict(
        origin="SFO", destination="NRT", date="2026-09-15", cabin="economy",
        travelers=1, is_roundtrip=False, return_date=None, cash_price=800.0,
        award_options=[award], return_award_options=[], user_programs=["united"],
    ))
    assert verdict["recommendation"] == "use_points"
    assert verdict["metrics"]["points_cost"] == 37500

    has_enough = compute_ownership(verdict, {"Chase Ultimate Rewards": 40000})
    assert has_enough["can_afford"] is True
    assert has_enough["fork_recommendation"] == "use_points"

    is_short = compute_ownership(verdict, {"Chase Ultimate Rewards": 20000})
    assert is_short["shortfall"] == 17500
    assert is_short["fork_recommendation"] == "pay_cash"  # cpp 2.0 < 3.85 buy rate
