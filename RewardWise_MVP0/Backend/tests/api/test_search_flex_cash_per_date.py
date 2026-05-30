"""Integration tests for per-date cash threading in search (ClickUp 86b9x8qr2).

The bug: flex-date searches returned award_options spanning multiple dates,
but cash was fetched once for the anchor date and reused — so every non-anchor
award's CPP was computed against the wrong cash anchor.

The fix exercises one new helper end-to-end:

  _build_award_options_with_per_date_cash(awards, cash_by_date, ...)

These tests stub the cash sampler's output (the cash_by_date dict the
orchestrator builds) and assert each award's CPP and cash_price field are
keyed off its own date — not a global scalar.

For the both-flex case (distinct outbound dates AND distinct return dates with
different prices), the test calls the helper TWICE — exactly as search()
does — and asserts each leg's winner uses its own-date cash.
"""

from app.api.search import _build_award_options_with_per_date_cash
from app.utils.math_utils import calculate_cpp


def _award(date: str, points: int, *, program="united", taxes_cents=5000):
    """Minimal award dict matching what search_award_availability returns."""
    return {
        "date": date,
        "points": points,
        "taxes": taxes_cents,
        "program": program,
        "remaining_seats": 2,
        "direct": True,
        "airlines": "UA",
        "trip_ids": [],
        "trips": [],
        "source": "united",
    }


# ---------------------------------------------------------------------------
# Original case: outbound awards on two dates, different cash, correct winner
# ---------------------------------------------------------------------------


def test_flex_outbound_picks_winner_via_own_date_cash():
    """Cheaper cash on a date hands the CPP win to the award on THAT date,
    even if it costs more points. Pre-fix bug would compare both awards to
    the same scalar and pick differently."""
    cash_by_date = {"2026-06-01": 320.0, "2026-06-02": 180.0}
    awards = [
        _award("2026-06-01", 50_000),  # 320 cash, 50K points
        _award("2026-06-02", 35_000),  # 180 cash, 35K points
    ]

    result = _build_award_options_with_per_date_cash(
        awards, cash_by_date, include_endpoint_airports=True
    )

    # Each award's cash_price field is its own-date cash, not the anchor.
    assert result[0]["cash_price"] in (320.0, 180.0)
    by_date = {row["date"]: row for row in result}
    assert by_date["2026-06-01"]["cash_price"] == 320.0
    assert by_date["2026-06-02"]["cash_price"] == 180.0

    # CPP must match calculate_cpp against own-date cash.
    expected_cpp_jun1 = calculate_cpp(320.0, 50.0, 50_000)  # taxes_cents=5000 → $50
    expected_cpp_jun2 = calculate_cpp(180.0, 50.0, 35_000)
    assert by_date["2026-06-01"]["cpp"] == expected_cpp_jun1
    assert by_date["2026-06-02"]["cpp"] == expected_cpp_jun2

    # Winner = highest CPP. Verify the sort honors per-date cash.
    assert result[0]["cpp"] == max(expected_cpp_jun1, expected_cpp_jun2)


def test_flex_outbound_with_endpoint_airports_preserves_field():
    """Both outbound and return legs emit origin_airport / destination_airport
    when include_endpoint_airports=True. The flag is now True on both legs in
    search.py so the FE leg-synthesis Tier-3 path can resolve metro CSVs
    (e.g. "JFK,LGA,EWR") to single airport codes on both directions."""
    award = _award("2026-06-01", 40_000)
    award["origin_airport"] = "SFO"
    award["destination_airport"] = "JFK"
    cash_by_date = {"2026-06-01": 200.0}

    out_result = _build_award_options_with_per_date_cash(
        [award], cash_by_date, include_endpoint_airports=True
    )
    ret_result = _build_award_options_with_per_date_cash(
        [award], cash_by_date, include_endpoint_airports=True
    )

    assert out_result[0]["origin_airport"] == "SFO"
    assert out_result[0]["destination_airport"] == "JFK"
    assert ret_result[0]["origin_airport"] == "SFO"
    assert ret_result[0]["destination_airport"] == "JFK"


