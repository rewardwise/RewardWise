import json
from pathlib import Path

from app.services.flight_pricing.serpapi_provider import normalize_serpapi_response

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "app" / "services" / "flight_pricing" / "mock_data"


def test_serpapi_oneway_fixture_normalizes_to_existing_cash_price_contract():
    raw = json.loads((FIXTURE_DIR / "serpapi_oneway_sample.json").read_text())

    result = normalize_serpapi_response(raw, is_roundtrip=False, currency="USD")

    assert result["source"] == "google_flights"
    assert result["currency"] == "USD"
    assert result["cash_price"] == 99
    assert result["is_roundtrip"] is False
    assert result["price_level"] == "low"
    assert result["typical_price_range"] == [140, 260]
    assert len(result["flights"]) == 2

    cheapest = result["flights"][0]
    assert cheapest["price"] == 99
    assert cheapest["departure_iata"] == "EWR"
    assert cheapest["arrival_iata"] == "LAX"
    assert cheapest["stops"] == 1
    assert cheapest["legs"][0]["airline"] == "Delta"
    assert cheapest["carbon_emissions"] == 428000


def test_serpapi_roundtrip_fixture_normalizes_return_flight():
    raw = json.loads((FIXTURE_DIR / "serpapi_roundtrip_sample.json").read_text())

    result = normalize_serpapi_response(raw, is_roundtrip=True, currency="USD")

    assert result["cash_price"] == 198
    assert result["is_roundtrip"] is True
    assert result["price_level"] == "low"

    flight = result["flights"][0]
    assert flight["departure_iata"] == "EWR"
    assert flight["arrival_iata"] == "LAX"
    assert flight["return_flight"] is not None
    assert flight["return_flight"]["departure_iata"] == "LAX"
    assert flight["return_flight"]["arrival_iata"] == "EWR"
    assert flight["return_flight"]["stops"] == 0
