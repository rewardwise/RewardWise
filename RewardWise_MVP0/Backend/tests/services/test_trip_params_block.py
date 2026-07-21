"""Simulated-vendor tests for the [[TRIP_PARAMS]] parser (server-prefill path).
NOTE: never run against a REAL Xpectrum reply yet — the vendor's first real
delivery gets a live verification (flagged), these cover the contract."""
from app.services.zoe_service import extract_trip_params_block


SIMULATED = (
    "✈️ Round-trip DEN ⇄ AUS, Sep 10–14 — pay cash both ways. 💰\n"
    '[[TRIP_PARAMS]] {"origin": "DEN", "destination": "AUS", "date": "2026-09-10",'
    ' "return_date": "2026-09-14", "travelers": 2, "tripType": "roundtrip",'
    ' "internal_debug": "DROP-ME"}\n'
    "👉 Book: outbound · return"
)


def test_whitelisted_fields_parse_and_extras_drop():
    _, prefill = extract_trip_params_block(SIMULATED)
    assert prefill == {
        "origin": "DEN", "destination": "AUS", "date": "2026-09-10",
        "return_date": "2026-09-14", "travelers": 2, "tripType": "roundtrip",
    }
    assert "internal_debug" not in prefill


def test_block_stripped_from_visible_text():
    clean, _ = extract_trip_params_block(SIMULATED)
    assert "TRIP_PARAMS" not in clean
    assert "DROP-ME" not in clean
    assert "pay cash both ways" in clean and "Book: outbound" in clean


def test_no_block_passthrough():
    clean, prefill = extract_trip_params_block("plain reply, no block")
    assert clean == "plain reply, no block" and prefill is None


def test_malformed_json_is_ignored_safely():
    clean, prefill = extract_trip_params_block("hi [[TRIP_PARAMS]] {broken json}")
    assert prefill is None and "hi" in clean


def test_non_dict_json_ignored():
    _, prefill = extract_trip_params_block('x [[TRIP_PARAMS]] ["not","a","dict"]')
    assert prefill is None
