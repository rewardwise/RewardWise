"""Regression tests for 86b9rprq5 - metro airport grouping rejected in production.

Root cause was a redundant pre-validator in search.py that called
is_valid_airport_code on raw comma-separated input. Pydantic SearchParams
correctly handles metro groups via regex. After deleting the pre-validator,
these tests lock the corrected behavior in.
"""

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.api.validators import SearchParams


FUTURE_DATE = (date.today() + timedelta(days=180)).strftime("%Y-%m-%d")


def test_single_airport_passes():
    """Single 3-letter code should pass validation."""
    p = SearchParams(
        origin="JFK",
        destination="NRT",
        date=FUTURE_DATE,
        cabin="economy",
        travelers=1,
    )
    assert p.origin == "JFK"
    assert p.destination == "NRT"


def test_metro_group_origin_passes():
    """Comma-separated origin (metro group) passes - the regression test for 86b9rprq5."""
    p = SearchParams(
        origin="JFK,LGA,EWR",
        destination="NRT",
        date=FUTURE_DATE,
        cabin="economy",
        travelers=1,
    )
    assert p.origin == "JFK,LGA,EWR"


def test_metro_group_both_sides_passes():
    """Comma-separated origin and destination should both pass."""
    p = SearchParams(
        origin="JFK,LGA,EWR",
        destination="NRT,HND",
        date=FUTURE_DATE,
        cabin="economy",
        travelers=1,
    )
    assert p.origin == "JFK,LGA,EWR"
    assert p.destination == "NRT,HND"


def test_invalid_code_rejected():
    """ABCD (4 letters) should still be rejected by Pydantic."""
    with pytest.raises(ValidationError):
        SearchParams(
            origin="ABCD",
            destination="NRT",
            date=FUTURE_DATE,
            cabin="economy",
            travelers=1,
        )


def test_non_alpha_code_rejected():
    """JFK1 (not all letters) should be rejected by Pydantic."""
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK1",
            destination="NRT",
            date=FUTURE_DATE,
            cabin="economy",
            travelers=1,
        )


def test_overlapping_metro_rejected():
    """JFK,LGA as origin and LGA,EWR as destination fails (LGA overlap)."""
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK,LGA",
            destination="LGA,EWR",
            date=FUTURE_DATE,
            cabin="economy",
            travelers=1,
        )


def test_identical_origin_destination_rejected():
    """JFK as both origin and destination should still be rejected.

    Regression for the deleted string-equality check in search.py: the Pydantic
    disjoint check catches this case too via set intersection.
    """
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK",
            destination="JFK",
            date=FUTURE_DATE,
            cabin="economy",
            travelers=1,
        )


def test_six_airports_rejected():
    """Validator regex is [A-Z]{3}(,[A-Z]{3}){0,4} -> max 5 airports.

    Six comma-separated codes should fail.
    """
    with pytest.raises(ValidationError):
        SearchParams(
            origin="JFK,LGA,EWR,HPN,SWF,BDL",
            destination="NRT",
            date=FUTURE_DATE,
            cabin="economy",
            travelers=1,
        )
