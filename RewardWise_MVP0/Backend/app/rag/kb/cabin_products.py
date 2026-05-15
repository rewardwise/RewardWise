"""
rag/kb/cabin_products.py
─────────────────────────
Aircraft cabin products, rankings, and redemption strategy.
Which airlines have the best business/first class products,
which routes they fly on, and how to book them on points.

CATEGORY: cabin_products
VALID AS OF: 2026-Q2
UPDATE CADENCE: Annually (new aircraft deliveries change routing).
"""

from __future__ import annotations

CABIN_PRODUCTS_KB: list[dict] = [

    {
        "id": "best-business-class-products-ranked",
        "title": "Best Business Class Products Worldwide — Ranked",
        "category": "cabin_products",
        "tags": ["business class", "ranking", "Qatar Q Suite", "Singapore Suites", "ANA The Room", "JAL Suite", "Cathay"],
        "valid_as_of": "2026-Q2",
        "summary": "Qatar Q Suite, Singapore Business Class, and ANA The Room consistently rank as the world's top business class products. All are accessible via points transfers. Key consideration: not all routes get the best aircraft.",
        "content": (
            "Business class quality varies dramatically by airline and even by route within the same airline. Here's the comprehensive ranking with points booking access.\n\n"
            "TIER 1 — WORLD'S BEST BUSINESS CLASS:\n\n"
            "QATAR AIRWAYS QSUITE:\n"
            "- The gold standard in business class. Fully flat bed, closing door for full privacy, double beds configurable for couples (best feature in airline history), 4K IFE, aisle access from every seat.\n"
            "- Aircraft: Boeing 777-300ER, Boeing 787-9, Airbus A350 (newer aircraft)\n"
            "- Routes with Q Suite: Most long-haul from Doha (DOH) including US gateways (JFK, LAX, ORD, MIA, IAD, ATL, BOS, DFW), London (LHR), Paris (CDG), Tokyo (NRT), and many others\n"
            "- How to book: Qatar Privilege Club Avios (can pool with BA/Iberia Avios). Also bookable via American AAdvantage miles.\n"
            "- Typical award cost: ~70,000-100,000 AA miles or Avios for transatlantic business\n\n"
            "SINGAPORE AIRLINES BUSINESS CLASS (A350/787/A380):\n"
            "- Full forward-facing flat bed, direct aisle access from every seat, exceptional service and food, Book the Cook menu customization\n"
            "- Aircraft: A350-900, Boeing 787-10, A380\n"
            "- Routes: SIN-JFK (A350-900 — the world's longest nonstop flight), SIN-LAX, SIN-SFO, SIN-HKG, SIN-LHR, and many more\n"
            "- How to book: Singapore KrisFlyer miles (hard to accumulate from US), Virgin Atlantic Flying Club → Singapore (excellent value), Air Canada Aeroplan → Singapore\n"
            "- Typical cost: ~63,000-85,000 Virgin Atlantic miles or KrisFlyer miles for long-haul business\n\n"
            "ANA THE ROOM (777-300ER):\n"
            "- Individual suite with closing door, full flat bed, one of the widest business class seats in the sky, excellent Japanese food service\n"
            "- Routes: NRT-JFK, NRT-LAX, NRT-LHR, NRT-FRA, NRT-CDG\n"
            "- How to book: Virgin Atlantic Flying Club (best value — ~60,000 miles for US-Japan), United MileagePlus, Air Canada Aeroplan\n"
            "- Virgin Atlantic sweet spot: 60,000 miles for ANA business class US→Japan — consistently one of the best redemptions in all of points travel\n\n"
            "JAL BUSINESS CLASS (SKY SUITE / JAL SUITE):\n"
            "- Sky Suite III: Direct aisle access, fully flat, good Japanese hospitality\n"
            "- JAL Suite: First class-level product on some aircraft — one of the best in the world\n"
            "- Routes: NRT/HND-JFK, NRT/HND-LAX, NRT/HND-LHR, NRT-CDG, NRT-BOS\n"
            "- How to book: American AAdvantage (JAL business: ~60,000 miles US-Japan), Alaska Mileage Plan (JAL business sweet spot)\n\n"
            "TIER 2 — EXCELLENT BUSINESS CLASS:\n\n"
            "CATHAY PACIFIC BUSINESS CLASS (A350/777):\n"
            "- Fully flat, direct aisle access, one of the best wine programs at altitude, excellent food especially on HKG routes\n"
            "- Routes: HKG-JFK, HKG-LAX, HKG-SFO, HKG-ORD, HKG-LHR and many\n"
            "- How to book: Alaska Mileage Plan (excellent rates, no surcharges), American AAdvantage\n\n"
            "LUFTHANSA BUSINESS CLASS (747-8/A350/A380):\n"
            "- Direct aisle access on newer aircraft (reverse herringbone), excellent German food, outstanding wine and beer\n"
            "- Routes: FRA/MUC-JFK, FRA-LAX, FRA-SFO, FRA-ORD, and many\n"
            "- Note: Some older Lufthansa aircraft have angled flat seats — check specific aircraft before booking\n"
            "- How to book: Air Canada Aeroplan (no surcharges!), United MileagePlus\n\n"
            "AIR FRANCE BUSINESS CLASS (La Première — First, and Business):\n"
            "- 777 business class has direct aisle access, good French food and wine, updated cabin\n"
            "- Routes: CDG-JFK, CDG-LAX, CDG-SFO, CDG-ORD, CDG-MIA\n"
            "- How to book: Flying Blue (Promo Awards significantly reduce price), Delta SkyMiles, Air Canada Aeroplan\n"
            "- Flying Blue Promo: Check monthly — 30-50% off selected routes\n\n"
            "SWISS INTERNATIONAL BUSINESS CLASS:\n"
            "- Excellent product on A340 and A330, Swiss hospitality, best business class food in Europe\n"
            "- Routes: ZRH-JFK, ZRH-LAX, ZRH-SFO, ZRH-ORD, ZRH-MIA\n"
            "- How to book: Air Canada Aeroplan (no surcharges on Swiss via Aeroplan)\n\n"
            "TIER 3 — GOOD BUSINESS CLASS:\n\n"
            "UNITED POLARIS:\n"
            "- Fully flat, direct aisle access, good food, reliable — not flashy but consistently good\n"
            "- Routes: United's entire international network\n"
            "- How to book: United MileagePlus (own metal), Air Canada Aeroplan\n\n"
            "DELTA ONE:\n"
            "- Fully flat, direct aisle access on new aircraft (Delta One Suites with door on A350), good food, excellent IFE\n"
            "- Delta One Suites (best): A350 and select 767 routes\n"
            "- How to book: Delta SkyMiles (own metal — dynamic pricing), Virgin Atlantic Flying Club (excellent for booking Delta One)\n"
            "- Virgin Atlantic sweet spot: ~50,000 miles for Delta One transatlantic\n\n"
            "AMERICAN AIRLINES FLAGSHIP BUSINESS:\n"
            "- 787/777/767 — direct aisle access, fully flat, inconsistent food quality\n"
            "- Routes: AA's international network\n"
            "- How to book: AAdvantage miles (own metal)\n\n"
            "JETBLUE MINT:\n"
            "- Best domestic/transatlantic business class for the price — suite with closing door, flat bed, genuinely excellent food and service\n"
            "- Routes: JFK-LAX, JFK-SFO, JFK-LHR, JFK-CDG, JFK-AMS, BOS-LHR (expanding)\n"
            "- How to book: TrueBlue points (fare-based), Chase UR transfer to JetBlue, Amex MR transfer to JetBlue\n"
            "- Cash price comparison: JetBlue Mint transcon often $500-$1,000 vs $2,000-$4,000 on AA/UA/DL for premium transcon\n\n"
            "ANGLED-FLAT WARNING: Several airlines still operate angled-flat seats on some aircraft — you don't fully lie flat, you're on a slope. Avoid these if comfort is priority:\n"
            "- Air Canada (some older 767 routes)\n"
            "- Older Lufthansa routes\n"
            "- Some Swiss routes\n"
            "- American on some 767 configurations\n"
            "Always check Seat Guru or the airline's seat map to confirm flat/angled-flat before booking a premium award."
        ),
    },

    {
        "id": "best-first-class-products-ranked",
        "title": "Best First Class Products Worldwide — Ranked and How to Book on Points",
        "category": "cabin_products",
        "tags": ["first class", "Emirates First", "Singapore Suites", "Lufthansa First", "ANA First", "JAL First", "points booking"],
        "valid_as_of": "2026-Q2",
        "summary": "Emirates First Class Suites, Singapore Suites, Lufthansa First (including First Class Terminal), and ANA First are the world's top first class products. All bookable on points, though availability is limited. Cathay Pacific First and JAL First are also exceptional.",
        "content": (
            "First class is where points deliver the most extraordinary value — cash prices are $8,000-$25,000+, but award rates can yield 3-7+ cents per point.\n\n"
            "TIER 1 — WORLD'S BEST FIRST CLASS:\n\n"
            "EMIRATES FIRST CLASS SUITES (A380/777):\n"
            "- The most famous first class in aviation — private suite with closing door, fully flat bed, shower spa (on A380), gourmet dining, Dom Perignon by default\n"
            "- A380 First: 14 suites, personal mini-bar, shower spa access, onboard lounge\n"
            "- 777 First: Similar but no shower, smaller suites\n"
            "- Routes with A380 First: DXB-JFK, DXB-LAX, DXB-LHR, DXB-CDG, DXB-MXP, DXB-SYD, DXB-MEL, and select other routes\n"
            "- Best way to book: Alaska Mileage Plan (no fuel surcharges! — huge advantage). Award cost: ~90,000 Alaska miles one-way for first class to Europe.\n"
            "- Alternative booking: Emirates Skywards own miles (high surcharges — $700-$1,400 in taxes), Qantas Frequent Flyer (surcharges apply)\n"
            "- Alaska + Emirates availability: Emirates releases Emirates First Class award space to Alaska — often better availability than Skywards own inventory\n\n"
            "SINGAPORE AIRLINES SUITES (A380 — First Class):\n"
            "- Not just first class — literally a private suite with a double bed you can share with a companion, full wardrobe, personal butler service, exceptional food\n"
            "- The most exclusive commercial first class experience available\n"
            "- Routes: SIN-LHR (A380), SIN-FRA (A380), SIN-JFK (not First — A350 only does Business), SIN-HKG (A380)\n"
            "- How to book: Singapore KrisFlyer miles (primary), but extremely difficult to find availability\n"
            "- Award cost: ~228,000 KrisFlyer miles Singapore-London round trip Suites\n"
            "- Reality: Availability is extremely limited. Suites are the unicorn of award travel.\n\n"
            "LUFTHANSA FIRST CLASS + FIRST CLASS TERMINAL:\n"
            "- Excellent product: fully private suite, seat converts to true flat bed, outstanding German wine and food\n"
            "- First Class Terminal (FRA only): Separate private terminal — valet parking, private check-in, chauffeur to plane, gourmet restaurant, spa\n"
            "- Routes: FRA/MUC-JFK, FRA-LAX, FRA-SFO, FRA-NRT, FRA-HKG, FRA-ORD\n"
            "- How to book: United MileagePlus (primary path for US travelers — ~110,000 miles transatlantic first class), Air Canada Aeroplan (no surcharges)\n"
            "- United MileagePlus sweet spot: Lufthansa First via United miles — one of the best premium cabin redemptions available\n\n"
            "ANA FIRST CLASS (THE SUITE):\n"
            "- Closing door suite on 777-300ER, one of the widest first class seats in the sky, premium Japanese hospitality\n"
            "- Routes: NRT-JFK, NRT-LAX, NRT-LHR (777-300ER only)\n"
            "- How to book: Virgin Atlantic Flying Club (sweet spot: ~110,000 miles for ANA First one-way), ANA Mileage Club own miles, United MileagePlus\n\n"
            "JAL FIRST CLASS (JAL SUITE):\n"
            "- Fully enclosed suite, best Japanese in-flight dining, exceptional service\n"
            "- Routes: NRT/HND-JFK, NRT/HND-LAX, NRT-LHR (777-300ER)\n"
            "- How to book: American AAdvantage (JAL First: ~80,000 miles one-way JFK-NRT — exceptional value), Alaska Mileage Plan\n"
            "- AAdvantage + JAL: One of the best first class redemptions available to US travelers\n\n"
            "TIER 2 — EXCELLENT FIRST CLASS:\n\n"
            "CATHAY PACIFIC FIRST CLASS:\n"
            "- Fully flat, 82-inch bed, exceptional HK-style hospitality and food\n"
            "- Routes: HKG-JFK, HKG-LHR, HKG-LAX, HKG-SFO, HKG-ORD\n"
            "- How to book: Alaska Mileage Plan (no surcharges), American AAdvantage\n\n"
            "ETIHAD FIRST CLASS (THE RESIDENCE — A380 only):\n"
            "- Three-room suite on A380: living room, bedroom, bathroom with shower — the most private experience in commercial aviation\n"
            "- Routes: AUH-LHR (A380 only)\n"
            "- How to book: Etihad Guest miles, but availability is extremely limited\n\n"
            "AVAILABILITY REALITY CHECK:\n"
            "First class award space is intentionally very limited:\n"
            "- Emirates: More space available than most, especially via Alaska\n"
            "- Lufthansa: Space opens 15 days before departure (good for flexible travelers)\n"
            "- ANA: Very limited via partner programs\n"
            "- JAL: More space available via AAdvantage than most expect\n"
            "- Singapore Suites: Extremely limited — plan 11 months in advance and be flexible with dates\n"
            "Tip: If you see first class availability, book immediately — it won't last."
        ),
    },

    {
        "id": "premium-economy-guide",
        "title": "Premium Economy — Is It Worth Points? Complete Guide",
        "category": "cabin_products",
        "tags": ["premium economy", "economy plus", "comfort plus", "main cabin extra", "worth it"],
        "valid_as_of": "2026-Q2",
        "summary": "Premium economy sits between economy and business class. Generally 4-8 inches more legroom, wider seats, better food. Best on 8+ hour flights. Usually NOT worth using points — points value is better used for business class upgrades. Best premium economy: Japan Airlines, Singapore, ANA, Virgin Atlantic.",
        "content": (
            "Premium economy exists at every major international carrier but varies significantly in quality and value.\n\n"
            "WHAT IS PREMIUM ECONOMY?\n"
            "A separate cabin between economy and business class, typically featuring:\n"
            "- 4-8 more inches of seat pitch (legroom) vs economy\n"
            "- Wider seats (usually 18-21 inches vs 17 in economy)\n"
            "- Larger recline\n"
            "- Better meal service (usually a separate menu from economy)\n"
            "- Priority boarding\n"
            "- Extra baggage allowance\n"
            "- On some carriers: dedicated cabin, better IFE screen\n\n"
            "PREMIUM ECONOMY IS NOT:\n"
            "- A flat bed (you're still upright, just more comfortably)\n"
            "- Business class food quality (usually)\n"
            "- Lie-flat on most carriers\n\n"
            "BEST PREMIUM ECONOMY PRODUCTS:\n\n"
            "JAPAN AIRLINES (JAL) PREMIUM ECONOMY:\n"
            "- Best in class — seats with significant recline, ottoman, excellent food matching business class quality on some routes, genuine attentive service\n"
            "- Routes: NRT-JFK, NRT-LAX, NRT-LHR, and most JAL long-haul\n\n"
            "SINGAPORE AIRLINES PREMIUM ECONOMY:\n"
            "- 8-inch wider seat than economy, 8 more inches of legroom, dedicated cabin, upgraded meal service, amenity kit\n"
            "- One of the best premium economy seats in the sky\n\n"
            "ANA PREMIUM ECONOMY:\n"
            "- Spacious, good Japanese food service, quieter cabin\n"
            "- Routes: NRT-JFK, NRT-LAX, NRT-LHR\n\n"
            "VIRGIN ATLANTIC PREMIUM (UPPER CLASS IS BUSINESS — PREMIUM IS THE MIDDLE):\n"
            "- Good seat, wider than economy, reasonable recline, decent food\n"
            "- Routes: LHR-JFK, LHR-LAX, and other transatlantic routes\n\n"
            "AIR FRANCE PREMIUM ECONOMY:\n"
            "- Separate cabin, wide seat, good French food, champagne\n"
            "- Routes: Most Air France long-haul departing CDG\n\n"
            "IS PREMIUM ECONOMY WORTH POINTS?\n"
            "Generally NO — here's why:\n"
            "- Premium economy usually costs 50-100% more miles than economy\n"
            "- Business class often costs only 50-100% more miles than premium economy\n"
            "- The value-per-point jump from economy → business is much better than economy → premium economy\n"
            "- Use points for the leap to business class, pay cash for premium economy if you want the upgrade\n\n"
            "WHEN PREMIUM ECONOMY MAKES SENSE ON POINTS:\n"
            "- No business class award availability on the date you need\n"
            "- The route doesn't have a good business class product (some economy-heavy routes)\n"
            "- You have excess points in a program that doesn't have good business class partners\n"
            "- Flight is under 6 hours (business class less necessary)\n\n"
            "DOMESTIC PREMIUM ECONOMY (ECONOMY PLUS):\n"
            "- United Economy Plus, Delta Comfort+, American Main Cabin Extra — these are just extra legroom seats in economy, not a separate cabin\n"
            "- Typically included for elite status holders or purchasable for $20-$150 depending on route\n"
            "- Almost never worth using points for — the marginal value is too low"
        ),
    },

    {
        "id": "finding-correct-aircraft-for-route",
        "title": "How to Find Out Which Aircraft Operates Your Route",
        "category": "cabin_products",
        "tags": ["aircraft type", "seat guru", "equipment", "flat bed", "business class", "route research"],
        "valid_as_of": "2026-Q2",
        "summary": "Aircraft type determines cabin quality. A380 or 777-300ER on your route means premium products. 737 or A320 means economy-focused. Tools: SeatGuru, FlightAware, ExpertFlyer. Always verify before booking an award.",
        "content": (
            "Not all business class is equal — the aircraft type determines which product you get. A 'business class' ticket on a 737 is just a slightly nicer economy seat. A 'business class' seat on a 777-300ER can be a lie-flat private suite.\n\n"
            "HOW TO FIND YOUR AIRCRAFT:\n\n"
            "SEATGURU (seatguru.com):\n"
            "- Enter airline, flight number, and date → shows exact aircraft type and seat configuration\n"
            "- Color-coded seat maps showing good, bad, and premium seats\n"
            "- Links to airline-specific guides for each aircraft type\n"
            "- Essential tool for any premium class booking\n\n"
            "FLIGHTAWARE:\n"
            "- Search historical data for which aircraft typically operates your route\n"
            "- Useful when specific dates aren't available yet in booking systems\n"
            "- Shows aircraft substitution history (when airlines swap planes)\n\n"
            "EXPERTFLYER:\n"
            "- More powerful — shows fare class availability, seat maps, award space\n"
            "- Can set alerts for aircraft changes on your booking\n\n"
            "AIRLINE MOBILE APPS:\n"
            "- Most airline apps show aircraft type under flight details before booking\n"
            "- United app: Shows United Polaris (lie-flat) vs Economy Plus vs Basic Economy clearly\n\n"
            "KEY AIRCRAFT TO KNOW:\n\n"
            "WIDE-BODY (ALWAYS BEST FOR INTERNATIONAL PREMIUM):\n"
            "- Boeing 777-300ER: Most common premium long-haul aircraft. Emirates, Qatar, ANA, JAL, Air France, Swiss use for best products.\n"
            "- Airbus A380: Emirates (First Suite, shower), Singapore (Suites, business), Qantas, British Airways. Large, often best products.\n"
            "- Boeing 787 Dreamliner (787-9, 787-8): ANA (The Room on 787), United Polaris, Singapore, JAL, Norwegian. Good to excellent premium products.\n"
            "- Airbus A350-900/1000: Qatar Q Suite (best business class), Singapore, Delta One Suites, Cathay, Lufthansa. Modern, excellent products.\n"
            "- Boeing 767-300ER: Delta One (some routes), American 777 on less premium routes. Mixed — some routes have good flat beds, some don't.\n"
            "- Airbus A330: Air France, Finnair, Lufthansa regional routes. Good products on some carriers.\n\n"
            "NARROW-BODY (DOMESTIC/SHORT-HAUL — no flat beds):\n"
            "- Boeing 737: All US domestic carriers, Southwest. Recliner seats at best.\n"
            "- Airbus A320/A321: American, JetBlue (except Mint A321), United. Recliner seats.\n"
            "- JetBlue A321 (Mint): Exception — has lie-flat suite product on select transcon routes.\n\n"
            "AIRCRAFT SUBSTITUTION WARNING:\n"
            "Airlines sometimes substitute aircraft, especially on routes with varying demand. Your booked 777-300ER flight could be changed to a 767 without notice. If you're redeeming premium points for a specific product:\n"
            "1. Check aircraft before booking\n"
            "2. Set an ExpertFlyer alert for aircraft changes\n"
            "3. If changed to an inferior aircraft, call the airline — often can get moved to another flight with the right equipment or receive a partial refund of miles"
        ),
    },
]