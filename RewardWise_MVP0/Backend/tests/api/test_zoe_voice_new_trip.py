"""Voice-path parity for the dual-source kill-switch: a spoken NEW-trip
request must short-circuit before the Xpectrum agent, same as typed.

Router-only app (same pattern as test_newsletter.py) so the test process
doesn't pull the riva/gRPC import graph via app.main.
"""
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import zoe_voice as zv
from app.api.validators import limiter
from app.api.zoe import require_user
from app.services.zoe_service import NEW_TRIP_ACK

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(zv.router)
app.dependency_overrides[require_user] = lambda: "user-voice-1"
client = TestClient(app)


def test_voice_new_trip_flag_reaches_handle_zoe_and_short_circuits():
    captured = {}

    async def fake_handle_zoe(payload, request=None):
        captured.update(payload)
        # Real handle_zoe short-circuits on the flag (pinned in
        # test_new_trip_grounding.py); echo its contract here.
        assert payload["is_new_trip"] is True
        return {"message": NEW_TRIP_ACK, "intent": "new_trip_ack"}

    with patch.object(zv, "handle_zoe", side_effect=fake_handle_zoe):
        res = client.post(
            "/api/zoe/voice",
            data={
                "transcript": "fly me from Denver to Austin September 10 to 14",
                "conversation_id": "c-9",
                "history": "[]",
                "is_new_trip": "true",
            },
        )
    assert res.status_code in (200, 204)
    assert captured["is_new_trip"] is True
    assert captured["is_voice"] is True
    assert captured["user_id"] == "user-voice-1"


def test_voice_flag_defaults_off_and_false_stays_false():
    captured = {}

    async def fake_handle_zoe(payload, request=None):
        captured.update(payload)
        return {"message": "normal reply"}

    with patch.object(zv, "handle_zoe", side_effect=fake_handle_zoe):
        res = client.post(
            "/api/zoe/voice",
            data={"transcript": "how do transfers work?", "history": "[]"},
        )
    assert res.status_code in (200, 204)
    assert captured["is_new_trip"] is False