def test_flex_endpoint_airports_omitted_when_flag_false():
    """The False branch is preserved for callers that have no per-leg airport
    data to emit. Both legs in search.py pass True; this guards the
    omit-on-False semantic so the flag stays meaningful."""
    award = _award("2026-06-01", 40_000)
    award["origin_airport"] = "SFO"
    award["destination_airport"] = "JFK"
    cash_by_date = {"2026-06-01": 200.0}

    result = _build_award_options_with_per_date_cash(
        [award], cash_by_date, include_endpoint_airports=False
    )
    assert "origin_airport" not in result[0]
    assert "destination_airport" not in result[0]


# ---------------------------------------------------------------------------
# Per-date None — that date's award returned with null cash + null cpp
# ---------------------------------------------------------------------------


def test_flex_per_date_none_returns_award_with_null_cash_and_cpp():
    """When the cash sampler couldn't price a date, the corresponding award
    is still emitted (no silent drop), but cash_price=None, cpp=None."""
    cash_by_date = {"2026-06-01": 250.0, "2026-06-02": None}
    awards = [
        _award("2026-06-01", 40_000),
        _award("2026-06-02", 30_000),
    ]

    result = _build_award_options_with_per_date_cash(
        awards, cash_by_date, include_endpoint_airports=True
    )

    by_date = {row["date"]: row for row in result}
    assert len(result) == 2
    assert by_date["2026-06-02"]["cash_price"] is None
    assert by_date["2026-06-02"]["cpp"] is None
    # The priced date is still ranked correctly above the null-cpp one.
    assert result[0]["date"] == "2026-06-01"


def test_flex_all_dates_none_returns_all_awards_with_null_cpp():
    """Total cash outage: every award still appears with null cpp."""
    cash_by_date = {"2026-06-01": None, "2026-06-02": None}
    awards = [
        _award("2026-06-01", 40_000),
        _award("2026-06-02", 30_000),
    ]
    result = _build_award_options_with_per_date_cash(
        awards, cash_by_date, include_endpoint_airports=False
    )
    assert len(result) == 2
    assert all(row["cpp"] is None for row in result)
    assert all(row["cash_price"] is None for row in result)


# ---------------------------------------------------------------------------
# Both-flex (user-added Phase 3 case)
# distinct outbound dates AND distinct return dates with different prices
# ---------------------------------------------------------------------------


def test_both_flex_winning_leg_uses_own_date_cash():
    """The search orchestrator calls the helper twice — once per leg — with a
    distinct cash_by_date for each direction. The winning outbound CPP must
    be computed against its OWN outbound-date cash, NOT the return-date cash
    and NOT some single departure-date anchor. Symmetric for return."""

    # Outbound options span 2 dates with distinct one-way cash.
    cash_out_by_date = {"2026-06-01": 300.0, "2026-06-02": 180.0}
    outbound_awards = [
        _award("2026-06-01", 50_000),  # cheap cash, high points
        _award("2026-06-02", 40_000),  # cheaper cash AND cheaper points
    ]

    # Return options span 2 distinct dates with their OWN distinct cash.
    # Critical: return cash prices are DIFFERENT from outbound's.
    cash_ret_by_date = {"2026-06-08": 220.0, "2026-06-09": 410.0}
    return_awards = [
        _award("2026-06-08", 45_000, program="aeroplan"),
        _award("2026-06-09", 30_000, program="aeroplan"),
    ]

    out_options = _build_award_options_with_per_date_cash(
        outbound_awards, cash_out_by_date, include_endpoint_airports=True
    )
    ret_options = _build_award_options_with_per_date_cash(
        return_awards, cash_ret_by_date, include_endpoint_airports=False
    )

    # Sanity: each leg's cash field strictly comes from its own cash_by_date.
    out_by_date = {r["date"]: r for r in out_options}
    ret_by_date = {r["date"]: r for r in ret_options}
    assert out_by_date["2026-06-01"]["cash_price"] == 300.0
    assert out_by_date["2026-06-02"]["cash_price"] == 180.0
    assert ret_by_date["2026-06-08"]["cash_price"] == 220.0
    assert ret_by_date["2026-06-09"]["cash_price"] == 410.0

    # Critical assertion: outbound CPP is NEVER computed against return cash.
    # If the bug regressed (e.g. an anchor scalar leaked through), the
    # cash_price on every outbound row would equal one of the return values.
    out_return_cash_values = {220.0, 410.0}
    for row in out_options:
        assert row["cash_price"] not in out_return_cash_values
    # Symmetric: return CPP never sees outbound cash.
    ret_outbound_cash_values = {300.0, 180.0}
    for row in ret_options:
        assert row["cash_price"] not in ret_outbound_cash_values

    # Verify the winner of each leg uses its OWN date's cash for CPP.
    out_winner = out_options[0]
    out_winner_cash = cash_out_by_date[out_winner["date"]]
    out_winner_taxes = (next(
        a["taxes"] for a in outbound_awards if a["date"] == out_winner["date"]
    ) or 0) / 100
    expected_out_cpp = calculate_cpp(
        out_winner_cash, out_winner_taxes, out_winner["points"]
    )
    assert out_winner["cpp"] == expected_out_cpp

    ret_winner = ret_options[0]
    ret_winner_cash = cash_ret_by_date[ret_winner["date"]]
    ret_winner_taxes = (next(
        a["taxes"] for a in return_awards if a["date"] == ret_winner["date"]
    ) or 0) / 100
    expected_ret_cpp = calculate_cpp(
        ret_winner_cash, ret_winner_taxes, ret_winner["points"]
    )
    assert ret_winner["cpp"] == expected_ret_cpp


