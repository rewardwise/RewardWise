"""Unit tests for zoe/xpectrum_caller SSE assembly (NVIDIA → Xpectrum migration).

These tests fake the httpx streaming client so we exercise the SSE event-loop
logic without any network. Style mirrors the rest of tests/services/zoe/*:
plain functions + asyncio.run, monkeypatch over respx (respx is not a repo dep).
"""

import asyncio
import json

from app.services.zoe import xpectrum_caller
from app.services.zoe.xpectrum_caller import (
    XpectrumReply,
    _CONNECT_MSG,
    _FALLBACK_MSG,
    call_xpectrum,
)


# ── Fake httpx streaming client ───────────────────────────────────────────────


def _sse(event: dict) -> str:
    """Render one SSE `data:` line the way the upstream does."""
    return "data: " + json.dumps(event)


class _FakeStreamResponse:
    """Stand-in for the object returned by httpx.AsyncClient.stream()."""

    def __init__(self, *, status_code: int, lines: list[str], body: bytes = b""):
        self.status_code = status_code
        self._lines = lines
        self._body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def aiter_lines(self):
        for ln in self._lines:
            yield ln

    async def aread(self):
        return self._body


class _FakeAsyncClient:
    """Stand-in for httpx.AsyncClient; returns a canned stream response."""

    def __init__(self, response: _FakeStreamResponse):
        self._response = response

    def __init_subclass__(cls, **kw):  # pragma: no cover - defensive
        raise TypeError("do not subclass")

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def stream(self, method, url, headers=None, json=None):
        # captured for assertions if the test wants them
        self.last_call = {"method": method, "url": url, "headers": headers, "json": json}
        return self._response


def _patch_client(monkeypatch, response: _FakeStreamResponse):
    """Make httpx.AsyncClient(...) return our fake regardless of ctor kwargs."""
    captured = {}

    def _factory(*_a, **_kw):
        client = _FakeAsyncClient(response)
        captured["client"] = client
        return client

    monkeypatch.setattr(xpectrum_caller.httpx, "AsyncClient", _factory)
    return captured


# ── Missing key → ok=False with connect message (no network) ──────────────────


def test_missing_api_key_returns_connect_message(monkeypatch):
    monkeypatch.delenv("XPECTRUM_API_KEY", raising=False)
    # If this tried to open a socket the test would hang/fail; it must short-circuit.
    out = asyncio.run(call_xpectrum("hi", user="u1"))
    assert isinstance(out, XpectrumReply)
    assert out.ok is False
    assert out.answer == _CONNECT_MSG
    assert "Missing XPECTRUM_API_KEY" in (out.error or "")


# ── agent_message deltas concatenate ──────────────────────────────────────────


