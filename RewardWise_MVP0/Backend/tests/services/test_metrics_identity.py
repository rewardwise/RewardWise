"""CI identity guard: cpp x points_cost must equal comparison_cash - taxes for
every scope. This is the invariant that would have caught #233 (per-leg points
vs RT cash), #238 (frontend recompute on full cash), and the outbound-scope
frame bug — it blocks merges, not just backfill replays."""
import pytest
from app.services.verdict_service import _metrics


def _check(m):
    assert m["cpp"] is not None and m["points_cost"] and m["comparison_cash"] is not None
    lhs = m["cpp"] * m["points_cost"] / 100.0
    rhs = m["comparison_cash"] - m["taxes"]
    assert lhs == pytest.approx(rhs, abs=0.51), (m["scope"], lhs, rhs)


def test_identity_matched_round_trip():
    m = _metrics(1200.0, {"points": 40000, "taxes": 10.0}, {"points": 40000, "taxes": 10.0}, 1, is_roundtrip=True)
    assert m["scope"] == "round_trip" and m["comparison_cash"] == 1200.0
    _check(m)


def test_identity_outbound_only_half_fare():
    m = _metrics(2379.0, {"points": 79000, "taxes": 0.0}, None, 1, is_roundtrip=True)
    assert m["scope"] == "outbound_only" and m["comparison_cash"] == pytest.approx(1189.5)
    assert m["points_cost"] == 79000
    _check(m)


def test_identity_one_way():
    m = _metrics(800.0, {"points": 60000, "taxes": 50.0}, None, 1, is_roundtrip=False)
    assert m["scope"] == "one_way" and m["comparison_cash"] == 800.0
    _check(m)


def test_identity_multi_traveler_matched():
    m = _metrics(2400.0, {"points": 30000, "taxes": 20.0}, {"points": 30000, "taxes": 20.0}, 2, is_roundtrip=True)
    assert m["points_cost"] == 120000
    _check(m)
