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

async def get_cash_price(origin: str, destination: str, date: str, cabin: str) -> dict:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return {"cash_price": None, "currency": "USD", "source": "google_flights"}

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

        lowest_price = None
        price_insights = data.get("price_insights", {})
        if price_insights.get("lowest_price"):
            lowest_price = price_insights["lowest_price"]
        else:
            all_flights = data.get("best_flights", []) + data.get("other_flights", [])
            if all_flights:
                lowest_price = min(f.get("price", float("inf")) for f in all_flights)
                if lowest_price == float("inf"):
                    lowest_price = None

        return {"cash_price": lowest_price, "currency": "USD", "source": "google_flights"}

    except Exception:
        return {"cash_price": None, "currency": "USD", "source": "google_flights"}