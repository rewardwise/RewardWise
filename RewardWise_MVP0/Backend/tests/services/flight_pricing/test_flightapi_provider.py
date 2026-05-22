"""CABIN_CLASS_MAP coverage for FlightAPI provider (86ba25eq0)."""

from app.services.flight_pricing.flightapi_provider import CABIN_CLASS_MAP


def test_flightapi_cabin_map_premium_economy_is_premium_economy_string():
    assert CABIN_CLASS_MAP["premium_economy"] == "Premium Economy"


def test_flightapi_cabin_map_covers_all_four_cabins():
    assert CABIN_CLASS_MAP == {
        "economy": "Economy",
        "premium_economy": "Premium Economy",
        "business": "Business",
        "first": "First",
    }
