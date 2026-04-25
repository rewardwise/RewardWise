#!/usr/bin/env python3
"""Build app/data/airport_metadata.json from OurAirports.

This script intentionally makes airport metadata a generated artifact instead of
hand-maintained application logic.

Run from RewardWise_MVP0/Backend:

    python scripts/build_airport_metadata.py

Optional local CSV usage:

    python scripts/build_airport_metadata.py \
      --airports-csv /path/to/airports.csv \
      --countries-csv /path/to/countries.csv \
      --regions-csv /path/to/regions.csv

The script reads app/validators/airport_codes.py as the source of codes the app
accepts, then writes app/data/airport_metadata.json with exactly one row per
unique VALID_AIRPORT_CODES entry. It fails if the output count does not match.
"""

from __future__ import annotations

import argparse
import ast
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from typing import Any
from urllib.request import urlopen


OURAIRPORTS_BASE_URL = "https://davidmegginson.github.io/ourairports-data"
AIRPORTS_URL = f"{OURAIRPORTS_BASE_URL}/airports.csv"
COUNTRIES_URL = f"{OURAIRPORTS_BASE_URL}/countries.csv"
REGIONS_URL = f"{OURAIRPORTS_BASE_URL}/regions.csv"

CONTINENT_NAMES = {
    "AF": "Africa",
    "AN": "Antarctica",
    "AS": "Asia",
    "EU": "Europe",
    "NA": "North America",
    "OC": "Oceania",
    "SA": "South America",
}


@dataclass(frozen=True)
class SourceRow:
    row: dict[str, str]
    country_name: str
    region_name: str


def backend_root() -> Path:
    return Path(__file__).resolve().parents[1]


def validator_path() -> Path:
    return backend_root() / "app" / "validators" / "airport_codes.py"


def output_path() -> Path:
    return backend_root() / "app" / "data" / "airport_metadata.json"


def load_valid_airport_codes(path: Path) -> set[str]:
    """Extract VALID_AIRPORT_CODES from the validator file without importing app code."""
    source = path.read_text(encoding="utf-8")
    module = ast.parse(source, filename=str(path))

    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "VALID_AIRPORT_CODES":
                    value = ast.literal_eval(node.value)
                    return {str(code).upper().strip() for code in value if str(code).strip()}

    raise RuntimeError(f"Could not find VALID_AIRPORT_CODES in {path}")


def read_csv_from_url(url: str) -> list[dict[str, str]]:
    with urlopen(url, timeout=60) as response:
        raw = response.read().decode("utf-8-sig")
    return list(csv.DictReader(raw.splitlines()))


