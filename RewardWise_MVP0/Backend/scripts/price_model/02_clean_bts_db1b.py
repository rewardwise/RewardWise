#!/usr/bin/env python3
"""Clean BTS DB1B/DB1C-style CSVs into Zoe's common training schema.

BTS export column names can vary by table/export. This cleaner accepts common
DB1BMarket-like names and writes a normalized CSV.
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path


def pick(row: dict, names: list[str]) -> str | None:
    lower = {k.lower(): k for k in row.keys()}
    for name in names:
        key = lower.get(name.lower())
        if key is not None and row.get(key) not in (None, ""):
            return row[key]
    return None


def clean(input_path: Path, output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with input_path.open("r", encoding="utf-8-sig", newline="") as source, output_path.open("w", encoding="utf-8", newline="") as dest:
        reader = csv.DictReader(source)
        fieldnames = ["source", "origin", "destination", "fare", "departure_date", "search_date", "cabin", "trip_type", "distance"]
        writer = csv.DictWriter(dest, fieldnames=fieldnames)
        writer.writeheader()
        for row in reader:
            origin = pick(row, ["Origin", "ORIGIN", "origin", "OriginAirportID", "MktOrigin", "MktOriginAirport"])
            destination = pick(row, ["Dest", "DEST", "destination", "Destination", "MktDest", "MktDestAirport"])
            fare = pick(row, ["MktFare", "market_fare", "fare", "Fare", "ItinFare", "avg_fare"])
            if not origin or not destination or not fare:
                continue
            writer.writerow({
                "source": "bts",
                "origin": str(origin).strip().upper()[:3],
                "destination": str(destination).strip().upper()[:3],
                "fare": fare,
                "departure_date": pick(row, ["FlightDate", "departure_date", "YearQuarter", "year_quarter", "Year"]),
                "search_date": "",
                "cabin": "economy",
                "trip_type": "roundtrip",
                "distance": pick(row, ["MktDistance", "distance", "Distance"]),
            })
            count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="training/processed/bts_cleaned.csv")
    args = parser.parse_args()
    count = clean(Path(args.input), Path(args.output))
    print(f"Wrote {count} cleaned BTS rows to {args.output}")


if __name__ == "__main__":
    main()
