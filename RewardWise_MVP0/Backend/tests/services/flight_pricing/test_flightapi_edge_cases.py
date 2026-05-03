from app.services.flight_pricing.normalizer import normalize_flightapi_response


def test_flightapi_parser_handles_docs_style_oneway_payload_with_fare_metadata():
    raw = {
        "itineraries": [
            {
                "id": "12126-2405200600--32317-0-15130-2405200700",
                "leg_ids": ["12126-2405200600--32317-0-15130-2405200700"],
                "pricing_options": [
                    {
                        "id": "EgiHJ3q9CXVr",
                        "agent_ids": ["finn"],
                        "price": {
                            "amount": 52.1,
                            "update_status": "current",
                            "last_updated": "2024-01-09T09:11:11",
                            "quote_age": 224,
                        },
                        "items": [
                            {
                                "agent_id": "finn",
                                "url": "/transport_deeplink/4.0/US/en-GB/USD/finn/1/mock?ticket_price=52.10",
                                "segment_ids": ["12126-15130-2405200600-2405200700--32317"],
                                "price": {"amount": 52.1},
                                "booking_proposition": "PBOOK",
                                "transfer_protection": "",
                                "max_redirect_age": 10,
                                "fares": [
                                    {
                                        "segment_id": "12126-15130-2405200600-2405200700--32317",
                                        "fare_basis_code": "ZNY0T9BE",
                                        "booking_code": "Z",
                                        "fare_family": "ESLCAMP11",
                                    }
                                ],
                            }
                        ],
                        "transfer_type": "MANAGED",
                        "score": 10,
                    }
                ],
            }
        ],
        "legs": [
            {
                "id": "12126-2405200600--32317-0-15130-2405200700",
                "origin_place_id": 12126,
                "destination_place_id": 15130,
                "departure": "2024-05-20T06:00:00",
                "arrival": "2024-05-20T07:00:00",
                "segment_ids": ["12126-15130-2405200600-2405200700--32317"],
                "duration": 60,
                "stop_count": 0,
                "marketing_carrier_ids": [-32317],
                "operating_carrier_ids": [-32317],
                "stop_ids": [],
            }
        ],
        "segments": [
            {
                "id": "12126-15130-2405200600-2405200700--32317",
                "origin_place_id": 12126,
                "destination_place_id": 15130,
                "arrival": "2024-05-20T07:00:00",
                "departure": "2024-05-20T06:00:00",
                "duration": 60,
                "marketing_flight_number": "431",
                "marketing_carrier_id": -32317,
                "operating_carrier_id": -32317,
                "mode": "flight",
            }
        ],
        "places": [
            {"id": 12126, "name": "New York Newark", "displayCode": "EWR"},
            {"id": 15130, "name": "Boston Logan International", "displayCode": "BOS"},
        ],
        "carriers": [{"id": -32317, "name": "Spirit Airlines", "displayCode": "NK"}],
        "agents": [{"id": "finn", "name": "Finn"}],
    }

    result = normalize_flightapi_response(raw, is_roundtrip=False, currency="USD")
    flight = result["flights"][0]

    assert result["cash_price"] == 52.1
    assert flight["departure_iata"] == "EWR"
    assert flight["arrival_iata"] == "BOS"
    assert flight["vendor"] == "Finn"
    assert flight["price_last_updated"] == "2024-01-09T09:11:11"
    assert flight["quote_age"] == 224
    assert flight["booking_url"].startswith("https://www.skyscanner.com/transport_deeplink")
    assert flight["fare_basis_codes"] == ["ZNY0T9BE"]
    assert flight["booking_codes"] == ["Z"]
    assert flight["fare_families"] == ["ESLCAMP11"]
    assert flight["transfer_type"] == "MANAGED"
    assert flight["score"] == 10
    assert flight["booking_proposition"] == "PBOOK"
    assert flight["max_redirect_age"] == 10
    assert flight["legs"][0]["flight_number"] == "431"


def test_flightapi_parser_sorts_multiple_pricing_options_by_lowest_price():
    raw = {
        "itineraries": [
            {
                "id": "expensive",
                "leg_ids": ["leg-1"],
                "pricing_options": [{"agent_ids": ["a1"], "price": {"amount": 99.0}}],
            },
            {
                "id": "cheap",
                "leg_ids": ["leg-1"],
                "pricing_options": [{"agent_ids": ["a2"], "price": {"amount": 45.5}}],
            },
        ],
        "legs": [{"id": "leg-1", "segment_ids": ["seg-1"], "duration": 100, "stop_count": 0}],
        "segments": [
            {
                "id": "seg-1",
                "origin_place_id": "EWR",
                "destination_place_id": "LAX",
                "departure": "2026-06-15T07:00:00",
                "arrival": "2026-06-15T10:00:00",
                "marketing_flight_number": "1",
                "marketing_carrier_id": "UA",
            }
        ],
        "places": [
            {"id": "EWR", "displayCode": "EWR", "name": "Newark"},
            {"id": "LAX", "displayCode": "LAX", "name": "Los Angeles"},
        ],
        "carriers": [{"id": "UA", "name": "United"}],
        "agents": [{"id": "a1", "name": "Agent 1"}, {"id": "a2", "name": "Agent 2"}],
    }

    result = normalize_flightapi_response(raw, is_roundtrip=False, currency="USD")

    assert result["cash_price"] == 45.5
    assert result["flights"][0]["price"] == 45.5
    assert result["flights"][0]["vendor"] == "Agent 2"
    assert result["flights"][1]["price"] == 99.0


def test_flightapi_parser_handles_empty_unpriced_payload_gracefully():
    raw = {
        "itineraries": [{"id": "no-price", "leg_ids": ["leg-1"], "pricing_options": []}],
        "legs": [{"id": "leg-1", "segment_ids": []}],
        "segments": [],
        "places": [],
        "carriers": [],
        "agents": [],
    }

    result = normalize_flightapi_response(raw, is_roundtrip=False, currency="USD")

    assert result["cash_price"] is None
    assert result["flights"] == []
