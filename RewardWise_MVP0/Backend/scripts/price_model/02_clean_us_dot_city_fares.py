#!/usr/bin/env python3
"""Clean city-pair U.S. DOT airfare data into Zoe's common training schema.

This cleaner is for files with columns like:
- origin_city
- destination_city
- avg_fare
- year
- quarter
- distance_miles
- passengers

Because this source is city/metro-level, it maps each city market to one
representative airport code. That is imperfect, but useful for broad baseline
training when tagged with a distinct source.
"""
from __future__ import annotations

import argparse
import csv
import re
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


CITY_TO_IATA = {
    # Major hubs / metros
    "atlanta, ga": "ATL",
    "boston, ma": "BOS",
    "charlotte, nc": "CLT",
    "chicago, il": "ORD",
    "dallas/fort worth, tx": "DFW",
    "denver, co": "DEN",
    "detroit, mi": "DTW",
    "houston, tx": "IAH",
    "las vegas, nv": "LAS",
    "los angeles, ca": "LAX",
    "miami, fl": "MIA",
    "minneapolis/st. paul, mn": "MSP",
    "new york city, ny": "JFK",
    "newark, nj": "EWR",
    "orlando, fl": "MCO",
    "philadelphia, pa": "PHL",
    "phoenix, az": "PHX",
    "salt lake city, ut": "SLC",
    "san francisco, ca": "SFO",
    "seattle, wa": "SEA",
    "washington, dc": "DCA",

    # Common major / regional markets
    "albuquerque, nm": "ABQ",
    "allentown/bethlehem/easton, pa": "ABE",
    "anchorage, ak": "ANC",
    "asheville, nc": "AVL",
    "austin, tx": "AUS",
    "baltimore, md": "BWI",
    "birmingham, al": "BHM",
    "boise, id": "BOI",
    "buffalo, ny": "BUF",
    "burbank, ca": "BUR",
    "burlington, vt": "BTV",
    "charleston, sc": "CHS",
    "cincinnati, oh": "CVG",
    "cleveland, oh": "CLE",
    "columbus, oh": "CMH",
    "dayton, oh": "DAY",
    "des moines, ia": "DSM",
    "el paso, tx": "ELP",
    "fresno, ca": "FAT",
    "fort lauderdale, fl": "FLL",
    "fort myers, fl": "RSW",
    "grand rapids, mi": "GRR",
    "greensboro/high point, nc": "GSO",
    "greenville/spartanburg, sc": "GSP",
    "hartford, ct": "BDL",
    "honolulu, hi": "HNL",
    "indianapolis, in": "IND",
    "jacksonville, fl": "JAX",
    "kansas city, mo": "MCI",
    "knoxville, tn": "TYS",
    "little rock, ar": "LIT",
    "louisville, ky": "SDF",
    "memphis, tn": "MEM",
    "milwaukee, wi": "MKE",
    "myrtle beach, sc": "MYR",
    "nashville, tn": "BNA",
    "new orleans, la": "MSY",
    "norfolk, va": "ORF",
    "oakland, ca": "OAK",
    "oklahoma city, ok": "OKC",
    "omaha, ne": "OMA",
    "ontario, ca": "ONT",
    "palm springs, ca": "PSP",
    "pensacola, fl": "PNS",
    "pittsburgh, pa": "PIT",
    "portland, or": "PDX",
    "providence, ri": "PVD",
    "raleigh/durham, nc": "RDU",
    "reno, nv": "RNO",
    "richmond, va": "RIC",
    "rochester, ny": "ROC",
    "sacramento, ca": "SMF",
    "san antonio, tx": "SAT",
    "san diego, ca": "SAN",
    "san jose, ca": "SJC",
    "santa ana, ca": "SNA",
    "savannah, ga": "SAV",
    "spokane, wa": "GEG",
    "st. louis, mo": "STL",
    "syracuse, ny": "SYR",
    "tampa, fl": "TPA",
    "tucson, az": "TUS",
    "tulsa, ok": "TUL",
    "west palm beach/palm beach, fl": "PBI",
}


def normalize_city(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s*\(metropolitan area\)\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text)
    return text


def city_to_iata(value: Any) -> str | None:
    normalized = normalize_city(value)
    return CITY_TO_IATA.get(normalized)


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
    try:
        year = int(float(str(year_value).strip()))
        quarter = int(float(str(quarter_value).strip()))
    except (TypeError, ValueError):
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


def clean(input_path: Path, output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    skipped = 0
    unmapped: dict[str, int] = {}

    with input_path.open("r", encoding="utf-8-sig", newline="") as source, output_path.open(
        "w", encoding="utf-8", newline=""
    ) as dest:
        reader = csv.DictReader(source)
        writer = csv.DictWriter(dest, fieldnames=OUTPUT_FIELDNAMES)
        writer.writeheader()

        for row in reader:
            origin = city_to_iata(row.get("origin_city"))
            destination = city_to_iata(row.get("destination_city"))
            fare = clean_float(row.get("avg_fare"))
            distance = clean_float(row.get("distance_miles"))

            if not origin:
                key = normalize_city(row.get("origin_city"))
                unmapped[key] = unmapped.get(key, 0) + 1
            if not destination:
                key = normalize_city(row.get("destination_city"))
                unmapped[key] = unmapped.get(key, 0) + 1

            if not origin or not destination or origin == destination or fare is None:
                skipped += 1
                continue

            writer.writerow(
                {
                    "source": "kaggle_us_dot_city_airfare_2008_2025",
                    "origin": origin,
                    "destination": destination,
                    "fare": fare,
                    "departure_date": quarter_to_departure_date(row.get("year"), row.get("quarter")),
                    "search_date": "",
                    "cabin": "economy",
                    "trip_type": "roundtrip",
                    "distance": distance or "",
                    "passengers": clean_int(row.get("passengers")),
                    "carrier_largest": str(row.get("largest_carrier") or "").strip().upper(),
                    "fare_largest": clean_float(row.get("largest_carrier_fare")) or "",
                    "carrier_lowest": str(row.get("lowest_fare_carrier") or "").strip().upper(),
                    "fare_lowest": clean_float(row.get("lowest_fare")) or "",
                }
            )
            written += 1

    print(f"Wrote {written} cleaned U.S. DOT city-fare rows to {output_path}")
    if skipped:
        print(f"Skipped {skipped} rows with missing/invalid mapped cities or fare")

    if unmapped:
        top_unmapped = sorted(unmapped.items(), key=lambda item: item[1], reverse=True)[:30]
        print("Top unmapped city markets:")
        for city, count in top_unmapped:
            print(f"  {city}: {count}")

    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="training/processed/cleaned_us_dot_city_2008_2025.csv")
    args = parser.parse_args()

    clean(Path(args.input), Path(args.output))


if __name__ == "__main__":
    main()