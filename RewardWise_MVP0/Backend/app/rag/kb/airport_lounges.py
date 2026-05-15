"""
rag/kb/airport_lounges.py
──────────────────────────
Airport lounge network knowledge base.
Every major lounge network, access methods, and best lounges by airport.

CATEGORY: airport_lounges
VALID AS OF: 2026-Q2
UPDATE CADENCE: Semi-annually.
"""

from __future__ import annotations

AIRPORT_LOUNGES_KB: list[dict] = [

    {
        "id": "centurion-lounges-guide",
        "title": "American Express Centurion Lounges — Complete Guide",
        "category": "airport_lounges",
        "tags": ["centurion lounge", "amex", "platinum", "lounge access", "airport lounge"],
        "valid_as_of": "2026-Q2",
        "summary": "Amex Centurion Lounges are the best airport lounges in the US — full bar, hot food, spa services. Access requires Amex Platinum or Centurion card. Guest policy: 2 guests free (fees apply at busy times). Locations in 30+ airports.",
        "content": (
            "American Express Centurion Lounges are consistently ranked as the best airport lounges in the United States. "
            "They feature full-service bars, hot food menus designed by local chefs, spa treatment rooms (at select locations), shower suites, and high-quality Wi-Fi.\n\n"
            "ACCESS REQUIREMENTS:\n"
            "- Amex Platinum Card (personal or business)\n"
            "- Amex Centurion Card (the black card)\n"
            "- Amex Delta Reserve (access when flying Delta — now limited to 10 visits/year)\n"
            "- Amex Hilton Aspire: Priority Pass only, not Centurion access\n"
            "- Day passes can sometimes be purchased (~$50-$80 per visit)\n\n"
            "GUEST POLICY: Amex Platinum cardholders get 2 complimentary guest passes per visit. Additional guests cost $30-$50 each depending on the lounge. During peak hours (typically 5-8pm at major hubs), some Centurion Lounges cap guest numbers.\n\n"
            "CENTURION LOUNGE LOCATIONS (US): Atlanta (ATL), Boston (BOS), Charlotte (CLT), Dallas (DFW — Terminal D), Denver (DEN), Hong Kong (HKG), Houston (IAH), Las Vegas (LAS — Terminal 3), London (LHR), Los Angeles (LAX — Terminal 4), Miami (MIA), Minneapolis (MSP), New York JFK (Terminal 4 — one of the best), New York LaGuardia (LGA), Philadelphia (PHL), Phoenix (PHX), Portland (PDX), San Francisco (SFO — Terminal 3), Seattle (SEA — Concourse C), Washington DC (DCA), Washington Dulles (IAD).\n\n"
            "BEST CENTURION LOUNGES: JFK Terminal 4 is widely considered the best — large, excellent food, spa. SFO Terminal 3 is also exceptional. LAS is solid. LAX has been renovated and is now one of the best on the West Coast.\n\n"
            "FOOD AND BEVERAGE: Full menu of hot dishes (not just appetizers), crafted cocktails, wine, beer, espresso. Menu is updated seasonally and varies by location. Most locations have something genuinely better than typical airport food.\n\n"
            "CROWDING ISSUE: Centurion Lounges have become significantly more crowded since Priority Pass access was added and then removed. Current policy with the fee requirement for guests helps manage capacity. Arrive early on popular travel days.\n\n"
            "CENTURION LOUNGE VS COMPETITORS: Generally superior to United Polaris Lounges (which require international business class), Delta Sky Clubs, and most Priority Pass lounges. The food quality and design set them apart."
        ),
    },

    {
        "id": "priority-pass-guide",
        "title": "Priority Pass — Complete Guide to Lounge Access",
        "category": "airport_lounges",
        "tags": ["priority pass", "lounge access", "credit card benefit", "1300 lounges", "select"],
        "valid_as_of": "2026-Q2",
        "summary": "Priority Pass is the world's largest independent airport lounge network with 1,300+ lounges globally. Access via credit cards (Chase Sapphire Reserve, Capital One Venture X, Amex Platinum, etc.). Different tiers: Select (unlimited) vs limited visit plans.",
        "content": (
            "Priority Pass is the most widely available independent lounge network, covering 1,300+ lounges in 600+ cities across 145 countries. "
            "Many premium travel credit cards include Priority Pass Select membership, which provides unlimited visits.\n\n"
            "ACCESS TIERS:\n"
            "- Priority Pass Select: Unlimited lounge visits, included with many premium cards\n"
            "- Priority Pass Standard Plus: 10 complimentary visits, then $32/visit\n"
            "- Priority Pass Standard: $32/visit for all visits\n\n"
            "CARDS THAT INCLUDE PRIORITY PASS SELECT (unlimited):\n"
            "- Chase Sapphire Reserve (unlimited + 2 free guests)\n"
            "- Amex Platinum (unlimited, guest fees may apply)\n"
            "- Capital One Venture X (unlimited + 2 free guests)\n"
            "- Citi Prestige (discontinued to new applicants)\n"
            "- US Bank Altitude Reserve (unlimited)\n"
            "- Hilton Amex Aspire (unlimited)\n"
            "- Many other premium cards\n\n"
            "CARDS WITH LIMITED PRIORITY PASS VISITS:\n"
            "- Hilton Amex Surpass: 10 visits/year\n"
            "- Various other mid-tier travel cards: 2-10 visits/year\n\n"
            "GUEST FEES: Most Priority Pass memberships charge $32-$35 per guest per visit. Chase Sapphire Reserve includes 2 free guests. Capital One Venture X includes 2 free guests.\n\n"
            "LOUNGE QUALITY VARIES WIDELY: Priority Pass lounges range from world-class to barely adequate. In international airports, Priority Pass lounges are often excellent (Plaza Premium, SATS, etc.). In US domestic airports, quality can be hit or miss — some are converted conference rooms with basic snacks.\n\n"
            "BEST PRIORITY PASS LOUNGES GLOBALLY:\n"
            "- Changi Airport Singapore (SIN): Any of the Plaza Premium or SATS lounges — exceptional\n"
            "- Dubai (DXB): Multiple Priority Pass options, generally good\n"
            "- Hong Kong (HKG): Plaza Premium — excellent\n"
            "- London Heathrow (LHR): Multiple options, quality varies\n"
            "- US: Plaza Premium (JFK, LAX) — among best PP options in North America\n\n"
            "IMPORTANT POLICY CHANGE: Amex removed restaurant credit reimbursement from Priority Pass memberships included with Amex cards (Platinum, Gold, etc.) — this was a common strategy to get $28-$56 in dining credits. Now only lounge access remains.\n\n"
            "APP: Priority Pass app shows all lounge locations, ratings, hours, amenities. Essential tool — always check before heading to a lounge, as access can be denied if the lounge is at capacity."
        ),
    },

    {
        "id": "united-club-polaris-lounges",
        "title": "United Club and United Polaris Lounges — Complete Guide",
        "category": "airport_lounges",
        "tags": ["united club", "polaris lounge", "united airlines", "star alliance", "business class lounge"],
        "valid_as_of": "2026-Q2",
        "summary": "United Club: available via membership, United Club card, or day pass. Polaris Lounge: only for international business/first class passengers on United. Polaris Lounges in Newark, SFO, LAX, Chicago, Houston, New York — excellent quality.",
        "content": (
            "United operates two distinct lounge tiers: United Club (general access lounge) and United Polaris Lounge (premium international-only lounge).\n\n"
            "UNITED CLUB ACCESS METHODS:\n"
            "- United Club membership: ~$650/year for most members (reduced for some elite tiers)\n"
            "- United Club Infinite Card (Chase): Full club membership included in $525 annual fee\n"
            "- United Club Explorer Card: 2 one-time passes per year\n"
            "- United Premier 1K members: United Club access on day of travel\n"
            "- Star Alliance Gold status on international United-operated flights\n"
            "- Day pass: $59 at the door or less via United app\n\n"
            "UNITED CLUB FEATURES: Complimentary beer, wine, and spirits. Hot food in most locations. Business center. Shower suites (at major hubs). Wi-Fi.\n\n"
            "UNITED POLARIS LOUNGE — Premium Tier:\n"
            "ELIGIBILITY: Must be flying United or United Express on the same day in Polaris business class or first class on an international flight. United Global First passengers also eligible. Star Alliance Gold traveling in business class on Star Alliance partners sometimes eligible (varies by location).\n"
            "LOCATIONS: Chicago O'Hare (ORD) Terminal 1, Houston (IAH) Terminal E, Los Angeles (LAX) Terminal 7, Newark (EWR) Terminal C, New York (JFK) Terminal 7, San Francisco (SFO) Terminal 3.\n"
            "FEATURES: The Polaris Lounge is a significant step above the United Club — full restaurant service (not buffet), Saks Fifth Avenue bedding in sleeping suites, more extensive bar program, dedicated check-in area.\n\n"
            "STAR ALLIANCE LOUNGES: When flying international on United metal or Star Alliance partners in business/first, you also get access to Star Alliance member lounges globally (Lufthansa, Singapore, ANA, Air Canada, etc.). Quality varies significantly by carrier and airport.\n\n"
            "BEST UNITED POLARIS LOUNGE: EWR Terminal C and SFO Terminal 3 are generally considered the best. EWR's location and smaller size keeps crowds manageable."
        ),
    },

    {
        "id": "delta-sky-club-guide",
        "title": "Delta Sky Club — Complete Guide",
        "category": "airport_lounges",
        "tags": ["delta sky club", "delta", "lounge", "skymiles", "amex delta reserve", "sky club access"],
        "valid_as_of": "2026-Q2",
        "summary": "Delta Sky Club access via Delta Reserve Amex (now limited to 10 visits/year unless $75k annual spend), SkyTeam Elite Plus status, or day pass ($50). Sky Clubs at all major Delta hubs. Quality has improved significantly after renovations.",
        "content": (
            "Delta Sky Club is Delta's own lounge network, located at all major Delta hubs and many focus cities.\n\n"
            "ACCESS METHODS AND RECENT POLICY CHANGES:\n"
            "- Delta Reserve Amex: Limited to 10 complimentary visits per year (as of Feb 2025) unless you spend $75,000 on the card in the previous year — then unlimited. This was a major policy change that angered many cardholders.\n"
            "- Delta Platinum Amex: 15 visits/year (via companion certificate days)\n"
            "- Day pass: $50 per person at the door, can be pre-purchased\n"
            "- Delta Diamond Medallion: Unlimited Sky Club access\n"
            "- Delta Platinum Medallion: Unlimited on international flights, limited on domestic\n"
            "- SkyTeam Elite Plus members: Access on international SkyTeam flights at Delta-operated airports\n"
            "- Priority Pass: Does NOT provide Sky Club access\n\n"
            "SKY CLUB LOCATIONS (major): Atlanta (ATL — multiple clubs, ATL is Delta's biggest hub), Boston (BOS), Detroit (DTW), JFK, LAX, Minneapolis (MSP), New York (LGA), Salt Lake City (SLC), San Francisco (SFO), Seattle (SEA).\n\n"
            "SKY CLUB QUALITY: Delta has invested heavily in Sky Club renovations. Current clubs are generally better than United Clubs but not as premium as Polaris Lounges. Food is a buffet model with rotating items — quality depends on the location and time of day. Full bar always included.\n\n"
            "ATLANTA NOTES: ATL has the most Sky Club locations (multiple clubs across concourses) and highest volume. Clubs can get very crowded during peak hours. The new F Concourse club is the best in the system.\n\n"
            "CROWDING: Sky Club crowding was the primary reason Delta implemented the visit limits. The $50 day pass and limits on Reserve card access are designed to reduce volume. Currently much less crowded than 2022-2024 peak.\n\n"
            "GUEST POLICY: 1 guest permitted for cardholders with access. Additional guests at day pass rate. Diamond Medallion members can bring 2 guests."
        ),
    },

    {
        "id": "admirals-club-american-airlines",
        "title": "American Airlines Admirals Club — Complete Guide",
        "category": "airport_lounges",
        "tags": ["admirals club", "american airlines", "oneworld", "citi executive", "lounge membership"],
        "valid_as_of": "2026-Q2",
        "summary": "AA's lounge network. Access via Citi AAdvantage Executive card ($595/year — includes full membership), standalone membership ($650+/year), or day pass ($59). Oneworld Emerald and Sapphire members get access on AA flights.",
        "content": (
            "Admirals Club is American Airlines' lounge network, located at major AA hubs and many domestic airports.\n\n"
            "ACCESS METHODS:\n"
            "- Citi AAdvantage Executive World Elite Mastercard ($595/year): Full Admirals Club membership for cardholder + authorized users (at $175/year each)\n"
            "- Standalone membership: $650+/year, varies by elite status level\n"
            "- Day pass: $59 at the door\n"
            "- AAdvantage Executive Platinum (EXP): Admirals Club access on AA flights\n"
            "- Oneworld Emerald status: Access on AA and Oneworld partner flights\n"
            "- Oneworld Sapphire status on international flights only\n\n"
            "ADMIRALS CLUB LOCATIONS: All major AA hubs — CLT, DFW, LAX, JFK, MIA, ORD, PHX — plus many domestic and international airports.\n\n"
            "CITI EXECUTIVE CARD VALUE: The $595 card includes Admirals Club membership worth $650+. You're effectively getting the membership below cost plus the card's earning rate and other benefits.\n\n"
            "QUALITY: Admirals Clubs are generally a step below Centurion Lounges and United Polaris but comparable to United Club. Food is self-serve appetizers with a full bar. Shower suites at major locations. Business center.\n\n"
            "FLAGSHIP LOUNGES: AA's premium lounge tier for Flagship First Class and Flagship Business Plus international passengers, plus Oneworld Emerald members on AA. Located at JFK, LAX, ORD, MIA, DFW, PHL. Flagship Dining is an even higher tier — full sit-down restaurant service before international business/first class flights.\n\n"
            "BEST ADMIRALS CLUB: JFK Terminal 8 is the newest and generally considered the best. DFW and CLT are also solid.\n\n"
            "ONEWORLD LOUNGE ACCESS: One of Oneworld's key benefits — Emerald status members can use partner airline lounges globally (Cathay Pacific, British Airways, Iberia, Qatar, JAL, etc.). This makes AA EXP or Oneworld Emerald status particularly valuable for international travelers."
        ),
    },

    {
        "id": "alaska-lounge-guide",
        "title": "Alaska Airlines Lounges — Complete Guide",
        "category": "airport_lounges",
        "tags": ["alaska airlines", "lounge", "atmos", "west coast", "priority pass"],
        "valid_as_of": "2026-Q2",
        "summary": "Alaska operates lounges at key West Coast airports. Access via membership, Alaska Lounge+ card, or day pass. Also accepting Priority Pass at some locations. Quality is solid — better than average domestic lounges.",
        "content": (
            "Alaska Airlines operates lounges primarily at West Coast airports, reflecting their geographic focus.\n\n"
            "ACCESS METHODS:\n"
            "- Alaska Lounge+ Membership: ~$450/year, includes 2 companion passes\n"
            "- Alaska Airlines Visa Signature card: Does not include lounge access (Alaska removed this benefit)\n"
            "- Alaska MVP Gold 75K: Complimentary lounge access on day of travel\n"
            "- Priority Pass: Alaska accepts Priority Pass at some locations — check app before visiting\n"
            "- Day pass: $45-$55 per person at the door\n"
            "- First class passengers on Alaska: Complimentary access at most Alaska lounges\n\n"
            "ALASKA LOUNGE LOCATIONS: Seattle (SEA — multiple concourses), Portland (PDX), Anchorage (ANC), Los Angeles (LAX), San Francisco (SFO), San Diego (SAN), Bellingham (BLI).\n\n"
            "QUALITY: Alaska lounges are generally well-regarded — clean, comfortable, with decent food and full bar service. Not as premium as Centurion or Polaris, but better than many Priority Pass partner lounges.\n\n"
            "ATMOS INTEGRATION: Following the Alaska-Hawaiian merger, Atmos Rewards is the evolving loyalty program. Lounge access rules may evolve as the programs integrate. Verify current access rules, especially for Hawaiian routes and Pacific Island airports.\n\n"
            "SEA NOTES: Seattle is Alaska's hub. The SEA lounges are the best in their network — recently renovated, large, and offer good food options."
        ),
    },

    {
        "id": "capital-one-lounges-guide",
        "title": "Capital One Lounges — Complete Guide",
        "category": "airport_lounges",
        "tags": ["capital one lounge", "venture x", "DFW", "LAS", "IAD", "new lounges"],
        "valid_as_of": "2026-Q2",
        "summary": "Capital One's growing lounge network. Currently in DFW, LAS, and IAD. Access via Venture X or Venture card. Quality is excellent — better than most Priority Pass lounges. Unlimited visits + 2 free guests with Venture X.",
        "content": (
            "Capital One Lounges are a newer but rapidly expanding lounge network, currently among the best non-airline-affiliated lounges in the US.\n\n"
            "ACCESS METHODS:\n"
            "- Capital One Venture X: Unlimited access + 2 free guests per visit\n"
            "- Capital One Venture: Up to 2 complimentary visits per year, then $45/visit\n"
            "- Day pass: $65 per person\n\n"
            "CURRENT LOCATIONS (2026): Dallas (DFW — Terminal D), Las Vegas (LAS — Terminal 3), Washington Dulles (IAD). Expansion planned to Denver, New York, and other major hubs.\n\n"
            "QUALITY: Capital One Lounges have set a new standard for bank-affiliated lounges. Features include:\n"
            "- Full-service bar with cocktails and local beer/wine selection\n"
            "- Hot food menu designed by local chefs (genuinely restaurant quality, not typical lounge buffet)\n"
            "- Wellness room (yoga mats, meditation area)\n"
            "- Shower suites\n"
            "- Fast, reliable Wi-Fi\n"
            "- Children's play area (at some locations)\n"
            "- Excellent design and comfortable seating\n\n"
            "CAPITAL ONE LOUNGE VS CENTURION: Very comparable quality — both are top-tier US airport lounges. Capital One Lounges tend to have better food design and wellness facilities. Centurion has more locations and the spa treatments.\n\n"
            "VENTURE X GUEST POLICY: 2 free guests included in access. Additional guests pay day pass rate. This is more generous than many competitors (Amex charges for guests).\n\n"
            "EXPANSION WATCH: Capital One has announced expansion to major hubs. By 2027, they plan 10+ locations. This trajectory makes the Venture X lounge benefit increasingly valuable over time."
        ),
    },

    {
        "id": "international-lounge-networks",
        "title": "International Airport Lounge Networks — Complete Guide",
        "category": "airport_lounges",
        "tags": ["plaza premium", "SATS", "marhaba", "aspire", "international lounges", "global lounge"],
        "valid_as_of": "2026-Q2",
        "summary": "The major international lounge networks accessible via Priority Pass and other programs. Plaza Premium is the best, operating in 80+ airports across Asia, Middle East, Europe. SATS is best at Singapore Changi.",
        "content": (
            "International airports often have multiple lounge options from various networks. Here are the major ones accessible through common travel card benefits.\n\n"
            "PLAZA PREMIUM LOUNGES:\n"
            "One of the largest independent lounge operators globally. Generally excellent quality — better than typical Priority Pass lounges.\n"
            "- Access: Priority Pass, Amex Platinum, Capital One Venture X\n"
            "- Locations: 80+ airports including HKG, SIN, LHR, CDG, YYZ, YVR, ORD, LAX, JFK, DFW\n"
            "- Features: Hot food (usually proper meals, not just snacks), full bar, showers at major locations\n"
            "- Best locations: Hong Kong (HKG) is exceptional. Toronto (YYZ) and Vancouver (YVR) are also very good for North American travelers.\n\n"
            "SATS PREMIER LOUNGE (Singapore Changi — SIN):\n"
            "- Access: Priority Pass\n"
            "- Widely considered one of the best airport lounges in the world\n"
            "- Singapore Changi is the best airport globally — any lounge there is exceptional\n"
            "- Features: Extensive hot and cold food, noodle bar, full bar, shower facilities, sleeping pods\n\n"
            "MARHABA LOUNGE (Middle East):\n"
            "- Access: Priority Pass\n"
            "- Locations: Dubai (DXB), Abu Dhabi (AUH), Qatar (DOH — some), and other Middle East airports\n"
            "- Quality: Good to excellent, particularly at DXB\n\n"
            "ASPIRE LOUNGE:\n"
            "- Access: Priority Pass\n"
            "- Locations: Many UK and European airports\n"
            "- Quality: Generally solid — better than average European airport lounges\n\n"
            "SWISSPORT LOUNGES (Europe):\n"
            "- Access: Priority Pass, various airline programs\n"
            "- Locations: Many European secondary airports\n"
            "- Quality: Basic but adequate — food service, beverages, Wi-Fi\n\n"
            "STAR ALLIANCE LOUNGES:\n"
            "- Access: Star Alliance Gold status or flying in business/first on a Star Alliance carrier\n"
            "- Present in major international hubs (FRA, MUC, NRT, ICN, SIN, etc.)\n"
            "- Quality varies by airline operating the lounge — Lufthansa and Singapore Airlines operate excellent lounges\n\n"
            "ONEWORLD LOUNGES:\n"
            "- Access: Oneworld Emerald or Sapphire status, or flying in business/first on a Oneworld carrier\n"
            "- Access to Cathay Pacific Lounges (excellent at HKG), British Airways Lounges (LHR — variable quality), Qatar Al Mourjan (exceptional at DOH), JAL Sakura and Kiku lounges (NRT — excellent)\n\n"
            "SKYTEAM LOUNGES:\n"
            "- Access: SkyTeam Elite Plus status or flying in business/first on SkyTeam carrier\n"
            "- Dedicated SkyTeam lounges at major hubs\n\n"
            "BEST INTERNATIONAL AIRPORT LOUNGES OVERALL:\n"
            "1. Singapore Changi — Qantas First Lounge, SATS Premier, Singapore Airlines SilverKris (any of them)\n"
            "2. Hong Kong — Cathay Pacific The Pier and The Wing (First and Business class)\n"
            "3. Dubai — Emirates First Class Lounge (requires Emirates First Class ticket)\n"
            "4. Doha — Qatar Al Mourjan (requires Business/First, or Oneworld Emerald)\n"
            "5. Tokyo Narita — ANA Suite Lounge, JAL Sakura\n"
            "6. London Heathrow — BA Concorde Room (First), Cathay Pacific (Oneworld Emerald)\n"
            "7. Frankfurt — Lufthansa First Class Terminal (First Class only — requires LH First Class ticket or HON Circle)"
        ),
    },

    {
        "id": "lounge-access-by-card-comparison",
        "title": "Lounge Access by Credit Card — Full Comparison",
        "category": "airport_lounges",
        "tags": ["lounge access comparison", "which card for lounges", "priority pass", "centurion", "club access"],
        "valid_as_of": "2026-Q2",
        "summary": "Side-by-side comparison of which credit cards provide which lounge access. Best for pure lounge access: Amex Platinum (Centurion + Priority Pass). Best value: Capital One Venture X ($395/year). Budget option: Chase Sapphire Reserve (Priority Pass + $550 offset by $300 credit).",
        "content": (
            "Choosing a card for lounge access depends on which lounges you'll actually use. Here's the complete breakdown:\n\n"
            "AMEX PLATINUM ($695/year):\n"
            "✓ Centurion Lounges (best in US)\n"
            "✓ Priority Pass Select (unlimited)\n"
            "✓ Delta Sky Club (up to 10 visits/year when flying Delta)\n"
            "✓ Escape Lounges\n"
            "✓ Plaza Premium\n"
            "✗ United Club, Admirals Club, Alaska Lounge (not included)\n"
            "Best for: Travelers who fly out of airports with Centurion Lounges frequently\n\n"
            "CAPITAL ONE VENTURE X ($395/year):\n"
            "✓ Capital One Lounges (DFW, LAS, IAD — expanding)\n"
            "✓ Priority Pass Select (unlimited + 2 free guests)\n"
            "✓ Plaza Premium\n"
            "✗ Centurion, Sky Club, United Club, Admirals Club\n"
            "Best for: Travelers who fly through DFW, LAS, or IAD and want premium lounge + Priority Pass\n\n"
            "CHASE SAPPHIRE RESERVE ($550/year, $250 after $300 travel credit):\n"
            "✓ Priority Pass Select (unlimited + 2 free guests)\n"
            "✓ Plaza Premium (via Priority Pass)\n"
            "✗ Centurion, Capital One, Sky Club, United Club\n"
            "Best for: Value-focused travelers who want solid Priority Pass coverage without paying for premium tier\n\n"
            "UNITED CLUB INFINITE ($525/year):\n"
            "✓ United Club (unlimited)\n"
            "✓ United Polaris Lounge (when flying international United business/first)\n"
            "✓ Star Alliance lounges (when traveling on United and partner flights)\n"
            "✗ Centurion, Sky Club, Priority Pass\n"
            "Best for: United loyalists who fly frequently through United hubs\n\n"
            "CITI AADVANTAGE EXECUTIVE ($595/year):\n"
            "✓ Admirals Club (unlimited + authorized users)\n"
            "✓ Flagship Lounge/Dining (when flying AA international business/first)\n"
            "✗ Centurion, Priority Pass, Sky Club, United Club\n"
            "Best for: American Airlines loyalists who use Admirals Clubs at AA hubs\n\n"
            "DELTA RESERVE AMEX ($650/year):\n"
            "✓ Delta Sky Club (10 visits/year unless $75k spend)\n"
            "✓ Centurion Lounge (when flying Delta)\n"
            "✗ Priority Pass, United Club, Admirals Club\n"
            "Best for: Delta loyalists who want Sky Club + Centurion at Delta hubs, can use 10 visits\n\n"
            "HILTON AMEX ASPIRE ($550/year):\n"
            "✓ Priority Pass Select (unlimited)\n"
            "✗ Centurion, Capital One, Sky Club, United Club\n"
            "Best for: Hilton loyalists who want Diamond status and Priority Pass\n\n"
            "BEST COMBINATION STRATEGY:\n"
            "For maximum lounge access, hold both:\n"
            "1. Amex Platinum: Centurion + Priority Pass\n"
            "2. United Club Infinite or Citi Executive: Airline club access\n"
            "Total cost: $1,070-$1,220/year for near-universal US lounge access\n\n"
            "BUDGET STRATEGY:\n"
            "Capital One Venture X ($395/year) + Capital One Lounges + Priority Pass covers the most ground for the least money. Centurion Lounges are the only major gap.\n\n"
            "INTERNATIONAL TRAVEL STRATEGY:\n"
            "Priority Pass (via any premium card) provides the best global coverage. Supplement with airline status for access to carrier-specific lounges (Cathay, ANA, Lufthansa First) that Priority Pass doesn't cover."
        ),
    },
]
