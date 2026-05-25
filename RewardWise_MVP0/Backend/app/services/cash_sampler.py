"""Per-date cash sampler.

flex-date searches return award_options spanning multiple departure dates, but
cash pricing was previously fetched once for the anchor date and reused. That
made CPP arithmetic compare each award against the wrong cash anchor.

This helper fans out one one-way `get_cash_price` call per distinct date, with
bounded concurrency, so each award can be costed against its own date's cash.
Per-date failures are isolated (None for that date, others succeed). It piggy-
backs on the existing provider-fallback wrapper, so no new caching semantics.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Iterable, Optional

from app.services.pricing_service import get_cash_price

DEFAULT_CONCURRENCY = 4

logger = logging.getLogger(__name__)


async def sample_cash_prices_by_date(
    origin: str,
    destination: str,
    dates: Iterable[str],
    cabin: str,
    travelers: int = 1,
    max_stops: str = "any",
    concurrency: int = DEFAULT_CONCURRENCY,
) -> Dict[str, Optional[float]]:
    """Fetch one-way cash price for each distinct date.

    Returns a dict mapping date -> cash_price (or None if that date failed).
    Duplicate dates in `dates` are deduped before fan-out.
    """
    distinct = sorted({d for d in dates if d})
    if not distinct:
        return {}

    semaphore = asyncio.Semaphore(max(1, concurrency))

    async def fetch_one(date: str) -> tuple[str, Optional[float]]:
        async with semaphore:
            try:
                result = await get_cash_price(
                    origin,
                    destination,
                    date,
                    cabin,
                    travelers,
                    return_date=None,
                    max_stops=max_stops,
                )
                return date, result.get("cash_price")
            except Exception as exc:
                # Isolate per-date failures so one bad date can't take down
                # the whole flex sweep — providers raise a wide range of
                # exception types (httpx.HTTPError, RuntimeError, ValueError,
                # KeyError, ...) and the contract here is "any failure → None
                # for that date." CancelledError + other BaseExceptions are
                # NOT caught (they aren't Exception subclasses), so
                # cooperative cancellation still works.
                logger.warning(
                    "sample_cash_prices_by_date: %s→%s on %s failed: %s",
                    origin, destination, date, exc,
                )
                return date, None

    pairs = await asyncio.gather(*(fetch_one(d) for d in distinct))
    return dict(pairs)
