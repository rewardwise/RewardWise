import httpx
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

SERPAPI_BASE_URL = "https://serpapi.com/search"

CABIN_CLASS_MAP = {
    "economy": 1,
    "premium_economy": 2,
    "business": 3,
    "first": 4,
}


def _parse_legs(flights_list: list) -> list:
    """Parse a list of SerpAPI leg objects into our standard leg format."""
    return [
        {
            "flight_number":    leg.get("flight_number"),
            "airline":          leg.get("airline"),
            "airline_logo":     leg.get("airline_logo"),
            "airplane":         leg.get("airplane"),
            "travel_class":     leg.get("travel_class"),
            "legroom":          leg.get("legroom"),
            "duration":         leg.get("duration"),          # minutes
            "departure_airport": leg.get("departure_airport", {}).get("name"),
            "departure_iata":   leg.get("departure_airport", {}).get("id"),
            "departure_time":   leg.get("departure_airport", {}).get("time"),
            "arrival_airport":  leg.get("arrival_airport", {}).get("name"),
            "arrival_iata":     leg.get("arrival_airport", {}).get("id"),
            "arrival_time":     leg.get("arrival_airport", {}).get("time"),
            "overnight":        leg.get("overnight", False),
            "often_delayed":    leg.get("often_delayed_by_over_30_min", False),
        }
        for leg in flights_list
    ]


def _parse_flight(f: dict) -> dict:
    """
    Parse a SerpAPI flight object (one round-trip itinerary).

    Outbound legs live in f['flights'].
    Return legs live in f['return_flight']['flights'] (present for round-trips).
    """
    outbound_legs_raw = f.get("flights", [])
    first_leg = outbound_legs_raw[0] if outbound_legs_raw else {}
    last_leg  = outbound_legs_raw[-1] if outbound_legs_raw else {}

    outbound_legs = _parse_legs(outbound_legs_raw)

    # ── Return leg (round-trip only) ──────────────────────────────────────
    return_flight_raw = f.get("return_flight", {})
    return_legs_raw   = return_flight_raw.get("flights", [])
    return_legs       = _parse_legs(return_legs_raw) if return_legs_raw else []

    ret_first = return_legs_raw[0]  if return_legs_raw else {}
    ret_last  = return_legs_raw[-1] if return_legs_raw else {}

    return_info = None
    if return_legs:
        return_info = {
            "departure_airport": ret_first.get("departure_airport", {}).get("name"),
            "departure_iata":    ret_first.get("departure_airport", {}).get("id"),
            "departure_time":    ret_first.get("departure_airport", {}).get("time"),
            "arrival_airport":   ret_last.get("arrival_airport", {}).get("name"),
            "arrival_iata":      ret_last.get("arrival_airport", {}).get("id"),
            "arrival_time":      ret_last.get("arrival_airport", {}).get("time"),
            "total_duration":    return_flight_raw.get("total_duration"),
            "stops":             len(return_legs) - 1,
            "legs":              return_legs,
        }

    return {
        "price":             f.get("price"),
        "total_duration":    f.get("total_duration"),         # outbound minutes
        "carbon_emissions":  f.get("carbon_emissions", {}).get("this_flight"),
        # Outbound
        "departure_airport": first_leg.get("departure_airport", {}).get("name"),
        "departure_iata":    first_leg.get("departure_airport", {}).get("id"),
        "departure_time":    first_leg.get("departure_airport", {}).get("time"),
        "arrival_airport":   last_leg.get("arrival_airport", {}).get("name"),
        "arrival_iata":      last_leg.get("arrival_airport", {}).get("id"),
        "arrival_time":      last_leg.get("arrival_airport", {}).get("time"),
        "stops":             len(outbound_legs) - 1,
        "legs":              outbound_legs,
        # Return (None for one-way)
        "return_flight":     return_info,
    }


async def get_cash_price(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
) -> dict:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return {"cash_price": None, "currency": "USD", "source": "google_flights", "flights": []}

    is_roundtrip = return_date is not None

    params = {
        "engine":        "google_flights",
        "departure_id":  origin.upper(),
        "arrival_id":    destination.upper(),
        "outbound_date": date,
        "type":          "1" if is_roundtrip else "2",   # 1=round-trip, 2=one-way
        "travel_class":  CABIN_CLASS_MAP.get(cabin.lower(), 1),
        "adults":        travelers,
        "currency":      "USD",
        "hl":            "en",
        "api_key":       api_key,
    }
    if is_roundtrip:
        params["return_date"] = return_date

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(SERPAPI_BASE_URL, params=params, timeout=15.0)
            response.raise_for_status()
            data = response.json()

        best  = data.get("best_flights",  [])
        other = data.get("other_flights", [])
        all_flights = best + other

        if not all_flights:
            return {"cash_price": None, "currency": "USD", "source": "google_flights", "flights": []}

        sorted_flights = sorted(all_flights, key=lambda f: f.get("price", float("inf")))
        top_flights    = [_parse_flight(f) for f in sorted_flights[:5]]
        lowest_price   = top_flights[0]["price"] if top_flights else None

        price_insights = data.get("price_insights", {})
        if not lowest_price and price_insights.get("lowest_price"):
            lowest_price = price_insights["lowest_price"]

        return {
            "cash_price":          lowest_price,
            "currency":            "USD",
            "source":              "google_flights",
            "flights":             top_flights,
            "price_level":         price_insights.get("price_level"),
            "typical_price_range": price_insights.get("typical_price_range"),
            "is_roundtrip":        is_roundtrip,
        }

    except Exception as e:
        return {
            "cash_price": None,
            "currency":   "USD",
            "source":     "google_flights",
            "flights":    [],
            "error":      str(e),
        }