import re

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


def test_flightapi_parser_never_renders_numeric_place_id_as_iata_on_return_leg():
    """Regression: prod return leg rendered "16292 → 16216" instead of an IATA pair.

    Skyscanner's place lookup is sometimes incomplete — the segment references
    the place by numeric id (e.g. 16292 for SIN, 16216 for SFO) but the
    placeMap entry for that id is missing displayCode/iata/iataCode/code and
    only carries the numeric "id". The pre-fix _get_place_code fell through to
    that "id" and emitted the numeric place ID as the IATA, which the FE then
    rendered verbatim on the leg-route span.

    Contract: every leg's departure_iata / arrival_iata is either a real
    3-letter IATA (^[A-Z]{3}$) or None — never a numeric place ID.
    """
    raw = {
        "itineraries": [
            {
                "id": "rt",
                "leg_ids": ["leg-out", "leg-ret"],
                "pricing_options": [
                    {"agent_ids": ["a1"], "price": {"amount": 1234.0}},
                ],
            }
        ],
        "legs": [
            {"id": "leg-out", "segment_ids": ["seg-out"], "duration": 980, "stop_count": 0},
            {"id": "leg-ret", "segment_ids": ["seg-ret"], "duration": 990, "stop_count": 0},
        ],
        "segments": [
            {
                "id": "seg-out",
                "origin_place_id": 16216,
                "destination_place_id": 16292,
                "departure": "2026-11-25T07:00:00",
                "arrival": "2026-11-26T15:00:00",
                "marketing_flight_number": "1",
                "marketing_carrier_id": "UA",
            },
            {
                "id": "seg-ret",
                "origin_place_id": 16292,
                "destination_place_id": 16216,
                "departure": "2026-12-02T22:00:00",
                "arrival": "2026-12-03T22:00:00",
                "marketing_flight_number": "2",
                "marketing_carrier_id": "UA",
            },
        ],
        # The bug-shape: places exist but lack any of iata/iataCode/
        # displayCode/code — only the numeric "id". The pre-fix chain
        # fell through to "id" and leaked 16216 / 16292 to the FE.
        "places": [
            {"id": 16216, "name": "San Francisco International"},
            {"id": 16292, "name": "Singapore Changi"},
        ],
        "carriers": [{"id": "UA", "name": "United"}],
        "agents": [{"id": "a1", "name": "Agent 1"}],
    }

    result = normalize_flightapi_response(raw, is_roundtrip=True, currency="USD")
    flight = result["flights"][0]

    iata_pattern = r"^[A-Z]{3}$"
    for leg_label, iata in (
        ("outbound departure", flight["departure_iata"]),
        ("outbound arrival", flight["arrival_iata"]),
        ("return departure", flight["return_flight"]["departure_iata"]),
        ("return arrival", flight["return_flight"]["arrival_iata"]),
    ):
        # Either a real IATA or None — never a numeric place ID.
        assert iata is None or re.match(iata_pattern, iata), (
            f"{leg_label} iata = {iata!r}; expected None or /^[A-Z]{{3}}$/. "
            "Numeric Skyscanner place IDs (e.g. 16216) must not leak through "
            "as IATAs — that is the bug CONTRACT 8 caught on prod."
        )


def test_flightapi_parser_resolves_iata_from_displaycode_when_id_is_numeric():
    """Happy path: when the place dict carries displayCode, the numeric id
    is ignored and the IATA flows through correctly."""
    raw = {
        "itineraries": [
            {
                "id": "rt",
                "leg_ids": ["leg-out", "leg-ret"],
                "pricing_options": [{"agent_ids": ["a1"], "price": {"amount": 800.0}}],
            }
        ],
        "legs": [
            {"id": "leg-out", "segment_ids": ["seg-out"], "duration": 600, "stop_count": 0},
            {"id": "leg-ret", "segment_ids": ["seg-ret"], "duration": 600, "stop_count": 0},
        ],
        "segments": [
            {
                "id": "seg-out",
                "origin_place_id": 16216,
                "destination_place_id": 16292,
                "departure": "2026-11-25T07:00:00",
                "arrival": "2026-11-26T15:00:00",
                "marketing_carrier_id": "UA",
                "marketing_flight_number": "1",
            },
            {
                "id": "seg-ret",
                "origin_place_id": 16292,
                "destination_place_id": 16216,
                "departure": "2026-12-02T22:00:00",
                "arrival": "2026-12-03T22:00:00",
                "marketing_carrier_id": "UA",
                "marketing_flight_number": "2",
            },
        ],
        "places": [
            {"id": 16216, "displayCode": "SFO", "name": "San Francisco"},
            {"id": 16292, "displayCode": "SIN", "name": "Singapore Changi"},
        ],
        "carriers": [{"id": "UA", "name": "United"}],
        "agents": [{"id": "a1", "name": "Agent 1"}],
    }

    result = normalize_flightapi_response(raw, is_roundtrip=True, currency="USD")
    flight = result["flights"][0]

    assert flight["departure_iata"] == "SFO"
    assert flight["arrival_iata"] == "SIN"
    assert flight["return_flight"]["departure_iata"] == "SIN"
    assert flight["return_flight"]["arrival_iata"] == "SFO"


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
