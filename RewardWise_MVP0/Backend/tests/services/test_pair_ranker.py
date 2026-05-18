"""Pair ranker: pick the (outbound, return) pair with the lowest total points
where return.date > outbound.date. Tiebreaker: earliest outbound iso wins.
"""

from app.services.pair_ranker import rank_pairs


def _award(date_iso: str, points: int) -> dict:
    return {"date": date_iso, "points": points}


def test_pair_ranker_filters_invalid_dates():
    """Pairs where return.date <= outbound.date must be skipped."""
    outbound = [_award("2026-06-05", 50_000)]
    returns = [
        _award("2026-06-04", 30_000),  # before outbound -> invalid
        _award("2026-06-05", 30_000),  # same day -> invalid
        _award("2026-06-06", 40_000),  # valid (only this should win)
    ]
    out, ret = rank_pairs(outbound, returns)
    assert out["date"] == "2026-06-05"
    assert ret["date"] == "2026-06-06"


def test_pair_ranker_picks_lowest_total_points():
    """Cheapest total across the Cartesian product wins."""
    outbound = [
        _award("2026-06-01", 70_000),
        _award("2026-06-02", 40_000),  # cheaper outbound
        _award("2026-06-03", 60_000),
    ]
    returns = [
        _award("2026-06-10", 50_000),
        _award("2026-06-11", 30_000),  # cheaper return
        _award("2026-06-12", 80_000),
    ]
    out, ret = rank_pairs(outbound, returns)
    assert out["points"] == 40_000
    assert ret["points"] == 30_000


def test_pair_ranker_earliest_outbound_tiebreaker():
    """On equal total points, the earliest outbound date wins."""
    outbound = [
        _award("2026-06-03", 50_000),
        _award("2026-06-01", 50_000),  # earlier, same total
        _award("2026-06-02", 50_000),
    ]
    returns = [_award("2026-06-15", 40_000)]
    out, ret = rank_pairs(outbound, returns)
    assert out["date"] == "2026-06-01"
    assert ret["date"] == "2026-06-15"


def test_pair_ranker_empty_inputs():
    """Empty outbound or return list yields (None, None)."""
    assert rank_pairs([], [_award("2026-06-10", 30_000)]) == (None, None)
    assert rank_pairs([_award("2026-06-01", 30_000)], []) == (None, None)
    assert rank_pairs([], []) == (None, None)


def test_pair_ranker_anchor_pair_always_valid():
    """When the user picks a valid anchor (outbound < return), the anchor pair
    is always among the candidates and chosen if it's the cheapest."""
    outbound = [_award("2026-06-01", 30_000), _award("2026-06-02", 50_000)]
    returns = [_award("2026-06-15", 30_000), _award("2026-06-16", 50_000)]
    out, ret = rank_pairs(outbound, returns)
    assert out["date"] == "2026-06-01"
    assert ret["date"] == "2026-06-15"
    assert out["points"] + ret["points"] == 60_000
