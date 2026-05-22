"""CabinClass enum coverage incl. premium_economy reintroduction (86ba25eq0)."""

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.api.validators import CabinClass, SearchParams


FUTURE = (date.today() + timedelta(days=180)).strftime("%Y-%m-%d")


def test_cabin_class_enum_accepts_premium_economy():
    assert CabinClass("premium_economy") is CabinClass.premium_economy
    assert CabinClass.premium_economy.value == "premium_economy"


def test_cabin_class_enum_accepts_all_four_canonical_values():
    assert {c.value for c in CabinClass} == {
        "economy",
        "premium_economy",
        "business",
        "first",
    }


def test_search_params_accepts_premium_economy():
    params = SearchParams(
        origin="JFK",
        destination="LAX",
        date=FUTURE,
        cabin="premium_economy",
    )
    assert params.cabin is CabinClass.premium_economy


def test_search_params_rejects_unknown_cabin():
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK",
            destination="LAX",
            date=FUTURE,
            cabin="luxury",
        )


def test_search_params_rejects_premium_without_economy_suffix():
    # Pre-PR-#22 used plain "premium"; that string must NOT validate now
    # so we don't silently accept ambiguous legacy values.
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK",
            destination="LAX",
            date=FUTURE,
            cabin="premium",
        )
