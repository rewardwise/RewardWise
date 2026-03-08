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
        raise ValueError("SEATS_AERO_API_KEY is not set. Check your .env file.")

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

        results.append({
            "program": avail.get("Source", "unknown"),
            "points": int(mileage_cost),
            "remaining_seats": avail.get(f"{cabin_prefix}RemainingSeats", 0),
            "airlines": avail.get(f"{cabin_prefix}Airlines", ""),
            "direct": avail.get(f"{cabin_prefix}Direct", False),
            "date": avail.get("Date"),
            "source": "seats.aero"
        })

    return results