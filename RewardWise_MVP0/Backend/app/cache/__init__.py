"""Cache module — public exports."""

from app.cache.config import FLIGHT_CACHE, SEARCH_CACHE, SEARCH_DB_CACHE
from app.cache.db_cache import (
    InsertCachedFlightsResult,
    SearchDbLookupResult,
    find_search_verdict_in_db,
    insert_cached_flights_only_new,
)
from app.cache.keys import build_flight_cache_key, build_search_cache_key
from app.cache.memory import (
    FlightMemoryCache,
    SearchMemoryCache,
    get_flight_memory_cache,
    get_search_memory_cache,
)
from app.cache.normalize import (
    normalize,
    normalize_cabin,
    normalize_date,
    normalize_search_params,
    to_departure_ms,
)
from app.cache.types import (
    CachedVerdictPayload,
    FlightCacheEntry,
    FlightCacheInput,
    SearchParams,
    SearchRow,
    VerdictRow,
)

__all__ = [
    "SEARCH_CACHE",
    "SEARCH_DB_CACHE",
    "FLIGHT_CACHE",
    "SearchParams",
    "VerdictRow",
    "SearchRow",
    "CachedVerdictPayload",
    "FlightCacheEntry",
    "FlightCacheInput",
    "normalize",
    "normalize_date",
    "normalize_cabin",
    "normalize_search_params",
    "to_departure_ms",
    "build_search_cache_key",
    "build_flight_cache_key",
    "get_search_memory_cache",
    "SearchMemoryCache",
    "get_flight_memory_cache",
    "FlightMemoryCache",
    "insert_cached_flights_only_new",
    "InsertCachedFlightsResult",
    "find_search_verdict_in_db",
    "SearchDbLookupResult",
]
