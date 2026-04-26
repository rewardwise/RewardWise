#!/usr/bin/env python3
"""Profile a raw airfare CSV before cleaning/training."""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def profile_csv(path: Path, sample_size: int) -> dict:
    row_count = 0
    columns: list[str] = []
    missing = Counter()
    origins = Counter()
    destinations = Counter()
    fare_values: list[float] = []

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        for row in reader:
            row_count += 1
            for col in columns:
                if row.get(col) in (None, ""):
                    missing[col] += 1
            origin = (row.get("origin") or row.get("Origin") or row.get("startingAirport") or row.get("origin_airport") or "").upper()
            dest = (row.get("destination") or row.get("Destination") or row.get("destinationAirport") or row.get("destination_airport") or "").upper()
            if len(origin) == 3:
                origins[origin] += 1
            if len(dest) == 3:
                destinations[dest] += 1
            fare = row.get("fare") or row.get("Fare") or row.get("avg_fare") or row.get("baseFare") or row.get("totalFare") or row.get("MktFare")
            try:
                value = float(str(fare).replace("$", "").replace(",", ""))
                if value >= 0:
                    fare_values.append(value)
            except (TypeError, ValueError):
                pass
            if sample_size and row_count >= sample_size:
                break

    fare_values.sort()
    def pct(q: float):
        if not fare_values:
            return None
        idx = int((len(fare_values) - 1) * q)
        return fare_values[idx]

    return {
        "path": str(path),
        "sampled_rows": row_count,
        "columns": columns,
        "missing_counts": dict(missing.most_common()),
        "top_origins": dict(origins.most_common(20)),
        "top_destinations": dict(destinations.most_common(20)),
        "fare_summary": {
            "count": len(fare_values),
            "min": fare_values[0] if fare_values else None,
            "p25": pct(0.25),
            "median": pct(0.50),
            "p75": pct(0.75),
            "p90": pct(0.90),
            "max": fare_values[-1] if fare_values else None,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="training/processed/dataset_profile.json")
    parser.add_argument("--sample-size", type=int, default=100000)
    args = parser.parse_args()
    profile = profile_csv(Path(args.input), args.sample_size)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(profile, indent=2), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
