from __future__ import annotations

from typing import Any


def _first_present(data: dict[str, Any], keys: list[str], default: Any = None) -> Any:
    for key in keys:
        if key in data and data.get(key) not in (None, ""):
            return data.get(key)
    return default


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.values())
    return []


def _index_by_id(items: Any) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    if isinstance(items, dict):
        for key, value in items.items():
            if isinstance(value, dict):
                indexed[str(value.get("id") or key)] = value
        return indexed

    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict):
                item_id = item.get("id") or item.get("key") or item.get("code")
                if item_id is not None:
                    indexed[str(item_id)] = item
    return indexed


def _money_to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = "".join(ch for ch in value if ch.isdigit() or ch == ".")
        try:
            return float(cleaned) if cleaned else None
        except ValueError:
            return None
    if isinstance(value, dict):
        for key in ("amount", "raw", "value", "price", "totalPrice"):
            result = _money_to_float(value.get(key))
            if result is not None:
                return result
    return None


def _get_place_name(place: dict[str, Any] | None, fallback_code: str | None = None) -> str | None:
    if not place:
        return fallback_code
    return _first_present(place, ["name", "displayCode", "code", "iata", "iataCode"], fallback_code)


def _get_place_code(place: dict[str, Any] | None, fallback_code: str | None = None) -> str | None:
    if not place:
        return fallback_code
    return _first_present(place, ["iata", "iataCode", "displayCode", "code", "id"], fallback_code)


def _carrier_name(carrier: dict[str, Any] | None, fallback: str | None = None) -> str | None:
    if not carrier:
        return fallback
    return _first_present(carrier, ["name", "displayCode", "code", "iata", "id"], fallback)


def _resolve_ref(ref: Any, lookup: dict[str, dict[str, Any]]) -> dict[str, Any]:
    if isinstance(ref, dict):
        return ref
    return lookup.get(str(ref), {}) if ref is not None else {}


