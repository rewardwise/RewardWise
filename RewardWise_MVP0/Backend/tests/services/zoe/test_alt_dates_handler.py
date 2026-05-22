"""Handler tests for the alt_dates intent (ClickUp 86ba26mhb)."""

import asyncio
from unittest.mock import patch

import pytest

from app.services.zoe.handlers import alt_dates as alt_dates_handler


VERDICT_TEXT = (
    "The search returned a verdict for JFK → LHR on 2026-07-04, 1 traveler, "
    "business class. Verdict: USE POINTS. Cash fare: $4,200. "
    "Best award: 70,000 points via United. Value: 5.20 cents per point. "
    "Confidence: HIGH."
)


# ── Parsing tests ─────────────────────────────────────────────────────────────

def test_parse_verdict_context_extracts_all_fields():
    parsed = alt_dates_handler._parse_verdict_context(VERDICT_TEXT)
    assert parsed is not None
    assert parsed["origin"] == "JFK"
    assert parsed["destination"] == "LHR"
    assert parsed["date"] == "2026-07-04"
    assert parsed["cabin"] == "business"
    assert parsed["base_points"] == 70_000


def test_parse_verdict_context_returns_none_when_unparseable():
    assert alt_dates_handler._parse_verdict_context("") is None
    assert alt_dates_handler._parse_verdict_context("totally unrelated text") is None
    # Missing date
    assert alt_dates_handler._parse_verdict_context(
        "for JFK → LHR, business class"
    ) is None


def test_parse_verdict_context_first_class_cabin():
    parsed = alt_dates_handler._parse_verdict_context(
        "for SFO → NRT on 2026-09-15, first class. Best award: 120,000 points via ANA."
    )
    assert parsed["cabin"] == "first"
    assert parsed["base_points"] == 120_000


def test_parse_verdict_context_economy_no_base_points():
    parsed = alt_dates_handler._parse_verdict_context(
        "for JFK → LAX on 2026-12-01, economy class."
    )
    assert parsed["cabin"] == "economy"
    assert parsed["base_points"] is None


# ── Cheapest-by-date reduction ────────────────────────────────────────────────

def test_cheapest_by_date_keeps_lowest_per_day():
    out = alt_dates_handler._cheapest_by_date([
        {"date": "2026-07-01", "points": 55_000, "program": "united"},
        {"date": "2026-07-01", "points": 48_000, "program": "air_canada"},
        {"date": "2026-07-02", "points": 60_000, "program": "united"},
    ])
    assert out["2026-07-01"]["points"] == 48_000
    assert out["2026-07-01"]["program"] == "air_canada"
    assert out["2026-07-02"]["points"] == 60_000


def test_cheapest_by_date_drops_entries_missing_points_or_date():
    out = alt_dates_handler._cheapest_by_date([
        {"date": "2026-07-01", "points": None, "program": "united"},
        {"date": None,         "points": 1, "program": "x"},
        {"date": "2026-07-02", "points": 99, "program": "y"},
    ])
    assert out == {"2026-07-02": {"date": "2026-07-02", "points": 99, "program": "y"}}


# ── Date formatting ───────────────────────────────────────────────────────────

def test_format_date_human():
    assert alt_dates_handler._format_date_human("2026-07-04") == "Jul 4"
    assert alt_dates_handler._format_date_human("2026-12-31") == "Dec 31"
    # garbage in → garbage out (string passes through)
    assert alt_dates_handler._format_date_human("not-a-date") == "not-a-date"


# ── End-to-end handler ────────────────────────────────────────────────────────

def _stub_search(results):
    """Return an async function that ignores args and yields canned `results`."""
    async def _stub(*_args, **_kwargs):
        return results
    return _stub


def _call(handler_kwargs):
    return asyncio.run(alt_dates_handler.handle(
        "any cheaper dates?", [], [], **handler_kwargs,
    ))


