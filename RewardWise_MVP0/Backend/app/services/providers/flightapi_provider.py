import os
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import httpx

FLIGHTAPI_BASE_URL = os.getenv("FLIGHTAPI_BASE_URL", "https://api.flightapi.io")
SKYSCANNER_BOOKING_BASE_URL = os.getenv("FLIGHTAPI_BOOKING_BASE_URL", "https://www.skyscanner.net")
DEFAULT_CURRENCY = os.getenv("FLIGHTAPI_CURRENCY", "USD")

CABIN_CLASS_MAP = {
    "economy": "Economy",
    "premium_economy": "Premium_Economy",
    "business": "Business",
    "first": "First",
}


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _resolve_keyed_entity(entities: list[dict], entity_id: Any) -> dict:
    entity_id_str = str(entity_id)
    for entity in entities or []:
        candidate_ids = {
            str(entity.get("id")),
            str(entity.get("entity_id")),
            str(entity.get("place_id")),
            str(entity.get("carrier_id")),
            str(entity.get("code")),
        }
        if entity_id_str in candidate_ids:
            return entity
    return {}


def _place_name(place: dict) -> Optional[str]:
    return (
        place.get("name")
        or place.get("airport_name")
        or place.get("display_name")
        or place.get("city_name")
        or place.get("label")
    )


def _place_iata(place: dict) -> Optional[str]:
    return (
        place.get("display_code")
        or place.get("iata")
        or place.get("iata_code")
        or place.get("code")
    )


def _carrier_name(carrier: dict) -> Optional[str]:
    return carrier.get("name") or carrier.get("display_name") or carrier.get("alternate_name")


def _carrier_logo(carrier: dict) -> Optional[str]:
    return carrier.get("logo_url") or carrier.get("image_url") or carrier.get("logo")


def _segment_to_leg(segment: dict, places: list[dict], carriers: list[dict], fare_lookup: Optional[dict[str, dict]] = None) -> dict:
    origin = _resolve_keyed_entity(places, segment.get("origin_place_id"))
    destination = _resolve_keyed_entity(places, segment.get("destination_place_id"))
    marketing_carrier = _resolve_keyed_entity(
        carriers,
        segment.get("marketing_carrier_id") or segment.get("operating_carrier_id"),
    )
    fare = (fare_lookup or {}).get(segment.get("id"), {})

    flight_number = segment.get("marketing_flight_number")
    carrier_code = marketing_carrier.get("display_code") or marketing_carrier.get("iata") or marketing_carrier.get("iata_code")
    if flight_number and carrier_code and not str(flight_number).startswith(str(carrier_code)):
        flight_number = f"{carrier_code}{flight_number}"

    return {
        "flight_number": flight_number,
        "airline": _carrier_name(marketing_carrier),
        "airline_logo": _carrier_logo(marketing_carrier),
        "airplane": segment.get("vehicle_type") or segment.get("aircraft_name") or segment.get("aircraft") or segment.get("equipment"),
        "travel_class": fare.get("fare_family") or fare.get("cabin_class") or fare.get("cabin") or segment.get("travel_class"),
        "legroom": None,
        "duration": _safe_int(segment.get("duration")),
        "departure_airport": _place_name(origin),
        "departure_iata": _place_iata(origin),
        "departure_time": segment.get("departure"),
        "arrival_airport": _place_name(destination),
        "arrival_iata": _place_iata(destination),
        "arrival_time": segment.get("arrival"),
        "overnight": False,
        "often_delayed": False,
    }


def _build_return_info(leg: dict, legs: list[dict]) -> Optional[dict]:
    if not legs:
        return None
    first_leg = legs[0]
    last_leg = legs[-1]
    return {
        "departure_airport": first_leg.get("departure_airport"),
        "departure_iata": first_leg.get("departure_iata"),
        "departure_time": first_leg.get("departure_time"),
        "arrival_airport": last_leg.get("arrival_airport"),
        "arrival_iata": last_leg.get("arrival_iata"),
        "arrival_time": last_leg.get("arrival_time"),
        "total_duration": _safe_int(leg.get("duration")),
        "stops": _safe_int(leg.get("stop_count")) if leg.get("stop_count") is not None else max(len(legs) - 1, 0),
        "legs": legs,
    }


def _pricing_option_for_itinerary(itinerary: dict) -> dict:
    options = itinerary.get("pricing_options") or []
    if options:
        return min(
            options,
            key=lambda option: _safe_float((option.get("price") or {}).get("amount")) or float("inf"),
        )
    return {}


def _normalize_deeplink(relative_url: Optional[str]) -> Optional[str]:
    if not relative_url:
        return None
    if str(relative_url).startswith("http"):
        return relative_url
    return urljoin(SKYSCANNER_BOOKING_BASE_URL, relative_url)


