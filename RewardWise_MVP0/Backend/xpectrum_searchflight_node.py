import json
import requests

# ─────────────────────────────────────────────────────────────────────────────
# RewardWise "searchFlight" tool — Xpectrum / Dify Code node (Python 3)
#
# End-to-end flow (mirrors the RewardWise backend):
#   1. Customer asks to fly A → B on a date (the agent extracts these).
#   2. Fetch CASH price        → FlightAPI   (api.flightapi.io)
#   3. Fetch AWARD availability → seats.aero  (partner API, miles + taxes)
#   4. Deterministic VERDICT   → cents-per-point math + thresholds (no LLM)
#   5. DEEP LINK the answer     → United award/cash URL, airline site, or the
#                                 Skyscanner cash booking link, so the customer
#                                 can click straight through to book.
#
# Returns three outputs (declare these in the node's OUTPUT VARIABLES):
#   verdict        (string)  — ready-to-present recommendation for the agent
#   recommendation (string)  — pay_cash | use_points | wait   (for branching)
#   result         (string)  — full structured JSON (debug / downstream use)
#
# NOTE: keep the signature main(date, departure, destination) so it stays
# wired to the existing tool schema. Passengers/cabin are fixed below; promote
# them to node input variables when you want the agent to pass them.
# ─────────────────────────────────────────────────────────────────────────────

# NOTE: this is a REFERENCE copy of the code pasted into the Xpectrum
# searchFlight Code node (the live node holds the real keys). Keys are
# redacted here so secrets never enter git history.
FLIGHT_API_KEY = "YOUR_FLIGHTAPI_KEY"
SEATS_AERO_API_KEY = "YOUR_SEATS_AERO_PARTNER_KEY"

FLIGHT_API_BASE = "https://api.flightapi.io"
SEATS_AERO_BASE = "https://seats.aero/partnerapi"

# Fixed for now (the current tool only passes date/departure/destination).
ADULTS = 1
CABIN = "economy"
CURRENCY = "USD"
HTTP_TIMEOUT = 25

# Verdict thresholds — mirror backend verdict_service.py exactly.
CPP_PAY_CASH_THRESHOLD = 1.25
CPP_GRAY_ZONE_MIDPOINT = 1.5
CPP_USE_POINTS_STRONG_THRESHOLD = 1.8
CHEAP_CASH_THRESHOLD_USD = 250

# seats.aero stores per-cabin fields under a 1-letter prefix; the query value
# uses a different word. Both must stay in lockstep.
CABIN_RESP_PREFIX = {"economy": "Y", "premium_economy": "W", "business": "J", "first": "F"}
CABIN_API_PARAM = {"economy": "economy", "premium_economy": "premium", "business": "business", "first": "first"}

TIER_EXPLANATION = {
    "premium": "This is one of the best uses of your points for this trip — strong value, book if you're ready.",
    "solid": "Your points stretch further than cash here, but it's not a top-tier redemption. Worth doing if you want to preserve cash.",
    "marginal": "Barely better than cash. Consider waiting for a stronger date or comparing other routes.",
}

