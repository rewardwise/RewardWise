"""Deterministic date handling in the Xpectrum searchFlight Code node.

All cases are TODAY-RELATIVE (computed from datetime.now inside each test) so
they never rot as the calendar advances. The node's clock is the source of
truth for "today" — the LLM's sense of the date is never trusted.
"""

import sys
import types
from datetime import date as date_cls, datetime, timedelta

import pytest

# The node targets the Dify sandbox, which ships `requests`; the backend CI
# env does not (the app uses httpx). Every test here either exercises the
# pure date logic or monkeypatches the fetchers, so a stub satisfies the
# node's top-level import without ever being called.
try:
    import requests  # noqa: F401
except ModuleNotFoundError:
    sys.modules["requests"] = types.ModuleType("requests")

import xpectrum_searchflight_node as node


TODAY = datetime.now().date()


def iso(d: date_cls) -> str:
    return d.strftime("%Y-%m-%d")


# ── _resolve_date unit behavior ──────────────────────────────────────────────

def test_normal_future_date_passes_untouched():
    d = TODAY + timedelta(days=45)
    res = node._resolve_date(iso(d))
    assert res == {"ok": True, "date": iso(d), "adjusted": False, "original": iso(d)}


def test_today_is_valid_and_untouched():
    res = node._resolve_date(iso(TODAY))
    assert res["ok"] is True
    assert res["date"] == iso(TODAY)
    assert res["adjusted"] is False


def test_past_date_within_a_year_rolls_forward_to_next_occurrence():
    past = TODAY - timedelta(days=100)
    res = node._resolve_date(iso(past))
    assert res["ok"] is True
    assert res["adjusted"] is True
    rolled = datetime.strptime(res["date"], "%Y-%m-%d").date()
    assert rolled >= TODAY
    # Next occurrence keeps month/day (Feb-29 aside) and lands within a year.
    assert (rolled.month, rolled.day) == (past.month, past.day)
    assert (rolled - TODAY).days <= 366


def test_past_beyond_a_year_is_invalid_not_guessed():
    stale = TODAY - timedelta(days=400)
    res = node._resolve_date(iso(stale))
    assert res["ok"] is False
    assert res["reason"] == "past"
    assert res["message"]


def test_beyond_booking_horizon_rejects_and_names_the_cap_date():
    far = TODAY + timedelta(days=node.BOOKING_HORIZON_DAYS + 10)
    cap = TODAY + timedelta(days=node.BOOKING_HORIZON_DAYS)
    res = node._resolve_date(iso(far))
    assert res["ok"] is False
    assert res["reason"] == "too_far"
    assert iso(cap) in res["message"]


def test_unparseable_is_structured_invalid():
    res = node._resolve_date("banana pancakes")
    assert res["ok"] is False
    assert res["reason"] == "unparseable"


def test_empty_is_structured_invalid():
    for raw in ("", None, "   "):
        res = node._resolve_date(raw)
        assert res["ok"] is False
        assert res["reason"] == "unparseable"


def test_alternate_formats_normalize_to_iso():
    d = TODAY + timedelta(days=60)
    for raw in (
        d.strftime("%Y/%m/%d"),
        d.strftime("%m/%d/%Y"),
        d.strftime("%B %d, %Y"),
        d.strftime("%b %d %Y"),
        d.strftime("%d %B %Y"),
    ):
        res = node._resolve_date(raw)
        assert res["ok"] is True, raw
        assert res["date"] == iso(d), raw


def test_yearless_date_resolves_to_next_occurrence():
    # A month/day ~40 days back, given with no year, means its NEXT occurrence.
    past = TODAY - timedelta(days=40)
    res = node._resolve_date(past.strftime("%B %d"))
    assert res["ok"] is True
    assert res["adjusted"] is True
    rolled = datetime.strptime(res["date"], "%Y-%m-%d").date()
    assert rolled >= TODAY
    assert (rolled.month, rolled.day) == (past.month, past.day)


# ── main() wiring: the resolver gates the API calls ──────────────────────────

