"""
Shared normalization and parsing helpers for all cache modules.
Single source of truth — used by keys, db_cache, memory.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.cache.types import SearchParams


def normalize(s: str | None) -> str:
    """Uppercase + trim. Used for origin / destination / cabin / airline."""
    if s is None or s == "":
        return ""
    return str(s).strip().upper()


def normalize_date(d: str | None) -> str:
    """Trim only, preserving YYYY-MM-DD format."""
    if d is None or d == "":
        return ""
    return str(d).strip()


def normalize_cabin(cabin: str | None) -> str:
    """Normalize cabin with a fallback. Empty / null => 'ECONOMY'."""
    return normalize(cabin or "economy") or "ECONOMY"


def normalize_search_params(params: SearchParams) -> tuple[str, str, str, str, int, str]:
    """Return (origin, destination, departure, return_date, passengers, cabin)
    normalized for cache-key building and DB matching."""
    origin = normalize(params.get("origin") or "")
    destination = normalize(params.get("destination") or "")
    departure = normalize_date(params.get("departure_date") or "")
    return_date = normalize_date(params.get("return_date") or "")
    passengers = max(1, int(params.get("passengers") or 1))
    cabin = normalize_cabin(params.get("cabin"))
    return origin, destination, departure, return_date, passengers, cabin


def to_departure_ms(d: str | int) -> int:
    """Parse departure time to epoch ms. Returns 0 for unparseable values."""
    if isinstance(d, int):
        return d
    if isinstance(d, float):
        return int(d)
    s = str(d).strip()
    if not s:
        return 0
    try:
        v = float(s)
        return int(v) if v >= 1e12 else int(v * 1000)
    except ValueError:
        pass
    try:
        from datetime import datetime

        if "T" in s or ("-" in s and len(s) >= 10):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(s)
        return int(dt.timestamp() * 1000)
    except (ValueError, TypeError):
        return 0