def _duration_minutes(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            return None
    return None


def _normalize_booking_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/transport_deeplink"):
        return f"https://www.skyscanner.com{url}"
    if url.startswith("/"):
        return f"https://www.skyscanner.com{url}"
    return url


def _as_unique_strings(values: list[Any]) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []
    for value in values:
        if value is None or value == "":
            continue
        text = str(value)
        if text not in seen:
            seen.add(text)
            results.append(text)
    return results


def _normalize_segment(segment_ref: Any, lookups: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    segment = _resolve_ref(segment_ref, lookups["segments"])

    origin = _resolve_ref(
        _first_present(
            segment,
            [
                "originPlaceId",
                "origin_place_id",
                "origin",
                "originId",
                "origin_id",
                "departureAirport",
                "departure_airport",
                "from",
            ],
        ),
        lookups["places"],
    )
    destination = _resolve_ref(
        _first_present(
            segment,
            [
                "destinationPlaceId",
                "destination_place_id",
                "destination",
                "destinationId",
                "destination_id",
                "arrivalAirport",
                "arrival_airport",
                "to",
            ],
        ),
        lookups["places"],
    )
    carrier = _resolve_ref(
        _first_present(
            segment,
            [
                "marketingCarrierId",
                "marketing_carrier_id",
                "operatingCarrierId",
                "operating_carrier_id",
                "carrier",
                "airline",
            ],
        ),
        lookups["carriers"],
    )

    flight_number = _first_present(segment, ["flightNumber", "flight_number", "marketing_flight_number"])
    airline = _carrier_name(carrier, _first_present(segment, ["airline", "carrierName", "carrier_name"]))

    return {
        "flight_number": flight_number,
        "airline": airline,
        "airline_logo": _first_present(carrier, ["imageUrl", "image_url", "logoUrl", "logo_url", "logo"]),
        "airplane": _first_present(segment, ["aircraft", "airplane"]),
        "travel_class": _first_present(segment, ["cabinClass", "cabin_class", "travelClass", "travel_class", "class"]),
        "legroom": None,
        "duration": _duration_minutes(_first_present(segment, ["durationInMinutes", "duration_in_minutes", "duration", "durationMinutes", "duration_minutes"])),
        "departure_airport": _get_place_name(origin, _first_present(segment, ["origin", "departureAirport", "departure_airport"])),
        "departure_iata": _get_place_code(origin, _first_present(segment, ["origin", "departureAirport", "departure_airport"])),
        "departure_time": _first_present(segment, ["departureDateTime", "departure_date_time", "departure", "departureTime", "departure_time"]),
        "arrival_airport": _get_place_name(destination, _first_present(segment, ["destination", "arrivalAirport", "arrival_airport"])),
        "arrival_iata": _get_place_code(destination, _first_present(segment, ["destination", "arrivalAirport", "arrival_airport"])),
        "arrival_time": _first_present(segment, ["arrivalDateTime", "arrival_date_time", "arrival", "arrivalTime", "arrival_time"]),
        "marketing_carrier_id": _first_present(segment, ["marketingCarrierId", "marketing_carrier_id"]),
        "operating_carrier_id": _first_present(segment, ["operatingCarrierId", "operating_carrier_id"]),
        "mode": _first_present(segment, ["mode"]),
        "overnight": False,
        "often_delayed": False,
    }


def _normalize_leg(leg_ref: Any, lookups: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    leg = _resolve_ref(leg_ref, lookups["legs"])
    segment_refs = _as_list(_first_present(leg, ["segmentIds", "segment_ids", "segments"], []))
    segments = [_normalize_segment(segment_ref, lookups) for segment_ref in segment_refs]
    segments = [segment for segment in segments if segment]

    if not segments:
        segments = [_normalize_segment(leg, lookups)]

    first = segments[0] if segments else {}
    last = segments[-1] if segments else {}

    explicit_stops = _first_present(leg, ["stopCount", "stop_count", "stops"])
    stop_count = _duration_minutes(explicit_stops)
    if stop_count is None:
        stop_count = max(len(segments) - 1, 0)

    stop_places = []
    for stop_id in _as_list(_first_present(leg, ["stopIds", "stop_ids"], [])):
        place = _resolve_ref(stop_id, lookups["places"])
        stop_places.append({
            "id": stop_id,
            "name": _get_place_name(place, str(stop_id)),
            "iata": _get_place_code(place, str(stop_id)),
        })

    return {
        "departure_airport": first.get("departure_airport"),
        "departure_iata": first.get("departure_iata"),
        "departure_time": first.get("departure_time") or _first_present(leg, ["departure", "departureDateTime", "departure_date_time"]),
        "arrival_airport": last.get("arrival_airport"),
        "arrival_iata": last.get("arrival_iata"),
        "arrival_time": last.get("arrival_time") or _first_present(leg, ["arrival", "arrivalDateTime", "arrival_date_time"]),
        "total_duration": _duration_minutes(_first_present(leg, ["durationInMinutes", "duration_in_minutes", "duration", "durationMinutes", "duration_minutes"])),
        "stops": stop_count,
        "stop_places": stop_places,
        "marketing_carrier_ids": _as_unique_strings(_as_list(_first_present(leg, ["marketingCarrierIds", "marketing_carrier_ids", "carrier_ids"], []))),
        "operating_carrier_ids": _as_unique_strings(_as_list(_first_present(leg, ["operatingCarrierIds", "operating_carrier_ids"], []))),
        "legs": segments,
    }


def _first_item_url(option: dict[str, Any]) -> str | None:
    items = _as_list(option.get("items"))
    for item in items:
        if isinstance(item, dict):
            url = _first_present(item, ["url", "deepLink", "deep_link", "bookingUrl", "booking_url"])
            if url:
                return url
    return None


def _first_agent_name(option: dict[str, Any], agents_lookup: dict[str, dict[str, Any]]) -> str | None:
    agents = _as_list(option.get("agents"))
    if agents and isinstance(agents[0], dict):
        return _first_present(agents[0], ["name", "displayName", "display_name"])

    agent_ids = _as_list(_first_present(option, ["agentIds", "agent_ids"], []))
    if not agent_ids:
        first_item = next((item for item in _as_list(option.get("items")) if isinstance(item, dict)), None)
        if first_item:
            agent_ids = _as_list(_first_present(first_item, ["agentIds", "agent_ids", "agent_id"], []))

    for agent_id in agent_ids:
        agent = _resolve_ref(agent_id, agents_lookup)
        name = _first_present(agent, ["name", "displayName", "display_name"])
        if name:
            return name
    return None


def _extract_option_details(option: dict[str, Any], agents_lookup: dict[str, dict[str, Any]]) -> dict[str, Any]:
    items = [item for item in _as_list(option.get("items")) if isinstance(item, dict)]
    first_item = items[0] if items else {}
    fares = [fare for item in items for fare in _as_list(item.get("fares")) if isinstance(fare, dict)]

    raw_booking_url = (
        _first_present(option, ["deepLink", "deep_link", "bookingUrl", "booking_url"])
        or _first_item_url(option)
    )

    agent_ids = _as_list(_first_present(option, ["agentIds", "agent_ids"], []))
    if not agent_ids and first_item:
        agent_ids = _as_list(_first_present(first_item, ["agentIds", "agent_ids", "agent_id"], []))

    return {
        "vendor": _first_agent_name(option, agents_lookup),
        "agent_ids": _as_unique_strings(agent_ids),
        "raw_booking_url": raw_booking_url,
        "booking_url": _normalize_booking_url(raw_booking_url),
        "pricing_option_id": _first_present(option, ["id", "pricingOptionId", "pricing_option_id"]),
        "transfer_type": _first_present(option, ["transferType", "transfer_type"]),
        "score": _first_present(option, ["score"]),
        "unpriced_type": _first_present(option, ["unpricedType", "unpriced_type"]),
        "booking_proposition": _first_present(first_item, ["bookingProposition", "booking_proposition"]),
        "transfer_protection": _first_present(first_item, ["transferProtection", "transfer_protection"]),
        "max_redirect_age": _first_present(first_item, ["maxRedirectAge", "max_redirect_age"]),
        "fare_basis_codes": _as_unique_strings([_first_present(fare, ["fareBasisCode", "fare_basis_code"]) for fare in fares]),
        "booking_codes": _as_unique_strings([_first_present(fare, ["bookingCode", "booking_code"]) for fare in fares]),
        "fare_families": _as_unique_strings([_first_present(fare, ["fareFamily", "fare_family"]) for fare in fares]),
        "ticket_attributes": _as_list(first_item.get("ticket_attributes") or first_item.get("ticketAttributes")),
        "flight_attributes": _as_list(first_item.get("flight_attributes") or first_item.get("flightAttributes")),
    }


def _itinerary_price(
    itinerary: dict[str, Any],
    agents_lookup: dict[str, dict[str, Any]],
) -> tuple[float | None, dict[str, Any]]:
    options = _as_list(_first_present(itinerary, ["pricingOptions", "pricing_options", "prices"], []))
    if not options:
        price = _money_to_float(_first_present(itinerary, ["price", "amount", "totalPrice", "total_price"]))
        return price, {
            "vendor": None,
            "booking_url": _normalize_booking_url(_first_present(itinerary, ["deepLink", "deep_link", "bookingUrl", "booking_url"])),
            "raw_booking_url": _first_present(itinerary, ["deepLink", "deep_link", "bookingUrl", "booking_url"]),
        }

    best_option = None
    best_price = None
    for option in options:
        if not isinstance(option, dict):
            continue
        price = _money_to_float(_first_present(option, ["price", "amount", "totalPrice", "total_price"]))
        if price is not None and (best_price is None or price < best_price):
            best_price = price
            best_option = option

    if not best_option:
        return None, {}

    price_payload = best_option.get("price") if isinstance(best_option.get("price"), dict) else {}
    details = _extract_option_details(best_option, agents_lookup)
    details.update({
        "price_update_status": _first_present(price_payload, ["update_status", "updateStatus"]),
        "price_last_updated": _first_present(price_payload, ["last_updated", "lastUpdated"]),
        "quote_age": _first_present(price_payload, ["quote_age", "quoteAge"]),
    })
    return best_price, details


def normalize_flightapi_response(data: dict[str, Any], *, is_roundtrip: bool, currency: str = "USD") -> dict:
    """
    Convert FlightAPI's richer response into the app's existing cash-price contract.

    FlightAPI responses can expose itineraries, legs, segments, places, carriers, and
    pricing options. This normalizer is intentionally defensive so small provider
    schema differences do not leak into Zoe/search.
    """
    if not isinstance(data, dict):
        return {"cash_price": None, "currency": currency, "source": "flightapi", "flights": []}

    payload = data.get("data") if isinstance(data.get("data"), dict) else data
    content = payload.get("content") if isinstance(payload.get("content"), dict) else payload

    lookups = {
        "places": _index_by_id(_first_present(content, ["places", "placeMap"], {})),
        "carriers": _index_by_id(_first_present(content, ["carriers", "carrierMap"], {})),
        "legs": _index_by_id(_first_present(content, ["legs", "legMap"], {})),
        "segments": _index_by_id(_first_present(content, ["segments", "segmentMap"], {})),
        "agents": _index_by_id(_first_present(content, ["agents", "agentMap"], {})),
    }

    itineraries = _as_list(_first_present(content, ["itineraries", "results", "flights"], []))
    normalized_flights: list[dict] = []

    for itinerary in itineraries:
        if not isinstance(itinerary, dict):
            continue

        price, pricing_details = _itinerary_price(itinerary, lookups["agents"])
        if price is None:
            continue

        leg_refs = _as_list(_first_present(itinerary, ["legIds", "legs", "leg_ids"], []))
        parsed_legs = [_normalize_leg(leg_ref, lookups) for leg_ref in leg_refs]
        parsed_legs = [leg for leg in parsed_legs if leg]

        outbound = parsed_legs[0] if parsed_legs else {}
        inbound = parsed_legs[1] if is_roundtrip and len(parsed_legs) > 1 else None

        normalized_flights.append(
            {
                "price": price,
                "total_duration": outbound.get("total_duration"),
                "carbon_emissions": None,
                "departure_airport": outbound.get("departure_airport"),
                "departure_iata": outbound.get("departure_iata"),
                "departure_time": outbound.get("departure_time"),
                "arrival_airport": outbound.get("arrival_airport"),
                "arrival_iata": outbound.get("arrival_iata"),
                "arrival_time": outbound.get("arrival_time"),
                "stops": outbound.get("stops", 0),
                "legs": outbound.get("legs", []),
                "return_flight": inbound,
                "booking_url": pricing_details.get("booking_url"),
                "raw_booking_url": pricing_details.get("raw_booking_url"),
                "vendor": pricing_details.get("vendor"),
                "agent_ids": pricing_details.get("agent_ids", []),
                "pricing_option_id": pricing_details.get("pricing_option_id"),
                "transfer_type": pricing_details.get("transfer_type"),
                "score": pricing_details.get("score"),
                "unpriced_type": pricing_details.get("unpriced_type"),
                "booking_proposition": pricing_details.get("booking_proposition"),
                "transfer_protection": pricing_details.get("transfer_protection"),
                "max_redirect_age": pricing_details.get("max_redirect_age"),
                "fare_basis_codes": pricing_details.get("fare_basis_codes", []),
                "booking_codes": pricing_details.get("booking_codes", []),
                "fare_families": pricing_details.get("fare_families", []),
                "ticket_attributes": pricing_details.get("ticket_attributes", []),
                "flight_attributes": pricing_details.get("flight_attributes", []),
                "price_update_status": pricing_details.get("price_update_status"),
                "price_last_updated": pricing_details.get("price_last_updated"),
                "quote_age": pricing_details.get("quote_age"),
            }
        )

    normalized_flights.sort(key=lambda flight: flight.get("price", float("inf")))
    top_flights = normalized_flights[:5]
    lowest_price = top_flights[0]["price"] if top_flights else None

    return {
        "cash_price": lowest_price,
        "currency": currency,
        "source": "flightapi",
        "flights": top_flights,
        "price_level": None,
        "typical_price_range": None,
        "is_roundtrip": is_roundtrip,
    }
