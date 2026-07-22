"""Dual-source guard (prod incident 2026-07-21): a typed NEW-trip message must
compose a query that FORBIDS agent-side pricing and drops the stale verdict
context. The engine search is the only pricing source for a fresh trip."""
from app.services.zoe_service import NEW_TRIP_INSTRUCTION, _compose_xpectrum_query

CTX = "Trip: DXB round trip to LHR. Verdict: pay_cash $612; best award 42,000 + $180."
WALLET = "Chase Ultimate Rewards: 3,900,000; Delta SkyMiles: 2,900,005"
MSG = "Can I go from SFO to Seattle round trip August 15th and 18th, one traveler, please?"


def test_new_trip_forbids_pricing_and_drops_stale_context():
    q = _compose_xpectrum_query(MSG, WALLET, CTX, is_new_trip=True)
    # Suppression instruction present, verbatim single source.
    assert NEW_TRIP_INSTRUCTION in q
    assert "Do NOT price" in q
    assert "ONE short, friendly sentence" in q
    # The stale verdict is GONE — its numbers must not reach the agent.
    assert "42,000" not in q and "$612" not in q
    assert "[Live search result" not in q
    # The user's message still goes through.
    assert MSG in q


def test_new_trip_instruction_bans_every_pricing_channel():
    # Tools, memory, and estimates are each named — the incident reply priced
    # from the agent's own searchFlight tool.
    for channel in ("not from tools", "not from memory", "not as", "No numbers"):
        assert channel in NEW_TRIP_INSTRUCTION


def test_normal_turn_unchanged():
    q = _compose_xpectrum_query("is points or cash better here?", WALLET, CTX)
    assert NEW_TRIP_INSTRUCTION not in q
    assert CTX in q  # grounding context still attaches on non-trip turns
    assert "USING THE NUMBERS ABOVE" in q


def test_flag_default_is_off():
    q = _compose_xpectrum_query(MSG, "", None)
    assert NEW_TRIP_INSTRUCTION not in q
    assert q == MSG  # no preamble at all without context/wallet
