"""Validators for both-flexible round-trip search (P1-D-2)."""

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.api.validators import SearchParams


FUTURE = (date.today() + timedelta(days=180)).strftime("%Y-%m-%d")


def _add_days(iso: str, days: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=days)).strftime("%Y-%m-%d")


def test_validators_reject_return_end_without_return():
    """return_date_end without a return_date must be rejected."""
    with pytest.raises(ValidationError) as exc:
        SearchParams(
            origin="JFK",
            destination="LAX",
            date=FUTURE,
            return_date_end=_add_days(FUTURE, 12),
        )
    assert "return_date_end requires return_date" in str(exc.value)


def test_validators_reject_return_end_before_return():
    """return_date_end earlier than return_date must be rejected."""
    return_date = _add_days(FUTURE, 10)
    with pytest.raises(ValidationError) as exc:
        SearchParams(
            origin="JFK",
            destination="LAX",
            date=FUTURE,
            return_date=return_date,
            return_date_end=_add_days(return_date, -3),
        )
    assert "return_date_end must be on or after return_date" in str(exc.value)


def test_validators_accept_both_flex():
    """A valid both-flex roundtrip passes (outbound window + return window)."""
    return_date = _add_days(FUTURE, 10)
    p = SearchParams(
        origin="JFK",
        destination="LAX",
        date=FUTURE,
        date_end=_add_days(FUTURE, 3),
        return_date=return_date,
        return_date_end=_add_days(return_date, 3),
    )
    assert p.return_date_end == _add_days(return_date, 3)
    assert p.date_end == _add_days(FUTURE, 3)
