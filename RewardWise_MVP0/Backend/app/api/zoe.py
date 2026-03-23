from app.services.seats_service import search_award_availability
from app.services.pricing_service import get_cash_price
from app.services.verdict_service import generate_verdict
from app.services.llm import parse_trip


async def handle_zoe(message: str, user_id: str):

    print("ZOE INPUT:", message)

    # 1. Parse user message (LLM)
    parsed = await parse_trip(message)

    print("ZOE PARSED:", parsed)

    if not parsed:
        return {"error": "Could not understand request"}

    # 2. Normalize to DB schema
    trip = {
        "origin": parsed.get("origin"),
        "destination": parsed.get("destination"),
        "departure_date": parsed.get("date"),
        "return_date": parsed.get("return_date"),
        "passengers": parsed.get("travelers", 1),
        "cabin": (parsed.get("cabin") or "economy").lower(),
    }

    print("ZOE NORMALIZED:", trip)

    # 3. Validate required fields
    if not trip["origin"] or not trip["destination"]:
        return {"error": "Missing origin or destination", "trip": trip}

    # 4. Defaults
    if not trip["departure_date"]:
        trip["departure_date"] = "2026-03-15"

    if not trip["passengers"]:
        trip["passengers"] = 1

    if not trip["cabin"]:
        trip["cabin"] = "economy"

    # 5. Search flights (award availability)
    try:
        flights = await search_award_availability(
            trip["origin"],
            trip["destination"],
            trip["departure_date"],
            trip["cabin"],
        )
        print("FLIGHTS RAW (before filter):", flights)
    except Exception as e:
        print("SEARCH ERROR:", str(e))
        return {"error": "Flight search failed"}

    # Filter based on seat availability
    flights = [
        f for f in flights
        if f.get("remaining_seats", 0) >= trip["passengers"]
    ]

    print("FLIGHTS AFTER FILTER:", flights)
    if not flights:
        return {
            "trip": trip,
            "message": "No flights found for this route"
        }

    # 6. Get cash price
    try:
        cash_data = await get_cash_price(
            trip["origin"],
            trip["destination"],
            trip["departure_date"],
            trip["cabin"],
            trip["passengers"],
            trip.get("return_date"),
        )
        cash_price = cash_data.get("cash_price")
    except Exception as e:
        print("PRICING ERROR:", str(e))
        cash_price = None

    # 7. Generate verdict
    verdict = await generate_verdict(
        origin=trip["origin"],
        destination=trip["destination"],
        date=trip["departure_date"],
        cabin=trip["cabin"],
        travelers=trip["passengers"],
        is_roundtrip=trip.get("return_date") is not None,
        return_date=trip.get("return_date"),
        cash_price=cash_price,
        award_options=flights,
        return_award_options=[],
        user_programs=None,
    )

    return {
        "type": "search_result",
        "trip": trip,
        "verdict": verdict,
        "flights_found": len(flights)
    }