"""Dual-source kill-switch (prod incident 2026-07-21): a typed NEW-trip turn
must NEVER reach the Xpectrum agent — its searchFlight tool priced trips even
when instructed not to (live-verified). The backend answers deterministically;
the engine verdict is the only pricing source."""
import pytest

import app.services.zoe_service as zs


@pytest.fixture()
def no_upstream(monkeypatch):
    async def _boom(*a, **k):  # noqa: ANN001
        raise AssertionError("Xpectrum must NOT be called on a new-trip turn")

    async def _log(*a, **k):  # noqa: ANN001
        return "interaction-123"

    monkeypatch.setattr(zs, "call_xpectrum", _boom)
    monkeypatch.setattr(zs, "log_interaction", _log)


@pytest.mark.asyncio
async def test_new_trip_short_circuits_before_the_agent(no_upstream):
    resp = await zs.handle_zoe({
        "message": "Can I go from SFO to Seattle round trip August 15th and 18th, one traveler, please?",
        "user_id": "u-1",
        "conversation_id": "c-1",
        "is_new_trip": True,
        "will_autorun": True,
        "verdict_context": "stale DXB verdict $612 / 42,000 points",
    })
    assert resp["message"] == zs.NEW_TRIP_ACK_RUNNING
    assert resp["interaction_id"] == "interaction-123"


def test_ack_contains_no_pricing_and_points_at_the_card():
    import re
    assert re.search(r"\$\s?\d|\d[\d,]{2,}\s*(points|pts|miles)|cents?\s*per\s*point", zs.NEW_TRIP_ACK, re.I) is None
    assert "verdict" in zs.NEW_TRIP_ACK.lower()


@pytest.mark.asyncio
async def test_non_trip_turn_still_reaches_the_agent(monkeypatch):
    called = {}

    class _Reply:
        ok = True
        answer = "grounded answer"
        conversation_id = None
        error = None

    async def _capture(query, **kw):  # noqa: ANN001
        called["query"] = query
        return _Reply()

    async def _log(*a, **k):  # noqa: ANN001
        return "i-2"

    async def _wallet(_uid):  # noqa: ANN001
        return []

    monkeypatch.setattr(zs, "call_xpectrum", _capture)
    monkeypatch.setattr(zs, "log_interaction", _log)
    monkeypatch.setattr(zs, "_fetch_wallet", _wallet)

    resp = await zs.handle_zoe({
        "message": "is points or cash better here?",
        "user_id": "u-1",
        "conversation_id": "c-2",
        "is_new_trip": False,
        "verdict_context": "Trip: SEA-LAX. Verdict pay_cash $157; award 15,200 + $11.",
    })
    assert resp["message"] == "grounded answer"
    # Grounding context still rides the composed query on non-trip turns.
    assert "15,200" in called["query"]
    assert "USING THE NUMBERS ABOVE" in called["query"]


def test_wallet_inputs_sums_per_program_not_per_card():
    from app.services.zoe_service import _wallet_inputs
    wallet = [
        {"program": "Chase Ultimate Rewards", "points": 301},
        {"program": "Chase Ultimate Rewards", "points": 0},
        {"program": "Chase Ultimate Rewards", "points": 0},
        {"program": "Amex Membership Rewards", "points": 0},
    ]
    out = _wallet_inputs(wallet)
    assert out == "Chase Ultimate Rewards: 301; Amex Membership Rewards: 0"
    assert out.count("Chase Ultimate Rewards") == 1
    assert _wallet_inputs([]) == "No reward programs on file."


TRIP_MSG = "Zoe, can you find me a trip from Seattle to Tokyo for next year, March 17th to 31st?"


