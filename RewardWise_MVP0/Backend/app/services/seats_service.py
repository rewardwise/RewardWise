import httpx
import os
from dotenv import load_dotenv

load_dotenv()

SEATS_AERO_BASE_URL = "https://seats.aero/partnerapi"

CABIN_MAP = {
    "economy": "Y",
    "premium": "W",
    "business": "J",
    "first": "F"
}

async def search_award_availability(origin: str, destination: str, date: str, cabin: str) -> list:
    api_key = os.getenv("SEATS_AERO_API_KEY")
    if not api_key:
        raise ValueError("SEATS_AERO_API_KEY is not set.")

    headers = {
        "Partner-Authorization": api_key,
        "accept": "application/json"
    }
    params = {
        "origin_airport": origin.upper(),
        "destination_airport": destination.upper(),
        "start_date": date,
        "end_date": date,
        "cabins": cabin.lower(),
        "include_trips": "true",   # ← pulls AvailabilityTrips inline, no extra call
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SEATS_AERO_BASE_URL}/search",
            headers=headers,
            params=params,
            timeout=15.0
        )
        response.raise_for_status()
        data = response.json()

    cabin_prefix = CABIN_MAP.get(cabin.lower(), "Y")
    results = []

    for avail in data.get("data", []):
        if not avail.get(f"{cabin_prefix}Available", False):
            continue

        mileage_cost = avail.get(f"{cabin_prefix}MileageCost")
        if not mileage_cost:
            continue

        # Taxes for this cabin
        taxes = avail.get(f"{cabin_prefix}TotalTaxes")
        taxes_currency = avail.get("TaxesCurrency", "USD")

        # AvailabilityTrips is a JSON string — parse it to get trip IDs
        import json as _json
        raw_trips = avail.get("AvailabilityTrips")
        trip_ids = []
        trips_detail = []
        if raw_trips:
            try:
                parsed = _json.loads(raw_trips) if isinstance(raw_trips, str) else raw_trips
                for t in (parsed if isinstance(parsed, list) else []):
                    tid = t.get("ID") or t.get("AvailabilityID")
                    if tid:
                        trip_ids.append(tid)
                    # Grab segment-level info if included inline
                    segs = t.get("AvailabilitySegments", [])
                    if segs:
                        trips_detail.append({
                            "id": tid,
                            "total_duration": t.get("TotalDuration"),
                            "stops": t.get("Stops", 0),
                            "flight_numbers": t.get("FlightNumbers", ""),
                            "departs_at": t.get("DepartsAt"),
                            "arrives_at": t.get("ArrivesAt"),
                            "segments": [
                                {
                                    "flight_number": s.get("FlightNumber"),
                                    "aircraft_name": s.get("AircraftName"),
                                    "aircraft_code": s.get("AircraftCode"),
                                    "origin": s.get("OriginAirport"),
                                    "destination": s.get("DestinationAirport"),
                                    "departs_at": s.get("DepartsAt"),
                                    "arrives_at": s.get("ArrivesAt"),
                                    "fare_class": s.get("FareClass"),
                                    "cabin": s.get("Cabin"),
                                    "distance": s.get("Distance"),
                                    "order": s.get("Order"),
                                }
                                for s in segs
                            ]
                        })
            except Exception:
                pass

        results.append({
            "program": avail.get("Source", "unknown"),
            "points": int(mileage_cost),
            "taxes": taxes,
            "taxes_currency": taxes_currency,
            "remaining_seats": avail.get(f"{cabin_prefix}RemainingSeats", 0),
            "airlines": avail.get(f"{cabin_prefix}Airlines", ""),
            "direct": avail.get(f"{cabin_prefix}Direct", False),
            "date": avail.get("Date"),
            "route": avail.get("Route", {}).get("ID") if isinstance(avail.get("Route"), dict) else f"{origin.upper()}-{destination.upper()}",
            "trip_ids": trip_ids,          # for lazy /trips/{id} fetch if needed
            "trips": trips_detail,         # segment detail if include_trips returned it
            "also_available": {
                cabin_name: {
                    "available": avail.get(f"{p}Available", False),
                    "points": avail.get(f"{p}MileageCost"),
                    "seats": avail.get(f"{p}RemainingSeats", 0),
                    "direct": avail.get(f"{p}Direct", False),
                    "taxes": avail.get(f"{p}TotalTaxes"),
                }
                for cabin_name, p in CABIN_MAP.items()
                if cabin_name != cabin.lower() and avail.get(f"{p}Available", False)
            },
            "source": "seats.aero"
        })

    return results


async def get_trip_detail(trip_id: str) -> dict:
    """Fetch full segment detail for a specific trip ID. Call this lazily on expand."""
    api_key = os.getenv("SEATS_AERO_API_KEY")
    if not api_key:
        return {}

    headers = {
        "Partner-Authorization": api_key,
        "accept": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SEATS_AERO_BASE_URL}/trips/{trip_id}",
            headers=headers,
            timeout=15.0
        )
        if response.status_code != 200:
            return {}
        data = response.json()

    trips = []
    for t in data.get("data", []):
        segs = t.get("AvailabilitySegments", [])
        trips.append({
            "id": t.get("ID"),
            "total_duration": t.get("TotalDuration"),
            "stops": t.get("Stops", 0),
            "flight_numbers": t.get("FlightNumbers", ""),
            "departs_at": t.get("DepartsAt"),
            "arrives_at": t.get("ArrivesAt"),
            "mileage_cost": t.get("MileageCost"),
            "total_taxes": t.get("TotalTaxes"),
            "taxes_currency": t.get("TaxesCurrency", "USD"),
            "segments": [
                {
                    "flight_number": s.get("FlightNumber"),
                    "aircraft_name": s.get("AircraftName"),
                    "aircraft_code": s.get("AircraftCode"),
                    "origin": s.get("OriginAirport"),
                    "destination": s.get("DestinationAirport"),
                    "departs_at": s.get("DepartsAt"),
                    "arrives_at": s.get("ArrivesAt"),
                    "fare_class": s.get("FareClass"),
                    "cabin": s.get("Cabin"),
                    "distance": s.get("Distance"),
                }
                for s in segs
            ]
        })

    return {
        "trips": trips,
        "booking_links": data.get("booking_links", []),
        "origin_coords": data.get("origin_coordinates"),
        "destination_coords": data.get("destination_coordinates"),
    }