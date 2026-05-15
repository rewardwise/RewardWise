"""
rag/kb/destinations.py
───────────────────────
Comprehensive destination guides for major travel markets.
Best time to visit, which airports, which programs have award availability,
typical cash price ranges, and points vs cash verdict.

CATEGORY: destinations
VALID AS OF: 2026-Q2
"""

from __future__ import annotations

DESTINATIONS_KB: list[dict] = [

    {
        "id": "destination-tokyo-japan",
        "title": "Tokyo, Japan — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Tokyo", "Japan", "NRT", "HND", "ANA", "JAL", "transpacific", "cherry blossom"],
        "valid_as_of": "2026-Q2",
        "summary": "Tokyo is one of the best points redemption destinations — premium cabin awards yield 4-7cpp. Best programs: Virgin Atlantic for ANA, AAdvantage for JAL First. Best time: Oct-Nov or early March. Avoid Golden Week and cherry blossom peak for award availability.",
        "content": (
            "Tokyo is arguably the single best destination for premium cabin points redemptions in the world. "
            "The combination of world-class airline products (ANA The Room, JAL Suite), high cash prices for premium cabins ($4,000-$12,000), and accessible award rates makes Tokyo a dream destination for points travelers.\n\n"
            "AIRPORTS:\n"
            "Narita (NRT): Main international hub, 60-90 minutes from central Tokyo. Most US carriers and long-haul international flights land here. ANA and JAL both have excellent lounge facilities.\n"
            "Haneda (HND): Closer to central Tokyo (30-40 min), increasingly popular for international routes. Some US carriers now fly HND — check which airport your flight uses as it matters significantly for convenience.\n\n"
            "BEST POINTS PROGRAMS FOR TOKYO:\n"
            "1. Virgin Atlantic Flying Club → ANA: 60,000 miles one-way business class from US West Coast, 65,000 from East Coast. No fuel surcharges. ANA The Room is the best business class product on the route. This is the #1 sweet spot for Tokyo on points.\n"
            "2. American AAdvantage → JAL: ~60,000 miles business class one-way, ~110,000 miles first class. JAL First Class Suites are exceptional. No fuel surcharges.\n"
            "3. Alaska Mileage Plan → JAL: 55,000 miles business class — slightly cheaper than AAdvantage. Alaska's fixed chart is very competitive for Japan.\n"
            "4. United MileagePlus → ANA: 88,000 miles business class round trip (saver). Good option if you have United miles, but Virgin Atlantic is often better value.\n"
            "5. Air Canada Aeroplan → ANA/JAL: Competitive distance-based pricing. No fuel surcharges on ANA. Good alternative if you have Aeroplan points.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy: $600-$1,400 depending on season and gateway city. LAX and SFO typically cheaper than EWR/JFK.\n"
            "Premium Economy: $1,500-$3,000\n"
            "Business Class: $4,000-$8,000 (peak season can hit $10,000+)\n"
            "First Class: $8,000-$15,000+\n\n"
            "CPP MATH: 60,000 Virgin Atlantic miles + ~$100 in fees for a $5,000 business class seat = 8.2 cpp. Among the best redemptions in all of award travel.\n\n"
            "BEST TIME TO VISIT:\n"
            "October-November: Best overall. Autumn foliage (koyo) peaks in late October/early November. Cool weather, fewer tourists than spring, good award availability.\n"
            "Early March: Before cherry blossom peak. Prices lower, availability better.\n"
            "Late January-February: Cheapest. Cold but manageable, best award availability, fewer crowds.\n\n"
            "AVOID FOR POINTS:\n"
            "Cherry Blossom Season (late March-early April): Exact timing varies by year. Award space is nearly impossible. Book 11 months in advance if targeting this period.\n"
            "Golden Week (April 29-May 5): Japan's busiest domestic travel period. International awards scarce, flights packed.\n"
            "Obon (mid-August): Major Japanese holiday, domestic travel peak.\n"
            "New Year (Dec 28-Jan 5): Very high demand.\n\n"
            "AWARD AVAILABILITY TIPS:\n"
            "ANA releases award space at 355 days before departure. Set calendar reminders and check exactly at the 355-day mark for peak travel dates.\n"
            "JAL also releases at 355 days via AAdvantage and Alaska.\n"
            "Last-minute (within 30 days): Occasionally ANA releases space for partner programs close to departure — worth checking if you're flexible.\n\n"
            "TOKYO PRACTICAL NOTES:\n"
            "IC card (Suica/Pasmo): Load before leaving airport. Works on all trains, subways, some convenience stores.\n"
            "JR Pass: Worth buying if you plan bullet train travel to Kyoto, Osaka, etc. Must purchase outside Japan.\n"
            "Neighborhoods to stay: Shinjuku (central, transport hub), Shibuya (shopping, nightlife), Ginza (luxury), Asakusa (traditional), Akihabara (electronics).\n"
            "Best hotel programs: Hyatt (Park Hyatt Tokyo from Lost in Translation fame, Andaz Tokyo), Hilton (Conrad Tokyo), Marriott (multiple properties)."
        ),
    },

    {
        "id": "destination-london-uk",
        "title": "London, UK — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["London", "LHR", "LGW", "STN", "transatlantic", "British Airways", "Virgin Atlantic", "UK APD"],
        "valid_as_of": "2026-Q2",
        "summary": "London is the most-served transatlantic route with the most program options. Key consideration: UK Air Passenger Duty (APD) adds $70-$500 to award tickets in departure taxes. Best programs: Aeroplan for Star Alliance, Virgin Atlantic for Delta One. Avoid BA's own fuel surcharges.",
        "content": (
            "London is the most competitive transatlantic market — dozens of airlines fly US-LHR daily, giving more award options than almost any other route.\n\n"
            "AIRPORTS:\n"
            "Heathrow (LHR): Main international hub, well-connected to central London (Heathrow Express: 15 min, Elizabeth line: 40 min). Most US carriers and all major European carriers use LHR. Best lounge access here — BA Concorde Room, Cathay Pacific, American Flagship.\n"
            "Gatwick (LGW): Secondary airport, 30 miles south. Budget carriers, some BA and Norwegian flights. 30-45 min to Victoria by Gatwick Express.\n"
            "Stansted (STN): Budget carrier hub (Ryanair). Far from center, not ideal for most award travelers.\n"
            "London City (LCY): Small business-focused airport near Canary Wharf. British Airways A318 all-business class JFK flight (via Shannon) departs here — unique product.\n\n"
            "UK AIR PASSENGER DUTY (APD) — CRITICAL TAX:\n"
            "The UK departure tax is one of the highest in the world and adds significantly to award ticket costs when departing from any UK airport.\n"
            "Economy/Premium Economy departing UK: ~£13-£16 per person\n"
            "Business Class departing UK: ~£200-£220 per person (~$260-$290)\n"
            "First Class departing UK: ~£220-£280 per person (~$290-$370)\n"
            "This is a government tax — cannot be avoided, applies to all awards departing UK regardless of program.\n"
            "Strategy: When possible, book London as the ARRIVAL, not departure. Fly to London on points, return on a separate ticket or use points differently.\n\n"
            "BEST PROGRAMS FOR US-LONDON:\n"
            "1. Air Canada Aeroplan: Best overall for Star Alliance partners (Lufthansa, Swiss, ANA, etc.) connecting through London. No significant surcharges.\n"
            "2. Virgin Atlantic Flying Club: Best for Delta One transatlantic (~50,000 miles, excellent value). Also good for Virgin Atlantic metal.\n"
            "3. United MileagePlus: Good for United metal (no fuel surcharges). Star Alliance partner awards available.\n"
            "4. American AAdvantage: Good for AA metal and some partner awards. Oneworld partners accessible.\n"
            "5. British Airways Avios: AVOID for long-haul — fuel surcharges on BA metal transatlantic can be $400-$800. Exception: use Avios for AA metal flights (no BA surcharges when booking AA).\n"
            "6. Alaska Mileage Plan: Can book BA metal without surcharges — a workaround for accessing BA flights cheaply.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy: $400-$1,200 (huge seasonal variation)\n"
            "Premium Economy: $1,200-$3,000\n"
            "Business Class: $3,000-$8,000 (Virgin Upper, BA Club World, AA Flagship, United Polaris, Delta One)\n"
            "First Class: $6,000-$15,000\n\n"
            "BEST TIME TO VISIT:\n"
            "June-August: Peak season, best weather but highest prices and crowded.\n"
            "September-October: Excellent — mild weather, fewer crowds, lower prices.\n"
            "April-May: Good, spring weather, moderate prices.\n"
            "January-February: Cheapest, grey and cold but best award availability.\n\n"
            "AVOIDING PEAK PERIODS FOR AWARDS:\n"
            "Summer (Jun-Aug): Book 10-11 months out for any premium cabin space.\n"
            "Christmas week: Virtually no saver award space — book 11 months out or pay cash.\n"
            "Spring break: March-April spike, book 6+ months ahead.\n\n"
            "HOTELS IN LONDON:\n"
            "Hyatt: Andaz London Liverpool Street, Great Scotland Yard, Park Hyatt (opening). Chase UR → Hyatt is best path.\n"
            "IHG: InterContinental London Park Lane, Kimpton Fitzroy. Chase → IHG works well.\n"
            "Marriott: Multiple Marriott and Autograph Collection properties throughout.\n"
            "Hilton: London Hilton on Park Lane, several Curio Collection hotels. Amex → Hilton at 1:2 ratio.\n\n"
            "PRACTICAL NOTES:\n"
            "Oyster Card: Load at Heathrow for all tube and bus travel. Contactless cards also work directly.\n"
            "Congestion Charge: £15/day to drive in central London — not an issue for transit travelers.\n"
            "Neighborhoods: Mayfair/Westminster (tourist/luxury), Shoreditch (trendy), South Bank (cultural), Notting Hill (picturesque), Chelsea (upscale residential)."
        ),
    },

    {
        "id": "destination-paris-france",
        "title": "Paris, France — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Paris", "CDG", "ORY", "Air France", "Flying Blue", "Promo Awards", "transatlantic"],
        "valid_as_of": "2026-Q2",
        "summary": "Paris CDG is a major transatlantic hub. Best program: Flying Blue Promo Awards (monthly discounts of 25-50%). Air France Business La Première is excellent. French departure tax adds €20-45 to award tickets. Best time: April-May or September-October.",
        "content": (
            "Paris is one of the most visited cities in the world and one of the most connected transatlantic hubs. "
            "The key program here is Flying Blue — Air France's loyalty program with monthly Promo Awards that can dramatically reduce points requirements.\n\n"
            "AIRPORTS:\n"
            "Charles de Gaulle (CDG): Main international hub, 30-45 min from central Paris via RER B train. All US-Paris nonstops land here. Excellent Air France lounges.\n"
            "Orly (ORY): Secondary airport, primarily domestic and European routes. Occasionally some international charters.\n\n"
            "FRENCH SOLIDARITY TAX:\n"
            "France imposes a departure tax on all flights:\n"
            "Economy: €1-€8 depending on destination\n"
            "Business/First departing France: €20-€45 per person\n"
            "This applies to all award tickets departing from French airports.\n\n"
            "BEST PROGRAMS FOR US-PARIS:\n"
            "1. Flying Blue Promo Awards: On the 1st of each month, Flying Blue announces 25-50% discounts on selected routes for the following month. US-Paris CDG routes frequently appear. A transatlantic business class award that normally costs 80,000 miles might drop to 40,000-50,000 during a promo. Check flyingblue.com every 1st of the month.\n"
            "2. Delta SkyMiles: Delta flies CDG from multiple US cities. Dynamic pricing means occasional good deals, but consistency is low.\n"
            "3. Air Canada Aeroplan: Can book Air France metal and other Star Alliance partners connecting through Paris.\n"
            "4. American AAdvantage: For AA metal to CDG (JFK, LAX, MIA, ORD, PHL).\n"
            "5. Flying Blue standard awards: Without Promo Awards, rates are reasonable but not exceptional — business class runs ~100,000-130,000 miles round trip standard.\n\n"
            "FUEL SURCHARGES ON AIR FRANCE:\n"
            "Air France imposes carrier-imposed surcharges on its own metal when booked via Flying Blue. Budget $200-$500 in surcharges for transatlantic business class booked via Flying Blue. Some programs (Aeroplan) book Air France with reduced surcharges — check total cost before booking.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy: $400-$1,100 seasonal\n"
            "Premium Economy (CDG has good premium economy on La Première aircraft): $1,500-$3,500\n"
            "Business Class: $3,500-$8,000\n"
            "La Première (First): $8,000-$15,000+ (one of the best first class products in the world)\n\n"
            "BEST TIME TO VISIT:\n"
            "April-May: Spring in Paris — iconic, moderate prices, good weather.\n"
            "September-October: Late summer warmth, fewer tourists than peak, good award availability.\n"
            "November-March: Cheapest, grey but culturally rich. Christmas markets in December are wonderful.\n\n"
            "AVOID: July-August peak tourist season for award availability and crowds. Award space exists but prices are high and competition fierce.\n\n"
            "HOTELS:\n"
            "Hyatt: Park Hyatt Vendôme (one of the best hotels in the world — 25,000-35,000 Hyatt points/night, cash ~$1,200-$2,000). Excellent Chase UR → Hyatt redemption.\n"
            "Marriott: Multiple properties including Autograph Collection Paris properties.\n"
            "IHG: InterContinental Paris Le Grand (iconic property, 4th night free benefit valuable here).\n"
            "Hilton: Several Curio and full-service properties.\n\n"
            "PARIS PRACTICAL:\n"
            "Metro: Easiest way to get around. 14 lines, extensive coverage. Carnet of 10 tickets or Navigo weekly pass.\n"
            "RER B: CDG to central Paris — €11 one-way. Faster than taxi/Uber for most destinations.\n"
            "Neighborhoods: Le Marais (historic, trendy), Saint-Germain (literary, cafés), Montmartre (artistic, views), 8th arrondissement (Champs-Élysées, luxury hotels), 1st (Louvre, central)."
        ),
    },

    {
        "id": "destination-dubai-uae",
        "title": "Dubai, UAE — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Dubai", "DXB", "Emirates", "First Class", "Alaska", "Skywards", "Middle East"],
        "valid_as_of": "2026-Q2",
        "summary": "Dubai is the world's busiest international airport and the hub for Emirates. Best redemption: Emirates First Class via Alaska Mileage Plan (no fuel surcharges — saves $600+). Emirates First Class Suites with shower are the world's most famous premium product. Best time: October-April.",
        "content": (
            "Dubai is a luxury travel destination and a major hub for onward connections to Africa, South Asia, and Southeast Asia. "
            "The primary draw for points travelers is Emirates First Class — one of the most famous luxury products in commercial aviation, accessible via Alaska Mileage Plan without the high fuel surcharges Emirates charges through its own program.\n\n"
            "AIRPORTS:\n"
            "Dubai International (DXB): World's busiest international airport. Emirates is the dominant carrier. Exceptional duty-free shopping and lounge facilities. Emirates First Class Lounge at DXB is spectacular.\n"
            "Al Maktoum (DWC): Second airport, primarily cargo and budget airlines. Not relevant for most travelers.\n\n"
            "EMIRATES BOOKING STRATEGY:\n"
            "VIA ALASKA MILEAGE PLAN (best option):\n"
            "- Economy: ~35,000 miles one-way from US East Coast\n"
            "- Business Class: ~58,000-72,000 miles one-way from US\n"
            "- First Class: ~85,000-110,000 miles one-way from US\n"
            "- Fuel surcharges: NONE. Alaska doesn't pass Emirates' carrier-imposed fees.\n"
            "- Total cash cost: typically $30-$80 in government taxes only\n"
            "- Compare to Skywards: same flight in First Class via Skywards would add $600-$1,200 in surcharges\n\n"
            "VIA EMIRATES SKYWARDS (only if Alaska has no availability):\n"
            "- Similar mileage cost but adds $300-$1,200 in carrier-imposed surcharges\n"
            "- Only consider if no Alaska availability and you have Skywards miles\n\n"
            "EMIRATES FIRST CLASS SUITES (A380):\n"
            "The A380 First Class has 14 private suites with closing doors, minibar, 23-inch TV, and access to two shower spas onboard. The shower at 40,000 feet is the most famous amenity in aviation. Champagne (Dom Perignon and Moët) served throughout. One of the most memorable travel experiences possible.\n"
            "Routes with A380 First: DXB-JFK, DXB-LAX, DXB-LHR, DXB-CDG, DXB-MXP, DXB-SYD, DXB-MEL, DXB-JNB, and others — check aircraft type before booking.\n\n"
            "777 First Class: Also exceptional — private suite, fully flat bed, but no shower.\n\n"
            "AVAILABILITY:\n"
            "Emirates releases First Class space to Alaska — sometimes excellent availability, other times extremely limited. Best to check seats.aero or search directly on alaskaair.com. Availability varies dramatically by date and route.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy: $700-$1,500 from US East Coast\n"
            "Business Class (lie-flat, direct aisle): $3,000-$6,000\n"
            "First Class (private suite): $8,000-$20,000+\n\n"
            "BEST TIME TO VISIT DUBAI:\n"
            "October-April: Ideal. Pleasant temperatures (20-30°C/68-86°F). Peak tourist season Dec-Feb.\n"
            "May-September: Extremely hot (40-48°C/104-118°F) and humid. Lowest prices. Not recommended for outdoor activities but hotels discount heavily.\n\n"
            "DUBAI PRACTICAL:\n"
            "Dubai Metro: Clean, air-conditioned, connects airport to downtown and marina.\n"
            "Tax-free shopping: Dubai has no VAT on most goods. Excellent duty-free.\n"
            "Neighborhoods: Downtown (Burj Khalifa, Dubai Mall), Dubai Marina (waterfront, expat hub), Palm Jumeirah (island resorts), Deira (historic, gold souk), JBR (beach).\n\n"
            "HOTELS:\n"
            "Hyatt: Grand Hyatt Dubai, Park Hyatt Dubai. Solid options at good rates.\n"
            "Marriott: JW Marriott Marquis (one of world's tallest hotels), W Dubai, and many others.\n"
            "IHG: InterContinental Dubai Festival City.\n"
            "Note: Dubai has world-class luxury hotels (Burj Al Arab, Atlantis, Armani) not part of standard points programs."
        ),
    },

    {
        "id": "destination-singapore",
        "title": "Singapore — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Singapore", "SIN", "Changi", "Singapore Airlines", "Suites", "Star Alliance", "Asia"],
        "valid_as_of": "2026-Q2",
        "summary": "Singapore Changi (SIN) is the world's best airport. Singapore Airlines Suites are the most exclusive commercial first class. Best for stopover on Asia trips. Best time: February-April. Excellent food, safety, and efficiency make it a top destination.",
        "content": (
            "Singapore is one of the most livable and visitor-friendly cities in the world. "
            "For points travelers, it's home to the world's best airport (Changi) and one of the most legendary airline products (Singapore Airlines Suites).\n\n"
            "AIRPORT:\n"
            "Changi Airport (SIN): Consistently rated the world's best airport. Features indoor gardens, butterfly garden, slide, swimming pool, movie theaters, and exceptional dining — all within the terminal. The Jewel Changi mall is attached to Terminal 1. Priority Pass access to excellent lounges (SATS Premier, Plaza Premium). Singapore Airlines' SilverKris and First Class lounges are exceptional for eligible passengers.\n\n"
            "SINGAPORE AIRLINES SUITES (First Class — A380):\n"
            "The most exclusive commercial first class product. A private suite with a closing door, double bed (couples can request bed configuration), full-height sliding doors for complete privacy, butler service. Available on: SIN-LHR, SIN-FRA, SIN-SYD (A380 routes).\n"
            "Booking: Singapore KrisFlyer miles are the primary path. Extremely limited availability. 228,000 KrisFlyer miles round trip Singapore-London in Suites. Check availability 12 months in advance and set ExpertFlyer alerts.\n\n"
            "SINGAPORE AIRLINES BUSINESS CLASS (excellent, more accessible):\n"
            "A350, 787, A380 business class is world-class — direct aisle access, flat bed, Book the Cook menu.\n"
            "Best booking paths:\n"
            "- Virgin Atlantic Flying Club: ~63,000 miles one-way US-Singapore business class\n"
            "- Air Canada Aeroplan: Competitive distance-based pricing\n"
            "- KrisFlyer: 96,000 miles round trip Singapore-North America business\n\n"
            "SINGAPORE AS STOPOVER:\n"
            "Many award programs allow a free stopover in Singapore when routing through SIN. Air Canada Aeroplan is particularly generous with stopovers. Spend 1-3 nights exploring Singapore on the way to another Asian destination — extends your trip without extra miles.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy SIN-JFK (world's longest nonstop, 18+ hours): $900-$2,000\n"
            "Business Class: $5,000-$12,000\n"
            "Suites (First): $15,000-$25,000+\n\n"
            "BEST TIME TO VISIT:\n"
            "February-April: Driest months, relatively cooler (though always warm and humid).\n"
            "December-January: Also good, some rain but festive season.\n"
            "Singapore has no true seasons — tropical climate year-round (26-32°C/79-90°F always).\n\n"
            "HOTELS:\n"
            "Hyatt: Andaz Singapore (excellent, Orchard Road). Strong Chase UR → Hyatt value.\n"
            "IHG: InterContinental Singapore. 4th night free benefit applies.\n"
            "Marriott: W Singapore, St. Regis Singapore, JW Marriott.\n"
            "Hilton: Conrad Centennial Singapore.\n"
            "Luxury (non-points): Marina Bay Sands (iconic infinity pool), Raffles Singapore (historic, recently renovated).\n\n"
            "PRACTICAL:\n"
            "MRT: World-class metro system. Connects airport (Changi Airport Station) to all major areas.\n"
            "EZ-Link Card: Reloadable card for all public transit. Buy at airport.\n"
            "Hawker Centers: Singapore's food culture centers on these outdoor food courts — best food at cheapest prices. Maxwell Food Centre, Lau Pa Sat, Chinatown Complex.\n"
            "Safety: Singapore is one of the safest cities globally. Strict laws (no gum, no jaywalking fines, etc.)."
        ),
    },

    {
        "id": "destination-cancun-caribbean",
        "title": "Cancun and Caribbean — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Cancun", "CUN", "Caribbean", "Punta Cana", "Jamaica", "Bahamas", "points vs cash"],
        "valid_as_of": "2026-Q2",
        "summary": "Caribbean and Mexico are often NOT ideal for points — economy cash prices get very low ($150-$400) in off-peak, making CPP below 1.0. Best use of points: when cash prices exceed $500+, or for resort credit card benefits. Best time: December-April. Hurricane season September-October.",
        "content": (
            "The Caribbean and Mexico are among the most popular US vacation destinations, but also among the worst for points redemptions — at least for economy class. "
            "Understanding when to pay cash vs use points here is essential.\n\n"
            "MAJOR DESTINATIONS AND AIRPORTS:\n"
            "Cancun (CUN): Most popular, massive resort strip (Hotel Zone), excellent food in downtown Cancun. Served from virtually every US city.\n"
            "Punta Cana (PUJ): Dominican Republic, all-inclusive resort hub. Many charter flights.\n"
            "Montego Bay (MBJ): Jamaica, popular for resorts and beaches.\n"
            "Nassau (NAS): Bahamas, 35-minute flight from Miami. Atlantis resort hub.\n"
            "Aruba (AUA): Outside the hurricane belt, year-round destination.\n"
            "San Juan (SJU): Puerto Rico — US territory, no passport required. Good entry point for US travelers.\n"
            "St. Lucia (UVF): More upscale, volcanic island, luxury resorts.\n"
            "Grand Cayman (GCM): Diving, Seven Mile Beach, financial hub.\n\n"
            "POINTS VS CASH REALITY CHECK:\n"
            "Economy tickets MIA-CUN in January: Often $150-$250 round trip.\n"
            "Award cost: 15,000-25,000 miles round trip.\n"
            "CPP: $200/20,000 miles = 1.0 cpp — mediocre at best.\n"
            "Verdict: Pay cash. Save your miles for international premium cabins worth 3-7 cpp.\n\n"
            "WHEN POINTS MAKE SENSE FOR CARIBBEAN:\n"
            "- Spring break (March-April): Cash prices spike to $500-$900. At $700 for a $25k award, you're getting 2.8 cpp — better.\n"
            "- Christmas/New Year: Cash prices hit $600-$1,200. Points start to make sense.\n"
            "- Business class: Some routes have good premium awards, though premium service to Caribbean is limited.\n"
            "- Southwest Rapid Rewards: Since awards = % of cash price, the consistency matters. Points work well here for the predictability.\n\n"
            "BEST PROGRAMS FOR CARIBBEAN/MEXICO:\n"
            "Southwest Rapid Rewards: Best domestic airline for Caribbean — flies many routes, flat-tax award model, no change fees, bags fly free.\n"
            "JetBlue TrueBlue: Strong Caribbean network (Fort Lauderdale, Boston, JFK to Caribbean). Dynamic pricing means watching for fare dips.\n"
            "American AAdvantage: Large Caribbean network from MIA hub.\n"
            "Delta SkyMiles: Good Atlanta hub coverage for Caribbean.\n\n"
            "CREDIT CARD RESORT BENEFITS (often better than points for Caribbean):\n"
            "Amex Platinum: Fine Hotels + Resorts program. Book certain Caribbean resorts for $200 hotel credit, room upgrades, early check-in, late checkout, daily breakfast.\n"
            "Chase Sapphire Reserve: The Edit hotels. Similar benefits at select properties.\n"
            "These programs often provide $300-$600 in value at the same cash rate — better than converting the cost to miles.\n\n"
            "BEST TIME TO VISIT:\n"
            "December-April: Peak season, best weather, but highest prices.\n"
            "May: Good shoulder — weather still nice, prices drop post-spring break.\n"
            "September-October: Hurricane season technically, but often clear. Cheapest prices by far. Many travelers avoid this period creating opportunity for flexible travelers.\n"
            "Note: Hurricane risk is real in September-October — buy travel insurance.\n\n"
            "ALL-INCLUSIVE STRATEGY:\n"
            "All-inclusive resorts often aren't bookable with points programs. Credit card benefits (FHR, The Edit) apply to some luxury properties. For pure all-inclusives (Sandals, Iberostar, Secrets), cash or travel agent rates are typically the only option."
        ),
    },

    {
        "id": "destination-hawaii",
        "title": "Hawaii — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Hawaii", "HNL", "OGG", "KOA", "LIH", "Alaska", "Hawaiian Airlines", "Atmos"],
        "valid_as_of": "2026-Q2",
        "summary": "Hawaii is excellent for points — economy awards from West Coast start at 12,500-25,000 miles. Best programs: Alaska Mileage Plan (excellent Hawaii rates), Southwest (Companion Pass makes Hawaii trips exceptional value). Best islands: Maui for luxury, Big Island for adventure, Kauai for scenery.",
        "content": (
            "Hawaii is one of the most consistent good-value points redemptions from the US mainland — particularly from West Coast cities. "
            "The distance (2,400-5,000 miles from mainland), lack of budget airline competition, and high demand keep cash prices elevated enough that points deliver solid CPP.\n\n"
            "AIRPORTS AND ISLANDS:\n"
            "Oahu — Honolulu (HNL): Main hub. Most international and mainland flights land here. Home to Waikiki, Diamond Head, Pearl Harbor.\n"
            "Maui — Kahului (OGG): Second largest. Luxury resorts, whale watching (Jan-April), Road to Hana.\n"
            "Big Island — Kona (KOA) and Hilo (ITO): Two airports. Kona for West side (resorts, snorkeling). Hilo for East side (Volcano National Park, waterfalls).\n"
            "Kauai — Lihue (LIH): Smallest major island. Most dramatic scenery — Na Pali Coast, Waimea Canyon. Fewer direct mainland flights.\n"
            "Molokai and Lanai: Small islands, inter-island flights only.\n\n"
            "BEST PROGRAMS FOR HAWAII:\n"
            "1. Alaska Mileage Plan: Excellent rates to Hawaii, especially from West Coast. Alaska flies HNL, OGG, KOA, LIH from multiple West Coast cities. Award rates are competitive under their fixed chart.\n"
            "2. Southwest Rapid Rewards + Companion Pass: Southwest flies inter-island Hawaii routes and some mainland-Hawaii. With Companion Pass, your companion flies free — incredible value for Hawaii trips.\n"
            "3. Hawaiian/Atmos (now merging with Alaska): Hawaiian miles accumulate through flights and co-branded Bank of America card. Inter-island travel awards.\n"
            "4. United MileagePlus: United has a strong Hawaii presence. Economy saver awards from West Coast start at 12,500 miles one-way.\n"
            "5. Delta SkyMiles: Delta flies Hawaii from multiple mainland cities. Dynamic pricing means checking specific dates.\n"
            "6. American AAdvantage: AA flies Hawaii from major mainland hubs.\n\n"
            "TYPICAL AWARD RATES (approximate):\n"
            "West Coast → Hawaii economy: 12,500-20,000 miles one-way depending on program\n"
            "East Coast → Hawaii economy: 25,000-40,000 miles one-way\n"
            "First class (limited): 30,000-55,000 miles one-way depending on program and carrier\n\n"
            "CASH PRICE CONTEXT:\n"
            "West Coast → Hawaii economy: $250-$600 depending on season\n"
            "East Coast → Hawaii economy: $400-$900\n"
            "Business Class / First: $1,000-$3,000 (limited premium cabins on most Hawaii routes)\n\n"
            "CPP: At $400 cash/$25,000 miles = 1.6 cpp — solid for economy. Hawaii economy awards are one of the better domestic economy redemptions.\n\n"
            "BEST TIME TO VISIT:\n"
            "April-May: Shoulder season — great weather, lower prices, good availability.\n"
            "September-October: Excellent value — summer crowds gone, prices drop, weather still warm.\n"
            "February-March: Whale watching season on Maui. Mix of good weather and winter deals.\n\n"
            "PEAK PERIODS (book 6+ months out for awards):\n"
            "Summer (June-August): Family travel peak.\n"
            "Christmas-New Year: Highest prices and demand of the year.\n"
            "Spring Break (March-April): Significant spike.\n\n"
            "INTER-ISLAND TRAVEL:\n"
            "Southwest, Hawaiian/Atmos, and Mokulele operate inter-island flights. Short flights (20-45 min), frequent service. Award travel between islands is possible via Hawaiian miles. Southwest Rapid Rewards also works for inter-island Southwest routes.\n\n"
            "HOTELS:\n"
            "Hyatt: Andaz Maui at Wailea, Grand Hyatt Kauai, Hyatt Regency Maui. Exceptional Chase UR → Hyatt for Hawaii luxury.\n"
            "Marriott: Multiple Marriott and Westin properties (Westin Maui, JW Marriott Ihilani).\n"
            "Hilton: Grand Wailea (Maui), Hilton Hawaiian Village (Oahu). 5th night free benefit is useful for week-long stays.\n"
            "IHG: Holiday Inn properties, some Kimpton. 4th night free helps."
        ),
    },

    {
        "id": "destination-rome-italy",
        "title": "Rome and Italy — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Rome", "FCO", "Italy", "Milan", "Venice", "ITA Airways", "transatlantic", "Aeroplan"],
        "valid_as_of": "2026-Q2",
        "summary": "Rome FCO is Italy's main hub. Best programs: Aeroplan for Star Alliance partners, AAdvantage for AA metal to FCO. ITA Airways (former Alitalia) is SkyTeam member but limited US point access. Best time: April-May or September-October. Avoid July-August for crowds.",
        "content": (
            "Italy is one of Europe's most popular travel destinations. Rome (FCO) is the main hub, with Milan (MXP/LIN) and Venice (VCE) as secondary airports for northern Italy.\n\n"
            "AIRPORTS:\n"
            "Rome Fiumicino (FCO): Italy's busiest airport. Direct US flights from JFK, EWR, BOS, ORD, MIA, LAX, ATL, PHX. 30-40 min from central Rome by Leonardo Express train.\n"
            "Milan Malpensa (MXP): Northern Italy's main airport. Some US direct flights. 45-60 min from Milan center.\n"
            "Venice Marco Polo (VCE): Water taxi or bus to Venice. Limited direct US flights — usually connect through European hub.\n"
            "Naples (NAP): Southern Italy gateway. No direct US flights.\n\n"
            "BEST PROGRAMS FOR US-ITALY:\n"
            "1. American AAdvantage: AA flies JFK/EWR-FCO, JFK-MXP, MIA-FCO. 57,500 miles one-way business class (Flagship Business). Competitive rates.\n"
            "2. Air Canada Aeroplan: Books Star Alliance partners routing through European hubs (Lufthansa, Swiss, Brussels to FCO). No fuel surcharges.\n"
            "3. United MileagePlus: United-operated flights and Star Alliance partners. EWR-FCO, EWR-MXP.\n"
            "4. Delta SkyMiles: Delta flies ATL-FCO, JFK-FCO. Dynamic pricing varies significantly.\n"
            "5. Iberia Plus Avios: Can sometimes book connections through MAD to FCO at good rates. Iberia business class Madrid-Rome is short-haul and cheap in Avios.\n\n"
            "ITALY WITHIN EUROPE:\n"
            "Once in Rome, budget carriers (Ryanair, Volotea) and ITA Airways connect to other Italian cities and European destinations cheaply. A short-haul Avios award or cash flight to other Italian cities from Rome is often cheaper and easier than a separate US-Venice or US-Naples booking.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy: $500-$1,200 seasonal\n"
            "Business Class: $3,500-$8,000\n\n"
            "BEST TIME TO VISIT:\n"
            "April-May: Ideal. Spring weather, manageable crowds, reasonable prices.\n"
            "September-October: Also excellent. Post-summer crowds, warm weather, better prices.\n\n"
            "AVOID: July-August — extremely hot (35-40°C/95-104°F in Rome), massive tourist crowds at major sights (Colosseum, Vatican), highest prices.\n\n"
            "MAJOR DESTINATIONS IN ITALY:\n"
            "Rome: Colosseum, Vatican Museums and Sistine Chapel, Trevi Fountain, Pantheon. Allow 3-4 days minimum.\n"
            "Florence: Renaissance art capital. Uffizi Gallery, Duomo, Ponte Vecchio. 2-3 days.\n"
            "Venice: Unique canal city. St. Mark's Basilica, gondolas. 2 days (it's small).\n"
            "Amalfi Coast: Positano, Ravello — requires rental car or ferry from Naples.\n"
            "Cinque Terre: Five coastal villages — train accessible from Genoa or Florence.\n"
            "Sicily: Separate island, ferry or flight from mainland. Less touristed, excellent food.\n\n"
            "HOTELS:\n"
            "Hyatt: Park Hyatt Milano (excellent property, strong Hyatt redemption). Limited Hyatt in Rome.\n"
            "Marriott: Multiple Rome properties including JW Marriott Rome and Autograph Collection.\n"
            "IHG: InterContinental Rome Ambasciatori Palace.\n"
            "Hilton: Limited but growing presence in Italy."
        ),
    },

    {
        "id": "destination-barcelona-spain",
        "title": "Barcelona and Spain — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Barcelona", "BCN", "Madrid", "MAD", "Spain", "Iberia", "Avios", "transatlantic"],
        "valid_as_of": "2026-Q2",
        "summary": "Barcelona and Madrid are excellent points destinations. Iberia Plus Avios is the best program — transatlantic business to Madrid/Barcelona at 34,000 Avios one-way during off-peak (one of the cheapest business class rates in the world). Best time: May-June or September-October.",
        "content": (
            "Spain is one of the best value destinations for transatlantic business class redemptions, primarily because Iberia Plus has among the lowest Avios rates for transatlantic business class.\n\n"
            "AIRPORTS:\n"
            "Barcelona El Prat (BCN): Catalonia's main airport. Direct US flights from JFK, EWR, BOS, LAX, MIA, ORD.\n"
            "Madrid Barajas (MAD): Spain's main hub and Iberia's home. More direct US connections. World-class Iberia lounges at MAD.\n\n"
            "THE IBERIA AVIOS SWEET SPOT:\n"
            "Iberia Plus uses Avios with significantly different (lower) pricing for flights on Iberia metal than British Airways uses for its own flights. This is one of the best-kept secrets in award travel:\n"
            "- Off-peak transatlantic business class (Iberia metal): 34,000 Avios one-way JFK/EWR/BOS-MAD/BCN\n"
            "- Peak transatlantic business class: 51,000 Avios one-way\n"
            "- Off-peak economy: 17,000 Avios one-way\n"
            "- Compare: British Airways charges 50,000+ Avios for the same transatlantic business class on BA metal, plus $400-$800 in fuel surcharges\n\n"
            "Iberia charges much lower fuel surcharges than BA on its own metal — typically $50-$150 vs BA's $400-800.\n\n"
            "HOW TO EARN IBERIA AVIOS:\n"
            "- Transfer Chase Ultimate Rewards → Iberia Plus (1:1)\n"
            "- Transfer Amex Membership Rewards → Iberia Plus (1:1)\n"
            "- Pool Avios from BA Executive Club, Iberia Plus, Aer Lingus AerClub, Qatar Privilege Club\n"
            "- British Airways co-branded Chase card earns Avios usable in Iberia Plus\n\n"
            "OFF-PEAK VS PEAK: Iberia defines specific off-peak dates — check iberia.com for current off-peak calendar. Generally Jan-Feb and mid-Sep to mid-Nov.\n\n"
            "OTHER PROGRAMS FOR SPAIN:\n"
            "1. American AAdvantage: AA flies JFK-MAD, JFK-BCN, MIA-MAD. 57,500 miles one-way Flagship Business.\n"
            "2. United MileagePlus: Star Alliance connections via European hubs to Spain.\n"
            "3. Air Canada Aeroplan: Distance-based, no fuel surcharges — good for multi-stop itineraries.\n\n"
            "BEST TIME TO VISIT:\n"
            "May-June: Ideal. Warm, festivals, manageable crowds.\n"
            "September-October: Excellent — summer heat breaks, prices drop, culturally rich.\n"
            "March-April: Spring, good weather, Easter week (Semana Santa) is spectacular but crowded.\n\n"
            "AVOID: July-August — extremely hot (35-40°C+), beach crowds, highest prices.\n\n"
            "BARCELONA HIGHLIGHTS: Gaudí architecture (Sagrada Família, Park Güell, Casa Batlló), Barri Gòtic, Las Ramblas, Barceloneta beach, Camp Nou, world-class food scene.\n\n"
            "MADRID HIGHLIGHTS: Prado Museum (world-class art), Thyssen Museum, Reina Sofía (Guernica), Retiro Park, vibrant nightlife, excellent food.\n\n"
            "SPAIN WITHIN SPAIN: High-speed rail (AVE) connects Madrid-Barcelona (2.5 hours), Madrid-Seville (2.5 hours), Madrid-Valencia (1.5 hours). Often faster than flying for these routes."
        ),
    },

    {
        "id": "destination-maldives",
        "title": "Maldives — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Maldives", "MLE", "Male", "overwater bungalow", "Qatar", "Emirates", "Singapore", "hotel points"],
        "valid_as_of": "2026-Q2",
        "summary": "The Maldives is the ultimate aspirational destination for hotel points — overwater villas that cost $1,500-$5,000/night can sometimes be booked for 35,000-60,000 hotel points. Best access: Qatar Airways or Emirates via Doha/Dubai. Seaplane or speedboat transfers required to most resorts.",
        "content": (
            "The Maldives is the quintessential luxury travel destination — 1,200 islands, crystal-clear lagoons, and overwater bungalows. "
            "It's also one of the best opportunities to use hotel points for outsized value, since nightly room rates at luxury resorts can exceed $3,000.\n\n"
            "GETTING THERE:\n"
            "Main entry: Male International Airport (MLE) — all international flights land here.\n"
            "Then: Seaplane transfer (15-45 min, scenic, spectacular) or speedboat transfer (30-90 min) to your resort island. Most luxury resorts include transfers in the room rate. THIS IS A SIGNIFICANT ADDITIONAL COST — seaplane transfers can be $500-$800 per person round trip if not included. Factor this into total trip cost.\n\n"
            "BEST FLIGHT PROGRAMS TO MALDIVES:\n"
            "Qatar Airways via Doha (DOH): QR flies DOH-MLE frequently. Book via Avios/Privilege Club or AAdvantage for Oneworld partners.\n"
            "Emirates via Dubai (DXB): EK flies DXB-MLE. Book via Alaska Mileage Plan (no surcharges) or Skywards.\n"
            "Singapore Airlines via Singapore (SIN): SQ flies SIN-MLE. Book via KrisFlyer or partner programs. Good if combining with Singapore stop.\n"
            "Turkish Airlines via Istanbul (IST): TK flies IST-MLE. Book via Turkish Miles&Smiles or Chase/Citi transfers.\n\n"
            "HOTEL POINTS IN THE MALDIVES:\n"
            "The Maldives is one of the best places to redeem hotel points — overwater villa cash rates are often $1,500-$5,000/night.\n\n"
            "WORLD OF HYATT:\n"
            "- Alila Kothaifaru Maldives: Park Hyatt Maldives Hadahaa (Category 6 — 25,000 Hyatt points/night, but cash often $700-$1,500). Very good CPP.\n"
            "- Park Hyatt Maldives: One of the best Maldives properties on points.\n"
            "- Chase UR → Hyatt is the best path for Maldives Hyatt properties.\n\n"
            "MARRIOTT BONVOY:\n"
            "- Several exceptional properties: St. Regis Maldives Vommuli (Category 8 — dynamic pricing), W Maldives, The Westin Maldives Miriandhoo, Sheraton Maldives Full Moon Resort, Four Points by Sheraton (more affordable).\n"
            "- Dynamic pricing makes it harder to predict award cost but can be good value.\n\n"
            "HILTON HONORS:\n"
            "- Conrad Maldives Rangali Island (famous for two-story underwater restaurant and glass-floor suites). Award rates vary but can be excellent given the $1,000-$4,000/night cash price.\n"
            "- 5th night free benefit is particularly valuable here for week-long stays.\n\n"
            "IHG ONE REWARDS:\n"
            "- Six Senses Laamu (IHG property — Category 10). Award rates available.\n\n"
            "STRATEGY FOR MALDIVES:\n"
            "1. Fly on points (Emirates via Alaska, Qatar via Avios, Singapore via Virgin)\n"
            "2. Book hotel on points (Hyatt, Marriott, Hilton) for 5-7 nights\n"
            "3. Budget for seaplane/speedboat transfers (often $400-$1,000 round trip per person)\n"
            "A week in an overwater villa with air travel can be done for 250,000-400,000 combined points — vs $10,000-$25,000 in cash.\n\n"
            "BEST TIME TO VISIT:\n"
            "November-April: Dry season, calm seas, best visibility for snorkeling/diving.\n"
            "May-October: Wet season, lower prices, some rain, can be windy. Prices drop 30-50%.\n"
            "Whale shark season: Typically best June-November around South Ari Atoll."
        ),
    },

    {
        "id": "destination-australia-sydney",
        "title": "Australia — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Australia", "SYD", "MEL", "BNE", "Qantas", "transpacific", "United", "Air Canada"],
        "valid_as_of": "2026-Q2",
        "summary": "Australia requires 15-20 hour flights from US. Best programs: United MileagePlus for Air NZ/Fiji connections, Qantas Frequent Flyer for its own metal, Air Canada Aeroplan for Star Alliance. Qantas Business Suite (A380) and Business (787) are excellent. Best time: Sep-Nov or Mar-May (Austral spring/fall).",
        "content": (
            "Australia is a long-haul destination requiring 15-20+ hours from the US West Coast. "
            "The distance means premium cabin points redemptions offer exceptional value — lying flat for that duration is worth significantly more than on a 7-hour transatlantic.\n\n"
            "AIRPORTS:\n"
            "Sydney (SYD): Main international gateway. Kingsford Smith Airport. 30 min from CBD by train.\n"
            "Melbourne (MEL): Cultural capital. Tullamarine Airport. 30 min by Skybus from CBD.\n"
            "Brisbane (BNE): Gateway to Queensland/Great Barrier Reef. Compact airport.\n"
            "Perth (PER): Western Australia. Unique routing challenge — often requires connecting through Asian hub.\n"
            "Cairns (CNS): Gateway to Great Barrier Reef. Small airport, limited direct international.\n\n"
            "BEST PROGRAMS FOR US-AUSTRALIA:\n"
            "1. United MileagePlus: United flies LAX/SFO-SYD, LAX-MEL. Partner awards via Air New Zealand (United miles) offer another routing. Saver awards ~80,000 miles round trip economy, 160,000 business.\n"
            "2. Qantas Frequent Flyer: Qantas flies LAX-SYD, LAX-MEL, DFW-SYD, JFK-SYD (via LHR). Award rates on Qantas metal are reasonable. Amex MR → Qantas (1:1). Classic Rewards chart provides predictable pricing.\n"
            "3. Air Canada Aeroplan: Books Star Alliance partners connecting through Asia (ANA, Air China, Singapore) to Australia. Distance-based pricing, no surcharges.\n"
            "4. American AAdvantage: Books Qantas (Oneworld partner) to Australia. ~72,000 miles one-way business class.\n"
            "5. Alaska Mileage Plan: Alaska has Qantas as a partner — competitive rates for Qantas metal.\n\n"
            "QANTAS BUSINESS SUITE (A380):\n"
            "One of the best long-haul business class products — fully enclosed pod with direct aisle access, excellent wine, superb food. Available on A380 routes (LAX-SYD, LAX-MEL, DFW-SYD). The 14-15 hour flight from Los Angeles makes having a flat bed essential for most travelers.\n\n"
            "CASH PRICE CONTEXT:\n"
            "Economy LAX-SYD: $800-$1,800 depending on season\n"
            "Business Class: $4,000-$10,000+\n\n"
            "BEST TIME TO VISIT:\n"
            "September-November (Austral spring): Best weather, flowers blooming, not too crowded. Corresponds to Northern Hemisphere fall.\n"
            "March-May (Austral autumn): Also excellent — comfortable temperatures, less crowded than summer.\n\n"
            "AVOID: December-February (Austral summer) — extremely hot in most cities (35-45°C/95-113°F), peak tourist season, highest prices and least award availability for US travelers (our winter holidays coincide with Aussie summer peak).\n\n"
            "MAJOR DESTINATIONS:\n"
            "Sydney: Opera House, Harbour Bridge, Bondi Beach, Manly. 3-4 days minimum.\n"
            "Melbourne: Food and coffee capital, laneways, arts scene. 3-4 days.\n"
            "Great Barrier Reef (Cairns): Snorkeling and diving world wonder. 3-5 days.\n"
            "Uluru (Ayers Rock): Sacred indigenous site, Central Australia. 2-3 days.\n"
            "Whitsunday Islands (Airlie Beach): Sailing, Whitehaven Beach.\n"
            "New Zealand: Often combined with Australia trip — separate entry requirements.\n\n"
            "HOTELS:\n"
            "Hyatt: Park Hyatt Sydney (stunning harbour views — excellent points redemption given $600-$800/night cash). Regency properties in major cities.\n"
            "Marriott: W Sydney (new), Sheraton Grand Sydney Hyde Park, Four Points.\n"
            "IHG: InterContinental Sydney (iconic location near Opera House). 4th night free valuable.\n"
            "Hilton: Sydney Hilton, Conrad Sydney."
        ),
    },

    {
        "id": "destination-amsterdam-netherlands",
        "title": "Amsterdam and the Netherlands — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Amsterdam", "AMS", "KLM", "Flying Blue", "Schiphol", "Netherlands", "transatlantic"],
        "valid_as_of": "2026-Q2",
        "summary": "Amsterdam Schiphol (AMS) is KLM's home hub and one of Europe's best-connected airports. Best program: Flying Blue (KLM's program, check Promo Awards monthly). Delta flies AMS from multiple US cities. AMS is also an excellent hub for day trips to Belgium, Germany, and France.",
        "content": (
            "Amsterdam is both a wonderful destination and one of Europe's most useful hub airports for onward European connections.\n\n"
            "AIRPORT:\n"
            "Amsterdam Schiphol (AMS): KLM's home hub. One of Europe's largest and best-connected airports. Excellent shopping, lounges, and connectivity. KLM Crown Lounge is very good. Priority Pass lounges available. Fast train to Amsterdam Centraal station (20 min).\n\n"
            "BEST PROGRAMS FOR US-AMSTERDAM:\n"
            "1. Flying Blue (KLM's program): Check monthly Promo Awards — AMS routes from US frequently appear at 25-50% discount. Standard rates: ~100,000 miles round trip business, Promo can bring to 50,000-70,000.\n"
            "2. Delta SkyMiles: Delta flies AMS from JFK, ATL, MSP, BOS, DTW, LAX. Dynamic pricing varies.\n"
            "3. Air Canada Aeroplan: Books KLM and other SkyTeam partners with no/minimal surcharges.\n"
            "4. United MileagePlus: Star Alliance partners connecting through AMS.\n\n"
            "KLM BUSINESS CLASS: Good product on 787 routes — direct aisle access, fully flat. Not as premium as ANA or Singapore but solid for European carrier.\n\n"
            "AMS AS EUROPE HUB:\n"
            "Schiphol's location and KLM's network makes AMS an excellent entry point for exploring multiple European countries:\n"
            "- Brussels: 2 hours by train, excellent beer and food\n"
            "- Paris: 3.5 hours by Thalys train\n"
            "- London: 4 hours by Eurostar (via Brussels)\n"
            "- Cologne: 3 hours by train\n"
            "- Bruges: Day trip from Brussels\n\n"
            "BEST TIME TO VISIT:\n"
            "April-May: Tulip season (Keukenhof blooms in April) and pleasant weather.\n"
            "June-August: Busy tourist season, canal boat trips, festivals. Warm but not hot.\n"
            "September-October: Shoulder season — good prices, pleasant weather.\n"
            "December: Christmas markets, festive atmosphere.\n\n"
            "AMSTERDAM HIGHLIGHTS:\n"
            "Rijksmuseum (Dutch Golden Age art — Rembrandt, Vermeer), Anne Frank House (book well in advance), Van Gogh Museum, canal boat tour, Jordaan neighborhood, Heineken Experience, cycling culture.\n\n"
            "DAY TRIP: Keukenhof Gardens (April-May only) — the world's most beautiful flower garden, 7 million tulips. Accessible by bus from Amsterdam."
        ),
    },

    {
        "id": "destination-south-africa",
        "title": "South Africa — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["South Africa", "JNB", "CPT", "Cape Town", "Johannesburg", "Safari", "Africa"],
        "valid_as_of": "2026-Q2",
        "summary": "South Africa requires 15-17 hour flights from US. Best programs: United MileagePlus for own metal (EWR-JNB), Delta SkyMiles for Johannesburg via Atlanta, or Air Canada Aeroplan for Star Alliance connections. Cape Town is spectacular. Safari destinations accessible from Johannesburg.",
        "content": (
            "South Africa is one of Africa's premier travel destinations, combining Cape Town's spectacular scenery with world-class safari opportunities and accessible, developed infrastructure.\n\n"
            "AIRPORTS:\n"
            "Johannesburg O.R. Tambo (JNB): Main international hub. 30 min from Sandton/Johannesburg center.\n"
            "Cape Town International (CPT): Smaller international airport. 20 min from city center.\n"
            "Most US travelers fly into JNB and either connect to CPT or do a Johannesburg-JNB-CPT combination.\n\n"
            "BEST PROGRAMS FOR US-SOUTH AFRICA:\n"
            "1. United MileagePlus: United flies EWR-JNB (18 hours nonstop — one of the longest US-Africa routes). Award rates: ~80,000 miles round trip economy (saver), ~160,000 business class round trip. United Polaris on this route.\n"
            "2. Delta SkyMiles: Delta flies ATL-JNB via connecting in ATL or codeshare. Check award availability.\n"
            "3. Air Canada Aeroplan: Books multiple Star Alliance carriers routing through European or other African hubs.\n"
            "4. American AAdvantage: Oneworld partner connections through European hubs.\n\n"
            "CAPE TOWN — THE DESTINATION:\n"
            "Table Mountain: Iconic flat-topped mountain, cable car access, world-famous views.\n"
            "Boulders Beach: African penguin colony — unique wildlife experience.\n"
            "Cape of Good Hope: Southernmost tip of Africa.\n"
            "Cape Winelands (Stellenbosch, Franschhoek): World-class wine estates within 45 min of Cape Town.\n"
            "Victoria & Alfred Waterfront: Shopping, restaurants, waterfront area.\n"
            "Cape Town Food Scene: Excellent — world-class restaurants at a fraction of NYC/London prices.\n\n"
            "SAFARI DESTINATIONS:\n"
            "Kruger National Park: Largest game reserve in South Africa. Access via Johannesburg (3-4 hour drive or short flight to Hoedspruit/Nelspruit). Best Big Five viewing in Africa. Private game lodges adjacent to Kruger offer the most intimate experiences.\n"
            "Pilanesberg (near JNB): Closer to Johannesburg, 2.5 hours. Good for short safari stop.\n"
            "Sabi Sands: Luxury private reserve adjacent to Kruger. World-class lodges but expensive.\n\n"
            "BEST TIME TO VISIT:\n"
            "May-September (Austral winter/dry season): Best for safari — animals congregate at water sources, vegetation sparse for better viewing. Cape Town mild and dry. Peak safari season.\n"
            "October-April: Cape Town summer — beach and wine country. Safari still good but more rain in some areas.\n\n"
            "CURRENCY NOTE: South African Rand is weak relative to USD/EUR — South Africa is extremely affordable for US travelers. Luxury experiences at a fraction of equivalent Western costs.\n\n"
            "SAFETY: Exercise appropriate caution. Johannesburg requires more vigilance than Cape Town. Use reputable transportation (hotel car, Uber), avoid displaying valuables. Cape Town is generally safe in tourist areas but has higher crime in certain neighborhoods."
        ),
    },

    {
        "id": "destination-bali-indonesia",
        "title": "Bali, Indonesia — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Bali", "DPS", "Indonesia", "Denpasar", "Asia", "Singapore Airlines", "Cathay", "transfer"],
        "valid_as_of": "2026-Q2",
        "summary": "Bali requires a connection in an Asian hub. Best routing: via Singapore (SQ is excellent), Hong Kong (Cathay), or Tokyo (ANA/JAL). Singapore Airlines, Garuda Indonesia, and Lion Air serve DPS from Singapore. Best time: April-October (dry season). Ubud for culture, Seminyak for beaches.",
        "content": (
            "Bali is Southeast Asia's most popular island destination — volcanic landscapes, rice terraces, Hindu temples, excellent food, and some of the world's best villa accommodations at reasonable prices.\n\n"
            "AIRPORTS:\n"
            "Ngurah Rai International (DPS): Bali's only international airport. 30-45 min from Seminyak/Kuta, 75-90 min from Ubud.\n"
            "No direct US flights — requires connecting through an Asian hub.\n\n"
            "BEST ROUTING OPTIONS FROM US:\n\n"
            "VIA SINGAPORE (SIN): Best overall. Singapore Airlines or budget carriers connect SIN-DPS (2.5 hours). Book US-SIN as the primary award (Virgin Atlantic → Singapore Airlines business class is outstanding). Then book SIN-DPS separately — often very cheap cash.\n\n"
            "VIA HONG KONG (HKG): Cathay Pacific or partner carriers. Book US-HKG award, then HKG-DPS separately.\n\n"
            "VIA TOKYO (NRT/HND): ANA or JAL connect to Bali. Book US-NRT award (Virgin Atlantic → ANA is the sweet spot), then NRT-DPS.\n\n"
            "VIA DUBAI (DXB): Emirates connects DXB-DPS. Book EK first class or business via Alaska, then DXB-DPS on Emirates or budget carrier.\n\n"
            "VIA SYDNEY (SYD): Qantas and others connect. Useful if combining with Australia.\n\n"
            "BALI REGIONS:\n"
            "Ubud: Cultural heart of Bali. Rice terraces (Tegalalang), Monkey Forest, traditional dance, spiritual retreats, cooking classes. 2-3 days.\n"
            "Seminyak/Kuta/Legian: Beach areas, restaurants, bars, shopping. More touristy but good for beach relaxation. 2-3 days.\n"
            "Canggu: Trendy, expat-heavy beach town. Cafes, surf spots, hip restaurants.\n"
            "Uluwatu: Dramatic clifftop temples, world-class surfing, luxury resorts above the cliffs.\n"
            "Nusa Dua: Resort enclave with white sand beaches, calmer than Seminyak.\n"
            "Nusa Lembongan/Penida: Small islands off Bali's southeast coast. Snorkeling, manta rays, day trips from DPS.\n\n"
            "BEST TIME TO VISIT:\n"
            "April-October (dry season): Best weather. July-August are peak months with more visitors.\n"
            "May-June and September-October: Sweet spot — dry weather, fewer crowds, moderate prices.\n"
            "November-March (wet season): Daily rain showers (usually afternoon). Greener landscapes, lower prices, fewer tourists. Still very enjoyable.\n\n"
            "HOTELS:\n"
            "Bali has exceptional luxury villas at lower prices than equivalent Western or Tokyo properties. Private pool villas are a Bali specialty — often $200-$600/night for something exceptional.\n"
            "Hyatt: Alila Ubud, Alila Seminyak, Alila Villas Uluwatu (all excellent, strong Chase UR → Hyatt redemptions). The Alila brand in Bali is outstanding.\n"
            "Marriott: St. Regis Bali, W Bali Seminyak, Westin Ubud, Sheraton Bali Kuta.\n"
            "IHG: InterContinental Bali Resort.\n"
            "Hilton: Conrad Bali.\n\n"
            "PRACTICAL:\n"
            "Visa on Arrival: Americans can purchase 30-day visa on arrival for ~$35 at DPS (also extendable to 60 days).\n"
            "Currency: Indonesian Rupiah (IDR). $100 USD = ~1.6 million IDR. Very affordable — excellent food for $2-5, villa massages for $15-25.\n"
            "Transport: Ride apps (Grab, Gojek) are cheap and reliable. Renting a scooter is popular but risky — traffic is chaotic. Hire a private driver for day trips ($30-$60/day for an excellent, English-speaking driver)."
        ),
    },

    {
        "id": "destination-mex-city-latin-america",
        "title": "Mexico City and Latin America — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Mexico City", "MEX", "Buenos Aires", "EZE", "Brazil", "GRU", "Lima", "Colombia", "LATAM", "Avianca"],
        "valid_as_of": "2026-Q2",
        "summary": "Latin America is often overlooked for points — economy cash prices are frequently low ($300-$600), making points less valuable. Best use: business class to South America (6-12 hours, cash $1,500-$5,000). Best programs: LATAM Pass, Avianca LifeMiles, Copa ConnectMiles.",
        "content": (
            "Latin America spans Mexico through South America — a huge range of destinations with varying points strategies.\n\n"
            "MEXICO:\n"
            "Mexico City (MEX): Large cosmopolitan city. Direct flights from virtually every US city. Economy cash prices often $200-$500 — frequently not worth using points. Business class makes more sense: $800-$2,000, and award rates can yield 2+ cpp.\n"
            "Resort Destinations (CUN, SJD, PVR, MZT, OAX): High-volume leisure routes with competitive cash prices. See Caribbean/Mexico guide for more detail.\n\n"
            "SOUTH AMERICA — WHEN POINTS MAKE SENSE:\n"
            "Flights to South America are 6-12 hours — premium cabin becomes worthwhile, and cash prices for business class ($1,500-$5,000) are high enough to make points valuable.\n\n"
            "BUENOS AIRES (EZE — Argentina):\n"
            "- 11-12 hours from MIA/JFK\n"
            "- Best programs: American AAdvantage (57,500 miles one-way business), United MileagePlus, LATAM Pass\n"
            "- Cash business class: $1,500-$4,000 depending on season and carrier\n"
            "- Best time: March-May and September-November (Austral spring/fall)\n"
            "- Argentina's current economic situation makes it extraordinary value for USD/EUR travelers\n\n"
            "SAO PAULO (GRU) and RIO DE JANEIRO (GIG — Brazil):\n"
            "- 8-10 hours from MIA/JFK/ATL\n"
            "- Best programs: American AAdvantage, United MileagePlus, Avianca LifeMiles\n"
            "- LATAM flies extensively throughout Brazil from US hubs\n"
            "- Best time: March-May and August-November\n"
            "- Avoid: Carnival (Feb/March) for award availability — massive demand\n\n"
            "LIMA, PERU (LIM):\n"
            "- 6-7 hours from MIA\n"
            "- Gateway to Machu Picchu, Cusco, Amazon\n"
            "- Best programs: American AAdvantage, Avianca LifeMiles\n"
            "- Strong cuisine reputation (Peruvian food is world-class)\n\n"
            "BOGOTA / MEDELLIN (Colombia):\n"
            "- 3-5 hours from MIA\n"
            "- Short enough that economy makes sense; cash prices often low\n"
            "- Avianca is the home carrier — LifeMiles program good for Colombia\n\n"
            "BEST PROGRAMS FOR LATIN AMERICA:\n\n"
            "AVIANCA LIFEMILES:\n"
            "- Books Star Alliance partners throughout Latin America\n"
            "- No fuel surcharges on most partners\n"
            "- Flash sales on LifeMiles purchases make this a good program to stock up during promos\n"
            "- Transfer partners: Amex MR, Capital One, Citi TY\n"
            "- Business class rates to South America are competitive\n\n"
            "LATAM PASS:\n"
            "- LATAM is the dominant carrier throughout South America\n"
            "- Complex program but strong network\n"
            "- Transfer partners: American Express (via Membership Rewards)\n\n"
            "COPA CONNECTMILES:\n"
            "- Panama City (PTY) hub — excellent connections throughout Central and South America\n"
            "- Star Alliance member — broad partner access\n"
            "- Good for routing through Panama to multiple South American destinations\n\n"
            "AMERICAN AADVANTAGE:\n"
            "- AA and LATAM (Oneworld) have extensive South America coverage from MIA hub\n"
            "- MIA is the gateway hub for all of Latin America via AA\n"
            "- Competitive Oneworld award rates to South America"
        ),
    },

    {
        "id": "destination-greek-islands",
        "title": "Greece and Greek Islands — Complete Travel and Points Guide",
        "category": "destinations",
        "tags": ["Greece", "Athens", "ATH", "Santorini", "Mykonos", "Aegean Airlines", "Star Alliance"],
        "valid_as_of": "2026-Q2",
        "summary": "Greece requires connecting through a European hub — typically London, Frankfurt, or Amsterdam. Best programs: Aeroplan or United for Star Alliance connections, Avios for Aegean Airlines (Star Alliance member). Santorini and Mykonos are peak summer destinations — book 10+ months ahead.",
        "content": (
            "Greece is a spectacular Mediterranean destination — ancient history, volcanic islands, crystal-clear Aegean waters, and excellent food. "
            "The key points strategy: fly to a European hub (ATH is only 3-4 hours from most European hubs) and island-hop by domestic flight or ferry.\n\n"
            "AIRPORTS:\n"
            "Athens International (ATH): Main entry point. Star Alliance hub — Aegean Airlines is Star Alliance member. 45 min from central Athens by Metro.\n"
            "Mykonos (JMK), Santorini (JTR), Rhodes (RHO), Heraklion/Crete (HER): Island airports. Domestic connections from ATH or direct European charters.\n\n"
            "GETTING TO GREECE ON POINTS:\n"
            "No major US carrier flies direct to Athens. Strategy: fly to a European hub and connect.\n\n"
            "Best approaches:\n"
            "1. Fly JFK-LHR or JFK-FRA/MUC on points, then book a cheap cash ticket to ATH (Aegean, Ryanair, or others from $50-$150).\n"
            "2. Air Canada Aeroplan: Books Star Alliance connections all the way to ATH. Distance-based pricing without surcharges.\n"
            "3. United MileagePlus: Star Alliance partners routing through European hubs to ATH.\n"
            "4. British Airways Avios: Aegean Airlines is oneworld (actually Star Alliance — verify current status) and Avios can book Aegean flights at very cheap rates for short hops.\n\n"
            "AEGEAN AIRLINES (OA): Greece's flag carrier, Star Alliance member. Strong domestic and European network from ATH. Accessible via Star Alliance programs.\n\n"
            "ISLAND-HOPPING:\n"
            "Ferry: Iconic Greek experience. Ferries connect Athens (Piraeus port) to most islands. Overnight ferries save hotel costs. Book via ferryscanner.com or directly.\n"
            "Domestic flights: Quick (30-45 min) and reasonable cost. Olympic Air and Aegean serve major islands from ATH.\n"
            "Popular routes: Athens → Santorini → Mykonos → Athens (classic circuit, 10-14 days)\n\n"
            "SANTORINI (JTR): The iconic caldera views, white-domed churches, sunset from Oia. Booking well in advance essential — one of Europe's most popular destinations. Premium accommodation on the caldera cliff is expensive ($400-$2,000/night for cave houses/infinity pool villas) but worth it.\n\n"
            "MYKONOS (JMK): Party island, beautiful beaches, iconic windmills, upscale hotels. Expensive in summer but beautiful.\n\n"
            "ATHENS: Acropolis (book early — timed entry), National Archaeological Museum, Plaka neighborhood, Monastiraki flea market, street food. 2-3 days.\n\n"
            "BEST TIME TO VISIT:\n"
            "May-June: Perfect. Warm, not yet peak crowding, good availability.\n"
            "September-October: Ideal — summer crowds gone, water still warm, prices drop.\n"
            "July-August: Peak season — hot, crowded (especially Santorini/Mykonos), highest prices and lowest award availability. Still spectacular but expensive.\n\n"
            "HOTELS:\n"
            "Few major chains on Greek islands (boutique properties dominate). Mykonos and Santorini have some Marriott and IHG properties.\n"
            "Athens: Hilton Athens (Priority Pass lounge), NJV Athens Plaza (Marriott), Hotel Grande Bretagne (iconic)."
        ),
    },
]