@pytest.mark.asyncio
async def test_pending_trip_reaches_agent_on_next_turn_then_clears(monkeypatch):
    """2026-07-26 incident: after a kill-switched trip turn, the follow-up's
    upstream query must CARRY the trip statement (agent not blind), and the
    statement is consumed exactly once."""
    queries = []

    class _Reply:
        ok = True
        answer = "contextual answer"
        conversation_id = None
        error = None

    async def _capture(query, **kw):  # noqa: ANN001
        queries.append(query)
        return _Reply()

    async def _log(*a, **k):  # noqa: ANN001
        return "i-77"

    async def _wallet(_uid):  # noqa: ANN001
        return []

    monkeypatch.setattr(zs, "call_xpectrum", _capture)
    monkeypatch.setattr(zs, "log_interaction", _log)
    monkeypatch.setattr(zs, "_fetch_wallet", _wallet)

    conv = "conv-pending-1"
    # Turn 1: kill-switched trip statement (never goes upstream)
    r1 = await zs.handle_zoe({
        "message": TRIP_MSG, "user_id": "u-p1", "conversation_id": conv,
        "is_new_trip": True, "will_autorun": True,
    })
    assert r1["message"] == zs.NEW_TRIP_ACK_RUNNING
    assert queries == []  # agent untouched

    # Turn 2: "ok" — upstream query must include the trip statement
    await zs.handle_zoe({
        "message": "ok", "user_id": "u-p1", "conversation_id": conv,
        "is_new_trip": False,
    })
    assert len(queries) == 1
    assert TRIP_MSG in queries[0]
    assert "trip under discussion" in queries[0]
    assert "do NOT price it yourself" in queries[0]

    # Turn 3: consumed — the statement must NOT repeat
    await zs.handle_zoe({
        "message": "thanks", "user_id": "u-p1", "conversation_id": conv,
        "is_new_trip": False,
    })
    assert len(queries) == 2
    assert TRIP_MSG not in queries[1]


@pytest.mark.asyncio
async def test_kill_switch_records_the_exchange_in_session_history(monkeypatch):
    async def _log(*a, **k):  # noqa: ANN001
        return "i-78"

    monkeypatch.setattr(zs, "log_interaction", _log)
    conv = "conv-pending-2"
    await zs.handle_zoe({
        "message": TRIP_MSG, "user_id": "u-p2", "conversation_id": conv,
        "is_new_trip": True, "will_autorun": True,
    })
    from app.services.zoe import session as session_store
    sess = await session_store.load(f"user:u-p2:conv:{conv}")
    assert sess.pending_trip_statement == TRIP_MSG
    assert sess.history[-2:] == [
        {"role": "user", "content": TRIP_MSG},
        {"role": "assistant", "content": zs.NEW_TRIP_ACK_RUNNING},
    ]


def test_ack_copy_matches_what_actually_happens():
    # Auto-run ack: the search really fires now, so "running it now" is honest.
    assert "running it now" in zs.NEW_TRIP_ACK_RUNNING
    assert "hit Search Flights" not in zs.NEW_TRIP_ACK_RUNNING
    # Nudge ack: no run happening; asks for exactly the missing fields.
    nudge = zs.new_trip_ack(False, ["date"])
    assert "what dates" in nudge
    assert "running it now" not in nudge
    both = zs.new_trip_ack(False, ["origin", "date"])
    assert "flying from" in both and "what dates" in both
    # Unknown/empty missing list still yields a sane sentence.
    assert "missing details" in zs.new_trip_ack(False, [])


def test_ack_copy_price_free():
    import re
    for ack in (zs.NEW_TRIP_ACK_RUNNING, zs.new_trip_ack(False, ["date"])):
        assert re.search(r"\$\s?\d|\d[\d,]{2,}\s*(points|pts|miles)", ack) is None


def test_unresolved_place_ack_holds_and_asks():
    ack = zs.new_trip_ack(False, ["unresolved_place"])
    assert "didn't catch that city" in ack
    assert "held off searching" in ack
    assert "running it now" not in ack


def test_return_before_depart_ack_holds_and_asks():
    # P0 2026-07-28: conflicting post-merge dates must produce a friendly ask,
    # never run the search (which 422s and rendered a raw validation error).
    ack = zs.new_trip_ack(False, ["return_before_depart"])
    assert "return" in ack.lower()
    assert "coming back" in ack.lower()
    assert "run" in ack.lower()
