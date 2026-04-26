#!/usr/bin/env python3
"""Clean Kaggle Expedia Flight Prices CSV into Zoe's common training schema."""
from __future__ import annotations

import argparse
import csv
from pathlib import Path


def clean(input_path: Path, output_path: Path, max_rows: int | None = None) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with input_path.open("r", encoding="utf-8-sig", newline="") as source, output_path.open("w", encoding="utf-8", newline="") as dest:
        reader = csv.DictReader(source)
        fieldnames = ["source", "origin", "destination", "fare", "departure_date", "search_date", "cabin", "trip_type", "distance"]
        writer = csv.DictWriter(dest, fieldnames=fieldnames)
        writer.writeheader()
        for row in reader:
            origin = row.get("startingAirport") or row.get("origin")
            destination = row.get("destinationAirport") or row.get("destination")
            fare = row.get("totalFare") or row.get("baseFare") or row.get("fare")
            if not origin or not destination or not fare:
                continue
            cabin = row.get("segmentsCabinCode") or row.get("cabin") or "economy"
            if isinstance(cabin, str) and "||" in cabin:
                cabin = cabin.split("||")[0]
            writer.writerow({
                "source": "expedia_kaggle",
                "origin": origin.strip().upper(),
                "destination": destination.strip().upper(),
                "fare": fare,
                "departure_date": row.get("flightDate") or row.get("departure_date") or "",
                "search_date": row.get("searchDate") or "",
                "cabin": str(cabin or "economy").strip().lower(),
                "trip_type": "oneway",
                "distance": row.get("totalTravelDistance") or row.get("distance") or "",
            })
            count += 1
            if max_rows and count >= max_rows:
                break
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="training/processed/expedia_cleaned.csv")
    parser.add_argument("--max-rows", type=int)
    args = parser.parse_args()
    count = clean(Path(args.input), Path(args.output), args.max_rows)
    print(f"Wrote {count} cleaned Expedia rows to {args.output}")


if __name__ == "__main__":
    main()
