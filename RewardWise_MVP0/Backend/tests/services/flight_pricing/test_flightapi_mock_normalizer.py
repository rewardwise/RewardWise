import json
from pathlib import Path

from app.services.flight_pricing.normalizer import normalize_flightapi_response

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "app" / "services" / "flight_pricing" / "mock_data"


def test_flightapi_oneway_fixture_normalizes_to_existing_cash_price_contract():
    raw = json.loads((FIXTURE_DIR / "flightapi_oneway_sample.json").read_text())

    result = normalize_flightapi_response(raw, is_roundtrip=False, currency="USD")

    assert result["source"] == "flightapi"
    assert result["currency"] == "USD"
    assert result["cash_price"] == 219.9
    assert result["is_roundtrip"] is False
    assert len(result["flights"]) == 2

    cheapest = result["flights"][0]
    assert cheapest["price"] == 219.9
    assert cheapest["departure_iata"] == "EWR"
    assert cheapest["arrival_iata"] == "LAX"
    assert cheapest["stops"] == 1
    assert cheapest["vendor"] == "Delta"
    assert cheapest["booking_url"]


def test_flightapi_roundtrip_fixture_normalizes_return_leg():
    raw = json.loads((FIXTURE_DIR / "flightapi_roundtrip_sample.json").read_text())

    result = normalize_flightapi_response(raw, is_roundtrip=True, currency="USD")

    assert result["cash_price"] == 123.4
    assert result["is_roundtrip"] is True

    flight = result["flights"][0]
    assert flight["departure_iata"] == "EWR"
    assert flight["arrival_iata"] == "LAX"
    assert flight["return_flight"] is not None
    assert flight["return_flight"]["departure_iata"] == "LAX"
    assert flight["return_flight"]["arrival_iata"] == "EWR"
    assert flight["vendor"] == "United"
