import os
from typing import Optional

import httpx

SERPAPI_BASE_URL = "https://serpapi.com/search"

CABIN_CLASS_MAP = {
    "economy": 1,
    "premium_economy": 2,
    "business": 3,
    "first": 4,
}

# SerpAPI google_flights engine 'stops' parameter: integer 0-3 per docs.
# 0/None = any (omit key, default), 1 = nonstop, 2 = <=1 stop, 3 = <=2 stops.
# Live probe deferred — validator enum at app.api.validators.MaxStops
# constrains input to these four documented strings, so SerpAPI's
# out-of-range integer behavior never reaches this map.
STOPS_MAP = {
    "any": None,
    "nonstop": 1,
    "one_or_fewer": 2,
    "two_or_fewer": 3,
}


def _empty_response(source: str = "google_flights", error: str | None = None) -> dict:
    payload = {"cash_price": None, "currency": "USD", "source": source, "flights": []}
    if error:
        payload["error"] = error
    return payload


def _parse_legs(flights_list: list) -> list:
    """Parse a list of SerpAPI leg objects into our standard leg format."""
    return [
        {
            "flight_number": leg.get("flight_number"),
            "airline": leg.get("airline"),
            "airline_logo": leg.get("airline_logo"),
            "airplane": leg.get("airplane"),
            "travel_class": leg.get("travel_class"),
            "legroom": leg.get("legroom"),
            "duration": leg.get("duration"),
            "departure_airport": leg.get("departure_airport", {}).get("name"),
            "departure_iata": leg.get("departure_airport", {}).get("id"),
            "departure_time": leg.get("departure_airport", {}).get("time"),
            "arrival_airport": leg.get("arrival_airport", {}).get("name"),
            "arrival_iata": leg.get("arrival_airport", {}).get("id"),
            "arrival_time": leg.get("arrival_airport", {}).get("time"),
            "overnight": leg.get("overnight", False),
            "often_delayed": leg.get("often_delayed_by_over_30_min", False),
        }
        for leg in flights_list
    ]


def _parse_flight(f: dict) -> dict:
    """Parse a SerpAPI flight object into our standard app flight format."""
    outbound_legs_raw = f.get("flights", [])
    first_leg = outbound_legs_raw[0] if outbound_legs_raw else {}
    last_leg = outbound_legs_raw[-1] if outbound_legs_raw else {}

    outbound_legs = _parse_legs(outbound_legs_raw)

    return_flight_raw = f.get("return_flight", {})
    return_legs_raw = return_flight_raw.get("flights", [])
    return_legs = _parse_legs(return_legs_raw) if return_legs_raw else []

    ret_first = return_legs_raw[0] if return_legs_raw else {}
    ret_last = return_legs_raw[-1] if return_legs_raw else {}

    return_info = None
    if return_legs:
        return_info = {
            "departure_airport": ret_first.get("departure_airport", {}).get("name"),
            "departure_iata": ret_first.get("departure_airport", {}).get("id"),
            "departure_time": ret_first.get("departure_airport", {}).get("time"),
            "arrival_airport": ret_last.get("arrival_airport", {}).get("name"),
            "arrival_iata": ret_last.get("arrival_airport", {}).get("id"),
            "arrival_time": ret_last.get("arrival_airport", {}).get("time"),
            "total_duration": return_flight_raw.get("total_duration"),
            "stops": len(return_legs) - 1,
            "legs": return_legs,
        }

    return {
        "price": f.get("price"),
        "total_duration": f.get("total_duration"),
        "carbon_emissions": f.get("carbon_emissions", {}).get("this_flight"),
        "departure_airport": first_leg.get("departure_airport", {}).get("name"),
        "departure_iata": first_leg.get("departure_airport", {}).get("id"),
        "departure_time": first_leg.get("departure_airport", {}).get("time"),
        "arrival_airport": last_leg.get("arrival_airport", {}).get("name"),
        "arrival_iata": last_leg.get("arrival_airport", {}).get("id"),
        "arrival_time": last_leg.get("arrival_airport", {}).get("time"),
        "stops": len(outbound_legs) - 1,
        "legs": outbound_legs,
        "return_flight": return_info,
        # Round-trip SerpAPI responses carry return legs only via a SECOND
        # request keyed by this token; kept so the frontend can lazy-fetch
        # return details on To-Flight tab click (display-only).
        "departure_token": f.get("departure_token"),
    }