def test_agent_message_deltas_concatenate(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    lines = [
        _sse({"event": "agent_message", "answer": "Hel", "conversation_id": "c-1",
              "message_id": "m-1"}),
        _sse({"event": "agent_message", "answer": "lo, ", "conversation_id": "c-1"}),
        _sse({"event": "agent_message", "answer": "world", "conversation_id": "c-1"}),
        _sse({"event": "message_end", "conversation_id": "c-1",
              "metadata": {"usage": {"total_tokens": 42}}}),
    ]
    _patch_client(monkeypatch, _FakeStreamResponse(status_code=200, lines=lines))

    out = asyncio.run(call_xpectrum("hi", user="u1"))
    assert out.ok is True
    assert out.answer == "Hello, world"
    assert out.conversation_id == "c-1"
    assert out.message_id == "m-1"
    assert out.usage == {"total_tokens": 42}


# ── message_replace REPLACES the accumulated answer ───────────────────────────


def test_message_replace_replaces_not_appends(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    lines = [
        _sse({"event": "agent_message", "answer": "draft answer that ",
              "conversation_id": "c-2"}),
        _sse({"event": "agent_message", "answer": "gets moderated", "conversation_id": "c-2"}),
        # moderation rewrite carries the FULL final answer
        _sse({"event": "message_replace", "answer": "Clean final answer.",
              "conversation_id": "c-2"}),
        _sse({"event": "message_end", "conversation_id": "c-2", "metadata": {}}),
    ]
    _patch_client(monkeypatch, _FakeStreamResponse(status_code=200, lines=lines))

    out = asyncio.run(call_xpectrum("hi", user="u1"))
    assert out.ok is True
    assert out.answer == "Clean final answer."
    assert "draft answer" not in out.answer


# ── error event → ok=False, fallback message, conv id preserved ───────────────


def test_error_event_returns_not_ok(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    lines = [
        _sse({"event": "agent_message", "answer": "partial", "conversation_id": "c-3"}),
        _sse({"event": "error", "message": "upstream blew up", "conversation_id": "c-3"}),
    ]
    _patch_client(monkeypatch, _FakeStreamResponse(status_code=200, lines=lines))

    out = asyncio.run(call_xpectrum("hi", user="u1"))
    assert out.ok is False
    assert out.answer == _FALLBACK_MSG
    assert out.error == "upstream blew up"
    assert out.conversation_id == "c-3"


# ── HTTP >= 400 → ok=False, connect message, preserves inbound conv id ─────────


def test_http_error_returns_not_ok(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    resp = _FakeStreamResponse(
        status_code=404, lines=[], body=b'{"message":"Conversation Not Exists."}'
    )
    _patch_client(monkeypatch, resp)

    out = asyncio.run(call_xpectrum("hi", user="u1", conversation_id="stale-id"))
    assert out.ok is False
    assert out.answer == _CONNECT_MSG
    # conversation_id is echoed back so the caller's self-heal branch can fire
    assert out.conversation_id == "stale-id"
    # error string contains "conversation" so zoe_service clears the stale id
    assert "conversation" in (out.error or "").lower()


# ── empty answer (only non-text events) → ok=False ────────────────────────────


def test_empty_answer_is_not_ok(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    lines = [
        _sse({"event": "agent_thought", "thought": "thinking...", "conversation_id": "c-4"}),
        _sse({"event": "message_end", "conversation_id": "c-4", "metadata": {}}),
    ]
    _patch_client(monkeypatch, _FakeStreamResponse(status_code=200, lines=lines))

    out = asyncio.run(call_xpectrum("hi", user="u1"))
    assert out.ok is False
    assert out.answer == _FALLBACK_MSG
    assert out.error == "empty answer"
    assert out.conversation_id == "c-4"


# ── malformed / keepalive lines are ignored, not fatal ────────────────────────


def test_malformed_lines_are_skipped(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    lines = [
        "",                     # blank keepalive
        "event: ping",          # not a data: line
        "data: ",               # empty payload
        "data: [DONE]",         # sentinel
        "data: {not valid json",  # broken JSON
        _sse({"event": "agent_message", "answer": "ok", "conversation_id": "c-5"}),
    ]
    _patch_client(monkeypatch, _FakeStreamResponse(status_code=200, lines=lines))

    out = asyncio.run(call_xpectrum("hi", user="u1"))
    assert out.ok is True
    assert out.answer == "ok"


# ── payload is built correctly (streaming-only, conv id, inputs) ──────────────


def test_request_payload_shape(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")
    captured = _patch_client(
        monkeypatch,
        _FakeStreamResponse(
            status_code=200,
            lines=[_sse({"event": "agent_message", "answer": "hi", "conversation_id": "c"})],
        ),
    )

    asyncio.run(call_xpectrum(
        "find me a flight", user="user-42",
        conversation_id="resume-me", inputs={"wallet": "United: 50,000"},
    ))

    body = captured["client"].last_call["json"]
    assert body["response_mode"] == "streaming"  # agent-chat: never blocking
    assert body["query"] == "find me a flight"
    assert body["user"] == "user-42"
    assert body["conversation_id"] == "resume-me"
    assert body["inputs"] == {"wallet": "United: 50,000"}
    # auth header carries the key but the test never asserts the secret value
    headers = captured["client"].last_call["headers"]
    assert headers["Authorization"] == "Bearer app-test"


# ── connection exception → ok=False, connect message ──────────────────────────


def test_connection_exception_degrades_gracefully(monkeypatch):
    monkeypatch.setenv("XPECTRUM_API_KEY", "app-test")

    def _boom(*_a, **_kw):
        raise RuntimeError("connection refused")

    monkeypatch.setattr(xpectrum_caller.httpx, "AsyncClient", _boom)

    out = asyncio.run(call_xpectrum("hi", user="u1", conversation_id="keep-me"))
    assert out.ok is False
    assert out.answer == _CONNECT_MSG
    assert out.conversation_id == "keep-me"
    assert "connection refused" in (out.error or "")
