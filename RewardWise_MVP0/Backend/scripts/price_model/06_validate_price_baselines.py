#!/usr/bin/env python3
"""Validate Zoe route price baseline artifact."""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from scripts.price_model._common import DEFAULT_ARTIFACT_PATH, DEFAULT_METADATA_PATH


def validate(artifact: Path) -> dict:
    if not artifact.exists():
        raise SystemExit(f"Missing artifact: {artifact}")
    conn = sqlite3.connect(artifact)
    conn.row_factory = sqlite3.Row
    required_tables = {"route_baselines", "region_pair_baselines", "distance_band_baselines", "model_metadata"}
    actual_tables = {row[0] for row in conn.execute("select name from sqlite_master where type='table'")}
    missing = sorted(required_tables - actual_tables)
    if missing:
        raise SystemExit(f"Missing tables: {missing}")

    counts = {
        "route_baselines": conn.execute("select count(*) from route_baselines").fetchone()[0],
        "region_pair_baselines": conn.execute("select count(*) from region_pair_baselines").fetchone()[0],
        "distance_band_baselines": conn.execute("select count(*) from distance_band_baselines").fetchone()[0],
    }

    bad_order = conn.execute(
        """
        select route_key, season, cabin, p25_cash_price, median_cash_price, p75_cash_price, p90_cash_price
        from route_baselines
        where not (p25_cash_price <= median_cash_price and median_cash_price <= p75_cash_price and p75_cash_price <= p90_cash_price)
        limit 10
        """
    ).fetchall()
    if bad_order:
        raise SystemExit(f"Invalid percentile ordering: {[dict(row) for row in bad_order]}")

    smoke = {}
    for route in ["EWR-LAX", "EWR-MIA", "ORD-DEN", "ATL-DFW"]:
        row = conn.execute("select * from route_baselines where route_key=? limit 1", (route,)).fetchone()
        smoke[route] = dict(row) if row else None

    conn.close()
    return {"artifact": str(artifact), "counts": counts, "smoke_routes": smoke, "status": "ok"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", default=str(DEFAULT_ARTIFACT_PATH))
    parser.add_argument("--metadata", default=str(DEFAULT_METADATA_PATH))
    args = parser.parse_args()
    result = validate(Path(args.artifact))
    Path(args.metadata).parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
