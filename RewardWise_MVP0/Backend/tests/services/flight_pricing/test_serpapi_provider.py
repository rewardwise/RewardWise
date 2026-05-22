"""CABIN_CLASS_MAP coverage for SerpAPI provider (86ba25eq0)."""

from app.services.flight_pricing.serpapi_provider import CABIN_CLASS_MAP


def test_serpapi_cabin_map_premium_economy_is_2():
    assert CABIN_CLASS_MAP["premium_economy"] == 2


def test_serpapi_cabin_map_covers_all_four_cabins():
    assert CABIN_CLASS_MAP == {
        "economy": 1,
        "premium_economy": 2,
        "business": 3,
        "first": 4,
    }
