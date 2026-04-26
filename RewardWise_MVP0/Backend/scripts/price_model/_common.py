from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from statistics import median
from typing import Any, Iterable

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AIRPORT_TIERS_PATH = BACKEND_ROOT / "training" / "external" / "airport_tiers.us.json"
DEFAULT_AIRPORT_METADATA_PATH = BACKEND_ROOT / "app" / "data" / "airport_metadata.json"
DEFAULT_ARTIFACT_PATH = BACKEND_ROOT / "app" / "data" / "price_model" / "route_price_baselines.sqlite"
DEFAULT_METADATA_PATH = BACKEND_ROOT / "app" / "data" / "price_model" / "route_price_model_metadata.json"

IATA_RE = re.compile(r"^[A-Z0-9]{3}$")

SEASON_BY_MONTH = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "fall", 10: "fall", 11: "fall",
}

DISTANCE_BANDS = [
    (0, 250, "0-250"),
    (250, 500, "250-500"),
    (500, 750, "500-750"),
    (750, 1000, "750-1000"),
    (1000, 1500, "1000-1500"),
    (1500, 2500, "1500-2500"),
    (2500, 99999, "2500+"),
]

REGION_BY_STATE = {
    "CT": "northeast", "DC": "northeast", "DE": "northeast", "MA": "northeast", "MD": "northeast", "ME": "northeast", "NH": "northeast", "NJ": "northeast", "NY": "northeast", "PA": "northeast", "RI": "northeast", "VT": "northeast",
    "AL": "southeast", "AR": "southeast", "FL": "southeast", "GA": "southeast", "KY": "southeast", "LA": "southeast", "MS": "southeast", "NC": "southeast", "SC": "southeast", "TN": "southeast", "VA": "southeast", "WV": "southeast",
    "IL": "midwest", "IN": "midwest", "IA": "midwest", "KS": "midwest", "MI": "midwest", "MN": "midwest", "MO": "midwest", "NE": "midwest", "ND": "midwest", "OH": "midwest", "SD": "midwest", "WI": "midwest",
    "OK": "south_central", "TX": "south_central",
    "AZ": "mountain", "CO": "mountain", "ID": "mountain", "MT": "mountain", "NM": "mountain", "NV": "mountain", "UT": "mountain", "WY": "mountain",
    "AK": "pacific", "HI": "pacific",
    "CA": "west", "OR": "west", "WA": "west",
}

@dataclass(frozen=True)
class AirportInfo:
    iata: str
    tier: str
    region: str
    country_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None


def normalize_iata(value: Any) -> str | None:
    code = str(value or "").strip().upper()
    if not IATA_RE.match(code):
        return None
    return code


def parse_date(value: Any) -> date | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def season_for_date(value: Any) -> str:
    parsed = parse_date(value)
    if not parsed:
        return "unknown"
    return SEASON_BY_MONTH[parsed.month]


def distance_band(distance: float | int | None) -> str:
    if distance is None:
        return "unknown"
    try:
        miles = float(distance)
    except (TypeError, ValueError):
        return "unknown"
    for low, high, label in DISTANCE_BANDS:
        if low <= miles < high:
            return label
    return "unknown"


def route_key(origin: str, destination: str) -> str:
    return f"{origin.upper()}-{destination.upper()}"


def route_tier(origin_tier: str, destination_tier: str) -> str:
    pair = {origin_tier, destination_tier}
    if pair == {"hub"}:
        return "hub_to_hub"
    if pair == {"hub", "major"}:
        return "hub_to_major"
    if pair == {"major"}:
        return "major_to_major"
    if "hub" in pair and "regional" in pair:
        return "hub_to_regional"
    if "major" in pair and "regional" in pair:
        return "major_to_regional"
    if pair == {"regional"}:
        return "regional_to_regional"
    return "unknown"


def confidence_for_sample_size(n: int) -> str:
    if n < 10:
        return "insufficient"
    if n < 50:
        return "low"
    if n < 200:
        return "medium"
    return "high"


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    pos = (len(ordered) - 1) * q
    lower = math.floor(pos)
    upper = math.ceil(pos)
    if lower == upper:
        return float(ordered[int(pos)])
    low_value = ordered[lower]
    high_value = ordered[upper]
    return float(low_value + (high_value - low_value) * (pos - lower))


def summarize(values: list[float]) -> dict[str, Any]:
    clean = sorted(float(v) for v in values if v is not None and float(v) >= 0)
    n = len(clean)
    return {
        "sample_size": n,
        "p25": percentile(clean, 0.25),
        "median": float(median(clean)) if clean else None,
        "p75": percentile(clean, 0.75),
        "p90": percentile(clean, 0.90),
        "confidence": confidence_for_sample_size(n),
    }


def load_airport_tiers(path: Path = DEFAULT_AIRPORT_TIERS_PATH) -> dict[str, AirportInfo]:
    raw = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    hubs = set(raw.get("hubs", []))
    majors = set(raw.get("majors", []))
    region_map: dict[str, str] = {}
    for region, codes in raw.get("regions", {}).items():
        for code in codes:
            region_map[code.upper()] = region
    airports: dict[str, AirportInfo] = {}
    for code in hubs | majors | set(region_map):
        tier = "hub" if code in hubs else "major" if code in majors else "regional"
        airports[code] = AirportInfo(iata=code, tier=tier, region=region_map.get(code, "unknown"), country_code="US")
    return airports


def _region_from_metadata_row(row: dict[str, Any]) -> str:
    region_code = str(row.get("region_code") or "").upper()
    state = region_code.split("-")[-1] if "-" in region_code else ""
    return REGION_BY_STATE.get(state, "unknown")


def load_airport_metadata(path: Path = DEFAULT_AIRPORT_METADATA_PATH) -> dict[str, AirportInfo]:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("airports", []) if isinstance(payload, dict) else []
    airports: dict[str, AirportInfo] = {}
    for row in rows:
        code = normalize_iata(row.get("iata"))
        if not code:
            continue
        airports[code] = AirportInfo(
            iata=code,
            tier="regional",
            region=_region_from_metadata_row(row),
            country_code=row.get("country_code"),
            latitude=float(row["latitude"]) if row.get("latitude") not in (None, "") else None,
            longitude=float(row["longitude"]) if row.get("longitude") not in (None, "") else None,
        )
    return airports


def merged_airport_info() -> dict[str, AirportInfo]:
    metadata = load_airport_metadata()
    tiered = load_airport_tiers()
    merged = dict(metadata)
    for code, info in tiered.items():
        base = merged.get(code)
        merged[code] = AirportInfo(
            iata=code,
            tier=info.tier,
            region=info.region if info.region != "unknown" else (base.region if base else "unknown"),
            country_code=base.country_code if base else info.country_code,
            latitude=base.latitude if base else None,
            longitude=base.longitude if base else None,
        )
    return merged


def haversine_miles(a: AirportInfo | None, b: AirportInfo | None) -> float | None:
    if not a or not b or a.latitude is None or a.longitude is None or b.latitude is None or b.longitude is None:
        return None
    radius = 3958.8
    lat1, lon1, lat2, lon2 = map(math.radians, [a.latitude, a.longitude, b.latitude, b.longitude])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(h))


def read_csv_rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)