@pytest.fixture
def api_guard(monkeypatch):
    """Fail the test if either provider call fires; record calls when allowed."""
    calls = {"cash": [], "awards": []}

    def fake_cash(date, departure, destination):
        calls["cash"].append(date)
        return 500.0, "https://www.skyscanner.com/x"

    def fake_awards(date, departure, destination, travelers):
        calls["awards"].append(date)
        return []

    monkeypatch.setattr(node, "_fetch_cash", fake_cash)
    monkeypatch.setattr(node, "_fetch_awards", fake_awards)
    return calls


def test_invalid_date_never_reaches_the_api(api_guard):
    import json

    out = node.main("banana", "SFO", "JFK")
    assert api_guard["cash"] == [] and api_guard["awards"] == []
    assert out["recommendation"] == "invalid_date"
    struct = json.loads(out["result"])
    assert struct["ok"] is False
    assert struct["reason"] == "unparseable"
    assert out["verdict"]  # the agent has something concrete to say


def test_too_far_date_never_reaches_the_api(api_guard):
    import json

    far = TODAY + timedelta(days=node.BOOKING_HORIZON_DAYS + 30)
    out = node.main(iso(far), "SFO", "JFK")
    assert api_guard["cash"] == [] and api_guard["awards"] == []
    struct = json.loads(out["result"])
    assert struct["ok"] is False and struct["reason"] == "too_far"
    assert iso(TODAY + timedelta(days=node.BOOKING_HORIZON_DAYS)) in out["verdict"]


def test_recent_past_date_whose_next_occurrence_exceeds_horizon_refuses(api_guard):
    # A date ~30 days back rolls forward to ~335 days ahead — PAST the booking
    # horizon. Refusing with the cap date beats silently searching a window
    # where providers return nothing.
    import json

    past = TODAY - timedelta(days=30)
    out = node.main(iso(past), "SFO", "JFK")
    assert api_guard["cash"] == [] and api_guard["awards"] == []
    struct = json.loads(out["result"])
    assert struct["ok"] is False and struct["reason"] == "too_far"
    assert iso(TODAY + timedelta(days=node.BOOKING_HORIZON_DAYS)) in out["verdict"]


def test_past_date_rolls_forward_and_api_gets_the_rolled_date(api_guard):
    import json

    past = TODAY - timedelta(days=100)
    out = node.main(iso(past), "SFO", "JFK")
    assert len(api_guard["cash"]) == 1 and len(api_guard["awards"]) == 1
    called_with = api_guard["cash"][0]
    rolled = datetime.strptime(called_with, "%Y-%m-%d").date()
    assert rolled >= TODAY
    assert (rolled.month, rolled.day) == (past.month, past.day)
    struct = json.loads(out["result"])
    assert struct["date_resolution"]["adjusted"] is True
    assert struct["date_resolution"]["date"] == called_with
    # The spoken verdict discloses the adjustment — never a silent swap.
    assert called_with in out["verdict"]


def test_valid_date_passes_through_unchanged(api_guard):
    import json

    d = TODAY + timedelta(days=20)
    out = node.main(iso(d), "SFO", "JFK")
    assert api_guard["cash"] == [iso(d)]
    struct = json.loads(out["result"])
    assert struct["date_resolution"] == {
        "ok": True, "date": iso(d), "adjusted": False, "original": iso(d),
    }
    assert out["recommendation"] in ("pay_cash", "use_points", "wait")


def test_return_before_depart_rejects_without_api(api_guard):
    import json

    depart = TODAY + timedelta(days=30)
    ret = TODAY + timedelta(days=20)
    out = node.main(iso(depart), "SFO", "JFK", return_date=iso(ret))
    assert api_guard["cash"] == [] and api_guard["awards"] == []
    struct = json.loads(out["result"])
    assert struct["ok"] is False and struct["reason"] == "return_before_depart"


def test_return_after_depart_is_accepted(api_guard):
    depart = TODAY + timedelta(days=30)
    ret = TODAY + timedelta(days=40)
    out = node.main(iso(depart), "SFO", "JFK", return_date=iso(ret))
    assert api_guard["cash"] == [iso(depart)]
    assert out["recommendation"] in ("pay_cash", "use_points", "wait")
