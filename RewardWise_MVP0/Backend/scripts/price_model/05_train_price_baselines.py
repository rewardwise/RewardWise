#!/usr/bin/env python3
"""Generate Zoe's route price baseline SQLite artifact.

This is intentionally explainable baseline training, not black-box ML. It groups
historical fares by route/tier/season/cabin and stores percentile ranges that
Zoe can compare live fares against.
"""
from __future__ import annotations

import argparse
import csv
import json
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scripts.price_model._common import (
    DEFAULT_ARTIFACT_PATH,
    DEFAULT_METADATA_PATH,
    distance_band,
    haversine_miles,
    merged_airport_info,
    normalize_iata,
    route_key,
    route_tier,
    season_for_date,
    summarize,
)

GroupKey = tuple[str, ...]


def clean_fare(value: Any) -> float | None:
    try:
        fare = float(str(value).replace("$", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    if fare < 0 or fare > 20000:
        return None
    return fare


def normalize_cabin(value: Any) -> str:
    text = str(value or "economy").strip().lower().replace(" ", "_")
    if text in {"coach", "main", "main_cabin", "basic_economy"}:
        return "economy"
    if text in {"premium", "premium_economy"}:
        return "premium_economy"
    if text not in {"economy", "premium_economy", "business", "first"}:
        return "economy"
    return text


def normalize_trip_type(value: Any) -> str:
    text = str(value or "roundtrip").strip().lower().replace("_", "")
    if text in {"oneway", "one-way", "one way"}:
        return "oneway"
    return "roundtrip"


def read_training_rows(paths: list[Path]) -> list[dict[str, Any]]:
    airports = merged_airport_info()
    rows: list[dict[str, Any]] = []

    for path in paths:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for raw in reader:
                origin = normalize_iata(raw.get("origin") or raw.get("Origin") or raw.get("startingAirport"))
                destination = normalize_iata(raw.get("destination") or raw.get("Destination") or raw.get("destinationAirport"))
                fare = clean_fare(raw.get("fare") or raw.get("Fare") or raw.get("totalFare") or raw.get("baseFare") or raw.get("avg_fare"))
                if not origin or not destination or origin == destination or fare is None:
                    continue

                origin_info = airports.get(origin)
                destination_info = airports.get(destination)
                origin_tier = origin_info.tier if origin_info else "regional"
                destination_tier = destination_info.tier if destination_info else "regional"
                tier = route_tier(origin_tier, destination_tier)
                season = season_for_date(raw.get("departure_date") or raw.get("flightDate") or raw.get("date"))

                raw_distance = raw.get("distance") or raw.get("Distance") or raw.get("totalTravelDistance")
                try:
                    miles = float(raw_distance) if raw_distance not in (None, "") else None
                except ValueError:
                    miles = None
                if miles is None:
                    miles = haversine_miles(origin_info, destination_info)

                rows.append({
                    "source": raw.get("source") or path.stem,
                    "origin": origin,
                    "destination": destination,
                    "route_key": route_key(origin, destination),
                    "reverse_route_key": route_key(destination, origin),
                    "fare": fare,
                    "season": season,
                    "cabin": normalize_cabin(raw.get("cabin") or raw.get("segmentsCabinCode")),
                    "trip_type": normalize_trip_type(raw.get("trip_type")),
                    "route_tier": tier,
                    "origin_tier": origin_tier,
                    "destination_tier": destination_tier,
                    "origin_region": origin_info.region if origin_info else "unknown",
                    "destination_region": destination_info.region if destination_info else "unknown",
                    "market_segment": "us_domestic" if (origin_info and destination_info and origin_info.country_code == "US" and destination_info.country_code == "US") else "unknown",
                    "distance_band": distance_band(miles),
                })
    return rows


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        drop table if exists route_baselines;
        drop table if exists region_pair_baselines;
        drop table if exists distance_band_baselines;
        drop table if exists model_metadata;

        create table route_baselines (
            route_key text not null,
            origin text not null,
            destination text not null,
            route_tier text not null,
            market_segment text not null,
            season text not null,
            cabin text not null,
            trip_type text not null,
            distance_band text not null,
            sample_size integer not null,
            p25_cash_price real,
            median_cash_price real,
            p75_cash_price real,
            p90_cash_price real,
            confidence text not null,
            source_mix text not null,
            primary key (route_key, season, cabin, trip_type)
        );

        create table region_pair_baselines (
            origin_region text not null,
            destination_region text not null,
            route_tier text not null,
            market_segment text not null,
            season text not null,
            cabin text not null,
            trip_type text not null,
            distance_band text not null,
            sample_size integer not null,
            p25_cash_price real,
            median_cash_price real,
            p75_cash_price real,
            p90_cash_price real,
            confidence text not null,
            source_mix text not null,
            primary key (origin_region, destination_region, route_tier, season, cabin, trip_type, distance_band)
        );

        create table distance_band_baselines (
            market_segment text not null,
            route_tier text not null,
            season text not null,
            cabin text not null,
            trip_type text not null,
            distance_band text not null,
            sample_size integer not null,
            p25_cash_price real,
            median_cash_price real,
            p75_cash_price real,
            p90_cash_price real,
            confidence text not null,
            source_mix text not null,
            primary key (market_segment, route_tier, season, cabin, trip_type, distance_band)
        );

        create table model_metadata (
            key text primary key,
            value text not null
        );

        create index idx_route_lookup on route_baselines(route_key, season, cabin, trip_type);
        create index idx_region_lookup on region_pair_baselines(origin_region, destination_region, route_tier, season, cabin, trip_type, distance_band);
        create index idx_distance_lookup on distance_band_baselines(market_segment, route_tier, season, cabin, trip_type, distance_band);
        """
    )


def source_mix(rows: list[dict[str, Any]]) -> str:
    return ",".join(sorted({str(row["source"]) for row in rows if row.get("source")})) or "unknown"


def insert_summary(conn: sqlite3.Connection, table: str, keys: GroupKey, rows: list[dict[str, Any]], columns: list[str]) -> None:
    stats = summarize([float(row["fare"]) for row in rows])
    values = list(keys) + [
        stats["sample_size"],
        stats["p25"],
        stats["median"],
        stats["p75"],
        stats["p90"],
        stats["confidence"],
        source_mix(rows),
    ]
    placeholders = ",".join("?" for _ in values)
    conn.execute(
        f"insert or replace into {table} ({','.join(columns)},sample_size,p25_cash_price,median_cash_price,p75_cash_price,p90_cash_price,confidence,source_mix) values ({placeholders})",
        values,
    )


def train(paths: list[Path], artifact_path: Path, metadata_path: Path, min_sample_size: int) -> dict[str, Any]:
    rows = read_training_rows(paths)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    if artifact_path.exists():
        artifact_path.unlink()

    conn = sqlite3.connect(artifact_path)
    init_db(conn)

    route_groups: dict[GroupKey, list[dict[str, Any]]] = defaultdict(list)
    region_groups: dict[GroupKey, list[dict[str, Any]]] = defaultdict(list)
    distance_groups: dict[GroupKey, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        route_groups[(row["route_key"], row["origin"], row["destination"], row["route_tier"], row["market_segment"], row["season"], row["cabin"], row["trip_type"], row["distance_band"])].append(row)
        region_groups[(row["origin_region"], row["destination_region"], row["route_tier"], row["market_segment"], row["season"], row["cabin"], row["trip_type"], row["distance_band"])].append(row)
        distance_groups[(row["market_segment"], row["route_tier"], row["season"], row["cabin"], row["trip_type"], row["distance_band"])].append(row)

    for key, group in route_groups.items():
        if len(group) >= min_sample_size:
            insert_summary(conn, "route_baselines", key, group, ["route_key", "origin", "destination", "route_tier", "market_segment", "season", "cabin", "trip_type", "distance_band"])
    for key, group in region_groups.items():
        if len(group) >= min_sample_size:
            insert_summary(conn, "region_pair_baselines", key, group, ["origin_region", "destination_region", "route_tier", "market_segment", "season", "cabin", "trip_type", "distance_band"])
    for key, group in distance_groups.items():
        if len(group) >= min_sample_size:
            insert_summary(conn, "distance_band_baselines", key, group, ["market_segment", "route_tier", "season", "cabin", "trip_type", "distance_band"])

    metadata = {
        "model_version": "zoe-price-baseline-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "artifact_path": str(artifact_path),
        "sources_used": [str(path) for path in paths],
        "rows_processed": len(rows),
        "minimum_sample_size": min_sample_size,
        "route_baseline_count": conn.execute("select count(*) from route_baselines").fetchone()[0],
        "region_pair_baseline_count": conn.execute("select count(*) from region_pair_baselines").fetchone()[0],
        "distance_band_baseline_count": conn.execute("select count(*) from distance_band_baselines").fetchone()[0],
        "notes": "Explainable percentile baseline artifact. No Supabase required for v1.",
    }
    for key, value in metadata.items():
        conn.execute("insert into model_metadata(key, value) values (?, ?)", (key, json.dumps(value) if not isinstance(value, str) else value))
    conn.commit()
    conn.close()

    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", action="append", required=True, help="Clean/common-schema CSV. Can be passed more than once.")
    parser.add_argument("--artifact", default=str(DEFAULT_ARTIFACT_PATH))
    parser.add_argument("--metadata", default=str(DEFAULT_METADATA_PATH))
    parser.add_argument("--min-sample-size", type=int, default=3, help="Use 3 for mock/demo data; use 10+ for real data.")
    args = parser.parse_args()

    metadata = train([Path(p) for p in args.input], Path(args.artifact), Path(args.metadata), args.min_sample_size)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
