#!/usr/bin/env python3
"""Clean BTS DB1B/OD10 .asc files into Zoe's common training schema.

BTS OD10/DB1B public files are pipe-delimited .asc files without headers.
This cleaner streams files line-by-line so large 500MB+ files do not need to be
loaded into memory.

Observed structure from BTS .asc rows:
  fare | ticketing_carrier | yearquarter | coupon_count | ... | coupon groups...

For a one-coupon itinerary, the observed fields line up like:
  index 5  = origin airport
  index 15 = coupon distance
  index 16 = destination airport

For multi-coupon itineraries, this cleaner uses:
  origin = first coupon origin
  destination = last coupon destination
  distance = sum of coupon distances when available

Important:
  This file intentionally does NOT filter to U.S.-domestic airports during raw
  import. Some airport tier metadata files have different shapes, and filtering
  too early can accidentally drop everything. Domestic/market filtering should
  happen later in route feature generation and training rules.

Output schema matches 05_train_price_baselines.py:
  source, origin, destination, fare, departure_date, search_date, cabin,
  trip_type, distance, passengers, carrier_largest, fare_largest,
  carrier_lowest, fare_lowest
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Iterable


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

COUPON_START_INDEX = 5
COUPON_WIDTH = 16
ORIGIN_OFFSET = 0
DISTANCE_OFFSET = 10
DESTINATION_OFFSET = 11

IATA_RE = re.compile(r"^[A-Z0-9]{3}$")


def clean_iata(value: str | None) -> str | None:
    code = str(value or "").strip().upper()
    if IATA_RE.match(code):
        return code
    return None


def clean_float(value: str | None) -> float | None:
    text = str(value or "").strip().replace("$", "").replace(",", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if number < 0:
        return None
    return number


def yearquarter_to_departure_date(value: str | None) -> str:
    """Convert values like 20191 into representative YYYY-MM-DD dates."""
    text = str(value or "").strip()
    if len(text) < 5:
        return ""

    try:
        year = int(text[:4])
        quarter = int(text[4])
    except ValueError:
        return ""

    month_by_quarter = {
        1: 2,
        2: 5,
        3: 8,
        4: 11,
    }
    month = month_by_quarter.get(quarter)
    if not month:
        return ""

    return f"{year:04d}-{month:02d}-15"


def iter_asc_files(input_path: Path) -> Iterable[Path]:
    if input_path.is_file():
        yield input_path
        return

    yield from sorted(input_path.rglob("*.asc"))


def parse_record(parts: list[str]) -> dict[str, str] | None:
    if len(parts) < 21:
        return None

    fare = clean_float(parts[0])
    if fare is None or fare <= 0:
        return None

    yearquarter = parts[2] if len(parts) > 2 else ""
    departure_date = yearquarter_to_departure_date(yearquarter)
    if not departure_date:
        return None

    try:
        coupon_count = int(float(parts[3]))
    except ValueError:
        coupon_count = 1

    if coupon_count <= 0:
        coupon_count = 1

    origin_index = COUPON_START_INDEX + ORIGIN_OFFSET
    final_coupon_start = COUPON_START_INDEX + ((coupon_count - 1) * COUPON_WIDTH)
    destination_index = final_coupon_start + DESTINATION_OFFSET

    if origin_index >= len(parts) or destination_index >= len(parts):
        return None

    origin = clean_iata(parts[origin_index])
    destination = clean_iata(parts[destination_index])

    if not origin or not destination or origin == destination:
        return None

    distances: list[float] = []
    for coupon_number in range(coupon_count):
        start = COUPON_START_INDEX + coupon_number * COUPON_WIDTH
        distance_index = start + DISTANCE_OFFSET
        if distance_index < len(parts):
            distance = clean_float(parts[distance_index])
            if distance is not None:
                distances.append(distance)

    total_distance = sum(distances) if distances else None
    carrier = str(parts[1] if len(parts) > 1 else "").strip().upper()

    return {
        "source": "bts_od10_db1b_asc",
        "origin": origin,
        "destination": destination,
        "fare": f"{fare:.2f}",
        "departure_date": departure_date,
        "search_date": "",
        "cabin": "economy",
        "trip_type": "roundtrip",
        "distance": f"{total_distance:.2f}" if total_distance is not None else "",
        "passengers": "1",
        "carrier_largest": carrier,
        "fare_largest": "",
        "carrier_lowest": "",
        "fare_lowest": "",
    }


def clean(input_path: Path, output_path: Path, max_files: int | None) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    files = list(iter_asc_files(input_path))
    if max_files is not None:
        files = files[:max_files]

    if not files:
        raise FileNotFoundError(f"No .asc files found under {input_path}")

    written = 0
    skipped = 0

    with output_path.open("w", encoding="utf-8", newline="") as dest:
        writer = csv.DictWriter(dest, fieldnames=OUTPUT_FIELDNAMES)
        writer.writeheader()

        for file_index, asc_file in enumerate(files, start=1):
            print(f"[{file_index}/{len(files)}] Cleaning {asc_file}")
            with asc_file.open("r", encoding="utf-8", errors="ignore", newline="") as source:
                for line in source:
                    line = line.strip()
                    if not line:
                        continue

                    parsed = parse_record(line.split("|"))

                    if parsed is None:
                        skipped += 1
                        continue

                    writer.writerow(parsed)
                    written += 1

    print(f"Wrote {written} cleaned BTS OD10 rows to {output_path}")
    print(f"Skipped {skipped} rows")

    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="A .asc file or a folder containing .asc files")
    parser.add_argument("--output", default="training/processed/cleaned_bts_od10_asc.csv")
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Optional safety limit for testing on the first N .asc files",
    )
    args = parser.parse_args()

    clean(
        input_path=Path(args.input),
        output_path=Path(args.output),
        max_files=args.max_files,
    )


if __name__ == "__main__":
    main()
