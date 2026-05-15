"""
rag/kb/award_tools.py
──────────────────────
Award search tools, booking resources, and community knowledge.

CATEGORY: award_tools
VALID AS OF: 2026-Q2
UPDATE CADENCE: Annually.
"""

from __future__ import annotations

AWARD_TOOLS_KB: list[dict] = [

    {
        "id": "award-search-tools-complete-guide",
        "title": "Award Search Tools — Complete Guide",
        "category": "award_tools",
        "tags": ["ExpertFlyer", "seats.aero", "AwardHacker", "point.me", "award search", "availability"],
        "valid_as_of": "2026-Q2",
        "summary": "Key tools for finding award availability: ExpertFlyer (best for alerts and detailed search), seats.aero (best for aggregated live availability), point.me (user-friendly aggregator), AwardHacker (good for program comparison), Google Flights (cash price context).",
        "content": (
            "Finding award availability is a skill — these tools make it dramatically easier.\n\n"
            "EXPERTFLYER (expertflyer.com):\n"
            "Cost: ~$10/month (basic), ~$99/year\n"
            "Best for: Award availability alerts, flight availability by fare class, seat alerts\n"
            "Key features:\n"
            "- Set fare class alerts: Get notified when saver award space (I, O, Z, U classes) opens on specific flights\n"
            "- Award search: Search partner award availability across Star Alliance, Oneworld, SkyTeam\n"
            "- Seat availability: See exactly which seats are available on a flight\n"
            "- Aircraft configuration: Verify which cabin product is on your specific flight\n"
            "- Award alert: Critical for last-minute award hunters — set alert for United partner space, Alaska space, etc.\n"
            "Best use: Set an alert 2-4 months before departure for your target route/cabin. When ExpertFlyer alerts you, log in to the airline's website immediately and book.\n\n"
            "SEATS.AERO:\n"
            "Cost: ~$10-20/month\n"
            "Best for: Real-time aggregated award availability across multiple programs\n"
            "Key features:\n"
            "- Searches award availability across United, Alaska, Air Canada, American, British Airways, and others simultaneously\n"
            "- Shows which programs have saver space on a route\n"
            "- Calendar view: See which dates have award availability\n"
            "- Particularly good for premium cabin searches (business, first)\n"
            "Best use: When you have a route but not fixed dates. Seats.aero shows you which days have award space and which programs have it — then you book directly with the airline.\n\n"
            "POINT.ME:\n"
            "Cost: ~$10-20/month or free tier\n"
            "Best for: User-friendly award search for beginners\n"
            "Key features:\n"
            "- Clean interface showing award options by program\n"
            "- Good for transatlantic and transpacific premium cabin searches\n"
            "- Shows total cost including fees\n"
            "Best use: Great starting point for those new to award search\n\n"
            "AWARDHACKER (awardhacker.com):\n"
            "Cost: Free\n"
            "Best for: Comparing award costs across programs for a specific route\n"
            "Key features:\n"
            "- Enter origin-destination → shows cost in points for each program\n"
            "- Useful for identifying which program is cheapest for your route\n"
            "- Static (shows chart rates, not live availability)\n"
            "Best use: Early planning to understand which program is cheapest before checking live availability\n\n"
            "GOOGLE FLIGHTS:\n"
            "Cost: Free\n"
            "Best for: Cash price context, finding cheapest dates\n"
            "Key features:\n"
            "- Price calendar: See cheapest months at a glance\n"
            "- Fare tracker: Set alerts for price drops\n"
            "- Explore: Find cheap destinations if you're flexible\n"
            "Best use for award travelers: Use to determine what the cash price is so you can calculate CPP on your award. If the route is showing $300 economy, using 25,000 miles is poor value — pay cash.\n\n"
            "GOOGLE FLIGHTS HACK — FINDING CHEAP DATES:\n"
            "1. Search flexible dates\n"
            "2. Click 'Calendar view' or 'Price graph'\n"
            "3. Find cheapest dates → these often correlate with more award availability\n"
            "4. Cross-reference with seats.aero or ExpertFlyer\n\n"
            "FLIGHTAWARE:\n"
            "Cost: Free (basic)\n"
            "Best for: Historical flight data, aircraft verification, on-time performance\n"
            "Use when: You want to know if a specific flight typically runs on time or often delays — useful before booking for connections\n\n"
            "SEATGURU:\n"
            "Cost: Free\n"
            "Best for: Seat maps, cabin configurations, identifying good vs bad seats\n"
            "Use when: Booking premium seats, want to avoid bad positions (near galleys, blocked recline)\n\n"
            "AIRLINE WEBSITES DIRECTLY:\n"
            "Always book on the airline's own website once you find availability elsewhere. Third-party booking can cause issues with:\n"
            "- Seat selection\n"
            "- Change/cancel flexibility\n"
            "- Mileage credit\n"
            "- Upgrade eligibility\n\n"
            "TRANSFER TIMING WITH SEARCH TOOLS:\n"
            "Standard workflow:\n"
            "1. Find availability via seats.aero or ExpertFlyer\n"
            "2. Verify on airline's direct website\n"
            "3. THEN transfer points from bank account\n"
            "4. Book immediately after transfer clears (usually instant for Chase/Amex → major partners)\n"
            "5. Award space can disappear in minutes — don't delay after transfer"
        ),
    },

    {
        "id": "mistake-fares-flash-sales-guide",
        "title": "Mistake Fares and Flash Sales — When Cash Beats Points",
        "category": "award_tools",
        "tags": ["mistake fare", "flash sale", "error fare", "Going.com", "Secret Flying", "cash beats points"],
        "valid_as_of": "2026-Q2",
        "summary": "Mistake fares (pricing errors by airlines) and flash sales occasionally offer cash prices so low that paying cash beats using points. Tools: Going.com (Scott's Cheap Flights), Secret Flying, Airfarewatchdog. Key rule: never cancel non-refundable plans to chase a mistake fare.",
        "content": (
            "Mistake fares and flash sales are pricing anomalies where cash prices are so low that using points would be wasteful.\n\n"
            "WHAT IS A MISTAKE FARE?\n"
            "A pricing error by the airline — usually a transposition of digits, currency error, or fare class filing mistake. Example: business class JFK-HKG for $400 cash instead of $4,000. Airlines are not required to honor mistake fares, but many do under DOT consumer protection rules.\n\n"
            "WHAT IS A FLASH SALE?\n"
            "An intentional short-term discount, not an error. Airlines run these to fill seats on specific routes. Example: Delta SkyMiles flash sale with 30% off business class to Europe.\n\n"
            "TOOLS FOR FINDING DEALS:\n\n"
            "GOING.COM (formerly Scott's Cheap Flights):\n"
            "- Email alerts for mistake fares and flash sales from your home airports\n"
            "- Free tier: covers economy deals\n"
            "- Premium ($49/year): Business class deals, more alerts, more airports\n"
            "- Best for: Transatlantic and transpacific deals from major US cities\n"
            "- Action required: Book immediately when you get an alert — deals last hours, sometimes minutes\n\n"
            "SECRET FLYING (secretflying.com):\n"
            "- Free aggregator of mistake fares and error fares globally\n"
            "- Good for international mistake fares not always caught by US-focused services\n\n"
            "AIRFAREWATCHDOG:\n"
            "- Price alerts for specific routes\n"
            "- Good for tracking regular discount prices, not just mistake fares\n\n"
            "THRIFTY TRAVELER:\n"
            "- Similar to Going.com, good deals for premium cabin flash sales\n"
            "- Strong coverage of business class flash sales\n\n"
            "REDDIT r/AWARDTRAVEL AND r/CHURNING:\n"
            "- Community posts mistake fares in real time\n"
            "- Check these when you hear about a deal — community confirms whether it's still live\n\n"
            "WHEN CASH BEATS POINTS:\n\n"
            "1. MISTAKE FARE SCENARIO:\n"
            "Business class JFK-NRT normally costs 60,000 Virgin Atlantic miles (worth ~$900 at reasonable CPP) + $100 fees = ~$1,000 total cost.\n"
            "If a mistake fare offers JFK-NRT business class for $600 cash — PAY CASH. The $400 savings is real money, and you keep your 60,000 miles for another use.\n\n"
            "2. FLASH SALE SCENARIO:\n"
            "Delta runs a flash sale at $800 transatlantic business class. Award cost via Virgin Atlantic miles is ~50,000 miles + $50 fees.\n"
            "At 1.5 cents per Virgin Atlantic mile, 50,000 miles are worth $750. If cash is $800, it's close — but you're spending real money that could have been invested vs points that are 'pretend money.' The flash sale might be better for your cash flow but the award still provides more flexibility.\n"
            "Rule of thumb: If the cash price yields less than 1.0 cpp on your points, strongly consider paying cash.\n\n"
            "3. ECONOMY DOMESTIC SALE:\n"
            "Southwest $29 sale: JFK-BOS for $29. Award cost on United would be 12,500 miles. At 1 cpp, that's $125 worth of miles. PAY CASH — save the miles for international premium cabins where they're worth 2-5x more.\n\n"
            "DOT PROTECTIONS FOR MISTAKE FARES:\n"
            "- Airlines must honor booked tickets unless the fare was clearly a mistake AND the passenger was reasonably aware\n"
            "- If you book a $400 business class to Tokyo when normal prices are $4,000+, you may have known it was a mistake\n"
            "- If airline cancels the booking, DOT requires full refund. You may also receive compensation if you had connecting flights or hotels booked.\n"
            "- Never cancel non-refundable plans to chase a mistake fare — they get cancelled more than 50% of the time\n\n"
            "BOOK BOTH STRATEGY:\n"
            "If you find a mistake fare and have other plans, some experienced travelers book the mistake fare AND keep their award booking, then cancel whichever doesn't work out (assuming the award is cancelable). Only do this with fully refundable awards or awards with free cancellation."
        ),
    },

    {
        "id": "points-valuation-guide",
        "title": "Points Valuation — CPP Guide and Program Rankings",
        "category": "award_tools",
        "tags": ["CPP", "cents per point", "point value", "valuation", "transfer value"],
        "valid_as_of": "2026-Q2",
        "summary": "Points valuations in cents per point (cpp). Not all points are equal — Hyatt points (~2.0cpp) and Chase UR/Amex MR (1.5-2.0cpp when transferred) are most valuable. Chase/Amex portal value is 1.0-1.5cpp. Airline miles range from 0.5cpp (Delta) to 1.8cpp+ (Alaska, United).",
        "content": (
            "Cents per point (CPP) = (Cash price of what you're buying) ÷ (Points cost) × 100\n\n"
            "Example: Business class flight worth $3,000 booked for 60,000 miles = $3,000/60,000 × 100 = 5.0 cpp\n\n"
            "APPROXIMATE POINT VALUATIONS (2026 estimates — highly dependent on redemption):\n\n"
            "TRANSFERABLE BANK CURRENCIES:\n"
            "- Chase Ultimate Rewards: 1.5-2.5+ cpp (1.5 via portal, 2.0+ via Hyatt transfer, 1.5-3.0+ via airline transfers)\n"
            "- Amex Membership Rewards: 1.5-2.0+ cpp (1.0 via portal, higher via airline transfers to good sweet spots)\n"
            "- Capital One Miles: 1.0-2.0+ cpp (1.0 via travel eraser, higher via transfer to Turkish/Aeroplan)\n"
            "- Citi ThankYou: 1.5-2.0+ cpp (via Turkish, Singapore transfers)\n"
            "- Bilt Rewards: 1.5-2.5+ cpp (especially via Hyatt and World of Hyatt transfers)\n\n"
            "AIRLINE MILES:\n"
            "- Alaska Mileage Plan: 1.5-2.5+ cpp (fixed award chart, partner sweet spots — Emirates First is exceptional)\n"
            "- United MileagePlus: 1.3-2.0+ cpp (dynamic pricing hurts domestic, partner awards still strong)\n"
            "- American AAdvantage: 1.3-2.0+ cpp (JAL First via AA is top sweet spot)\n"
            "- Southwest Rapid Rewards: 1.3-1.5 cpp consistently (fare-based model is predictable)\n"
            "- JetBlue TrueBlue: 1.3-1.5 cpp (fare-based)\n"
            "- Air Canada Aeroplan: 1.5-2.0+ cpp (sweet spots via partner awards without surcharges)\n"
            "- Virgin Atlantic Flying Club: 1.5-2.5+ cpp (ANA and Delta One sweet spots are exceptional)\n"
            "- Delta SkyMiles: 0.8-1.5 cpp (dynamic pricing makes it hard to get consistent value — worst of the majors)\n"
            "- British Airways Avios: 0.8-2.0 cpp (short-haul is great, fuel surcharges destroy long-haul value)\n"
            "- Flying Blue: 1.0-2.0 cpp (Promo Awards are the way to extract maximum value)\n"
            "- Turkish Miles&Smiles: 1.5-2.5+ cpp (sweet spot for business class, but booking is complex)\n"
            "- Singapore KrisFlyer: 1.5-2.5+ cpp (hard to earn from US, but very valuable when you have them)\n\n"
            "HOTEL POINTS:\n"
            "- World of Hyatt: 1.7-2.5+ cpp (most valuable hotel currency, consistently)\n"
            "- IHG One Rewards: 0.5-0.8 cpp (4th night free raises effective value)\n"
            "- Hilton Honors: 0.4-0.7 cpp (5th night free and aspirational properties raise value)\n"
            "- Marriott Bonvoy: 0.6-0.9 cpp (dynamic pricing makes it inconsistent)\n"
            "- Wyndham Rewards: 0.8-1.2 cpp (flat rate model is more predictable)\n\n"
            "CPP THRESHOLDS FOR DECISION-MAKING:\n"
            "< 1.0 cpp: Almost never use points — pay cash\n"
            "1.0-1.5 cpp: Mediocre — consider cash, especially if you have cash back opportunities\n"
            "1.5-2.0 cpp: Good — this is the baseline for acceptable point usage\n"
            "2.0-3.0 cpp: Excellent — strong redemption\n"
            "> 3.0 cpp: Exceptional — premium cabin international sweet spots\n\n"
            "REAL CPP EXAMPLES:\n"
            "- Delta One JFK-CDG for 50,000 Virgin Atlantic miles (cash $3,500): $3,500/50,000 × 100 = 7.0 cpp ← EXCEPTIONAL\n"
            "- United economy JFK-LAX for 12,500 miles (cash $200): $200/12,500 × 100 = 1.6 cpp ← ok but not great\n"
            "- Hotel room via Hilton for 50,000 points (cash $200): $200/50,000 × 100 = 0.4 cpp ← very poor, pay cash\n"
            "- Park Hyatt Paris for 25,000 Hyatt points (cash $500): $500/25,000 × 100 = 2.0 cpp ← good\n\n"
            "IMPORTANT NUANCE:\n"
            "CPP calculations use the cash price as the benchmark, but the question is really: 'What is the opportunity cost of these points?' If your next best use of 50,000 Chase UR points is at 1.0 cpp through the portal ($500), then any airline/hotel redemption worth more than $500 is worth doing, even if the CPP seems low in isolation."
        ),
    },
]