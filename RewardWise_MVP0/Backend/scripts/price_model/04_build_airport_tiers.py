#!/usr/bin/env python3
"""Build or inspect airport tier metadata used by the price baseline model."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from scripts.price_model._common import load_airport_tiers, DEFAULT_AIRPORT_TIERS_PATH


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_AIRPORT_TIERS_PATH))
    parser.add_argument("--output", default=str(DEFAULT_AIRPORT_TIERS_PATH))
    parser.add_argument("--print-summary", action="store_true")
    args = parser.parse_args()

    path = Path(args.input)
    airports = load_airport_tiers(path)
    counts = Counter(info.tier for info in airports.values())
    region_counts = Counter(info.region for info in airports.values())
    summary = {
        "airport_count": len(airports),
        "tier_counts": dict(counts),
        "region_counts": dict(region_counts),
    }

    if args.print_summary:
        print(json.dumps(summary, indent=2))

    if Path(args.output) != path:
        payload = {
            "schema_version": "1.0",
            "generated_from": str(path),
            "summary": summary,
            "airports": {code: info.__dict__ for code, info in sorted(airports.items())},
        }
        Path(args.output).write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
