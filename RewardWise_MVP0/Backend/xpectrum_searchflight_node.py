import json
import requests

FLIGHT_API_KEY = "YOUR_FLIGHTAPI_KEY"
SEATS_AERO_API_KEY = "YOUR_SEATS_AERO_PARTNER_KEY"

FLIGHT_API_BASE = "https://api.flightapi.io"
SEATS_AERO_BASE = "https://seats.aero/partnerapi"
ADULTS, CABIN, CURRENCY, HTTP_TIMEOUT = 1, "economy", "USD", 25

CPP_PAY_CASH_THRESHOLD = 1.25
CPP_GRAY_ZONE_MIDPOINT = 1.5
CPP_USE_POINTS_STRONG_THRESHOLD = 1.8
CHEAP_CASH_THRESHOLD_USD = 250

CABIN_RESP_PREFIX = {"economy": "Y", "premium_economy": "W", "business": "J", "first": "F"}
CABIN_API_PARAM = {"economy": "economy", "premium_economy": "premium", "business": "business", "first": "first"}
TIER_EXPLANATION = {
    "premium": "one of the best uses of your points for this trip",
    "solid": "your points stretch further than cash here, though not a top-tier deal",
    "marginal": "barely better than cash",
}
PROGRAM_URL_OVERRIDES = {
    "american": "https://www.aa.com/", "aeroplan": "https://www.aircanada.com/",
    "velocity": "https://www.virginaustralia.com/", "lifemiles": "https://www.lifemiles.com/",
    "smiles": "https://www.smiles.com.br/", "singapore": "https://www.singaporeair.com/",
    "cathay": "https://www.cathaypacific.com/", "qatar": "https://www.qatarairways.com/",
    "turkish": "https://www.turkishairlines.com/", "ethiopian": "https://www.ethiopianairlines.com/",
    "alaska": "https://www.alaskaair.com/", "ana": "https://www.ana.co.jp/", "united": "https://www.united.com/",
}


def _cash_label(a):
    return "${:,.0f}".format(a) if a is not None else "N/A"


def _program_label(s):
    return (s or "the airline").replace("_", " ").title()


def _index(items):
    out = {}
    for x in (items or []):
        if isinstance(x, dict) and x.get("id") is not None:
            out[str(x["id"])] = x
    return out


def _fmt_time(iso):
    # "2026-09-15T06:00:00" -> ("Sep 15", "6:00 AM")
    try:
        d, t = iso.split("T")
        y, mo, day = d.split("-")
        months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        date_lbl = "{} {}".format(months[int(mo)], int(day))
        hh, mm = int(t[:2]), t[3:5]
        ampm = "AM" if hh < 12 else "PM"
        h12 = hh % 12 or 12
        return date_lbl, "{}:{} {}".format(h12, mm, ampm)
    except Exception:
        return "", ""


def _normalize_booking_url(url):
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return "https://www.skyscanner.com" + url
    return url


def _airline_url(program):
    name = (program or "").lower().strip()
    if name in PROGRAM_URL_OVERRIDES:
        return PROGRAM_URL_OVERRIDES[name]
    return "https://www.{}.com/".format(name) if name else "https://www.google.com/travel/flights"


def _matched_cpp(cash_price, points, taxes, travelers):
    if cash_price is None or not points:
        return None
    travelers = max(int(travelers or 1), 1)
    total_points = int(points) * travelers
    if total_points <= 0:
        return None
    total_taxes = float(taxes or 0) * travelers
    return round((float(cash_price) - total_taxes) / total_points * 100, 4)


def _fetch_cash(date, departure, destination):
    url = "{b}/onewaytrip/{k}/{o}/{d}/{date}/{a}/0/0/{c}/{cur}".format(
        b=FLIGHT_API_BASE, k=FLIGHT_API_KEY, o=departure, d=destination, date=date, a=ADULTS, c=CABIN, cur=CURRENCY)
    try:
        data = requests.get(url, timeout=HTTP_TIMEOUT).json()
    except Exception:
        return None
    its = data.get("itineraries") or []
    best, best_amt = None, None
    for it in its:
        opts = it.get("pricing_options") or []
        if not opts:
            continue
        amt = (opts[0].get("price") or {}).get("amount")
        if amt is None:
            continue
        try:
            amt = float(amt)
        except (TypeError, ValueError):
            continue
        if best_amt is None or amt < best_amt:
            best_amt, best = amt, it
    if best is None:
        return None

    places = _index(data.get("places"))
    carriers = _index(data.get("carriers"))
    legs = _index(data.get("legs"))
    segments = _index(data.get("segments"))

    cash = {"price": best_amt, "currency": CURRENCY}
    # Robust booking URL: first non-empty deep link across all options/items,
    # else a Google Flights search fallback so the link is always clickable.
    book_url = None
    for opt in best.get("pricing_options") or []:
        for item in opt.get("items") or []:
            u = item.get("url") or item.get("deep_link") or item.get("deepLink")
            if u:
                book_url = _normalize_booking_url(u)
                break
        if book_url:
            break
    if not book_url:
        book_url = "https://www.google.com/travel/flights?q=Flights%20{}%20to%20{}%20{}".format(
            departure, destination, date)
    cash["booking_url"] = book_url

    leg = legs.get(str((best.get("leg_ids") or [None])[0]))
    if isinstance(leg, dict):
        o = places.get(str(leg.get("origin_place_id")), {})
        d = places.get(str(leg.get("destination_place_id")), {})
        cash["origin"] = o.get("display_code") or departure
        cash["destination"] = d.get("display_code") or destination
        cash["stops"] = leg.get("stop_count", 0)
        dep_date, dep_t = _fmt_time(leg.get("departure", ""))
        arr_date, arr_t = _fmt_time(leg.get("arrival", ""))
        cash["depart_time"], cash["arrive_time"] = dep_t, arr_t
        cash["depart_date"] = dep_date
        seg = segments.get(str((leg.get("segment_ids") or [None])[0]))
        carrier = carriers.get(str((leg.get("marketing_carrier_ids") or [None])[0])) or {}
        code = carrier.get("display_code") or ""
        cash["airline"] = carrier.get("name") or code or "Airline"
        fno = seg.get("marketing_flight_number") if isinstance(seg, dict) else None
        cash["flight_code"] = ("{}{}".format(code, fno) if code and fno else (code or "")).strip()
        stops_lbl = "nonstop" if cash["stops"] == 0 else "{} stop{}".format(cash["stops"], "s" if cash["stops"] > 1 else "")
        cash["flight_line"] = "{o}→{d} · {fc} · {dt} {dep}–{arr} · {stops}".format(
            o=cash["origin"], d=cash["destination"], fc=cash["flight_code"] or cash["airline"],
            dt=dep_date, dep=dep_t, arr=arr_t, stops=stops_lbl).replace(" ·  ·", " ·")
    return cash


