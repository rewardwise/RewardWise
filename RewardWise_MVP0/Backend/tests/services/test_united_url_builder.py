import pytest
from app.services.verdict_service import _united_url, _get_booking_link_for_verdict


SESSION_NOISE_PARAMS = ["EditSearchCartId", "pst", "idx", "ft", "cp", "cbm", "cbm2", "ct", "act"]


def test_cash_round_trip():
    url = _united_url(
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date="2026-06-08",
        travelers=1, is_award=False,
    )
    assert "f=JFK" in url
    assert "t=LAX" in url
    assert "d=2026-06-01" in url
    assert "r=2026-06-08" in url
    assert "sc=7%2C7" in url
    assert "px=1" in url
    assert "tqp=R" in url
    assert "newHP=True" in url
    assert "at=" not in url
    assert "rm=" not in url
    assert "tt=" not in url


def test_cash_one_way():
    url = _united_url(
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=1, is_award=False,
    )
    assert "f=JFK" in url
    assert "t=LAX" in url
    assert "d=2026-06-01" in url
    assert "r=" not in url
    assert "sc=7" in url
    assert "sc=7%2C" not in url
    assert "tt=1" in url
    assert "tqp=R" in url
    assert "newHP=" not in url
    assert "at=" not in url
    assert "rm=" not in url


def test_award_round_trip():
    url = _united_url(
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date="2026-06-08",
        travelers=1, is_award=True,
    )
    assert "at=1" in url
    assert "rm=1" in url
    assert "tqp=A" in url
    assert "sc=7%2C7" in url
    assert "newHP=True" in url
    assert "tt=" not in url


def test_award_one_way():
    url = _united_url(
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=1, is_award=True,
    )
    assert "at=1" in url
    assert "rm=1" in url
    assert "tqp=A" in url
    assert "sc=7" in url
    assert "sc=7%2C" not in url
    assert "tt=1" in url
    assert "newHP=" not in url


def test_no_session_noise():
    for is_award in [False, True]:
        for return_date in [None, "2026-06-08"]:
            url = _united_url(
                origin="JFK", destination="LAX",
                depart_date="2026-06-01", return_date=return_date,
                travelers=1, is_award=is_award,
            )
            for noise in SESSION_NOISE_PARAMS:
                assert f"{noise}=" not in url, f"Session noise {noise} leaked into URL"


def test_origin_destination_uppercased():
    url = _united_url(
        origin="jfk", destination="lax",
        depart_date="2026-06-01", return_date=None,
        travelers=1, is_award=False,
    )
    assert "f=JFK" in url
    assert "t=LAX" in url
    assert "jfk" not in url
    assert "lax" not in url


def test_travelers_passthrough():
    url = _united_url(
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=3, is_award=False,
    )
    assert "px=3" in url


def test_wrapper_united_cash_templates_url():
    result = _get_booking_link_for_verdict(
        program="united", trip_ids=[],
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date="2026-06-08",
        travelers=1, recommendation="pay_cash",
    )
    assert result["preferred"] == "airline"
    assert "united.com/en/us/fsr/choose-flights" in result["airline_link"]
    assert "tqp=R" in result["airline_link"]
    assert "at=" not in result["airline_link"]


def test_wrapper_united_points_templates_award_url():
    result = _get_booking_link_for_verdict(
        program="United", trip_ids=[],
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=1, recommendation="use_points",
    )
    assert result["preferred"] == "airline"
    assert "at=1" in result["airline_link"]
    assert "rm=1" in result["airline_link"]
    assert "tqp=A" in result["airline_link"]


def test_wrapper_other_program_falls_through():
    result = _get_booking_link_for_verdict(
        program="delta", trip_ids=[],
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=1, recommendation="pay_cash",
    )
    assert "fsr/choose-flights" not in result["airline_link"]


def test_wrapper_missing_trip_fields_falls_through():
    result = _get_booking_link_for_verdict(
        program="united", trip_ids=[],
        origin=None, destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=1, recommendation="pay_cash",
    )
    assert "fsr/choose-flights" not in result["airline_link"]


def test_wrapper_wait_recommendation_falls_through():
    result = _get_booking_link_for_verdict(
        program="united", trip_ids=[],
        origin="JFK", destination="LAX",
        depart_date="2026-06-01", return_date=None,
        travelers=1, recommendation="wait",
    )
    assert "fsr/choose-flights" not in result["airline_link"]
