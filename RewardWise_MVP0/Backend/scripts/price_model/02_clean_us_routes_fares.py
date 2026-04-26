#!/usr/bin/env python3
"""Clean Kaggle/BTS-style U.S. airline route fare CSVs into Zoe's common schema.

This cleaner is for datasets with columns like:
- airport_1
- airport_2
- fare
- Year
- quarter
- nsmiles
- passengers
- carrier_lg / fare_lg
- carrier_low / fare_low

It writes the common schema expected by 05_train_price_baselines.py:
source, origin, destination, fare, departure_date, search_date, cabin, trip_type, distance
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Any


OUTPUT_FIELDNAMES = [
    "source",
    "origin",
    "destination",
    "fare",
    "departure_date",
    "search_date",
    "cabin",
    "trip_type",
    "distance",
    "passengers",
    "carrier_largest",
    "fare_largest",
    "carrier_lowest",
    "fare_lowest",
]


def clean_iata(value: Any) -> str | None:
    code = str(value or "").strip().upper()
    if len(code) != 3:
        return None
    if not code.isalnum():
        return None
    return code


def clean_float(value: Any) -> str | None:
    text = str(value or "").strip().replace("$", "").replace(",", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if number < 0:
        return None
    return f"{number:.2f}"


def clean_int(value: Any) -> str:
    text = str(value or "").strip().replace(",", "")
    if not text:
        return ""
    try:
        return str(int(float(text)))
    except ValueError:
        return ""


def quarter_to_departure_date(year_value: Any, quarter_value: Any) -> str:
    """Use a representative month for the quarter.

    This dataset is quarterly aggregate fare data, not exact flight-date data.
    We use the middle month of each quarter so Zoe can still derive a season.
    """
    try:
        year = int(float(str(year_value).strip()))
        quarter = int(float(str(quarter_value).strip()))
    except (TypeError, ValueError):
        return ""

    month_by_quarter = {
        1: 2,   # winter-ish midpoint
        2: 5,   # spring midpoint
        3: 8,   # summer midpoint
        4: 11,  # fall midpoint
    }
    month = month_by_quarter.get(quarter)
    if not month:
        return ""

    return f"{year:04d}-{month:02d}-15"


def clean(input_path: Path, output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    skipped = 0

    with input_path.open("r", encoding="utf-8-sig", newline="") as source, output_path.open(
        "w", encoding="utf-8", newline=""
    ) as dest:
        reader = csv.DictReader(source)
        writer = csv.DictWriter(dest, fieldnames=OUTPUT_FIELDNAMES)
        writer.writeheader()

        for row in reader:
            origin = clean_iata(row.get("airport_1"))
            destination = clean_iata(row.get("airport_2"))
            fare = clean_float(row.get("fare"))
            distance = clean_float(row.get("nsmiles"))

            if not origin or not destination or origin == destination or fare is None:
                skipped += 1
                continue

            departure_date = quarter_to_departure_date(row.get("Year"), row.get("quarter"))

            writer.writerow(
                {
                    "source": "kaggle_us_airline_routes_fares",
                    "origin": origin,
                    "destination": destination,
                    "fare": fare,
                    "departure_date": departure_date,
                    "search_date": "",
                    "cabin": "economy",
                    "trip_type": "roundtrip",
                    "distance": distance or "",
                    "passengers": clean_int(row.get("passengers")),
                    "carrier_largest": str(row.get("carrier_lg") or "").strip().upper(),
                    "fare_largest": clean_float(row.get("fare_lg")) or "",
                    "carrier_lowest": str(row.get("carrier_low") or "").strip().upper(),
                    "fare_lowest": clean_float(row.get("fare_low")) or "",
                }
            )
            written += 1

    print(f"Wrote {written} cleaned U.S. route/fare rows to {output_path}")
    if skipped:
        print(f"Skipped {skipped} rows with missing/invalid origin, destination, or fare")

    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="training/processed/cleaned_historical_fares.csv")
    args = parser.parse_args()

    clean(Path(args.input), Path(args.output))


if __name__ == "__main__":
    main()