def _fetch_awards(date, departure, destination, travelers):
    if not SEATS_AERO_API_KEY or SEATS_AERO_API_KEY.startswith("YOUR_"):
        return []
    prefix = CABIN_RESP_PREFIX.get(CABIN, "Y")
    params = {"origin_airport": departure.upper(), "destination_airport": destination.upper(),
              "start_date": date, "end_date": date, "cabins": CABIN_API_PARAM.get(CABIN, "economy"),
              "take": 50, "include_trips": "true"}
    headers = {"Partner-Authorization": SEATS_AERO_API_KEY, "Accept": "application/json"}
    try:
        data = requests.get(SEATS_AERO_BASE + "/search", params=params, headers=headers, timeout=HTTP_TIMEOUT).json()
    except Exception:
        return []
    awards = []
    for avail in data.get("data", []):
        if not avail.get(prefix + "Available"):
            continue
        try:
            points = int(avail.get(prefix + "MileageCost"))
        except (TypeError, ValueError):
            continue
        if not points:
            continue
        try:
            taxes = float(avail.get(prefix + "TotalTaxes") or 0) / 100.0
        except (TypeError, ValueError):
            taxes = 0.0
        try:
            seats = int(avail.get(prefix + "RemainingSeats") or 0)
        except (TypeError, ValueError):
            seats = 0
        if seats and seats < travelers:
            continue
        awards.append({"program": avail.get("Source", "unknown"), "points": points,
                       "taxes": round(taxes, 2), "remaining_seats": seats,
                       "direct": bool(avail.get(prefix + "Direct", False))})
    awards.sort(key=lambda a: a["points"])
    return awards[:3]


def main(date, departure, destination):
    departure = (departure or "").strip().upper()
    destination = (destination or "").strip().upper()
    travelers = ADULTS
    cash = _fetch_cash(date, departure, destination)
    awards = _fetch_awards(date, departure, destination, travelers)
    cash_price = cash["price"] if cash else None

    # best award by matched cpp
    best, best_cpp = None, None
    for a in awards:
        c = _matched_cpp(cash_price, a["points"], a["taxes"], travelers)
        a["cpp"] = c
        if c is not None and (best_cpp is None or c > best_cpp):
            best, best_cpp = a, c

    if cash_price is None and not best:
        rec, label, headline = "wait", "Wait", "Pricing came back thin right now."
    elif not best:
        rec, label, headline = "pay_cash", "Pay Cash", "Cash wins here at {}.".format(_cash_label(cash_price))
    elif cash_price is None:
        rec, label, headline = "wait", "Wait", "Found award space but no live cash fare to compare."
    else:
        cpp, points, taxes = best_cpp, best["points"], best["taxes"]
        if cash_price <= CHEAP_CASH_THRESHOLD_USD or cpp < CPP_PAY_CASH_THRESHOLD:
            rec, label, tier = "pay_cash", "Pay Cash", None
            headline = "Cash wins at {} — save your points.".format(_cash_label(cash_price))
        elif cpp >= CPP_USE_POINTS_STRONG_THRESHOLD:
            rec, label, tier = "use_points", "Use Points", "premium"
            headline = "Points win — {:,} points vs {} cash.".format(points, _cash_label(cash_price))
        elif cpp < CPP_GRAY_ZONE_MIDPOINT:
            rec, label, tier = "pay_cash", "Pay Cash", "marginal"
            headline = "Lean cash — the award value is thin at {} points.".format(format(points, ","))
        else:
            rec, label, tier = "use_points", "Use Points", "solid"
            headline = "Points edge it — {:,} points vs {} cash.".format(points, _cash_label(cash_price))

    result = {
        "recommendation": rec,
        "verdict_label": label,
        "headline": headline,
        "cash": cash,
        "best_award": best,
        "award_options": awards,
        "cpp": best_cpp,
        "savings": (round(cash_price - (best["taxes"] * travelers), 2) if (best and cash_price) else None),
        "cash_booking_url": (cash or {}).get("booking_url"),
        "award_booking_url": (_airline_url(best["program"]) if best else None),
    }
    return {"verdict": headline, "recommendation": rec, "result": json.dumps(result)}


if __name__ == "__main__":
    out = main("2026-09-15", "SFO", "JFK")
    print(json.dumps(json.loads(out["result"]), indent=2))
