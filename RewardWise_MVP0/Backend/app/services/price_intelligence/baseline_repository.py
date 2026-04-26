from __future__ import annotations

import sqlite3
from dataclasses import dataclass, asdict
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.services.price_intelligence.route_features import RouteFeatures

BACKEND_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_BASELINE_DB = BACKEND_ROOT / "app" / "data" / "price_model" / "route_price_baselines.sqlite"


@dataclass(frozen=True)
class BaselineMatch:
    has_baseline: bool
    match_level: str
    route_key: str | None = None
    route_tier: str | None = None
    confidence: str | None = None
    sample_size: int | None = None
    p25_cash_price: float | None = None
    median_cash_price: float | None = None
    p75_cash_price: float | None = None
    p90_cash_price: float | None = None
    source_mix: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _row_to_match(row: sqlite3.Row | None, match_level: str, route_key: str | None = None) -> BaselineMatch | None:
    if not row:
        return None
    data = dict(row)
    return BaselineMatch(
        has_baseline=True,
        match_level=match_level,
        route_key=route_key or data.get("route_key"),
        route_tier=data.get("route_tier"),
        confidence=data.get("confidence"),
        sample_size=data.get("sample_size"),
        p25_cash_price=data.get("p25_cash_price"),
        median_cash_price=data.get("median_cash_price"),
        p75_cash_price=data.get("p75_cash_price"),
        p90_cash_price=data.get("p90_cash_price"),
        source_mix=data.get("source_mix"),
    )


class BaselineRepository:
    def __init__(self, db_path: Path | str = DEFAULT_BASELINE_DB):
        self.db_path = Path(db_path)

    def is_available(self) -> bool:
        return self.db_path.exists()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_best_baseline(self, features: RouteFeatures) -> BaselineMatch:
        if not self.is_available():
            return BaselineMatch(has_baseline=False, match_level="missing_artifact", route_key=features.route_key, route_tier=features.route_tier)

        try:
            with self._connect() as conn:
                exact = conn.execute(
                    """
                    select * from route_baselines
                    where route_key=? and season=? and cabin=? and trip_type=?
                    limit 1
                    """,
                    (features.route_key, features.season, features.cabin, features.trip_type),
                ).fetchone()
                match = _row_to_match(exact, "exact_route", features.route_key)
                if match:
                    return match

                reverse = conn.execute(
                    """
                    select * from route_baselines
                    where route_key=? and season=? and cabin=? and trip_type=?
                    limit 1
                    """,
                    (features.reverse_route_key, features.season, features.cabin, features.trip_type),
                ).fetchone()
                match = _row_to_match(reverse, "reverse_route", features.reverse_route_key)
                if match:
                    return match

                region = conn.execute(
                    """
                    select * from region_pair_baselines
                    where origin_region=? and destination_region=? and route_tier=? and season=? and cabin=? and trip_type=? and distance_band=?
                    limit 1
                    """,
                    (
                        features.origin_region,
                        features.destination_region,
                        features.route_tier,
                        features.season,
                        features.cabin,
                        features.trip_type,
                        features.distance_band,
                    ),
                ).fetchone()
                match = _row_to_match(region, "region_pair", features.route_key)
                if match:
                    return match

                distance = conn.execute(
                    """
                    select * from distance_band_baselines
                    where market_segment=? and route_tier=? and season=? and cabin=? and trip_type=? and distance_band=?
                    limit 1
                    """,
                    (
                        features.market_segment,
                        features.route_tier,
                        features.season,
                        features.cabin,
                        features.trip_type,
                        features.distance_band,
                    ),
                ).fetchone()
                match = _row_to_match(distance, "distance_band", features.route_key)
                if match:
                    return match
        except Exception:
            return BaselineMatch(has_baseline=False, match_level="lookup_error", route_key=features.route_key, route_tier=features.route_tier)

        return BaselineMatch(has_baseline=False, match_level="no_match", route_key=features.route_key, route_tier=features.route_tier)


@lru_cache(maxsize=1)
def get_baseline_repository() -> BaselineRepository:
    return BaselineRepository()