def test_handler_returns_concrete_alternatives():
    results = [
        # base date itself — should be excluded
        {"date": "2026-07-04", "points": 70_000, "program": "united"},
        # cheaper alts
        {"date": "2026-07-01", "points": 48_000, "program": "air_canada"},
        {"date": "2026-07-08", "points": 55_000, "program": "united"},
        {"date": "2026-07-02", "points": 65_000, "program": "united"},
        # not cheaper than 70k base — filtered out
        {"date": "2026-07-05", "points": 80_000, "program": "united"},
    ]
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search(results)
    ):
        out = _call({"verdict_context": VERDICT_TEXT})

    msg = out["message"]
    # The lead alternative should be the cheapest (Jul 1, 48k)
    assert "Jul 1" in msg
    assert "48,000" in msg
    assert "air canada" in msg
    # Followups in ascending price order
    assert "Jul 8" in msg
    assert "55,000" in msg
    assert "Jul 2" in msg
    assert "65,000" in msg
    # Base-date comparison line
    assert "70,000" in msg
    assert "Jul 4" in msg
    # Excluded non-cheaper date
    assert "80,000" not in msg
    # Staleness disclaimer
    assert "verify" in msg.lower()
    assert out["prefill"] is None


def test_handler_excludes_base_date_from_alternatives():
    """Even if the same date appears in range-search output, the user's own
    date is not an 'alternative'."""
    results = [
        {"date": "2026-07-04", "points": 50_000, "program": "united"},  # base
        {"date": "2026-07-05", "points": 60_000, "program": "united"},  # cheaper than 70k
    ]
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search(results)
    ):
        out = _call({"verdict_context": VERDICT_TEXT})

    msg = out["message"]
    assert "Jul 5" in msg
    assert "60,000" in msg
    # The base-date comparison line will mention Jul 4 + 70,000 — that's
    # expected. But there should be no claim that Jul 4 is itself an alt.
    assert "Jul 4 has award space at 50,000" not in msg


def test_handler_no_cheaper_alts_reports_honestly():
    results = [
        {"date": "2026-07-01", "points": 90_000, "program": "united"},
        {"date": "2026-07-08", "points": 85_000, "program": "united"},
    ]
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search(results)
    ):
        out = _call({"verdict_context": VERDICT_TEXT})

    msg = out["message"]
    assert "nothing cheaper" in msg.lower() or "no clearly cheaper" in msg.lower()
    assert "70,000" in msg  # references their current cost


def test_handler_handles_unparseable_verdict_gracefully():
    out = _call({"verdict_context": None})
    assert "can't see the trip details" in out["message"]
    assert out["prefill"] is None


def test_handler_handles_seats_aero_failure():
    async def _boom(*_a, **_kw):
        raise RuntimeError("network down")

    with patch.object(alt_dates_handler, "search_award_availability", _boom):
        out = _call({"verdict_context": VERDICT_TEXT})

    assert "couldn't reach" in out["message"].lower()
    assert out["prefill"] is None


def test_handler_uses_top_n_only():
    # 10 cheaper alts — we should only render TOP_N (3)
    results = [
        {"date": f"2026-07-{day:02d}", "points": 40_000 + i * 1000, "program": "united"}
        for i, day in enumerate([1, 2, 3, 5, 6, 7, 8, 9, 10, 11])
    ]
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search(results)
    ):
        out = _call({"verdict_context": VERDICT_TEXT})

    msg = out["message"]
    # Top 3 cheapest are 40k (Jul 1), 41k (Jul 2), 42k (Jul 3)
    assert "40,000" in msg
    assert "41,000" in msg
    assert "42,000" in msg
    # The 4th-cheapest (43k) should NOT be in the rendered list
    assert "43,000" not in msg


def test_handler_call_passes_window_range_to_seats_aero():
    captured = {}

    async def _capture(origin, destination, date, cabin, *, end_date=None, take=None):
        captured.update(dict(
            origin=origin, destination=destination, date=date, cabin=cabin,
            end_date=end_date, take=take,
        ))
        return []

    with patch.object(alt_dates_handler, "search_award_availability", _capture):
        _call({"verdict_context": VERDICT_TEXT})

    assert captured["origin"] == "JFK"
    assert captured["destination"] == "LHR"
    assert captured["cabin"] == "business"
    # ±7 days around 2026-07-04
    assert captured["date"] == "2026-06-27"
    assert captured["end_date"] == "2026-07-11"
    assert captured["take"] == 100


