"""Selection-policy tests for the SINGLE selector (#2 step c) — mirrors the
frontend selectTopProgram cases so the ported scoring can't drift."""
from app.services.verdict_service import _select_top_award, WALLET_FIT_MULTIPLIER


def _a(program, cpp):
    return {"program": program, "cpp": cpp, "points": 10000, "taxes": 5.6}


def test_reachable_beats_unreachable_higher_cpp():
    # aeroplan 1.6 reachable vs delta 1.9 unreachable: 1.6 > 1.9*0.7=1.33
    pick = _select_top_award([_a("delta", 1.9), _a("aeroplan", 1.6)], ["aeroplan"])
    assert pick["program"] == "aeroplan"


def test_unreachable_wins_past_the_penalty_gap():
    # 43%+ cpp gap overrides the wallet-fit penalty (2.5*0.7=1.75 > 1.6)
    pick = _select_top_award([_a("delta", 2.5), _a("aeroplan", 1.6)], ["aeroplan"])
    assert pick["program"] == "delta"


def test_reachable_tiebreak_and_stable_order():
    pick = _select_top_award([_a("united", 1.0), _a("aeroplan", 1.0)], ["aeroplan", "united"])
    assert pick["program"] == "united"  # equal score, first in order wins


def test_empty_wallet_scores_all_equally_penalized():
    pick = _select_top_award([_a("united", 1.2), _a("delta", 1.5)], [])
    assert pick["program"] == "delta"


def test_no_cpp_awards_fall_back_to_first():
    pick = _select_top_award([{"program": "x", "cpp": None}], ["x"])
    assert pick["program"] == "x"


def test_multiplier_is_frontend_mirror():
    assert WALLET_FIT_MULTIPLIER == 0.7
