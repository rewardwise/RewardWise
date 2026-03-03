
#L1 in-memory caches backed by a shared LRU eviction store.

#SearchMemoryCache - stores recent search verdicts (keyed by search params).
#FlightMemoryCache - stores individual flight data (keyed by flight_id + airline).


from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

from app.cache.config import FLIGHT_CACHE, SEARCH_CACHE
from app.cache.keys import build_flight_cache_key, build_search_cache_key
from app.cache.normalize import to_departure_ms
from app.cache.types import (
    CachedVerdictPayload,
    FlightCacheEntry,
    FlightCacheInput,
    SearchParams,
    VerdictRow,
)


class _LRUStore:
    """Generic dict + ordered list LRU with TTL-based expiration."""

    def __init__(self, max_size: int):
        self._data: dict[str, tuple[Any, float]] = {}
        self._order: list[str] = []
        self._max_size = max_size

    def get(self, key: str) -> Any | None:
        rec = self._data.get(key)
        if not rec:
            return None
        value, expires_at = rec
        if time.time() * 1000 > expires_at:
            self._data.pop(key, None)
            try:
                self._order.remove(key)
            except ValueError:
                pass
            return None
        return value

    def put(self, key: str, value: Any, expires_at_ms: float) -> None:
        if len(self._order) >= self._max_size and key not in self._data:
            if self._order:
                oldest = self._order.pop(0)
                self._data.pop(oldest, None)
        if key not in self._order:
            self._order.append(key)
        self._data[key] = (value, expires_at_ms)

    def contains(self, key: str) -> bool:
        return key in self._data

    def clear(self) -> None:
        self._data.clear()
        self._order.clear()



# Search verdict cache


_search_store = _LRUStore(SEARCH_CACHE["MAX_SIZE"])


class SearchMemoryCache:
    def get(self, params: SearchParams) -> CachedVerdictPayload | None:
        return _search_store.get(build_search_cache_key(params))

    def set(self, params: SearchParams, search_id: str, verdict: VerdictRow) -> None:
        dep = params.get("departure_date") or ""
        try:
            if date.fromisoformat(dep) < date.today() - timedelta(days=1):
                return
        except ValueError:
            return

        payload: CachedVerdictPayload = {
            "search_id": search_id,
            "verdict": verdict,
            "from_cache": True,
        }
        _search_store.put(
            build_search_cache_key(params),
            payload,
            time.time() * 1000 + SEARCH_CACHE["TTL_MS"],
        )


def get_search_memory_cache() -> SearchMemoryCache:
    return SearchMemoryCache()



# Flight data cache


_flight_store = _LRUStore(FLIGHT_CACHE["MAX_SIZE"])


def _flight_expires_at(departure_ms: int) -> float:
    cap = time.time() * 1000 + FLIGHT_CACHE["MAX_TTL_MS"]
    return min(float(departure_ms), cap)


class FlightMemoryCache:
    def get(self, flight_id: str, airline: str) -> FlightCacheEntry | None:
        return _flight_store.get(build_flight_cache_key(flight_id, airline))

    def add_only_if_new(self, inp: FlightCacheInput) -> bool:
        departure_ms = to_departure_ms(inp["departure_time"])
        if departure_ms <= time.time() * 1000:
            return False
        key = build_flight_cache_key(inp["flight_id"], inp["airline"])
        if _flight_store.contains(key):
            return False
        entry: FlightCacheEntry = {
            "flight_id": inp["flight_id"],
            "airline": inp["airline"],
            "departure_time": departure_ms,
            "payload": inp.get("payload") or {},
        }
        _flight_store.put(key, entry, _flight_expires_at(departure_ms))
        return True

    def add_only_new(self, inputs: list[FlightCacheInput]) -> int:
        return sum(1 for inp in inputs if self.add_only_if_new(inp))

    def clear(self) -> None:
        _flight_store.clear()


def get_flight_memory_cache() -> FlightMemoryCache:
    return FlightMemoryCache()
