"""Tests for /api/newsletter endpoint (ticket 86ba11k7y).

Covers the four contract paths:
1. valid email → 200 subscribed, insert called with normalized email
2. duplicate (caught via SELECT) → 200 already_subscribed, insert NOT called
3. invalid email format → 422 from field_validator
4. race condition (SELECT empty, INSERT raises UNIQUE_VIOLATION) → 200 already_subscribed

Mocks the supabase client + insert_one helper via monkeypatch. Builds a minimal
FastAPI app that mounts only the newsletter router so we don't pull in the
rest of the backend's import graph in the test process.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import newsletter
from app.api.validators import limiter
from app.db.errors import DbError


@pytest.fixture
def client(monkeypatch):
    """Fresh app + reset limiter state per test so rate-limit accounting doesn't leak."""
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(newsletter.router, prefix="/api")
    limiter.reset()
    return TestClient(app)


def _select_returning(rows):
    """Build a MagicMock chain that simulates supabase.from_().select().eq().limit().execute()."""
    mock_supabase = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    (
        mock_supabase
        .from_.return_value
        .select.return_value
        .eq.return_value
        .limit.return_value
        .execute.return_value
    ) = execute_result
    return mock_supabase


def test_valid_email_subscribes(client, monkeypatch):
    mock_supabase = _select_returning([])
    insert_calls = []

    def fake_insert_one(db, table, payload):
        insert_calls.append((table, payload))
        return {"id": "00000000-0000-0000-0000-000000000001", **payload}

    monkeypatch.setattr(newsletter, "get_server_supabase", lambda: mock_supabase)
    monkeypatch.setattr(newsletter, "insert_one", fake_insert_one)

    resp = client.post("/api/newsletter", json={"email": "  Test@Example.COM  "})

    assert resp.status_code == 200
    assert resp.json() == {"status": "subscribed"}
    assert len(insert_calls) == 1
    table, payload = insert_calls[0]
    assert table == "newsletter_signups"
    assert payload["email"] == "test@example.com"  # stripped + lowercased by validator
    assert payload["source"] == "landing-footer"
    assert payload["ip_hash"]  # non-empty hash


def test_duplicate_email_returns_already_subscribed(client, monkeypatch):
    mock_supabase = _select_returning([{"id": "existing-id"}])
    insert_calls = []

    monkeypatch.setattr(newsletter, "get_server_supabase", lambda: mock_supabase)
    monkeypatch.setattr(
        newsletter,
        "insert_one",
        lambda *a, **kw: insert_calls.append(a) or {},
    )

    resp = client.post("/api/newsletter", json={"email": "dupe@example.com"})

    assert resp.status_code == 200
    assert resp.json() == {"status": "already_subscribed"}
    assert insert_calls == []  # SELECT short-circuit, no INSERT attempted


def test_invalid_email_returns_422(client):
    resp = client.post("/api/newsletter", json={"email": "not-an-email"})
    assert resp.status_code == 422
    body = resp.json()
    assert "detail" in body
    # Pydantic structured error mentions the field that failed
    assert any("email" in str(item.get("loc", [])) for item in body["detail"])


def test_race_condition_unique_violation_returns_already_subscribed(client, monkeypatch):
    mock_supabase = _select_returning([])

    def raise_unique_violation(db, table, payload):
        raise DbError(
            message="Duplicate entry in newsletter_signups",
            code="UNIQUE_VIOLATION",
            table=table,
        )

    monkeypatch.setattr(newsletter, "get_server_supabase", lambda: mock_supabase)
    monkeypatch.setattr(newsletter, "insert_one", raise_unique_violation)

    resp = client.post("/api/newsletter", json={"email": "race@example.com"})

    assert resp.status_code == 200
    assert resp.json() == {"status": "already_subscribed"}