def _parse_itinerary(
    itinerary: dict,
    legs_by_id: dict[str, dict],
    segments_by_id: dict[str, dict],
    places: list[dict],
    carriers: list[dict],
) -> dict:
    leg_ids = itinerary.get("leg_ids") or []
    outbound_leg = legs_by_id.get(leg_ids[0], {}) if leg_ids else {}
    return_leg = legs_by_id.get(leg_ids[1], {}) if len(leg_ids) > 1 else {}

    pricing_option = _pricing_option_for_itinerary(itinerary)
    fares = ((pricing_option.get("items") or [{}])[0].get("fares") or []) if pricing_option else []
    fare_lookup = {
        fare.get("segment_id"): fare
        for fare in fares
        if fare.get("segment_id")
    }

    outbound_segments = [
        segments_by_id.get(segment_id, {})
        for segment_id in outbound_leg.get("segment_ids") or []
        if segments_by_id.get(segment_id)
    ]
    outbound_legs = [
        _segment_to_leg(segment, places, carriers, fare_lookup)
        for segment in outbound_segments
    ]

    return_segments = [
        segments_by_id.get(segment_id, {})
        for segment_id in return_leg.get("segment_ids") or []
        if segments_by_id.get(segment_id)
    ]
    return_legs = [
        _segment_to_leg(segment, places, carriers, fare_lookup)
        for segment in return_segments
    ]

    first_leg = outbound_legs[0] if outbound_legs else {}
    last_leg = outbound_legs[-1] if outbound_legs else {}

    amount = _safe_float((pricing_option.get("price") or {}).get("amount"))
    if amount is None:
        amount = _safe_float((itinerary.get("cheapest_price") or {}).get("amount"))

    return {
        "price": amount,
        "total_duration": _safe_int(outbound_leg.get("duration")),
        "carbon_emissions": None,
        "departure_airport": first_leg.get("departure_airport"),
        "departure_iata": first_leg.get("departure_iata"),
        "departure_time": first_leg.get("departure_time"),
        "arrival_airport": last_leg.get("arrival_airport"),
        "arrival_iata": last_leg.get("arrival_iata"),
        "arrival_time": last_leg.get("arrival_time"),
        "stops": _safe_int(outbound_leg.get("stop_count")) if outbound_leg.get("stop_count") is not None else max(len(outbound_legs) - 1, 0),
        "legs": outbound_legs,
        "return_flight": _build_return_info(return_leg, return_legs) if return_legs else None,
        "booking_url": _normalize_deeplink(((pricing_option.get("items") or [{}])[0].get("url")) if pricing_option else None),
        "provider": "flightapi",
    }


async def search_cash_fares(
    origin: str,
    destination: str,
    date: str,
    cabin: str,
    travelers: int = 1,
    return_date: Optional[str] = None,
) -> Dict[str, Any]:
    api_key = os.getenv("FLIGHTAPI_KEY")
    currency = os.getenv("FLIGHTAPI_CURRENCY", DEFAULT_CURRENCY)

    if not api_key:
        return {
            "cash_price": None,
            "currency": currency,
            "source": "flightapi",
            "flights": [],
            "is_roundtrip": return_date is not None,
            "error": "FLIGHTAPI_KEY is not configured.",
        }

    cabin_class = CABIN_CLASS_MAP.get((cabin or "economy").lower(), "Economy")
    endpoint = "roundtrip" if return_date else "onewaytrip"
    url_parts = [
        FLIGHTAPI_BASE_URL.rstrip("/"),
        endpoint,
        api_key,
        origin.upper(),
        destination.upper(),
        date,
    ]

    if return_date:
        url_parts.append(return_date)

    url_parts.extend([
        str(travelers),
        "0",
        "0",
        cabin_class,
        currency,
    ])

    request_url = "/".join(url_parts)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(request_url, timeout=20.0)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        return {
            "cash_price": None,
            "currency": currency,
            "source": "flightapi",
            "flights": [],
            "is_roundtrip": return_date is not None,
            "error": f"FlightAPI HTTP {exc.response.status_code}",
        }
    except Exception as exc:
        return {
            "cash_price": None,
            "currency": currency,
            "source": "flightapi",
            "flights": [],
            "is_roundtrip": return_date is not None,
            "error": str(exc),
        }

    itineraries = data.get("itineraries") or []
    legs = data.get("legs") or []
    segments = data.get("segments") or []
    places = data.get("places") or []
    carriers = data.get("carriers") or []

    legs_by_id = {leg.get("id"): leg for leg in legs if leg.get("id")}
    segments_by_id = {segment.get("id"): segment for segment in segments if segment.get("id")}

    normalized_flights = [
        _parse_itinerary(itinerary, legs_by_id, segments_by_id, places, carriers)
        for itinerary in itineraries
    ]
    normalized_flights = [f for f in normalized_flights if f.get("price") is not None]
    normalized_flights.sort(key=lambda flight: flight.get("price", float("inf")))
    top_flights = normalized_flights[:5]

    lowest_price = top_flights[0].get("price") if top_flights else None
    if lowest_price is None:
        cheapest_prices = [
            _safe_float((itinerary.get("cheapest_price") or {}).get("amount"))
            for itinerary in itineraries
        ]
        cheapest_prices = [price for price in cheapest_prices if price is not None]
        lowest_price = min(cheapest_prices) if cheapest_prices else None

    return {
        "cash_price": lowest_price,
        "currency": currency,
        "source": "flightapi",
        "flights": top_flights,
        "price_level": None,
        "typical_price_range": None,
        "is_roundtrip": return_date is not None,
    }