def read_csv_from_path(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def load_csv(path_or_none: str | None, url: str) -> list[dict[str, str]]:
    if path_or_none:
        path = Path(path_or_none)
        if not path.exists():
            raise FileNotFoundError(f"CSV file not found: {path}")
        return read_csv_from_path(path)
    return read_csv_from_url(url)


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def safe_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normal_alias(value: Any) -> str:
    text = clean_text(value).lower()
    text = text.replace("’", "'")
    text = re.sub(r"[^a-z0-9\s']+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_keywords(value: str) -> list[str]:
    parts = []
    for item in re.split(r"[,;/|]", value or ""):
        item = clean_text(item)
        if item:
            parts.append(item)
    return parts


def unique_aliases(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        alias = normal_alias(value)
        if not alias or alias in seen:
            continue
        seen.add(alias)
        out.append(alias)
    return out


def country_lookup(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    return {clean_text(row.get("code")).upper(): row for row in rows if clean_text(row.get("code"))}


def region_lookup(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    return {clean_text(row.get("code")).upper(): row for row in rows if clean_text(row.get("code"))}


def source_priority(row: dict[str, str]) -> tuple[int, int, int, str]:
    """Choose the best row when OurAirports has duplicate IATA codes."""
    airport_type = clean_text(row.get("type"))
    type_rank = {
        "large_airport": 0,
        "medium_airport": 1,
        "small_airport": 2,
        "seaplane_base": 3,
        "heliport": 4,
        "balloonport": 5,
        "closed": 9,
    }.get(airport_type, 6)

    scheduled_rank = 0 if clean_text(row.get("scheduled_service")).lower() == "yes" else 1
    has_name_rank = 0 if clean_text(row.get("name")) else 1
    ident = clean_text(row.get("ident"))
    return (scheduled_rank, type_rank, has_name_rank, ident)


def choose_best_airport_rows(
    airports: list[dict[str, str]],
    countries: dict[str, dict[str, str]],
    regions: dict[str, dict[str, str]],
    valid_codes: set[str],
) -> tuple[dict[str, SourceRow], dict[str, int]]:
    by_code: dict[str, list[SourceRow]] = {}
    seen_with_iata = 0

    for row in airports:
        iata = clean_text(row.get("iata_code")).upper()
        if not iata or iata not in valid_codes:
            continue

        seen_with_iata += 1
        country_code = clean_text(row.get("iso_country")).upper()
        region_code = clean_text(row.get("iso_region")).upper()

        country_name = clean_text(countries.get(country_code, {}).get("name")) or country_code
        region_name = clean_text(regions.get(region_code, {}).get("name")) or region_code

        by_code.setdefault(iata, []).append(SourceRow(row=row, country_name=country_name, region_name=region_name))

    chosen: dict[str, SourceRow] = {}
    duplicate_codes = 0

    for code, rows in by_code.items():
        if len(rows) > 1:
            duplicate_codes += 1
        chosen[code] = sorted(rows, key=lambda item: source_priority(item.row))[0]

    stats = {
        "ourairports_matching_rows": seen_with_iata,
        "ourairports_unique_matching_codes": len(chosen),
        "ourairports_duplicate_iata_codes": duplicate_codes,
    }
    return chosen, stats


def build_aliases(row: dict[str, str], iata: str, city: str, region: str, country: str) -> list[str]:
    name = clean_text(row.get("name"))
    local_code = clean_text(row.get("local_code"))
    gps_code = clean_text(row.get("gps_code"))
    ident = clean_text(row.get("ident"))

    keywords = split_keywords(clean_text(row.get("keywords")))

    aliases = [
        iata,
        name,
        city,
        f"{city} airport" if city else "",
        f"{city} {iata}" if city else "",
        local_code,
        gps_code,
        ident,
    ]

    if name and city and city.lower() not in name.lower():
        aliases.append(f"{city} {name}")

    if region:
        aliases.append(region)
        if city:
            aliases.append(f"{city} {region}")

    if country and city:
        aliases.append(f"{city} {country}")

    aliases.extend(keywords)
    return unique_aliases(aliases)


def build_metadata_row(code: str, source: SourceRow | None) -> dict[str, Any]:
    if source is None:
        # Keep these honest. The resolver can still accept the code, but Zoe will
        # not pretend to know a city/name that the data source did not provide.
        return {
            "iata": code,
            "name": f"{code} Airport",
            "city": "",
            "region": "",
            "region_code": "",
            "country": "",
            "country_code": "",
            "continent": "",
            "continent_code": "",
            "latitude": None,
            "longitude": None,
            "airport_type": "",
            "scheduled_service": False,
            "ident": "",
            "gps_code": "",
            "local_code": "",
            "aliases": [code.lower()],
            "metadata_quality": "fallback_code_only",
        }

    row = source.row
    iata = code
    name = clean_text(row.get("name")) or f"{iata} Airport"
    city = clean_text(row.get("municipality"))
    region = source.region_name
    region_code = clean_text(row.get("iso_region")).upper()
    country = source.country_name
    country_code = clean_text(row.get("iso_country")).upper()
    continent_code = clean_text(row.get("continent")).upper()
    continent = CONTINENT_NAMES.get(continent_code, continent_code)
    airport_type = clean_text(row.get("type"))
    scheduled_service = clean_text(row.get("scheduled_service")).lower() == "yes"

    return {
        "iata": iata,
        "name": name,
        "city": city,
        "region": region,
        "region_code": region_code,
        "country": country,
        "country_code": country_code,
        "continent": continent,
        "continent_code": continent_code,
        "latitude": safe_float(row.get("latitude_deg")),
        "longitude": safe_float(row.get("longitude_deg")),
        "airport_type": airport_type,
        "scheduled_service": scheduled_service,
        "ident": clean_text(row.get("ident")),
        "gps_code": clean_text(row.get("gps_code")),
        "local_code": clean_text(row.get("local_code")),
        "aliases": build_aliases(row, iata, city, region, country),
        "metadata_quality": "ourairports",
    }


def validate_output(valid_codes: set[str], airports: list[dict[str, Any]]) -> dict[str, Any]:
    output_codes = [clean_text(row.get("iata")).upper() for row in airports]
    output_set = set(output_codes)

    duplicates = sorted({code for code in output_codes if output_codes.count(code) > 1})
    missing = sorted(valid_codes - output_set)
    extra = sorted(output_set - valid_codes)

    stats = {
        "validator_unique_code_count": len(valid_codes),
        "airport_metadata_count": len(airports),
        "missing_count": len(missing),
        "duplicate_count": len(duplicates),
        "extra_count": len(extra),
        "missing_codes": missing,
        "duplicate_codes": duplicates,
        "extra_codes": extra,
    }

    if stats["airport_metadata_count"] != stats["validator_unique_code_count"]:
        raise RuntimeError(
            f"Count mismatch: generated {stats['airport_metadata_count']} rows "
            f"for {stats['validator_unique_code_count']} validator codes."
        )
    if missing:
        raise RuntimeError(f"Generated metadata is missing validator codes: {missing[:25]}")
    if extra:
        raise RuntimeError(f"Generated metadata has codes not in validator: {extra[:25]}")
    if duplicates:
        raise RuntimeError(f"Generated metadata has duplicate codes: {duplicates[:25]}")

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Build airport_metadata.json from OurAirports.")
    parser.add_argument("--airports-csv", help="Optional local path to OurAirports airports.csv")
    parser.add_argument("--countries-csv", help="Optional local path to OurAirports countries.csv")
    parser.add_argument("--regions-csv", help="Optional local path to OurAirports regions.csv")
    parser.add_argument("--output", help="Optional output path. Defaults to app/data/airport_metadata.json")
    args = parser.parse_args()

    valid_codes = load_valid_airport_codes(validator_path())

    print(f"Validator unique codes: {len(valid_codes)}")
    print("Loading OurAirports CSV data...")

    airports_csv = load_csv(args.airports_csv, AIRPORTS_URL)
    countries_csv = load_csv(args.countries_csv, COUNTRIES_URL)
    regions_csv = load_csv(args.regions_csv, REGIONS_URL)

    countries = country_lookup(countries_csv)
    regions = region_lookup(regions_csv)
    chosen, source_stats = choose_best_airport_rows(airports_csv, countries, regions, valid_codes)

    airports = [build_metadata_row(code, chosen.get(code)) for code in sorted(valid_codes)]
    fallback_count = sum(1 for row in airports if row["metadata_quality"] == "fallback_code_only")

    validation = validate_output(valid_codes, airports)

    payload = {
        "schema_version": "2.0",
        "source": "OurAirports",
        "source_urls": {
            "airports": AIRPORTS_URL,
            "countries": COUNTRIES_URL,
            "regions": REGIONS_URL,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "validator_file": str(validator_path().relative_to(backend_root())),
        "validator_unique_code_count": validation["validator_unique_code_count"],
        "airport_metadata_count": validation["airport_metadata_count"],
        "missing_count": validation["missing_count"],
        "duplicate_count": validation["duplicate_count"],
        "extra_count": validation["extra_count"],
        "fallback_code_only_count": fallback_count,
        **source_stats,
        "airports": airports,
    }

    destination = Path(args.output) if args.output else output_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8")

    print(f"Generated metadata rows: {len(airports)}")
    print(f"Missing from JSON: {validation['missing_count']}")
    print(f"Duplicate JSON rows: {validation['duplicate_count']}")
    print(f"Extra JSON rows: {validation['extra_count']}")
    print(f"Fallback rows: {fallback_count}")
    print(f"OurAirports matching rows: {source_stats['ourairports_matching_rows']}")
    print(f"OurAirports unique matching codes: {source_stats['ourairports_unique_matching_codes']}")
    print(f"Wrote {destination}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"❌ Failed to build airport metadata: {exc}", file=sys.stderr)
        raise