# ── Cash-only verdict regression (code-review H1) ─────────────────────────────

CASH_ONLY_VERDICT = (
    "The search returned a verdict for JFK → LHR on 2026-07-04, 1 traveler, "
    "business class. Verdict: PAY CASH. Cash fare: $1,200. "
    "Confidence: HIGH."
)


def test_handler_cash_only_verdict_does_not_claim_cheaper_than():
    """When the verdict has no award baseline, the lead line must NOT claim
    'cheaper than your date' — we have no number to compare against."""
    results = [
        {"date": "2026-07-01", "points": 48_000, "program": "united"},
        {"date": "2026-07-05", "points": 55_000, "program": "united"},
    ]
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search(results)
    ):
        out = _call({"verdict_context": CASH_ONLY_VERDICT})

    msg = out["message"]
    # We do still surface the available award space honestly.
    assert "48,000" in msg
    assert "Jul 1" in msg
    # But we must NOT make a comparison claim we can't substantiate.
    assert "cheaper than" not in msg.lower()
    assert "drops further" not in msg.lower()
    # And we must be honest that the verdict didn't include an award cost.
    assert "didn't include an award cost" in msg or "no award baseline" in msg.lower()
    # Disclaimer still present.
    assert "verify" in msg.lower()


def test_handler_cash_only_verdict_no_alts_stays_honest():
    """No alts + cash-only verdict — must not invent a 'best available' claim."""
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search([])
    ):
        out = _call({"verdict_context": CASH_ONLY_VERDICT})

    msg = out["message"]
    assert "cheaper than" not in msg.lower()
    assert "best available" not in msg.lower()  # would imply we knew a base cost
    # Disclaimer must be present on every branch.
    assert "verify" in msg.lower()


# ── seats.aero date-shape normalization (code-review M1) ──────────────────────

def test_normalize_date_handles_plain_and_iso_timestamp():
    assert alt_dates_handler._normalize_date("2026-07-04") == "2026-07-04"
    assert alt_dates_handler._normalize_date("2026-07-04T00:00:00+00:00") == "2026-07-04"
    assert alt_dates_handler._normalize_date("2026-07-04T12:34:56Z") == "2026-07-04"


def test_normalize_date_rejects_garbage():
    assert alt_dates_handler._normalize_date(None) is None
    assert alt_dates_handler._normalize_date("") is None
    assert alt_dates_handler._normalize_date("not a date") is None
    assert alt_dates_handler._normalize_date("20260704") is None
    assert alt_dates_handler._normalize_date(20260704) is None


def test_handler_strips_iso_timestamp_dates_from_seats_aero():
    """If seats.aero returns ISO timestamps, the base date must still be
    excluded and the rendered output must show YYYY-MM-DD, not the raw ISO."""
    results = [
        # base date with timestamp shape — must be excluded
        {"date": "2026-07-04T00:00:00+00:00", "points": 70_000, "program": "united"},
        {"date": "2026-07-01T00:00:00+00:00", "points": 48_000, "program": "united"},
    ]
    with patch.object(
        alt_dates_handler, "search_award_availability", _stub_search(results)
    ):
        out = _call({"verdict_context": VERDICT_TEXT})

    msg = out["message"]
    # Base date (Jul 4) must NOT be rendered as the lead alternative even
    # though seats.aero returned it with a T-suffix.
    assert "Jul 4 has award space" not in msg
    # ISO timestamp must not leak into the rendered text.
    assert "T00:00:00" not in msg
    assert "+00:00" not in msg
    # Real cheaper alt (Jul 1, 48k) should still surface.
    assert "Jul 1" in msg
    assert "48,000" in msg
