"""
rag/kb/travel_protections.py
──────────────────────────────
Travel insurance and protections from credit cards.
Trip delay, cancellation, baggage, rental car, and purchase protections.

CATEGORY: travel_protections
VALID AS OF: 2026-Q2
UPDATE CADENCE: Annually — benefits change with card refreshes.
"""

from __future__ import annotations

TRAVEL_PROTECTIONS_KB: list[dict] = [

    {
        "id": "credit-card-travel-protections-overview",
        "title": "Credit Card Travel Protections — Complete Guide",
        "category": "travel_protections",
        "tags": ["trip delay", "trip cancellation", "baggage", "travel insurance", "credit card benefit"],
        "valid_as_of": "2026-Q2",
        "summary": "Premium travel cards include trip delay insurance (up to $500/ticket after 6-12 hours), trip cancellation (up to $10,000/person), and baggage protection. These benefits can save hundreds to thousands annually and often replace the need for separate travel insurance for most trips.",
        "content": (
            "Travel credit card protections are among the most underutilized benefits in the points world. A 6-hour flight delay can trigger $500 in hotel and meal reimbursements if you used the right card to book your flight.\n\n"
            "TRIP DELAY INSURANCE — HOW IT WORKS:\n"
            "- Must pay for the ticket (or taxes/fees on award ticket) with the qualifying card\n"
            "- Coverage activates after a delay of the specified threshold (6 hours for premium cards, 12 hours for mid-tier)\n"
            "- Covers: meals, lodging, transportation, toiletries, essential clothing\n"
            "- Requires documentation: delay certificate from airline, receipts for all expenses\n"
            "- Filing: Call the number on back of your card or file online within 60-90 days\n\n"
            "TRIP DELAY BY CARD:\n"
            "- Chase Sapphire Reserve: $500/ticket after 6-hour delay or overnight stay required\n"
            "- Chase Sapphire Preferred: $500/ticket after 12-hour delay\n"
            "- Amex Platinum: $500/ticket after 6-hour delay (added 2021)\n"
            "- Capital One Venture X: Included, verify current terms\n"
            "- United Explorer: $500/ticket after 12 hours\n"
            "- Most co-branded airline cards: $500/ticket after 12 hours\n\n"
            "TRIP CANCELLATION/INTERRUPTION:\n"
            "- Covers non-refundable trip expenses if you must cancel or cut short a trip\n"
            "- Covered reasons: illness, injury, death of family member, severe weather, jury duty, job loss\n"
            "- NOT covered: change of mind, voluntary cancellations\n"
            "- Chase Sapphire Reserve: Up to $10,000/person, $20,000/trip, $40,000/year\n"
            "- Chase Sapphire Preferred: Up to $10,000/person, $20,000/trip\n"
            "- Amex Platinum: Up to $10,000/trip\n"
            "- Must pay for trip with the card (award tickets covered if you pay taxes/fees with card)\n\n"
            "BAGGAGE DELAY INSURANCE:\n"
            "- Covers essential purchases (clothing, toiletries) if baggage is delayed\n"
            "- Chase Sapphire Reserve: $100/day for 5 days after 6-hour delay\n"
            "- Chase Sapphire Preferred: $100/day for 5 days\n"
            "- Most premium cards: Similar coverage\n"
            "- Lost baggage: Up to $3,000/person for lost/damaged/stolen checked or carry-on luggage\n\n"
            "RENTAL CAR COVERAGE:\n"
            "- Primary vs Secondary is a critical distinction:\n"
            "  PRIMARY (pays BEFORE your personal auto insurance): Chase Sapphire Reserve, Chase Sapphire Preferred, Capital One Venture X, Amex Platinum (secondary on personal, primary on business)\n"
            "  SECONDARY (pays what your insurance doesn't): Most other cards\n"
            "- With primary coverage: Decline the rental company's CDW/LDW ($15-30/day). Your card covers damage.\n"
            "- Coverage limit: Typically up to the vehicle's full value\n"
            "- NOT covered: Liability (injuries to others), personal effects theft, tire/windshield damage on some cards\n\n"
            "PURCHASE PROTECTION:\n"
            "- Covers new purchases against theft or accidental damage\n"
            "- Chase Sapphire Reserve: 120 days, up to $10,000/claim, $50,000/year\n"
            "- Amex Platinum: 90 days, up to $10,000/claim, $50,000/year\n"
            "- Use this for expensive electronics, camera equipment, etc. purchased before travel\n\n"
            "EXTENDED WARRANTY:\n"
            "- Adds 1 year to manufacturer warranties under 5 years\n"
            "- Chase and Amex cards generally include this\n"
            "- Use for appliances and electronics — works even when you return from travel\n\n"
            "WHEN TO BUY SEPARATE TRAVEL INSURANCE:\n"
            "Credit card coverage has gaps. Buy separate travel insurance when:\n"
            "- Trip costs more than card coverage maximums\n"
            "- Trip involves high-risk activities (skiing, adventure sports) — cards often exclude\n"
            "- Medical evacuation is a concern (cards rarely cover medevac — costs can be $50,000-$200,000)\n"
            "- International travel where healthcare costs are high and unknown\n"
            "- Cruise-specific cancellation (complex rules not well-covered by cards)\n\n"
            "HOW TO FILE A CLAIM:\n"
            "1. Document everything — take photos, get written delay certificate from airline\n"
            "2. Save all receipts (hotel, meals, transportation)\n"
            "3. Call card's benefits administrator (not the bank itself) within 60-90 days\n"
            "4. Chase benefits: eclaimsline.com or call 1-888-320-9961\n"
            "5. Amex benefits: americanexpress.com/en-us/benefits\n"
            "6. Expect 2-4 weeks for processing"
        ),
    },

    {
        "id": "taxes-fees-on-awards",
        "title": "Taxes and Fees on Award Tickets — Complete Guide",
        "category": "travel_protections",
        "tags": ["taxes", "fees", "YQ", "fuel surcharge", "carrier imposed", "UK APD", "award costs"],
        "valid_as_of": "2026-Q2",
        "summary": "Award tickets aren't free — you pay taxes and fees ranging from $5.60 (Southwest domestic) to $700+ (British Airways transatlantic). Fuel surcharges (YQ/YR) are the biggest wildcard. Programs like Alaska, United, Air Canada, and American minimize surcharges on partner awards.",
        "content": (
            "Award tickets always have some cash cost beyond the points. Understanding taxes and fees is critical to evaluating the true cost of a redemption.\n\n"
            "TAXES VS FEES VS SURCHARGES — THE THREE TYPES:\n\n"
            "1. GOVERNMENT TAXES (mandatory, unavoidable):\n"
            "- US departure/arrival taxes: ~$5-$30 each way\n"
            "- UK Air Passenger Duty (APD): £13-£180 depending on destination and class\n"
            "- French Solidarity Tax: €1-€45 depending on route and class\n"
            "- German air transport levy: ~€12 short-haul, ~€29 long-haul\n"
            "- Australia Passenger Movement Charge: AUD~$60\n"
            "- Japan departure tax: JPY 1,000 (~$7)\n"
            "- Canada airport improvement fees: CAD $25-$35\n\n"
            "2. AIRPORT/CARRIER FEES (mandatory, varies by airport):\n"
            "- Passenger Facility Charges (US): $4.50 per airport connection (max $18 one-way)\n"
            "- International airport departure fees: vary by country, typically $20-$80\n\n"
            "3. CARRIER-IMPOSED SURCHARGES (YQ/YR — optional per program):\n"
            "- These are fuel surcharges that airlines pass through to award bookers\n"
            "- NOT government taxes — the airline CHOOSES to impose them\n"
            "- Can add $200-$800+ to an international business class award\n"
            "- THIS is the biggest variable cost to understand before booking\n\n"
            "FUEL SURCHARGE (YQ) BY PROGRAM:\n\n"
            "PROGRAMS THAT PASS HIGH SURCHARGES:\n"
            "- British Airways Executive Club: $500-$800+ on transatlantic BA metal business class. BA is the worst offender for US travelers.\n"
            "- Lufthansa Miles & More: $300-$600 on Lufthansa, Swiss, Austrian metal\n"
            "- Air France/KLM Flying Blue: $200-$500 on AF/KLM metal\n"
            "- Singapore KrisFlyer: Variable, some partners have surcharges\n"
            "- Emirates Skywards: $300-$600 on Emirates metal\n"
            "- Etihad Guest: Surcharges on Etihad metal\n"
            "- Qatar Privilege Club: Surcharges on Qatar metal\n\n"
            "PROGRAMS THAT DON'T PASS SURCHARGES (huge advantage):\n"
            "- Alaska Mileage Plan: No YQ on ANY partner (Emirates, Cathay, JAL, British Airways booked via Alaska — no surcharges)\n"
            "- United MileagePlus: No YQ on non-United partner awards (United may have its own fees on some partners)\n"
            "- Air Canada Aeroplan: Minimal to no YQ on most Star Alliance partners (main exception: Lufthansa charges some carriers a handling fee)\n"
            "- American AAdvantage: Generally no YQ on most partner awards\n"
            "- Delta SkyMiles: Generally no YQ on most partner awards\n"
            "- Chase UR portal redemptions: No YQ (portal pays cash, no surcharges)\n\n"
            "THE ALASKA LOOPHOLE:\n"
            "Booking Emirates First Class or Business Class via Alaska Mileage Plan avoids Emirates' own high surcharges. The same Emirates flight booked via Skywards might cost $600 in surcharges; booked via Alaska, you pay only $30-$50 in government taxes. This is one of the most important fee-avoidance strategies in all of award travel.\n\n"
            "SIMILAR STRATEGY FOR LUFTHANSA:\n"
            "Book Lufthansa business class via United MileagePlus or Air Canada Aeroplan rather than Miles & More. Avoid paying the $400-$600 Lufthansa imposes via its own program.\n\n"
            "ACTUAL CASH COSTS BY SCENARIO:\n"
            "- Southwest domestic round trip (points): ~$11 in taxes (literally just $5.60 each way)\n"
            "- United domestic round trip (points): ~$30-60 in taxes\n"
            "- United transatlantic business (via United miles): ~$100-200 in taxes only, no YQ\n"
            "- British Airways transatlantic business (via Avios): ~$500-800 after YQ\n"
            "- Emirates business class JFK-DXB (via Alaska): ~$50-80 in taxes only\n"
            "- Emirates business class JFK-DXB (via Skywards): ~$600-900 after YQ\n"
            "- Lufthansa transatlantic business (via Aeroplan): ~$100-200, minimal surcharges\n"
            "- Lufthansa transatlantic business (via Miles & More): ~$400-600 in surcharges\n\n"
            "ALWAYS CHECK TOTAL COST BEFORE TRANSFERRING POINTS:\n"
            "Calculate the true cost = Miles value at your valuation + Cash fees. Sometimes a flight with lower mileage cost but high surcharges is worse value than a program with more miles but no surcharges."
        ),
    },

    {
        "id": "award-booking-step-by-step",
        "title": "Step-by-Step Award Booking Guides — Major Programs",
        "category": "travel_protections",
        "tags": ["how to book", "award booking", "aeroplan", "aadvantage", "mileageplus", "booking guide"],
        "valid_as_of": "2026-Q2",
        "summary": "Step-by-step guides for booking awards on United MileagePlus, Air Canada Aeroplan (for Star Alliance), AAdvantage (for JAL/BA), and Alaska (for Emirates/Cathay/JAL). Key rule: always verify award space BEFORE transferring points — transfers are irreversible.",
        "content": (
            "CRITICAL RULE FOR ALL AWARD BOOKINGS:\n"
            "ALWAYS verify award space exists and confirm you can book BEFORE transferring points from a bank currency. Points transfers are almost always irreversible. If you transfer 60,000 Chase points to United and then discover no award space, you've lost the transfer optionality.\n\n"
            "BOOKING UNITED AWARDS (United Metal + Star Alliance):\n"
            "1. Go to united.com, search for your route with 'Search for award travel' checked\n"
            "2. Look for 'Saver' awards (lower price) vs 'Everyday' awards (dynamic, often higher)\n"
            "3. For partner awards (Lufthansa, ANA, etc.), check united.com and call if online shows limited options\n"
            "4. Confirm total miles needed and taxes\n"
            "5. Transfer Chase UR or other points to United AFTER confirming space\n"
            "6. Complete booking immediately — award space can disappear while you transfer\n"
            "Key: United partner awards (Lufthansa, ANA, Air Canada) can appear on united.com or require a phone call\n\n"
            "BOOKING VIA AIR CANADA AEROPLAN (for Star Alliance partners without surcharges):\n"
            "1. Go to aeroplan.com or Air Canada app\n"
            "2. Search for your route — Aeroplan shows partner award space well\n"
            "3. Verify no fuel surcharges are applied (Aeroplan is transparent about fees at booking)\n"
            "4. Note the total Aeroplan points + cash cost\n"
            "5. If satisfied, transfer Amex MR or Chase UR to Aeroplan (1:1)\n"
            "6. Complete booking within minutes of transfer (points usually appear quickly)\n"
            "Sweet spots: Lufthansa business (FRA-JFK etc.), Swiss business, ANA business, Turkish business — all without significant surcharges via Aeroplan\n\n"
            "BOOKING JAL FIRST/BUSINESS VIA AADVANTAGE:\n"
            "1. Go to aa.com, search award travel\n"
            "2. Select 'Partner Airlines' or look for JAL (JL) flight numbers\n"
            "3. Check availability — JAL releases space to AA at 355 days and closer to departure\n"
            "4. Call AA (1-800-882-8880) if website doesn't show space — agents sometimes see more\n"
            "5. Transfer Citi ThankYou, Amex MR (via partner), or use existing AAdvantage miles\n"
            "Key cost: ~60,000 miles economy, ~80,000 business, ~110,000 first class JFK-NRT one-way\n\n"
            "BOOKING EMIRATES VIA ALASKA MILEAGE PLAN:\n"
            "1. Go to alaskaair.com, click 'Use miles' when searching\n"
            "2. Search your route — Alaska's search engine shows Emirates inventory\n"
            "3. Confirm availability and note the miles + fees (fees will be very low vs Skywards)\n"
            "4. Transfer Bank of America points or existing Alaska miles (Alaska doesn't have many bank transfer partners — accumulate miles via flying or BOA Alaska card)\n"
            "5. Complete booking — Alaska can book Emirates directly\n"
            "Key rates: ~50,000 miles economy, ~90,000 business, no fuel surcharges\n\n"
            "BOOKING ANA BUSINESS VIA VIRGIN ATLANTIC:\n"
            "1. Call Virgin Atlantic Flying Club (0800 number from US or international number)\n"
            "2. Request ANA (NH) award on your specific route/date\n"
            "3. Virgin's agents have access to ANA's partner award inventory\n"
            "4. Confirm availability, note points + fees\n"
            "5. Transfer Chase UR, Amex MR, Citi TY, or Bilt to Virgin Atlantic\n"
            "6. Call back to complete booking immediately after transfer\n"
            "Key: This cannot always be done online — phone booking is often necessary for Virgin/ANA\n"
            "Cost: ~60,000 miles business class one-way JFK-NRT — among the best redemptions available\n\n"
            "BOOKING FLYING BLUE PROMO AWARDS:\n"
            "1. Check flyingblue.com on the 1st of each month when new promos are announced\n"
            "2. Promos are route-specific and typically 25-50% off standard rates\n"
            "3. Book quickly — popular promo awards sell out within hours\n"
            "4. Transfer Chase UR, Amex MR, Capital One, or Citi TY to Flying Blue\n"
            "5. Book online — Flying Blue has good online booking interface\n\n"
            "PHONE BOOKING TIPS:\n"
            "- Be specific: give flight number, date, cabin class, number of passengers\n"
            "- Have backup dates ready\n"
            "- Ask about waitlists if first choice isn't available\n"
            "- Request callback number if call drops\n"
            "- Best call times: Tuesday-Thursday, before 10am or after 8pm\n"
            "- Hold times vary: AA and United often 15-45 min, Alaska often faster"
        ),
    },
]
