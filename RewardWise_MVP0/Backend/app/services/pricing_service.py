import httpx
import os
from dotenv import load_dotenv

load_dotenv()

SERPAPI_BASE_URL = "https://serpapi.com/search"

CABIN_CLASS_MAP = {
    "economy": 1,
    "premium": 2,
    "business": 3,
    "first": 4
}

def _parse_flight(f: dict) -> dict:
    """Extract rich details from a single SerpAPI flight object."""
    flights = f.get("flights", [])
    first_leg = flights[0] if flights else {}
    last_leg = flights[-1] if flights else {}

    return {
        "price": f.get("price"),
        "total_duration": f.get("total_duration"),  # minutes
        "carbon_emissions": f.get("carbon_emissions", {}).get("this_flight"),
        "departure_airport": first_leg.get("departure_airport", {}).get("name"),
        "departure_iata": first_leg.get("departure_airport", {}).get("id"),
        "departure_time": first_leg.get("departure_airport", {}).get("time"),
        "arrival_airport": last_leg.get("arrival_airport", {}).get("name"),
        "arrival_iata": last_leg.get("arrival_airport", {}).get("id"),
        "arrival_time": last_leg.get("arrival_airport", {}).get("time"),
        "stops": len(flights) - 1,
        "legs": [
            {
                "flight_number": leg.get("flight_number"),
                "airline": leg.get("airline"),
                "airline_logo": leg.get("airline_logo"),
                "airplane": leg.get("airplane"),
                "travel_class": leg.get("travel_class"),
                "legroom": leg.get("legroom"),
                "duration": leg.get("duration"),  # minutes
                "departure_airport": leg.get("departure_airport", {}).get("name"),
                "departure_iata": leg.get("departure_airport", {}).get("id"),
                "departure_time": leg.get("departure_airport", {}).get("time"),
                "arrival_airport": leg.get("arrival_airport", {}).get("name"),
                "arrival_iata": leg.get("arrival_airport", {}).get("id"),
                "arrival_time": leg.get("arrival_airport", {}).get("time"),
                "extensions": leg.get("extensions", []),
                "overnight": leg.get("overnight", False),
                "often_delayed": leg.get("often_delayed_by_over_30_min", False),
            }
            for leg in flights
        ],
    }

async def get_cash_price(origin: str, destination: str, date: str, cabin: str) -> dict:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return {"cash_price": None, "currency": "USD", "source": "google_flights", "flights": []}

    params = {
        "engine": "google_flights",
        "departure_id": origin.upper(),
        "arrival_id": destination.upper(),
        "outbound_date": date,
        "type": "2",  # one-way
        "travel_class": CABIN_CLASS_MAP.get(cabin.lower(), 1),
        "currency": "USD",
        "hl": "en",
        "api_key": api_key
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(SERPAPI_BASE_URL, params=params, timeout=15.0)
            response.raise_for_status()
            data = response.json()

        best = data.get("best_flights", [])
        other = data.get("other_flights", [])
        all_flights = best + other

        if not all_flights:
            return {"cash_price": None, "currency": "USD", "source": "google_flights", "flights": []}

        # Sort by price, take top 5
        sorted_flights = sorted(all_flights, key=lambda f: f.get("price", float("inf")))
        top_flights = [_parse_flight(f) for f in sorted_flights[:5]]
        lowest_price = top_flights[0]["price"] if top_flights else None

        # Cheapest from price_insights as fallback
        price_insights = data.get("price_insights", {})
        if not lowest_price and price_insights.get("lowest_price"):
            lowest_price = price_insights["lowest_price"]

        return {
            "cash_price": lowest_price,
            "currency": "USD",
            "source": "google_flights",
            "flights": top_flights,
            "price_level": price_insights.get("price_level"),       # "low", "typical", "high"
            "typical_price_range": price_insights.get("typical_price_range"),  # [min, max]
        }

    except Exception as e:
        return {"cash_price": None, "currency": "USD", "source": "google_flights", "flights": [], "error": str(e)}