def normalize_serpapi_response(
    data: dict,
    *,
    is_roundtrip: bool,
    currency: str = "USD",
) -> dict:
    """Convert SerpAPI Google Flights JSON into the app cash-price contract."""
    if not isinstance(data, dict):
        return _empty_response(source="google_flights", error="Invalid SerpAPI response")

    best = data.get("best_flights", [])
    other = data.get("other_flights", [])
    all_flights = best + other

    if not all_flights:
        price_insights = data.get("price_insights", {}) if isinstance(data.get("price_insights"), dict) else {}
        lowest_price = price_insights.get("lowest_price")
        payload = _empty_response(source="google_flights")
        payload.update({
            "cash_price": lowest_price,
            "currency": currency,
            "price_level": price_insights.get("price_level"),
            "typical_price_range": price_insights.get("typical_price_range"),
            "is_roundtrip": is_roundtrip,
        })
        return payload

    sorted_flights = sorted(all_flights, key=lambda f: f.get("price", float("inf")))
    top_flights = [_parse_flight(f) for f in sorted_flights[:5]]
    lowest_price = top_flights[0]["price"] if top_flights else None

    price_insights = data.get("price_insights", {})
    if not isinstance(price_insights, dict):
        price_insights = {}
    if not lowest_price and price_insights.get("lowest_price"):
        lowest_price = price_insights["lowest_price"]

    return {
        "cash_price": lowest_price,
        "currency": currency,
        "source": "google_flights",
        "flights": top_flights,
        "price_level": price_insights.get("price_level"),
        "typical_price_range": price_insights.get("typical_price_range"),
        "is_roundtrip": is_roundtrip,
    }


async def get_serpapi_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
    max_stops: str = "any",
) -> dict:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return _empty_response()

    is_roundtrip = return_date is not None

    params = {
        "engine": "google_flights",
        "departure_id": origin.upper(),
        "arrival_id": destination.upper(),
        "outbound_date": date,
        "type": "1" if is_roundtrip else "2",
        "travel_class": CABIN_CLASS_MAP.get((cabin or "economy").lower(), 1),
        "adults": travelers,
        "currency": "USD",
        "hl": "en",
        "api_key": api_key,
    }
    if is_roundtrip:
        params["return_date"] = return_date
    stops_int = STOPS_MAP.get(max_stops)
    if stops_int is not None:
        params["stops"] = stops_int

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(SERPAPI_BASE_URL, params=params, timeout=15.0)
            response.raise_for_status()
            data = response.json()

        return normalize_serpapi_response(data, is_roundtrip=is_roundtrip, currency="USD")

    except Exception as e:
        return _empty_response(error=str(e))

async def get_serpapi_return_flights(
    origin: str,
    destination: str,
    date: str,
    return_date: str,
    departure_token: str,
    cabin: str = "economy",
    travelers: int = 1,
) -> Optional[dict]:
    """Second SerpAPI request: returning flights for a chosen outbound.

    Google Flights only exposes return legs via a follow-up request keyed by
    the outbound's departure_token. Display-only (does not feed verdict math);
    called lazily from the To-Flight tab. Returns the cheapest returning
    option in the same shape as _parse_flight's return_info, or None.
    """
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key or not departure_token:
        return None

    params = {
        "engine": "google_flights",
        "departure_id": origin.upper(),
        "arrival_id": destination.upper(),
        "outbound_date": date,
        "return_date": return_date,
        "type": "1",
        "travel_class": CABIN_CLASS_MAP.get((cabin or "economy").lower(), 1),
        "adults": travelers,
        "currency": "USD",
        "hl": "en",
        "api_key": api_key,
        "departure_token": departure_token,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(SERPAPI_BASE_URL, params=params, timeout=15.0)
            response.raise_for_status()
            data = response.json()

        options = (data.get("best_flights") or []) + (data.get("other_flights") or [])
        if not options:
            return None
        cheapest = sorted(options, key=lambda f: f.get("price", float("inf")))[0]
        legs_raw = cheapest.get("flights", [])
        legs = _parse_legs(legs_raw)
        if not legs:
            return None
        first, last = legs_raw[0], legs_raw[-1]
        return {
            "departure_airport": first.get("departure_airport", {}).get("name"),
            "departure_iata": first.get("departure_airport", {}).get("id"),
            "departure_time": first.get("departure_airport", {}).get("time"),
            "arrival_airport": last.get("arrival_airport", {}).get("name"),
            "arrival_iata": last.get("arrival_airport", {}).get("id"),
            "arrival_time": last.get("arrival_airport", {}).get("time"),
            "total_duration": cheapest.get("total_duration"),
            "stops": len(legs) - 1,
            "legs": legs,
        }
    except Exception as e:
        print(f"SerpAPI return-flight fetch failed: {e}")
        return None
