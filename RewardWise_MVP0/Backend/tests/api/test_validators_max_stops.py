"""MaxStops enum coverage on SearchParams (86ba2ze4g)."""

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.api.validators import MaxStops, SearchParams


FUTURE = (date.today() + timedelta(days=180)).strftime("%Y-%m-%d")


def test_max_stops_enum_has_four_canonical_values():
    assert {m.value for m in MaxStops} == {
        "any",
        "nonstop",
        "one_or_fewer",
        "two_or_fewer",
    }


def test_max_stops_enum_lookup_by_value():
    assert MaxStops("any") is MaxStops.any
    assert MaxStops("nonstop") is MaxStops.nonstop
    assert MaxStops("one_or_fewer") is MaxStops.one_or_fewer
    assert MaxStops("two_or_fewer") is MaxStops.two_or_fewer


def test_search_params_defaults_max_stops_to_any():
    params = SearchParams(
        origin="JFK",
        destination="LAX",
        date=FUTURE,
    )
    assert params.max_stops is MaxStops.any


@pytest.mark.parametrize("value", ["any", "nonstop", "one_or_fewer", "two_or_fewer"])
def test_search_params_accepts_each_max_stops_value(value):
    params = SearchParams(
        origin="JFK",
        destination="LAX",
        date=FUTURE,
        max_stops=value,
    )
    assert params.max_stops.value == value


def test_search_params_rejects_unknown_max_stops():
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK",
            destination="LAX",
            date=FUTURE,
            max_stops="direct_only",
        )


def test_search_params_rejects_numeric_max_stops():
    # Validator is load-bearing: SerpAPI's out-of-range integer behavior is
    # undocumented, so we never let raw integers reach the provider layer.
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK",
            destination="LAX",
            date=FUTURE,
            max_stops="0",
        )
