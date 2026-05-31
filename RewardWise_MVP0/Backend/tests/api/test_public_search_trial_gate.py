"""Trial gate enforces the count-based 3-search limit per ip_hash.

Pre-fix bug (PR A): ``public_search_trials`` carried a UNIQUE index
``public_search_trials_ip_hash_uidx`` on ``ip_hash``. It was created when
the original free-search limit was 1 and never dropped when the limit moved
to 3. The count-based gate in ``_claim_public_search_trial`` was written for
the new contract — SELECT existing rows, allow up to ``PUBLIC_SEARCH_FREE_LIMIT``
inserts per ip_hash — but the residual unique index silently superseded it:
every 2nd insert from the same IP failed with Postgres 23505, fell into the
race-case ``except`` branch, and surfaced "you've used your 3 free searches".
The paywall enforced 1, not 3, and the live "3 free searches" copy on
``https://www.mytravelwallet.ai`` was therefore false.

Fix has two halves: (a) migration
``20260531000712_drop_public_search_trials_ip_hash_uidx.sql`` drops the
residual unique index so the gate's count-based check actually runs, and
(b) this test pins the count-based contract so the intent is not silently
re-broken in code.

A pure unit test cannot replay the Postgres-side bug (the bug lived in a DB
index, not in Python). What this test does pin: given a supabase client that
behaves correctly (no spurious unique constraint), the gate allows exactly
three inserts per ip_hash and 429s on the fourth. If anyone later regresses
the gate logic (e.g. tightening it back to 1 or upserting on ip_hash), this
test fails immediately.
"""

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api.search import _claim_public_search_trial
from app.api.validators import SearchParams


class _FakeRequest:
    """Minimal stand-in for fastapi.Request — only `.headers.get(...)` is used."""

    def __init__(self, headers: dict[str, str]):
        self.headers = headers


class _FakeSupabase:
    """Per-test fake that emulates the two access patterns the gate uses.

    Patterns the gate exercises:
      SELECT: ``supabase.from_("public_search_trials").select(...).eq("ip_hash", X).limit(N).execute()``
      INSERT: ``supabase.table("public_search_trials").insert(payload).execute()``
              (via ``app.db.insert_one``)

    Rows are kept in a single in-memory list. There is intentionally NO
    unique-constraint emulation on ip_hash — the whole point of PR A's
    migration is that the production DB no longer enforces that, and the
    gate's contract is to count rows itself.
    """

    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []
        self._mode: str | None = None
        self._eq: tuple[str, Any] | None = None
        self._limit: int | None = None
        self._pending: dict[str, Any] | None = None
        self._next_id = 1

    # ----- SELECT chain -----
    def from_(self, _table: str) -> "_FakeSupabase":
        return self

    def select(self, *_args, **_kwargs) -> "_FakeSupabase":
        self._mode = "select"
        return self

    def eq(self, col: str, val: Any) -> "_FakeSupabase":
        self._eq = (col, val)
        return self

    def limit(self, n: int) -> "_FakeSupabase":
        self._limit = n
        return self

    # ----- INSERT chain (used by app.db.insert_one) -----
    def table(self, _name: str) -> "_FakeSupabase":
        return self

    def insert(self, payload: dict[str, Any]) -> "_FakeSupabase":
        self._mode = "insert"
        self._pending = dict(payload)
        return self

    def execute(self):
        if self._mode == "select":
            assert self._eq is not None
            col, val = self._eq
            matches = [r for r in self._rows if r.get(col) == val]
            if self._limit is not None:
                matches = matches[: self._limit]
            self._reset()
            return MagicMock(data=matches)

        if self._mode == "insert":
            assert self._pending is not None
            row = dict(self._pending)
            row.setdefault("id", f"row-{self._next_id}")
            self._next_id += 1
            self._rows.append(row)
            self._reset()
            return MagicMock(data=[row])

        raise RuntimeError(f"_FakeSupabase: unexpected execute() with mode={self._mode!r}")

    def _reset(self) -> None:
        self._mode = None
        self._eq = None
        self._limit = None
        self._pending = None


def _params(**overrides) -> SearchParams:
    base = dict(
        origin="SFO",
        destination="SIN",
        date="2030-06-15",  # well-future date to satisfy not-in-past validator
        cabin="economy",
        travelers=1,
    )
    base.update(overrides)
    return SearchParams(**base)


def _request(ip: str = "203.0.113.7", user_agent: str = "pytest/1.0") -> _FakeRequest:
    return _FakeRequest(
        headers={"cf-connecting-ip": ip, "user-agent": user_agent}
    )


def test_three_searches_succeed_then_fourth_raises_429():
    """Same ip_hash: 1st/2nd/3rd return trial_ids, 4th 429s with exhausted-detail copy."""
    supabase = _FakeSupabase()
    req = _request()

    trial_ids = [
        _claim_public_search_trial(supabase, req, _params())
        for _ in range(3)
    ]

    # All three inserts succeeded and returned distinct trial IDs.
    assert all(isinstance(tid, str) and tid for tid in trial_ids)
    assert len(set(trial_ids)) == 3

    # Fourth attempt fires the gate.
    with pytest.raises(HTTPException) as excinfo:
        _claim_public_search_trial(supabase, req, _params())

    assert excinfo.value.status_code == 429
    assert "3 free searches" in excinfo.value.detail


def test_distinct_ips_each_get_their_own_quota():
    """The gate keys on ip_hash, so a fresh IP starts with a full 3-search quota."""
    supabase = _FakeSupabase()

    # IP A burns its 3 searches.
    for _ in range(3):
        _claim_public_search_trial(supabase, _request(ip="198.51.100.1"), _params())
    with pytest.raises(HTTPException):
        _claim_public_search_trial(supabase, _request(ip="198.51.100.1"), _params())

    # IP B is independent — should still be able to run 3.
    for _ in range(3):
        _claim_public_search_trial(supabase, _request(ip="198.51.100.2"), _params())
    with pytest.raises(HTTPException) as excinfo:
        _claim_public_search_trial(supabase, _request(ip="198.51.100.2"), _params())
    assert excinfo.value.status_code == 429
