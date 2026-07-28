"""Shared provider-payload cache (Supabase-backed, 30-min freshness).

Lookup order in /api/search (operator-approved 2026-07-28):
  1. THIS cache (params-keyed, shared across users) — hit => ZERO provider
     calls; per-user verdict/ownership recompute on top (free).
  2. Same-user verdict reuse (L1 memory / L2 Supabase).
  3. Full fetch — populates both layers.

The payload is the COMPLETE deterministic verdict input: cash_data (incl.
google_flights_url), both award legs (post-hygiene), and both per-date
sampler maps (load-bearing for award cpp).

LOUD-FAILURE RULE (the L2 lesson, non-negotiable): any query/schema error
here logs explicitly and returns a miss — never a silent zero.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.cache.keys import build_search_cache_key
from app.cache.types import SearchParams

logger = logging.getLogger(__name__)

PAYLOAD_TTL_MINUTES = 30


def _fresh_cutoff_iso() -> str:
    return (
        datetime.now(tz=timezone.utc) - timedelta(minutes=PAYLOAD_TTL_MINUTES)
    ).isoformat()


def payload_cache_key(params: SearchParams) -> str:
    # Reuses the canonical normalized search key (params only — NO user).
    return "payload:" + build_search_cache_key(params)


def get_cached_payload(supabase, params: SearchParams) -> Optional[dict[str, Any]]:
    key = payload_cache_key(params)
    try:
        resp = (
            supabase.table("search_payload_cache")
            .select("payload, created_at")
            .eq("cache_key", key)
            .gte("created_at", _fresh_cutoff_iso())
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("payload_cache read FAILED (treating as miss): %s", exc)
        print(f"payload_cache ERROR read failed: {str(exc)[:160]}")
        return None
    rows = resp.data or []
    if not rows:
        return None
    print(f"payload_cache HIT key={key[:80]}")
    return rows[0]["payload"]


def put_cached_payload(supabase, params: SearchParams, payload: dict[str, Any]) -> None:
    key = payload_cache_key(params)
    try:
        supabase.table("search_payload_cache").upsert(
            {
                "cache_key": key,
                "payload": payload,
                "created_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        ).execute()
        # Prune-on-write: expired rows (any key) go out with each fresh write.
        supabase.table("search_payload_cache").delete().lt(
            "created_at", _fresh_cutoff_iso()
        ).execute()
    except Exception as exc:
        logger.error("payload_cache write FAILED (non-fatal): %s", exc)
        print(f"payload_cache ERROR write failed: {str(exc)[:160]}")