def test_both_flex_no_cross_leg_anchor_leakage():
    """Pin the regression directly: even if outbound and return share a date
    string by coincidence, each leg's cash MUST come from its own direction's
    cash_by_date map (since outbound JFK→SFO and return SFO→JFK have
    different one-way cash on the same date)."""

    cash_out_by_date = {"2026-06-01": 250.0}  # SFO→JFK on Jun 1
    cash_ret_by_date = {"2026-06-01": 410.0}  # JFK→SFO on Jun 1 (priced higher)

    outbound = [_award("2026-06-01", 40_000)]
    returns = [_award("2026-06-01", 40_000, program="aeroplan")]

    out_options = _build_award_options_with_per_date_cash(
        outbound, cash_out_by_date, include_endpoint_airports=True
    )
    ret_options = _build_award_options_with_per_date_cash(
        returns, cash_ret_by_date, include_endpoint_airports=False
    )

    assert out_options[0]["cash_price"] == 250.0
    assert ret_options[0]["cash_price"] == 410.0
    assert out_options[0]["cpp"] != ret_options[0]["cpp"]


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_award_with_zero_points_is_dropped():
    """Pre-fix invariant preserved: awards with 0 / None points are dropped."""
    cash_by_date = {"2026-06-01": 200.0}
    awards = [
        _award("2026-06-01", 0),
        _award("2026-06-01", None),  # type: ignore[arg-type]
        _award("2026-06-01", 30_000),
    ]
    result = _build_award_options_with_per_date_cash(
        awards, cash_by_date, include_endpoint_airports=True
    )
    assert len(result) == 1
    assert result[0]["points"] == 30_000


def test_empty_awards_returns_empty_list():
    result = _build_award_options_with_per_date_cash(
        [], {"2026-06-01": 200.0}, include_endpoint_airports=True
    )
    assert result == []


def test_award_date_missing_from_cash_map_gets_null_cpp():
    """Defensive: if the orchestrator's cash_by_date is missing an award's
    date (shouldn't happen — search builds the map from these very awards —
    but stay safe), that award still emits with cash=None / cpp=None."""
    cash_by_date = {"2026-06-01": 200.0}
    awards = [_award("2026-06-03", 40_000)]  # date NOT in cash map
    result = _build_award_options_with_per_date_cash(
        awards, cash_by_date, include_endpoint_airports=False
    )
    assert len(result) == 1
    assert result[0]["cash_price"] is None
    assert result[0]["cpp"] is None
