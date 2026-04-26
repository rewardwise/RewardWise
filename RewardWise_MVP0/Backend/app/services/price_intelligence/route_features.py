from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[3]
AIRPORT_METADATA_PATH = BACKEND_ROOT / "app" / "data" / "airport_metadata.json"
AIRPORT_TIERS_PATH = BACKEND_ROOT / "training" / "external" / "airport_tiers.us.json"

SEASON_BY_MONTH = {
    12: "winter", 1: "winter", 2: "winter",
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "fall", 10: "fall", 11: "fall",
}

REGION_BY_STATE = {
    "CT": "northeast", "DC": "northeast", "DE": "northeast", "MA": "northeast", "MD": "northeast", "ME": "northeast", "NH": "northeast", "NJ": "northeast", "NY": "northeast", "PA": "northeast", "RI": "northeast", "VT": "northeast",
    "AL": "southeast", "AR": "southeast", "FL": "southeast", "GA": "southeast", "KY": "southeast", "LA": "southeast", "MS": "southeast", "NC": "southeast", "SC": "southeast", "TN": "southeast", "VA": "southeast", "WV": "southeast",
    "IL": "midwest", "IN": "midwest", "IA": "midwest", "KS": "midwest", "MI": "midwest", "MN": "midwest", "MO": "midwest", "NE": "midwest", "ND": "midwest", "OH": "midwest", "SD": "midwest", "WI": "midwest",
    "OK": "south_central", "TX": "south_central",
    "AZ": "mountain", "CO": "mountain", "ID": "mountain", "MT": "mountain", "NM": "mountain", "NV": "mountain", "UT": "mountain", "WY": "mountain",
    "AK": "pacific", "HI": "pacific",
    "CA": "west", "OR": "west", "WA": "west",
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


@dataclass(frozen=True)
class AirportInfo:
    iata: str
    tier: str = "regional"
    region: str = "unknown"
    country_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@dataclass(frozen=True)
class RouteFeatures:
    route_key: str
    reverse_route_key: str
    origin: str
    destination: str
    origin_tier: str
    destination_tier: str
    route_tier: str
    market_segment: str
    season: str
    cabin: str
    trip_type: str
    origin_region: str
    destination_region: str
    distance_band: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _normalize_iata(value: str) -> str:
    return (value or "").strip().upper()


def _parse_date(value: str | date | None) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _season(value: str | date | None) -> str:
    parsed = _parse_date(value)
    if not parsed:
        return "unknown"
    return SEASON_BY_MONTH[parsed.month]


def _normalize_cabin(value: str | None) -> str:
    text = (value or "economy").strip().lower().replace(" ", "_")
    if text in {"coach", "main", "main_cabin", "basic_economy"}:
        return "economy"
    if text not in {"economy", "premium_economy", "business", "first"}:
        return "economy"
    return text


def _normalize_trip_type(value: str | None) -> str:
    text = (value or "roundtrip").strip().lower().replace("_", "")
    if text in {"oneway", "one-way", "one way"}:
        return "oneway"
    return "roundtrip"


def _region_from_metadata(row: dict[str, Any]) -> str:
    region_code = str(row.get("region_code") or "").upper()
    state = region_code.split("-")[-1] if "-" in region_code else ""
    return REGION_BY_STATE.get(state, "unknown")


@lru_cache(maxsize=1)
def load_airports() -> dict[str, AirportInfo]:
    airports: dict[str, AirportInfo] = {}
    if AIRPORT_METADATA_PATH.exists():
        try:
            payload = json.loads(AIRPORT_METADATA_PATH.read_text(encoding="utf-8"))
            for row in payload.get("airports", []):
                code = _normalize_iata(row.get("iata"))
                if len(code) != 3:
                    continue
                airports[code] = AirportInfo(
                    iata=code,
                    tier="regional",
                    region=_region_from_metadata(row),
                    country_code=row.get("country_code"),
                    latitude=float(row["latitude"]) if row.get("latitude") not in (None, "") else None,
                    longitude=float(row["longitude"]) if row.get("longitude") not in (None, "") else None,
                )
        except Exception:
            airports = {}

    if AIRPORT_TIERS_PATH.exists():
        try:
            tiers = json.loads(AIRPORT_TIERS_PATH.read_text(encoding="utf-8"))
            hubs = set(tiers.get("hubs", []))
            majors = set(tiers.get("majors", []))
            region_map = {}
            for region, codes in tiers.get("regions", {}).items():
                for code in codes:
                    region_map[_normalize_iata(code)] = region
            for code in hubs | majors | set(region_map):
                base = airports.get(code)
                tier = "hub" if code in hubs else "major" if code in majors else "regional"
                airports[code] = AirportInfo(
                    iata=code,
                    tier=tier,
                    region=region_map.get(code) or (base.region if base else "unknown"),
                    country_code=base.country_code if base else "US",
                    latitude=base.latitude if base else None,
                    longitude=base.longitude if base else None,
                )
        except Exception:
            pass

    return airports


def _route_tier(origin_tier: str, destination_tier: str) -> str:
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


def _haversine_miles(origin: AirportInfo | None, destination: AirportInfo | None) -> float | None:
    if not origin or not destination or None in (origin.latitude, origin.longitude, destination.latitude, destination.longitude):
        return None
    radius = 3958.8
    lat1, lon1, lat2, lon2 = map(math.radians, [origin.latitude, origin.longitude, destination.latitude, destination.longitude])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(h))


def _distance_band(miles: float | None) -> str:
    if miles is None:
        return "unknown"
    for low, high, label in DISTANCE_BANDS:
        if low <= miles < high:
            return label
    return "unknown"


def build_route_features(
    origin: str,
    destination: str,
    departure_date: str | date | None,
    cabin: str | None = "economy",
    trip_type: str | None = "roundtrip",
) -> RouteFeatures:
    origin_code = _normalize_iata(origin)
    destination_code = _normalize_iata(destination)
    airports = load_airports()
    origin_info = airports.get(origin_code, AirportInfo(iata=origin_code))
    destination_info = airports.get(destination_code, AirportInfo(iata=destination_code))
    miles = _haversine_miles(origin_info, destination_info)
    market_segment = "us_domestic" if origin_info.country_code == "US" and destination_info.country_code == "US" else "international_or_unknown"

    return RouteFeatures(
        route_key=f"{origin_code}-{destination_code}",
        reverse_route_key=f"{destination_code}-{origin_code}",
        origin=origin_code,
        destination=destination_code,
        origin_tier=origin_info.tier,
        destination_tier=destination_info.tier,
        route_tier=_route_tier(origin_info.tier, destination_info.tier),
        market_segment=market_segment,
        season=_season(departure_date),
        cabin=_normalize_cabin(cabin),
        trip_type=_normalize_trip_type(trip_type),
        origin_region=origin_info.region,
        destination_region=destination_info.region,
        distance_band=_distance_band(miles),
    )