PROGRAM_URL_OVERRIDES = {
    "american": "https://www.aa.com/",
    "aeroplan": "https://www.aircanada.com/",
    "velocity": "https://www.virginaustralia.com/",
    "lifemiles": "https://www.lifemiles.com/",
    "smiles": "https://www.smiles.com.br/",
    "singapore": "https://www.singaporeair.com/",
    "cathay": "https://www.cathaypacific.com/",
    "qatar": "https://www.qatarairways.com/",
    "turkish": "https://www.turkishairlines.com/",
    "ethiopian": "https://www.ethiopianairlines.com/",
    "alaska": "https://www.alaskaair.com/",
    "ana": "https://www.ana.co.jp/",
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _cash_label(amount):
    return "${:,.0f}".format(amount) if amount is not None else "N/A"


def _program_label(slug):
    return (slug or "the airline").replace("_", " ").title()


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


def _united_url(origin, destination, depart_date, travelers, is_award):
    # One-way economy handoff (matches verdict_service._united_url one-way branch).
    params = [
        ("f", origin.upper()), ("t", destination.upper()), ("d", depart_date),
        ("px", str(travelers)), ("taxng", "1"), ("clm", "7"),
        ("st", "bestmatches"), ("tqp", "A" if is_award else "R"),
        ("sc", "7"), ("tt", "1"),
    ]
    if is_award:
        params += [("at", "1"), ("rm", "1")]
    query = "&".join("{}={}".format(k, v) for k, v in params)
    return "https://www.united.com/en/us/fsr/choose-flights?" + query


def _matched_cpp(cash_price, points, taxes, travelers):
    """cpp = (cash_price − total_taxes) / total_points × 100  (matched scope).

    cash_price is the all-travelers total from FlightAPI; only points and taxes
    scale by travelers. One-way only (no inbound leg in this tool).
    """
    if cash_price is None or not points:
        return None
    travelers = max(int(travelers or 1), 1)
    total_points = int(points) * travelers
    total_taxes = float(taxes or 0) * travelers
    if total_points <= 0:
        return None
    return round((float(cash_price) - total_taxes) / total_points * 100, 4)


# ── 2. CASH price (FlightAPI) ────────────────────────────────────────────────

def _fetch_cash(date, departure, destination):
    url = "{base}/onewaytrip/{key}/{o}/{d}/{date}/{a}/0/0/{cabin}/{cur}".format(
        base=FLIGHT_API_BASE, key=FLIGHT_API_KEY, o=departure, d=destination,
        date=date, a=ADULTS, cabin=CABIN, cur=CURRENCY,
    )
    cheapest, cheapest_url = None, None
    try:
        resp = requests.get(url, timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None, None
    for itin in data.get("itineraries", []):
        opts = itin.get("pricing_options", [])
        if not opts:
            continue
        amount = (opts[0].get("price") or {}).get("amount")
        if amount is None:
            continue
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            continue
        if cheapest is None or amount < cheapest:
            cheapest = amount
            items = opts[0].get("items") or []
            cheapest_url = _normalize_booking_url(items[0].get("url") if items else None)
    return cheapest, cheapest_url


# ── 3. AWARD availability (seats.aero) ───────────────────────────────────────

def _fetch_awards(date, departure, destination, travelers):
    if not SEATS_AERO_API_KEY or SEATS_AERO_API_KEY.startswith("YOUR_"):
        return []  # no key configured → degrade to cash-only verdict
    prefix = CABIN_RESP_PREFIX.get(CABIN, "Y")
    params = {
        "origin_airport": departure.upper(),
        "destination_airport": destination.upper(),
        "start_date": date, "end_date": date,
        "cabins": CABIN_API_PARAM.get(CABIN, "economy"),
        "take": 50, "include_trips": "true",
    }
    headers = {"Partner-Authorization": SEATS_AERO_API_KEY, "Accept": "application/json"}
    try:
        resp = requests.get(SEATS_AERO_BASE + "/search", params=params, headers=headers, timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
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
        # seats.aero TotalTaxes is in CENTS → convert to dollars.
        try:
            taxes = float(avail.get(prefix + "TotalTaxes") or 0) / 100.0
        except (TypeError, ValueError):
            taxes = 0.0
        try:
            seats = int(avail.get(prefix + "RemainingSeats") or 0)
        except (TypeError, ValueError):
            seats = 0
        if seats and seats < travelers:  # not enough award seats for the party
            continue
        awards.append({
            "program": avail.get("Source", "unknown"),
            "points": points,
            "taxes": round(taxes, 2),
            "remaining_seats": seats,
            "direct": bool(avail.get(prefix + "Direct", False)),
            "airlines": avail.get(prefix + "Airlines", ""),
            "date": avail.get("Date"),
        })
    return awards


# ── 4. Deterministic VERDICT ─────────────────────────────────────────────────

def _verdict(cash_price, cash_url, awards, travelers, departure, destination, date):
    # Pick the best award by matched cents-per-point (highest value redemption).
    winner, winner_cpp = None, None
    for a in awards:
        c = _matched_cpp(cash_price, a["points"], a["taxes"], travelers)
        if c is None:
            continue
        if winner_cpp is None or c > winner_cpp:
            winner, winner_cpp = a, c

    # 4a. Data-availability branches (mirror engine pre-gates).
    if cash_price is None and not winner:
        return _pack("wait", "Wait", "I couldn't get live pricing right now.",
                     "Cash and award data both came back empty — try the search again.",
                     None, None, None, None, None, None)
    if not winner:
        # Cash only / no award space found → pay cash.
        return _pack("pay_cash", "Pay Cash",
                     "Cash wins here at {}.".format(_cash_label(cash_price)),
                     "I couldn't find award space for this route and date, so cash is the way to go.",
                     cash_price, None, None, None, None, cash_url)
    if cash_price is None:
        return _pack("wait", "Wait",
                     "I found award space but no live cash price to compare it against.",
                     "{} at {:,} points is available, but without a cash fare I can't size the value. Try again shortly.".format(
                         _program_label(winner["program"]), winner["points"]),
                     None, winner["program"], winner["points"], winner["taxes"], None,
                     _airline_url(winner["program"]))

    # 4b. CPP gates.
    cpp = winner_cpp
    points = winner["points"]
    taxes = winner["taxes"]
    program = winner["program"]
    program_label = _program_label(program)
    total_taxes = round(float(taxes) * max(int(travelers), 1), 2)
    savings = max(0.0, round(float(cash_price) - total_taxes, 2))
    is_award_link = False
    tax_note = " plus about ${} in taxes".format(int(round(taxes))) if taxes else ""

    if cash_price <= CHEAP_CASH_THRESHOLD_USD or cpp < CPP_PAY_CASH_THRESHOLD:
        recommendation, label = "pay_cash", "Pay Cash"
        headline = "Cash wins here at {}.".format(_cash_label(cash_price))
        explanation = ("Cash is only {}, while the best award I found is {:,} points{}."
                       " Your points are likely worth more on a different trip.").format(
            _cash_label(cash_price), points, tax_note)
        tier = None
    elif cpp >= CPP_USE_POINTS_STRONG_THRESHOLD:
        recommendation, label, is_award_link = "use_points", "Use Points", True
        headline = "{} is the strongest redemption on this trip.".format(program_label)
        explanation = ("The best award is {:,} points{}, which saves about ${:,.0f} "
                       "compared with paying {} cash.").format(points, tax_note, savings, _cash_label(cash_price))
        tier = "premium"
    elif CPP_PAY_CASH_THRESHOLD <= cpp < CPP_GRAY_ZONE_MIDPOINT:
        recommendation, label = "pay_cash", "Pay Cash"
        headline = "Pay cash. Save your points for a stronger redemption."
        explanation = ("I found {} at {:,} points versus {} cash. At {:.2f}¢/pt, the award value "
                       "is below the threshold where points typically beat cash.").format(
            program_label, points, _cash_label(cash_price), cpp)
        tier = "marginal"
    else:  # 1.5 <= cpp < 1.8
        recommendation, label, is_award_link = "use_points", "Use Points", True
        headline = "Use points. Better than cash, though not the strongest redemption."
        explanation = ("I found {} at {:,} points versus {} cash. At {:.2f}¢/pt, this beats paying "
                       "cash, but it isn't at premium-redemption levels.").format(
            program_label, points, _cash_label(cash_price), cpp)
        tier = "solid"

    # 5. Deep link.
    if is_award_link:
        if program.lower() == "united":
            booking_link = _united_url(departure, destination, date, travelers, is_award=True)
        else:
            booking_link = _airline_url(program)
    else:
        booking_link = cash_url or _united_url(departure, destination, date, travelers, is_award=False)

    return _pack(recommendation, label, headline, explanation, cash_price,
                 program, points, total_taxes, cpp, booking_link, tier=tier, savings=savings,
                 direct=winner.get("direct"), remaining_seats=winner.get("remaining_seats"))


def _pack(recommendation, label, headline, explanation, cash_price, program, points,
          taxes, cpp, booking_link, tier=None, savings=None, direct=None, remaining_seats=None):
    verdict_str = "{}: {} {}".format(label, headline, explanation).strip()
    tier_expl = TIER_EXPLANATION.get(tier) if tier else None
    if tier_expl:
        verdict_str += " " + tier_expl
    if booking_link:
        verdict_str += "\n\nBook here: {}".format(booking_link)
    struct = {
        "recommendation": recommendation,
        "verdict_label": label,
        "headline": headline,
        "explanation": explanation,
        "verdict": verdict_str,
        "cash_price": cash_price,
        "program": program,
        "points": points,
        "taxes": taxes,
        "cpp": cpp,
        "estimated_savings": savings,
        "verdict_tier": tier,
        "tier_explanation": tier_expl,
        "direct": direct,
        "remaining_seats": remaining_seats,
        "booking_link": booking_link,
    }
    return verdict_str, recommendation, struct


# ── Entry point (Dify Code node) ─────────────────────────────────────────────

def main(date, departure, destination):
    travelers = ADULTS
    departure = (departure or "").strip().upper()
    destination = (destination or "").strip().upper()

    cash_price, cash_url = _fetch_cash(date, departure, destination)
    awards = _fetch_awards(date, departure, destination, travelers)
    verdict_str, recommendation, struct = _verdict(
        cash_price, cash_url, awards, travelers, departure, destination, date
    )

    return {
        "verdict": verdict_str,
        "recommendation": recommendation,
        "result": json.dumps(struct),
    }


if __name__ == "__main__":
    # Local smoke test (cash path is live; award path needs the seats.aero key).
    out = main("2026-08-15", "SFO", "JFK")
    print(json.dumps(json.loads(out["result"]), indent=2))
    print("\n--- verdict ---\n" + out["verdict"])
