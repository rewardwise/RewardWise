"""Unit tests for sample_cash_prices_by_date."""

import asyncio
from typing import Optional

import pytest

from app.services import cash_sampler


@pytest.fixture
def patch_cash(monkeypatch):
    """Patch pricing_service.get_cash_price as imported into cash_sampler."""

    calls: list[dict] = []

    def install(side_effect):
        async def fake_get_cash_price(
            origin, destination, date, cabin, travelers, return_date=None, max_stops="any"
        ):
            calls.append(
                {
                    "origin": origin,
                    "destination": destination,
                    "date": date,
                    "cabin": cabin,
                    "travelers": travelers,
                    "return_date": return_date,
                    "max_stops": max_stops,
                }
            )
            return await side_effect(date)

        monkeypatch.setattr(cash_sampler, "get_cash_price", fake_get_cash_price)
        return calls

    return install


def test_empty_dates_returns_empty_dict():
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO", "JFK", [], cabin="economy", travelers=1
        )
    )
    assert result == {}


def test_filters_out_falsy_dates(patch_cash):
    async def side_effect(date):
        return {"cash_price": 100.0}

    calls = patch_cash(side_effect)
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO", "JFK", [None, "", "2026-06-01"], cabin="economy", travelers=1
        )
    )
    assert result == {"2026-06-01": 100.0}
    assert [c["date"] for c in calls] == ["2026-06-01"]


def test_single_date(patch_cash):
    async def side_effect(date):
        return {"cash_price": 320.0}

    calls = patch_cash(side_effect)
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO", "JFK", ["2026-06-01"], cabin="economy", travelers=2, max_stops="nonstop"
        )
    )
    assert result == {"2026-06-01": 320.0}
    assert len(calls) == 1
    assert calls[0]["return_date"] is None
    assert calls[0]["travelers"] == 2
    assert calls[0]["max_stops"] == "nonstop"


def test_multi_date_returns_per_date_prices(patch_cash):
    prices = {"2026-06-01": 320.0, "2026-06-02": 180.0, "2026-06-03": 410.0}

    async def side_effect(date):
        return {"cash_price": prices[date]}

    patch_cash(side_effect)
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO", "JFK", list(prices.keys()), cabin="economy", travelers=1
        )
    )
    assert result == prices


def test_dedups_duplicate_dates(patch_cash):
    async def side_effect(date):
        return {"cash_price": 250.0}

    calls = patch_cash(side_effect)
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO",
            "JFK",
            ["2026-06-01", "2026-06-01", "2026-06-02", "2026-06-02"],
            cabin="economy",
            travelers=1,
        )
    )
    assert result == {"2026-06-01": 250.0, "2026-06-02": 250.0}
    assert sorted(c["date"] for c in calls) == ["2026-06-01", "2026-06-02"]


def test_per_date_error_isolation(patch_cash):
    async def side_effect(date):
        if date == "2026-06-02":
            raise RuntimeError("provider blew up")
        return {"cash_price": 300.0}

    patch_cash(side_effect)
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO",
            "JFK",
            ["2026-06-01", "2026-06-02", "2026-06-03"],
            cabin="economy",
            travelers=1,
        )
    )
    assert result == {
        "2026-06-01": 300.0,
        "2026-06-02": None,
        "2026-06-03": 300.0,
    }


def test_per_date_none_cash_price(patch_cash):
    async def side_effect(date):
        if date == "2026-06-02":
            return {"cash_price": None, "error": "no priced itineraries"}
        return {"cash_price": 280.0}

    patch_cash(side_effect)
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO",
            "JFK",
            ["2026-06-01", "2026-06-02"],
            cabin="economy",
            travelers=1,
        )
    )
    assert result == {"2026-06-01": 280.0, "2026-06-02": None}


def test_concurrency_bound_caps_in_flight(monkeypatch):
    """With concurrency=4 and 10 dates, at most 4 calls are in flight at once."""

    in_flight = 0
    peak = 0
    lock = asyncio.Lock()

    async def fake_get_cash_price(
        origin, destination, date, cabin, travelers, return_date=None, max_stops="any"
    ):
        nonlocal in_flight, peak
        async with lock:
            in_flight += 1
            peak = max(peak, in_flight)
        await asyncio.sleep(0.01)
        async with lock:
            in_flight -= 1
        return {"cash_price": 100.0}

    monkeypatch.setattr(cash_sampler, "get_cash_price", fake_get_cash_price)

    dates = [f"2026-06-{i:02d}" for i in range(1, 11)]
    result = asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO", "JFK", dates, cabin="economy", travelers=1, concurrency=4
        )
    )

    assert len(result) == 10
    assert peak <= 4
    assert peak >= 2  # sanity: concurrency actually kicked in


def test_always_one_way(patch_cash):
    """Sampler must never pass return_date; each date is sampled as one-way."""

    async def side_effect(date):
        return {"cash_price": 150.0}

    calls = patch_cash(side_effect)
    asyncio.run(
        cash_sampler.sample_cash_prices_by_date(
            "SFO",
            "JFK",
            ["2026-06-01", "2026-06-02"],
            cabin="business",
            travelers=1,
        )
    )
    assert all(c["return_date"] is None for c in calls)
    assert all(c["cabin"] == "business" for c in calls)
