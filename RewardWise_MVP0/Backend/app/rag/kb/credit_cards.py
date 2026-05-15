"""
rag/kb/credit_cards.py
───────────────────────
Comprehensive travel credit card knowledge base.
Every major travel card with earning rates, benefits, fees, and strategy.

CATEGORY: credit_cards
VALID AS OF: 2026-Q2
UPDATE CADENCE: Quarterly — welcome bonuses and benefits change frequently.
"""

from __future__ import annotations

CREDIT_CARDS_KB: list[dict] = [

    {
        "id": "chase-sapphire-reserve",
        "title": "Chase Sapphire Reserve — Full Card Guide",
        "category": "credit_cards",
        "tags": ["chase", "sapphire reserve", "CSR", "ultimate rewards", "priority pass", "travel credit"],
        "valid_as_of": "2026-Q2",
        "summary": "Chase's premium travel card. $550 annual fee offset by $300 travel credit. Earns 3x on travel and dining. Best for frequent travelers who use Priority Pass and transfer points to airline/hotel partners.",
        "content": (
            "Chase Sapphire Reserve (CSR) is Chase's flagship premium travel card. Annual fee is $550. "
            "The $300 annual travel credit applies automatically to the first $300 of travel purchases each cardmember year, effectively reducing the out-of-pocket cost to $250 for most travelers. "
            "Travel is defined broadly — airlines, hotels, Airbnb, Uber, trains, parking, tolls, and more all count.\n\n"
            "EARNING RATES:\n"
            "- 10x points on hotels and car rentals booked through Chase Travel\n"
            "- 10x points on Chase Dining purchases\n"
            "- 5x points on flights booked through Chase Travel\n"
            "- 3x points on all other travel (after the $300 credit is earned)\n"
            "- 3x points on dining worldwide\n"
            "- 1x on everything else\n\n"
            "POINT VALUE: Chase Ultimate Rewards points are worth 1.5 cents each when redeemed through Chase Travel portal with CSR. Transfer value is often higher — Hyatt transfers can yield 2+ cents per point.\n\n"
            "TRANSFER PARTNERS (1:1 unless noted): United MileagePlus, Southwest Rapid Rewards, British Airways Avios, Air France/KLM Flying Blue, Singapore KrisFlyer, Virgin Atlantic Flying Club, Iberia Plus, Aer Lingus AerClub, Emirates Skywards, Air Canada Aeroplan, World of Hyatt, IHG One Rewards, Marriott Bonvoy.\n\n"
            "KEY BENEFITS:\n"
            "- Priority Pass Select membership (unlimited visits + 2 guests free)\n"
            "- $300 annual travel credit (auto-applies)\n"
            "- Global Entry/TSA PreCheck credit ($100 every 4 years)\n"
            "- DoorDash DashPass membership\n"
            "- Lyft Pink All Access membership\n"
            "- Primary rental car insurance (CDW/LDW — major benefit, saves $15-30/day)\n"
            "- Trip delay insurance: $500/ticket after 6-hour delay\n"
            "- Trip cancellation/interruption: up to $10,000/person, $20,000/trip\n"
            "- Baggage delay: $100/day for 5 days after 6-hour delay\n"
            "- Lost luggage: up to $3,000/passenger\n"
            "- Purchase protection: 120 days, up to $10,000/claim\n"
            "- Extended warranty: adds 1 year to manufacturer warranty\n\n"
            "WHO IT'S BEST FOR: Travelers who fly several times per year, dine out regularly, and will use the Priority Pass lounge access. The math works well if you value the $300 travel credit at face value — you're paying $250 net for a card that earns 3x on travel and dining and comes with primary rental car insurance alone worth hundreds annually.\n\n"
            "WHO SHOULD SKIP: Infrequent travelers who won't use Priority Pass or the travel credit efficiently. The Chase Sapphire Preferred at $95/year may make more sense.\n\n"
            "IMPORTANT: Subject to Chase 5/24 rule. Cannot hold both CSR and Sapphire Preferred simultaneously. Cannot receive Sapphire bonus if received another Sapphire bonus in the past 48 months."
        ),
    },

    {
        "id": "chase-sapphire-preferred",
        "title": "Chase Sapphire Preferred — Full Card Guide",
        "category": "credit_cards",
        "tags": ["chase", "sapphire preferred", "CSP", "ultimate rewards", "travel card", "beginner"],
        "valid_as_of": "2026-Q2",
        "summary": "Chase's mid-tier travel card. $95 annual fee. Earns 3x on dining, 2x on travel. Best starter travel card for building Ultimate Rewards. Same transfer partners as CSR.",
        "content": (
            "Chase Sapphire Preferred (CSP) is the best entry-level travel rewards card for most people. Annual fee is $95. "
            "It earns the same Ultimate Rewards currency as the Sapphire Reserve and has access to all the same transfer partners.\n\n"
            "EARNING RATES:\n"
            "- 5x points on travel booked through Chase Travel\n"
            "- 5x points on Lyft (through March 2025)\n"
            "- 3x points on dining\n"
            "- 3x points on select streaming services\n"
            "- 3x points on online grocery purchases (not Walmart, Target, wholesale clubs)\n"
            "- 2x points on all other travel\n"
            "- 1x on everything else\n\n"
            "POINT VALUE: 1.25 cents per point through Chase Travel portal (vs 1.5 cents on CSR). Transfer partners are identical to CSR — same 1:1 ratios.\n\n"
            "KEY BENEFITS:\n"
            "- $50 annual hotel credit (for hotels booked through Chase Travel)\n"
            "- 10% anniversary point bonus (if you spend $10,000 in a year, you get 1,000 bonus points)\n"
            "- Primary rental car insurance\n"
            "- Trip delay: $500/ticket after 12-hour delay (CSR is 6 hours)\n"
            "- Trip cancellation: up to $10,000/person\n"
            "- Baggage delay: $100/day after 6-hour delay\n"
            "- No foreign transaction fees\n\n"
            "TRANSFER PARTNERS (identical to CSR, 1:1): United, Southwest, British Airways, Air France/KLM, Singapore, Virgin Atlantic, Iberia, Aer Lingus, Emirates, Air Canada, Hyatt, IHG, Marriott.\n\n"
            "WHO IT'S BEST FOR: People new to travel rewards, those who want UR transfer access without the $550 CSR fee, and people who spend heavily on dining and travel but don't need Priority Pass. The $95 fee is easy to justify with the $50 hotel credit and 2x+ on travel.\n\n"
            "CSP VS CSR DECISION: If you travel frequently and will use Priority Pass + $300 credit, CSR wins. If you travel occasionally or are just starting out, CSP at $95 is a much better value proposition. You cannot hold both simultaneously.\n\n"
            "PRODUCT CHANGE: Can product change to/from Freedom Flex, Freedom Unlimited, or Freedom (no annual fee) without closing the account, preserving your UR points."
        ),
    },

    {
        "id": "chase-ink-preferred",
        "title": "Chase Ink Business Preferred — Full Card Guide",
        "category": "credit_cards",
        "tags": ["chase", "ink preferred", "CIP", "business card", "ultimate rewards", "5/24"],
        "valid_as_of": "2026-Q2",
        "summary": "Chase's best business travel card. $95 annual fee. Earns 3x on travel, shipping, internet, cable, phone, and advertising (up to $150k/year). Does not count toward 5/24.",
        "content": (
            "Chase Ink Business Preferred (CIP) is the best business card in the Chase ecosystem. Annual fee is $95. "
            "Critical strategic point: business cards generally do not add to your Chase 5/24 count, making this a powerful tool for earning UR points without burning a 5/24 slot.\n\n"
            "EARNING RATES:\n"
            "- 3x points on travel\n"
            "- 3x points on shipping purchases\n"
            "- 3x points on internet, cable, and phone services\n"
            "- 3x points on advertising purchases (social media and search engines)\n"
            "- All 3x categories capped at $150,000 combined spending per year\n"
            "- 1x on everything else\n\n"
            "POINT VALUE: Same UR points, same transfer partners as Sapphire cards. Points transfer 1:1 to all airline and hotel partners.\n\n"
            "KEY BENEFITS:\n"
            "- Cell phone protection: up to $1,000/claim, $100 deductible, 3 claims per year (if you pay your phone bill with this card)\n"
            "- Primary rental car insurance for business purposes\n"
            "- Trip cancellation/interruption: $5,000/trip\n"
            "- Purchase protection: 120 days, $10,000/claim\n"
            "- Extended warranty: adds 1 year\n"
            "- No foreign transaction fees\n\n"
            "STRATEGY: Stack with personal Sapphire card. Earn 3x on business expenses (ads, shipping, phone), then transfer UR points from Ink to Sapphire Reserve for 1.5 cents portal value or to airline/hotel partners. "
            "The Ink Preferred + Sapphire Preferred combo at $190 total annual fee is one of the best value setups in travel rewards.\n\n"
            "WELCOME BONUS: Historically 80,000-100,000 UR points after spending $8,000 in 3 months. One of the highest-value business card bonuses available. Check current offer before applying."
        ),
    },

    {
        "id": "amex-platinum",
        "title": "Amex Platinum Card — Full Card Guide",
        "category": "credit_cards",
        "tags": ["amex", "platinum", "centurion lounge", "membership rewards", "airline credit", "hotel credit"],
        "valid_as_of": "2026-Q2",
        "summary": "Amex's ultra-premium card. $695 annual fee. Best lounge access of any card (Centurion + Priority Pass + Delta Sky Club). Up to $1,500+ in annual credits that offset the fee if used.",
        "content": (
            "American Express Platinum Card is the premium lounge access card. Annual fee is $695. "
            "The fee sounds steep but is offset by credits that can total $1,500+ in value if used fully — the key is whether you can realistically use them.\n\n"
            "EARNING RATES:\n"
            "- 5x Membership Rewards points on flights booked directly with airlines or through Amex Travel (up to $500,000/year)\n"
            "- 5x on prepaid hotels booked through Amex Travel\n"
            "- 1x on everything else\n\n"
            "ANNUAL CREDITS (the real value of the card):\n"
            "- $200 airline fee credit (incidental fees on one selected airline — bags, seat upgrades, in-flight purchases, lounge day passes)\n"
            "- $200 Uber Cash ($15/month + $20 in December)\n"
            "- $200 hotel credit (Fine Hotels + Resorts or Hotel Collection bookings through Amex Travel)\n"
            "- $189 CLEAR Plus credit\n"
            "- $155 Walmart+ credit ($12.95/month)\n"
            "- $100 Saks Fifth Avenue credit ($50 Jan-June, $50 July-Dec)\n"
            "- $300 Equinox credit\n"
            "- Global Entry/TSA PreCheck credit ($100 every 4.5 years)\n\n"
            "LOUNGE ACCESS (best of any card):\n"
            "- Centurion Lounges (American Express owned — best food and service of any airport lounge)\n"
            "- Priority Pass Select (unlimited visits, note: some Amex Priority Pass cards no longer include restaurant credits)\n"
            "- Delta Sky Club access (when flying Delta — effective Feb 2025: limited to 10 visits/year unless you spend $75k+ on the card)\n"
            "- Escape Lounges\n"
            "- Plaza Premium Lounges\n"
            "- Lufthansa Lounges (when flying Lufthansa)\n\n"
            "TRANSFER PARTNERS (MR points, 1:1 unless noted):\n"
            "Airlines: Air Canada Aeroplan, Air France/KLM Flying Blue, ANA Mileage Club, British Airways Avios, Cathay Pacific Asia Miles, Delta SkyMiles, Emirates Skywards, Etihad Guest, Iberia Plus, JetBlue TrueBlue (1.25:1), Qantas Frequent Flyer, Singapore KrisFlyer, Virgin Atlantic Flying Club.\n"
            "Hotels: Choice Privileges (1:1), Hilton Honors (1:2), Marriott Bonvoy (1:1).\n\n"
            "KEY BENEFITS:\n"
            "- No foreign transaction fees\n"
            "- Marriott Bonvoy Gold Elite status (complimentary)\n"
            "- Hilton Honors Gold status (complimentary)\n"
            "- Car rental elite status: Hertz Gold Plus Rewards President's Circle, Avis Preferred Plus, National Car Rental Emerald Club Executive\n"
            "- Trip delay insurance: $500/ticket after 6 hours\n"
            "- Trip cancellation: $10,000/trip\n"
            "- Baggage insurance: $3,000/person checked, $1,250 carry-on\n"
            "- Purchase protection: 90 days, $10,000/claim\n"
            "- Return protection: 90 days, $300/item\n\n"
            "WHO IT'S BEST FOR: Frequent travelers who fly out of airports with Centurion Lounges, can use the Uber Cash monthly, and travel enough to maximize the hotel credit. The card makes most sense if you spend heavily on airfare (5x is excellent) and value lounge access above all else.\n\n"
            "WHO SHOULD SKIP: Occasional travelers or those who fly from airports without Centurion Lounges. The credits require active management — if you forget to use the airline credit or Saks credit, you're overpaying.\n\n"
            "AMEX IMPORTANT RULE: Amex has a once-per-lifetime bonus rule — you can only earn the welcome bonus on a specific card once in your lifetime (some exceptions apply via targeted offers)."
        ),
    },

    {
        "id": "amex-gold",
        "title": "Amex Gold Card — Full Card Guide",
        "category": "credit_cards",
        "tags": ["amex", "gold", "membership rewards", "dining", "grocery", "4x"],
        "valid_as_of": "2026-Q2",
        "summary": "Amex's mid-premium card. $250 annual fee. Earns 4x on dining and US supermarkets. Best card for heavy dining and grocery spenders who want MR points. $220 in annual credits offset most of the fee.",
        "content": (
            "American Express Gold Card is the best card for dining and grocery spending. Annual fee is $250. "
            "The earning rates on restaurants and supermarkets are unmatched in the MR ecosystem.\n\n"
            "EARNING RATES:\n"
            "- 4x Membership Rewards on restaurants worldwide\n"
            "- 4x on US supermarkets (up to $25,000/year, then 1x)\n"
            "- 3x on flights booked directly with airlines or through Amex Travel\n"
            "- 1x on everything else\n\n"
            "ANNUAL CREDITS:\n"
            "- $120 dining credit ($10/month at Grubhub, The Cheesecake Factory, Goldbelly, Wine.com, Milk Bar, select restaurants)\n"
            "- $120 Uber Cash ($10/month for Uber Eats or Uber rides)\n"
            "- $100 hotel credit (The Hotel Collection via Amex Travel, minimum 2-night stay)\n\n"
            "TRANSFER PARTNERS: Same MR network as Amex Platinum — all airline and hotel partners at same ratios.\n\n"
            "KEY BENEFITS:\n"
            "- No foreign transaction fees\n"
            "- Purchase protection: 90 days, $10,000/claim\n"
            "- Extended warranty: adds 1 year\n"
            "- Baggage insurance on flights paid with card\n\n"
            "WHO IT'S BEST FOR: Anyone who spends $500+/month on dining and groceries combined. At 4x on both categories, the earning rate is exceptional. A household spending $1,000/month on food earns 48,000 MR points/year from those categories alone — worth $480-$960+ depending on redemption.\n\n"
            "AMEX GOLD VS PLATINUM: Gold earns far more on everyday spending. Platinum earns more on airfare (5x vs 3x) and has superior lounge access. Many serious points earners hold both — Gold for daily spend, Platinum for lounge access and flight booking. The combination costs $945/year in fees before credits."
        ),
    },

    {
        "id": "amex-blue-business-plus",
        "title": "Amex Blue Business Plus — Full Card Guide",
        "category": "credit_cards",
        "tags": ["amex", "blue business plus", "BBP", "business card", "no annual fee", "2x"],
        "valid_as_of": "2026-Q2",
        "summary": "No-annual-fee business card that earns 2x MR on everything up to $50,000/year. Best no-fee card for earning Amex Membership Rewards on everyday business spend.",
        "content": (
            "Amex Blue Business Plus is the best no-annual-fee card for earning Membership Rewards points. $0 annual fee.\n\n"
            "EARNING RATES:\n"
            "- 2x Membership Rewards on all purchases (up to $50,000/year)\n"
            "- 1x on everything above $50,000\n\n"
            "STRATEGY: This is a workhorse card for earning MR points on spend that doesn't hit bonus categories on Gold or Platinum. Pairs perfectly with the Gold Card — use Gold for dining/groceries (4x), Blue Business Plus for everything else (2x).\n\n"
            "KEY BENEFITS:\n"
            "- No annual fee\n"
            "- Extended payment option (spend beyond credit limit in some months)\n"
            "- Purchase protection: 90 days\n"
            "- Extended warranty\n\n"
            "IMPORTANT: As a business card, it does not count toward Amex's 5-card personal limit. Can hold in addition to personal Amex cards."
        ),
    },

    {
        "id": "capital-one-venture-x",
        "title": "Capital One Venture X — Full Card Guide",
        "category": "credit_cards",
        "tags": ["capital one", "venture x", "priority pass", "travel credit", "2x everywhere"],
        "valid_as_of": "2026-Q2",
        "summary": "Best premium travel card value at $395/year. $300 travel credit + 10,000 anniversary miles make effective cost $0-$95. Earns 2x on everything. Priority Pass + Capital One Lounges.",
        "content": (
            "Capital One Venture X is the best premium travel card for pure value. Annual fee is $395. "
            "After credits, the effective annual cost is often $0-$95 depending on how you use it.\n\n"
            "EARNING RATES:\n"
            "- 10x miles on hotels and rental cars booked through Capital One Travel\n"
            "- 5x miles on flights booked through Capital One Travel\n"
            "- 2x miles on all other purchases (no cap)\n\n"
            "ANNUAL CREDITS:\n"
            "- $300 Capital One Travel credit (must book through Capital One portal)\n"
            "- 10,000 anniversary bonus miles (worth $100 at 1 cpp baseline, often more via transfer)\n"
            "- Global Entry/TSA PreCheck credit ($100 every 4 years)\n\n"
            "NET COST: $395 - $300 travel credit - $100 anniversary miles (at minimum value) = -$5. Most people effectively pay nothing or earn money on the annual fee.\n\n"
            "LOUNGE ACCESS:\n"
            "- Capital One Lounges (LAS, DFW, IAD — expanding; excellent food and service)\n"
            "- Priority Pass Select (unlimited visits + 2 guests)\n"
            "- Plaza Premium Lounges\n\n"
            "TRANSFER PARTNERS (most at 1:1): Air Canada Aeroplan, Air France/KLM Flying Blue, Avianca LifeMiles, British Airways Avios, Emirates Skywards, EVA Air Infinity MileageLands, Finnair Plus, Qantas Frequent Flyer, Singapore KrisFlyer, TAP Miles&Go, Turkish Miles&Smiles, Wyndham Rewards, Choice Privileges.\n\n"
            "KEY BENEFITS:\n"
            "- No foreign transaction fees\n"
            "- Primary rental car insurance\n"
            "- Trip cancellation/interruption insurance\n"
            "- Cell phone protection ($800/claim, $50 deductible)\n"
            "- Hertz President's Circle status\n\n"
            "WHO IT'S BEST FOR: People who want premium card benefits without Amex's complexity. The 2x on everything is simple and the credits genuinely offset the fee. Ideal for travelers who fly out of LAS, DFW, or IAD where Capital One Lounges are available.\n\n"
            "VENTURE X VS AMEX PLATINUM: Venture X wins on simplicity and value. Platinum wins on lounge network breadth (Centurion is superior to Capital One) and earning on airfare (5x vs 2x on non-portal bookings)."
        ),
    },

    {
        "id": "capital-one-venture",
        "title": "Capital One Venture — Full Card Guide",
        "category": "credit_cards",
        "tags": ["capital one", "venture", "2x everywhere", "travel eraser", "miles"],
        "valid_as_of": "2026-Q2",
        "summary": "Capital One's mid-tier travel card. $95/year. Earns 2x on everything. Can redeem miles to erase travel purchases or transfer to partners. Simpler than Chase/Amex ecosystem.",
        "content": (
            "Capital One Venture earns 2x miles on all purchases with no category restrictions. Annual fee is $95.\n\n"
            "EARNING RATES:\n"
            "- 5x miles on hotels and rental cars booked through Capital One Travel\n"
            "- 2x miles on all other purchases\n\n"
            "REDEMPTION OPTIONS:\n"
            "1. Transfer to airline/hotel partners (same partners as Venture X)\n"
            "2. Erase travel purchases at 1 cent per mile (book anywhere, then erase statement credit)\n"
            "3. Capital One Travel portal at 1 cent per mile\n\n"
            "TRANSFER PARTNERS (same as Venture X): Air Canada, Air France/KLM, Avianca, British Airways, Emirates, EVA Air, Finnair, Qantas, Singapore, TAP, Turkish, Wyndham, Choice.\n\n"
            "KEY BENEFITS:\n"
            "- Global Entry/TSA PreCheck credit ($100 every 4 years)\n"
            "- No foreign transaction fees\n"
            "- Travel accident insurance\n"
            "- Auto rental collision damage waiver\n\n"
            "WHO IT'S BEST FOR: People who want simple rewards without managing bonus categories. 2x on everything is genuinely useful and the travel eraser redemption makes it flexible."
        ),
    },

    {
        "id": "citi-strata-premier",
        "title": "Citi Strata Premier — Full Card Guide",
        "category": "credit_cards",
        "tags": ["citi", "strata premier", "thankyou", "3x everywhere", "transfer partners"],
        "valid_as_of": "2026-Q2",
        "summary": "Citi's best travel card. $95/year. Earns 3x on air, hotels, restaurants, supermarkets, and gas. Access to Citi ThankYou transfer partners including Turkish and Singapore.",
        "content": (
            "Citi Strata Premier (formerly Citi Premier) is Citi's flagship transferable points card. Annual fee is $95.\n\n"
            "EARNING RATES:\n"
            "- 3x ThankYou Points on air travel\n"
            "- 3x on hotels\n"
            "- 3x on restaurants\n"
            "- 3x on supermarkets\n"
            "- 3x on gas stations and EV charging\n"
            "- 1x on everything else\n\n"
            "ANNUAL CREDIT: $100 hotel savings benefit (once per year, $500+ hotel booking through thankyoutravel.com).\n\n"
            "TRANSFER PARTNERS (1:1 unless noted): Air France/KLM Flying Blue, Avianca LifeMiles, Cathay Pacific Asia Miles, Etihad Guest, EVA Air Infinity MileageLands, JetBlue TrueBlue, Qatar Privilege Club, Singapore KrisFlyer, Thai Royal Orchid Plus, Turkish Miles&Smiles, Virgin Atlantic Flying Club, Wyndham Rewards.\n\n"
            "SWEET SPOT PARTNERS: Turkish Miles&Smiles and Singapore KrisFlyer are the standout reasons to earn Citi ThankYou points. Turkish has historically low award rates for business class to Asia and Europe. Singapore provides access to Star Alliance partners.\n\n"
            "KEY BENEFITS:\n"
            "- No foreign transaction fees\n"
            "- Trip cancellation/interruption: $5,000/trip\n"
            "- Lost or damaged baggage: $3,000/person\n\n"
            "CITI APPLICATION RULES: Cannot receive bonus if you've opened or closed a Citi ThankYou card in the past 24 months for same-family cards, 48 months for some premium cards. Verify current rules before applying.\n\n"
            "WHO IT'S BEST FOR: People who want another transferable currency (don't put all eggs in Chase/Amex basket) and those who spend heavily on everyday categories. 3x on supermarkets, gas, AND restaurants is unusually broad for a $95 card."
        ),
    },

    {
        "id": "bilt-mastercard",
        "title": "Bilt Mastercard — Full Card Guide",
        "category": "credit_cards",
        "tags": ["bilt", "rent", "no annual fee", "hyatt", "transfer", "rent day"],
        "valid_as_of": "2026-Q2",
        "summary": "The only card that earns points on rent with no transaction fee. $0 annual fee. Bilt points transfer to Hyatt, United, American, Alaska, Air Canada, and more. Rent Day bonuses on the 1st of every month.",
        "content": (
            "Bilt Mastercard is unique: the only card that earns rewards on rent payments without charging a transaction fee. Annual fee is $0.\n\n"
            "EARNING RATES (standard days):\n"
            "- 1x points on rent (up to 100,000 points/year)\n"
            "- 3x on dining\n"
            "- 2x on travel\n"
            "- 1x on everything else\n"
            "- IMPORTANT: Must make at least 5 transactions per statement period to earn points\n\n"
            "RENT DAY (1st of every month) — DOUBLED RATES:\n"
            "- 2x on rent\n"
            "- 6x on dining\n"
            "- 4x on travel\n"
            "- 2x on everything else\n"
            "- Rent Day is one of the best earning opportunities in all of travel rewards — plan major purchases for the 1st.\n\n"
            "TRANSFER PARTNERS (1:1): United MileagePlus, American AAdvantage, Alaska Mileage Plan, Air Canada Aeroplan, British Airways Avios, Air France/KLM Flying Blue, Cathay Pacific Asia Miles, Emirates Skywards, Virgin Atlantic Flying Club, Turkish Miles&Smiles, Singapore KrisFlyer, Marriott Bonvoy, IHG One Rewards, World of Hyatt.\n\n"
            "BILT → HYATT: One of the best transfer paths in all of travel rewards. Hyatt points are extremely valuable (often 2+ cents each) and Bilt is one of the few ways to earn them via everyday spend without paying an annual fee. This is the key reason to get this card.\n\n"
            "KEY BENEFITS:\n"
            "- No annual fee\n"
            "- No foreign transaction fees\n"
            "- Cell phone protection: up to $800/claim\n"
            "- Trip cancellation: up to $5,000\n"
            "- Auto rental collision damage waiver\n"
            "- Lyft Pink membership\n\n"
            "WHO IT'S BEST FOR: Anyone who pays rent. Even at 1x on rent, you're earning points on a large monthly expense that no other card will reward without a fee. For renters in cities with high rents ($2,000+/month), this card generates significant points purely from housing costs.\n\n"
            "WHO SHOULD SKIP: Homeowners who don't pay rent. The dining and travel rates (3x and 2x) are decent but not market-leading for non-renters."
        ),
    },

    {
        "id": "united-explorer-card",
        "title": "United Explorer Card — Full Card Guide",
        "category": "credit_cards",
        "tags": ["united", "explorer", "mileageplus", "free checked bag", "lounge passes", "chase"],
        "valid_as_of": "2026-Q2",
        "summary": "United's mid-tier co-branded card. $95/year (waived first year). Free first checked bag for you and a companion. 2x on United, dining, and hotels. 2 United Club one-time passes per year.",
        "content": (
            "United Explorer Card (Chase) is the best United co-branded card for most travelers. Annual fee is $95, waived the first year.\n\n"
            "EARNING RATES:\n"
            "- 2x MileagePlus miles on United purchases\n"
            "- 2x on dining\n"
            "- 2x on hotel stays\n"
            "- 1x on everything else\n\n"
            "KEY BENEFITS:\n"
            "- Free first checked bag for cardholder and one companion on same reservation (saves $35/bag each way — $140 round trip for 2 people)\n"
            "- 2 United Club one-time passes per year (worth $59 each = $118 value)\n"
            "- Priority boarding (Group 2)\n"
            "- 25% back on in-flight purchases (food, beverages, Wi-Fi)\n"
            "- No foreign transaction fees\n"
            "- Primary rental car insurance\n"
            "- Expanded award space (cardholders may see additional saver award availability)\n\n"
            "ANNUAL VALUE MATH: If you check 2 bags round trip once per year, that's $140 in bag fee savings — more than covering the $95 fee. Add the 2 lounge passes ($118) and the card pays for itself multiple times over for United flyers.\n\n"
            "WHO IT'S BEST FOR: United flyers who check bags. The free bag benefit alone justifies the annual fee for anyone who flies United more than twice per year with checked luggage.\n\n"
            "UNITED CLUB CARD: United's premium co-branded card at $525/year includes full United Club membership (unlimited visits) and higher earning rates. Worth it for frequent United flyers who use the club heavily."
        ),
    },

    {
        "id": "delta-gold-amex",
        "title": "Delta SkyMiles Gold Amex — Full Card Guide",
        "category": "credit_cards",
        "tags": ["delta", "skymiles", "gold amex", "free checked bag", "amex", "co-branded"],
        "valid_as_of": "2026-Q2",
        "summary": "Delta's mid-tier co-branded Amex. $150/year (first year $0). Free first checked bag. 2x on Delta, dining, and US supermarkets. Delta Sky Club access when flying Delta for a per-visit fee.",
        "content": (
            "Delta SkyMiles Gold American Express Card is Delta's most popular co-branded card. Annual fee is $150 ($0 first year).\n\n"
            "EARNING RATES:\n"
            "- 2x SkyMiles on Delta purchases\n"
            "- 2x on dining at restaurants\n"
            "- 2x on US supermarkets\n"
            "- 1x on everything else\n\n"
            "KEY BENEFITS:\n"
            "- Free first checked bag for cardholder and up to 8 companions on same reservation\n"
            "- Main Cabin 1 priority boarding\n"
            "- 20% savings on in-flight purchases\n"
            "- $200 Delta flight credit after $10,000 in annual card spend\n"
            "- No foreign transaction fees\n\n"
            "FREE BAG VALUE: Delta charges $35 for first bag each way. Round trip = $70 per person. Two people = $140 per trip. One round trip saves more than the annual fee.\n\n"
            "DELTA PLATINUM AMEX ($350/year): Adds companion certificate (economy round trip), TakeOff 15 (15% off award redemptions), and MQD boost toward Medallion status. Worth considering if you fly Delta frequently and want to accelerate toward Silver Medallion.\n\n"
            "DELTA RESERVE AMEX ($650/year): Adds unlimited Delta Sky Club access (before Feb 2025 policy — now limited to 15 visits/year or pay per visit), Centurion Lounge access when flying Delta, companion certificate (any cabin), and Medallion Qualifying Dollars boost. Best for Delta loyalists chasing Platinum or Diamond Medallion.\n\n"
            "WHO IT'S BEST FOR: Anyone who flies Delta at least 2-3 times per year and checks bags. The free bag benefit easily covers the fee."
        ),
    },

    {
        "id": "american-airlines-citi-cards",
        "title": "American Airlines Citi AAdvantage Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["american airlines", "aadvantage", "citi", "co-branded", "free checked bag", "admirals club"],
        "valid_as_of": "2026-Q2",
        "summary": "American Airlines co-branded cards from Citi. Free checked bag, preferred boarding, and AAdvantage miles. Multiple tiers from $99/year to $595/year for Admirals Club access.",
        "content": (
            "American Airlines offers co-branded cards through both Citi and Barclays. Here are the main Citi options:\n\n"
            "CITI AADVANTAGE PLATINUM SELECT ($99/year, first year waived):\n"
            "- 2x on American Airlines purchases\n"
            "- 2x on dining and gas stations\n"
            "- 1x everywhere else\n"
            "- Free first checked bag for cardholder and up to 4 companions\n"
            "- Preferred boarding (Group 5)\n"
            "- 25% savings on in-flight food and beverage\n"
            "- No foreign transaction fees\n\n"
            "CITI AADVANTAGE EXECUTIVE ($595/year):\n"
            "- All Platinum Select benefits plus:\n"
            "- Admirals Club membership (unlimited access + 2 guests)\n"
            "- Global Entry/TSA PreCheck credit\n"
            "- 10,000 Elite Qualifying Miles bonus each year\n"
            "- Concierge service\n"
            "- 4x on American Airlines purchases\n\n"
            "ADMIRALS CLUB VALUE: A standalone Admirals Club membership costs $650+/year. The Executive card at $595 effectively gives you the club membership plus all card benefits at less than membership alone — strong value for frequent AA flyers.\n\n"
            "BARCLAYS AADVANTAGE AVIATOR RED ($99/year): Another AA card option through Barclays. Key benefit: free companion fare after spending $20,000 in a year. Earns 2x on AA purchases, 1x elsewhere. Important: Barclays and Citi both issue AA cards, and you can hold one of each — double the welcome bonuses.\n\n"
            "FREE BAG MATH: AA charges $35 first bag each way. Two people, round trip = $140. One trip pays for the Platinum Select annual fee. If you fly AA with checked bags twice per year, you're up $185."
        ),
    },

    {
        "id": "alaska-airlines-bank-of-america",
        "title": "Alaska Airlines Visa — Full Card Guide",
        "category": "credit_cards",
        "tags": ["alaska airlines", "mileage plan", "bank of america", "companion fare", "free checked bag"],
        "valid_as_of": "2026-Q2",
        "summary": "Alaska's co-branded Visa from Bank of America. $95/year. Annual companion fare ($99 + taxes), free first checked bag, 3x on Alaska purchases. Best for Alaska/West Coast travelers.",
        "content": (
            "Alaska Airlines Visa Signature Card (Bank of America) is the best co-branded card for West Coast travelers. Annual fee is $95.\n\n"
            "EARNING RATES:\n"
            "- 3x miles on Alaska Airlines purchases\n"
            "- 2x on gas, EV charging, cable, streaming, local transit\n"
            "- 1x on everything else\n\n"
            "KEY BENEFITS:\n"
            "- Annual companion fare: $99 + taxes and fees (companion flies for $99 on any Alaska flight, round trip, any fare class) — this benefit alone is worth $200-$800+ depending on where you fly\n"
            "- Free first checked bag for you and up to 6 companions on same reservation\n"
            "- 3,000 bonus miles on account anniversary each year\n"
            "- 20% back on in-flight purchases\n"
            "- No foreign transaction fees\n\n"
            "COMPANION FARE VALUE: Alaska's companion fare is one of the most valuable airline card benefits in the industry. On a $500 round trip, your companion pays $99 + taxes (maybe $120 total) — saving $380. This benefit can justify the annual fee 4x over on a single trip.\n\n"
            "ALASKA PREMIUM BUSINESS CARD ($75/year): Earns 3x on Alaska, 2x on shipping/office, 1x everywhere. Includes companion fare and free bag. Lower fee makes it a strong business option.\n\n"
            "WHO IT'S BEST FOR: West Coast residents, Hawaiian route travelers, and anyone who can use the companion fare annually. Alaska's partner network (Emirates, Cathay, JAL, British Airways) makes Mileage Plan miles extremely valuable — earning them via the card accelerates access to exceptional redemptions."
        ),
    },

    {
        "id": "southwest-rapid-rewards-cards",
        "title": "Southwest Rapid Rewards Credit Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["southwest", "rapid rewards", "companion pass", "chase", "priority card"],
        "valid_as_of": "2026-Q2",
        "summary": "Southwest's co-branded Chase cards. Key feature: earning enough points triggers the Companion Pass (companion flies free for up to 2 years). Best for domestic US travelers who can earn 135,000 points in a calendar year.",
        "content": (
            "Southwest Rapid Rewards credit cards are the best path to earning the Southwest Companion Pass — one of the most valuable benefits in domestic travel.\n\n"
            "COMPANION PASS BASICS:\n"
            "Earn 135,000 Rapid Rewards points in a calendar year → your designated companion flies free (just pays taxes ~$5.60 each way) for the rest of that year and all of the following year. Points from credit card welcome bonuses count toward the threshold.\n\n"
            "STRATEGY: Apply for two Southwest cards in January (personal + business). If welcome bonuses total 80,000+ points and you spend the minimum, you may hit 135,000 points early in the year, earning 2 full years of Companion Pass benefits.\n\n"
            "SOUTHWEST RAPID REWARDS PRIORITY ($149/year):\n"
            "- 3x on Southwest purchases\n"
            "- 2x on hotel and car rental partners\n"
            "- 1x on everything else\n"
            "- $75 Southwest travel credit per year\n"
            "- 7,500 anniversary bonus points\n"
            "- 4 upgraded boarding positions per year (A1-A15 boarding)\n"
            "- 20% back on in-flight purchases\n"
            "- No foreign transaction fees\n\n"
            "SOUTHWEST RAPID REWARDS PLUS ($69/year):\n"
            "- 2x on Southwest purchases\n"
            "- 2x on hotel and car rental partners\n"
            "- 1x on everything else\n"
            "- 3,000 anniversary bonus points\n"
            "- 2 EarlyBird check-in per year\n\n"
            "SOUTHWEST RAPID REWARDS PREMIER ($99/year):\n"
            "- 3x on Southwest purchases\n"
            "- 2x on hotel and car rental partners\n"
            "- 6,000 anniversary bonus points\n"
            "- 1,500 tier qualifying points toward A-List for every $5,000 spent\n\n"
            "SOUTHWEST PERFORMANCE BUSINESS ($199/year):\n"
            "- 4x on Southwest purchases\n"
            "- 3x on hotel and car rental partners, social media, search engine advertising\n"
            "- 2x on everything else\n"
            "- 80,000 point welcome bonus historically\n"
            "- 9,000 anniversary bonus points\n"
            "- Up to 365 inflight Wi-Fi credits ($8 each)\n"
            "- 4 upgraded boarding positions\n\n"
            "WHO IT'S BEST FOR: Frequent domestic US travelers, especially families. The Companion Pass makes Southwest the best domestic carrier deal in the industry when you can earn it. No blackout dates, no change fees, points are refundable — Southwest is the most flexible domestic airline."
        ),
    },

    {
        "id": "jetblue-card",
        "title": "JetBlue Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["jetblue", "trueblue", "barclays", "mint", "mosaic"],
        "valid_as_of": "2026-Q2",
        "summary": "JetBlue's Barclays co-branded cards. Best for JetBlue loyalists on East Coast, Florida, and Caribbean routes. TrueBlue points are fare-linked and most valuable for Mint business class.",
        "content": (
            "JetBlue offers co-branded cards through Barclays at two main tiers.\n\n"
            "JETBLUE CARD ($0/year):\n"
            "- 3x on JetBlue purchases\n"
            "- 2x on dining and grocery stores\n"
            "- 1x on everything else\n"
            "- 50% savings on JetBlue in-flight purchases\n"
            "- No foreign transaction fees\n\n"
            "JETBLUE PLUS ($99/year):\n"
            "- 6x on JetBlue purchases\n"
            "- 2x on dining and grocery\n"
            "- 1x everything else\n"
            "- Free first checked bag for cardholder + one companion\n"
            "- 50% savings on in-flight purchases\n"
            "- $100 annual JetBlue statement credit\n"
            "- Mosaic 1 status for first year (then threshold applies)\n"
            "- 5,000 anniversary bonus points\n\n"
            "TRUEBLUE POINT VALUE: TrueBlue points are fare-based — you redeem them as a percentage of the cash price. Generally worth 1.3-1.5 cents each. Best redemptions are for Mint (JetBlue's business class) — Mint can cost $500-$1,500 in cash but award rates can yield 1.5-2+ cpp.\n\n"
            "TRANSFER PARTNERS: Chase UR → JetBlue (1:1), Amex MR → JetBlue (1:1 for some, verify), Citi ThankYou → JetBlue (1:1).\n\n"
            "WHO IT'S BEST FOR: JetBlue loyalists on the East Coast, transcon travelers who want Mint business class at a fraction of cash prices."
        ),
    },

    {
        "id": "marriott-bonvoy-cards",
        "title": "Marriott Bonvoy Credit Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["marriott", "bonvoy", "amex", "chase", "hotel", "free night"],
        "valid_as_of": "2026-Q2",
        "summary": "Marriott Bonvoy cards from Amex and Chase. Free night certificates are the primary value. Points transfer to airline miles at 3:1 (plus 5k bonus at 60k). Best for Marriott loyalists, not transfer point seekers.",
        "content": (
            "Marriott Bonvoy cards are issued by both Amex (personal) and Chase (business). Key rule: you cannot hold the Amex Bonvoy Brilliant and Chase Bonvoy Boundless simultaneously if you got both bonuses within certain time windows.\n\n"
            "MARRIOTT BONVOY BRILLIANT AMEX ($650/year):\n"
            "- 6x on Marriott purchases\n"
            "- 3x on flights and restaurants\n"
            "- 2x on everything else\n"
            "- Annual free night certificate (up to 85,000 points value)\n"
            "- $300 Marriott statement credit\n"
            "- Marriott Platinum Elite status\n"
            "- Priority Pass Select\n"
            "- $25 dining statement credit per month at restaurants in Marriott hotels\n\n"
            "MARRIOTT BONVOY BOUNDLESS CHASE ($95/year):\n"
            "- 6x on Marriott\n"
            "- 3x on grocery, gas, dining (up to $6,000/year)\n"
            "- 2x on everything else\n"
            "- Annual free night (up to 35,000 points)\n"
            "- 15 Elite Night Credits per year\n"
            "- Silver Elite status\n\n"
            "MARRIOTT → AIRLINE TRANSFER: 60,000 Marriott points = 25,000 airline miles (3:1 ratio + 5,000 bonus miles at 60,000). Transfer partners: Alaska, American, Delta, United, Southwest, JetBlue, Air Canada, British Airways, and ~40 others. The 3:1 ratio is poor — only use this if you have excess Marriott points with no hotel redemption value.\n\n"
            "FREE NIGHT CERTIFICATE VALUE: The 85,000-point free night on the Brilliant can cover rooms worth $300-$600+ at premium Marriott properties. This is the primary reason to hold the card.\n\n"
            "WHO IT'S BEST FOR: Marriott loyalists who stay at Marriott properties regularly and will use the free night certificate. Not recommended as a transfer point vehicle — Chase UR and Amex MR earn the same points with better transfer ratios."
        ),
    },

    {
        "id": "hilton-honors-cards",
        "title": "Hilton Honors Amex Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["hilton", "honors", "amex", "hotel", "free night", "diamond status"],
        "valid_as_of": "2026-Q2",
        "summary": "Hilton Honors cards from Amex. Hilton Aspire ($550/year) is the best premium hotel card — Diamond status, $400 Hilton resort credit, Priority Pass, and free weekend night. Surpass ($150/year) offers Gold status and free night.",
        "content": (
            "Hilton Honors cards are issued by American Express. Hilton points are earned at high rates but are generally worth less per point than Chase/Amex currencies (approximately 0.5-0.6 cents each).\n\n"
            "HILTON HONORS AMEX ASPIRE ($550/year):\n"
            "- 14x on Hilton purchases\n"
            "- 7x on flights booked directly with airlines, car rentals, US restaurants\n"
            "- 3x on everything else\n"
            "- Hilton Diamond status (highest tier — free breakfast at most properties, room upgrades, executive lounge)\n"
            "- $400 Hilton resort credit ($200 semi-annually at Hilton Resorts)\n"
            "- $200 airline fee credit (choose one airline)\n"
            "- Free weekend night reward each year\n"
            "- Priority Pass Select\n"
            "- Second free weekend night if you spend $30,000 in a year\n\n"
            "HILTON ASPIRE VALUE: Hilton Diamond status alone can be worth $500-$1,000+/year in free breakfasts (worth $25-$50/person at full-service properties) and room upgrades. For Hilton loyalists, the Aspire is one of the best hotel cards available.\n\n"
            "HILTON HONORS AMEX SURPASS ($150/year):\n"
            "- 12x on Hilton\n"
            "- 6x on US restaurants, US supermarkets, US gas stations\n"
            "- 3x on everything else\n"
            "- Hilton Gold status (free breakfast at some properties, room upgrades)\n"
            "- Free weekend night after $15,000 spend\n"
            "- 10 Priority Pass visits per year\n\n"
            "HILTON HONORS AMEX ($0 annual fee):\n"
            "- 7x on Hilton\n"
            "- 5x on US restaurants, US supermarkets, US gas\n"
            "- 3x on everything else\n"
            "- Hilton Silver status\n\n"
            "AMEX MR → HILTON: Transfer at 1:2 ratio (1 MR = 2 Hilton points). Unusually, this transfer can sometimes make sense given Hilton's 5th night free benefit on award stays — you effectively get 5 nights for the price of 4, making the effective rate 1.6x.\n\n"
            "5TH NIGHT FREE: On award stays of 5+ nights at Hilton properties, the 5th night is always free. This is a major benefit that makes Hilton redemptions more competitive than the point value alone suggests."
        ),
    },

    {
        "id": "ihg-one-rewards-card",
        "title": "IHG One Rewards Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["IHG", "intercontinental", "holiday inn", "chase", "4th night free", "platinum status"],
        "valid_as_of": "2026-Q2",
        "summary": "IHG co-branded cards from Chase. IHG One Rewards Premier ($99/year) is the standout — Platinum Elite status, 4th night free on awards, annual free night, and 140,000+ point welcome bonuses.",
        "content": (
            "IHG One Rewards cards are issued by Chase and offer exceptional value for the annual fee.\n\n"
            "IHG ONE REWARDS PREMIER ($99/year):\n"
            "- 26x on IHG purchases (10x base + 6x from Platinum + 10x from card)\n"
            "- 5x on travel, dining, gas\n"
            "- 3x on everything else\n"
            "- IHG Platinum Elite status (room upgrades, late checkout, bonus points)\n"
            "- 4th night free on award stays (every 4th night of an award redemption is free)\n"
            "- Annual free night (up to 40,000 points)\n"
            "- Global Entry/TSA PreCheck credit\n"
            "- No foreign transaction fees\n\n"
            "4TH NIGHT FREE VALUE: If you stay 4 nights on points, you only pay 3 nights' worth of points. Effectively a 25% discount on all award stays of 4+ nights. This significantly improves IHG redemption value.\n\n"
            "IHG ONE REWARDS PREMIER BUSINESS ($99/year): Similar benefits, tailored for business expenses. Earns 5x on dining, gas, social media advertising, office supply stores.\n\n"
            "IHG TRAVELER ($0/year): No annual fee, Silver Elite status, no 4th night free. Primarily useful for the welcome bonus.\n\n"
            "IHG POINT VALUE: IHG points are generally worth 0.5-0.7 cents each. The 4th night free benefit and frequent point sales (IHG regularly sells points at deep discounts) make them more valuable when stacked.\n\n"
            "CHASE → IHG TRANSFER: Chase UR points transfer to IHG at 1:1. At 0.5 cents per IHG point, this is a poor transfer — don't transfer Chase UR to IHG unless the 4th night free benefit makes it worthwhile on a specific stay."
        ),
    },

    {
        "id": "world-of-hyatt-card",
        "title": "World of Hyatt Credit Card — Full Card Guide",
        "category": "credit_cards",
        "tags": ["hyatt", "world of hyatt", "chase", "hotel", "globalist", "free night"],
        "valid_as_of": "2026-Q2",
        "summary": "Hyatt's Chase co-branded card. $95/year. Earns Hyatt points (most valuable hotel currency). Free night annually. Discoverist status. 5 qualifying night credits per year toward Globalist.",
        "content": (
            "World of Hyatt Credit Card (Chase) earns the most valuable hotel currency in the market. Annual fee is $95.\n\n"
            "EARNING RATES:\n"
            "- 9x Hyatt points on Hyatt stays (4x base + 5x card)\n"
            "- 2x on dining, airlines, local transit, fitness club memberships\n"
            "- 1x on everything else\n\n"
            "KEY BENEFITS:\n"
            "- Free night each year at a Category 1-4 Hyatt property (worth $100-$300+)\n"
            "- Hyatt Discoverist status (room upgrades when available, late checkout, 10% bonus points)\n"
            "- 5 qualifying night credits toward elite status (every year)\n"
            "- Earn 2 qualifying night credits for every $5,000 spent (toward Globalist)\n"
            "- No foreign transaction fees\n\n"
            "HYATT POINT VALUE: Hyatt points are worth approximately 1.7-2.5+ cents each — consistently the most valuable hotel currency. A Category 7 Park Hyatt property might cost 45,000 points per night but $500-$1,000 in cash, yielding 1.1-2.2+ cpp.\n\n"
            "CHASE UR → HYATT: The best hotel transfer in the Chase ecosystem. 1:1 transfer. Turning 25,000 UR points into 25,000 Hyatt points and redeeming for a $400+ hotel night is one of the best point redemptions available to anyone.\n\n"
            "BILT → HYATT: Same 1:1 transfer, same value. Bilt cardholders can earn Hyatt points on rent — an exceptional combination.\n\n"
            "PATH TO GLOBALIST: Hyatt Globalist is the most valuable hotel elite status available — it includes confirmed suite upgrades, free breakfast worldwide, club lounge access, and waived resort fees. The Hyatt card's 5 qualifying night credits each year reduce the 60-night annual threshold. Spend $15,000 on the card in a year and earn an additional 6 qualifying nights. Total possible: 5 base + 6 via spend = 11 nights credit, reducing your stay requirement to 49 nights from personal travel."
        ),
    },

    {
        "id": "wells-fargo-autograph-journey",
        "title": "Wells Fargo Autograph Journey — Full Card Guide",
        "category": "credit_cards",
        "tags": ["wells fargo", "autograph journey", "transfer partners", "hotels", "airlines"],
        "valid_as_of": "2026-Q2",
        "summary": "Wells Fargo's premium travel card. $95/year. Earns 5x on hotels, 4x on airlines, 3x on dining. Transferable points to airline partners. Good diversification from Chase/Amex.",
        "content": (
            "Wells Fargo Autograph Journey is Wells Fargo's first serious transferable points card. Annual fee is $95.\n\n"
            "EARNING RATES:\n"
            "- 5x on hotels\n"
            "- 4x on airlines\n"
            "- 3x on dining\n"
            "- 3x on other travel\n"
            "- 1x on everything else\n\n"
            "ANNUAL CREDIT: $50 annual airline credit.\n\n"
            "TRANSFER PARTNERS (1:1): Air France/KLM Flying Blue, Avianca LifeMiles, British Airways Avios, Iberia Plus, Aer Lingus AerClub, Korean Air SKYPASS, TAP Miles&Go, Turkish Miles&Smiles, Singapore KrisFlyer, Qantas Frequent Flyer.\n\n"
            "NOTABLE PARTNERS: Turkish Miles&Smiles (access via Wells Fargo), Singapore KrisFlyer, and Korean Air SKYPASS are the standout transfer partners — routes and sweet spots not easily accessible via Chase or Amex.\n\n"
            "STRATEGY: Useful as a diversification card alongside Chase and Amex. The 5x on hotels and 4x on airlines are best-in-class rates for those categories. Transfers to Turkish give access to Star Alliance business class sweet spots that are harder to reach with other bank currencies.\n\n"
            "AUTOGRAPH ($0/year): The no-fee Autograph earns 3x on restaurants, travel, gas, transit, streaming, phone — but points are NOT transferable to airline/hotel partners. Must have the Journey to unlock transfers."
        ),
    },

    {
        "id": "us-bank-altitude-reserve",
        "title": "US Bank Altitude Reserve — Full Card Guide",
        "category": "credit_cards",
        "tags": ["US bank", "altitude reserve", "mobile pay", "real time rewards", "travel credit"],
        "valid_as_of": "2026-Q2",
        "summary": "US Bank's premium card. $400/year, offset by $325 travel/dining credit. Earns 3x on travel and mobile wallet purchases. Unique for its 1.5 cpp redemption rate. Best for mobile pay heavy spenders.",
        "content": (
            "US Bank Altitude Reserve is an underrated premium card. Annual fee is $400, but a $325 annual travel and dining credit reduces effective cost to $75.\n\n"
            "EARNING RATES:\n"
            "- 5x on prepaid hotels and car rentals in Altitude Rewards Center\n"
            "- 3x on all travel and mobile wallet purchases (Apple Pay, Google Pay, Samsung Pay)\n"
            "- 1x on everything else\n\n"
            "KEY FEATURES:\n"
            "- Real-Time Rewards: Redeem points as a statement credit against travel purchases at 1.5 cents per point (better than most portal redemptions)\n"
            "- $325 annual travel and dining credit (applies automatically)\n"
            "- Priority Pass Select (unlimited)\n"
            "- Global Entry/TSA PreCheck credit\n"
            "- No foreign transaction fees\n\n"
            "THE MOBILE WALLET ANGLE: The 3x on mobile wallet is the card's sleeper feature. If you use Apple Pay/Google Pay for most purchases, you're effectively earning 3x on everything — a rate that beats most general spending cards.\n\n"
            "REDEMPTION: Points are worth 1.5 cents when redeemed via Real-Time Rewards against travel purchases. No transfer partners — this is a fixed-value card, not a transferable currency card.\n\n"
            "WHO IT'S BEST FOR: Mobile payment heavy users who want a simple premium travel card with excellent real-world redemption value. Not suitable as a primary card if you want to transfer to airline/hotel programs."
        ),
    },

    {
        "id": "british-airways-visa-chase",
        "title": "British Airways Visa Signature — Full Card Guide",
        "category": "credit_cards",
        "tags": ["british airways", "avios", "chase", "companion voucher", "travel together"],
        "valid_as_of": "2026-Q2",
        "summary": "Chase's British Airways co-branded card. $95/year. Earns Avios (the most versatile points currency — shared with Iberia, Aer Lingus, Qatar). Travel Together companion voucher after $30k spend.",
        "content": (
            "British Airways Visa Signature (Chase) earns British Airways Avios — the currency shared by BA Executive Club, Iberia Plus, Aer Lingus AerClub, and Qatar Privilege Club. Annual fee is $95.\n\n"
            "EARNING RATES:\n"
            "- 3x Avios on British Airways, Iberia, Aer Lingus, and OpenSkies purchases\n"
            "- 2x on hotel stays\n"
            "- 1x on everything else\n\n"
            "KEY BENEFITS:\n"
            "- Travel Together Ticket: After spending $30,000 in a calendar year, earn a companion ticket — companion flies free (just pays taxes/fees) on any BA flight in same cabin. In business/first, this is worth thousands of dollars.\n"
            "- 10% discount on British Airways flights when booked with Avios\n"
            "- No foreign transaction fees\n\n"
            "AVIOS FLEXIBILITY: Avios can be used across the Oneworld ecosystem via any of the four programs. Key sweet spots:\n"
            "- Short-haul on AA metal (under 650 miles) = very few Avios\n"
            "- American Airlines flights bookable via Avios without BA fuel surcharges\n"
            "- Alaska Airlines bookable via Avios\n"
            "- Iberia transatlantic business class (lowest points price to Spain/Portugal)\n\n"
            "AVIOS POOLING: You can pool Avios between BA, Iberia, Aer Lingus, and Qatar accounts — useful for combining smaller balances to book premium awards.\n\n"
            "WHO IT'S BEST FOR: People who fly British Airways regularly, want the Travel Together Ticket, or want to accumulate Avios for short-haul AA redemptions without paying BA's high fuel surcharges on transatlantic flights."
        ),
    },

    {
        "id": "emirates-skywards-card",
        "title": "Emirates Skywards Credit Cards — Full Card Guide",
        "category": "credit_cards",
        "tags": ["emirates", "skywards", "first class", "business class", "hsbc", "mastercard"],
        "valid_as_of": "2026-Q2",
        "summary": "Emirates Skywards co-branded cards in the US via HSBC. Earns Skywards miles directly. Limited US card availability but useful for Emirates loyalists. Most US travelers earn Emirates miles via Amex MR, Capital One, or Citi transfers.",
        "content": (
            "Emirates Skywards cards in the US are issued by HSBC. These cards are less mainstream than Chase/Amex products but serve Emirates loyalists.\n\n"
            "EMIRATES SKYWARDS REWARDS WORLD ELITE MASTERCARD ($99/year):\n"
            "- 3x on Emirates purchases\n"
            "- 2x on dining and entertainment\n"
            "- 1x on everything else\n"
            "- 10,000 bonus Skywards miles on first purchase\n"
            "- No foreign transaction fees\n\n"
            "KEY INSIGHT: Most US-based travelers earn Emirates Skywards miles more efficiently via transfer from Amex MR, Capital One, or Citi ThankYou than via the co-branded card. The transfer partner paths offer larger welcome bonuses and better category earning rates.\n\n"
            "EMIRATES REDEMPTION STRATEGY: Emirates Skywards is best for redeeming on Emirates metal — First Class Suites and Business Class are exceptional products. However, Skywards imposes high carrier-imposed surcharges, and many travelers get better value booking Emirates via Alaska Mileage Plan (no fuel surcharges) than via Skywards itself.\n\n"
            "EARNING VIA TRANSFERS:\n"
            "- Amex MR → Emirates Skywards (1:1)\n"
            "- Capital One → Emirates (1:1)\n"
            "- Citi ThankYou → Emirates (1:1)\n\n"
            "For most US travelers, earning Amex MR or Capital One miles and transferring to Skywards for specific redemptions is more efficient than holding the Emirates co-branded card."
        ),
    },

    {
        "id": "card-application-strategy-overview",
        "title": "Credit Card Application Strategy — Chase 5/24, Amex Rules, Timing",
        "category": "credit_cards",
        "tags": ["5/24", "application strategy", "velocity rules", "amex once per lifetime", "citi 24 month", "business cards"],
        "valid_as_of": "2026-Q2",
        "summary": "How to sequence credit card applications to maximize welcome bonuses. Chase 5/24 is the most important rule — apply for Chase cards first, before Amex. Business cards generally don't count toward 5/24. Amex has once-per-lifetime bonus rules.",
        "content": (
            "Credit card application strategy is as important as which cards you hold. Applying in the wrong order can cost you tens of thousands of points in lost welcome bonuses.\n\n"
            "CHASE 5/24 RULE — MOST IMPORTANT:\n"
            "Chase will not approve most of their cards if you have opened 5 or more personal credit cards (from any issuer) in the past 24 months. This is the single most important rule in travel rewards.\n"
            "- What counts: personal credit cards from any bank (Chase, Amex, Citi, Capital One, etc.)\n"
            "- What doesn't count: business credit cards (Amex, Chase, Citi, Capital One business cards do NOT count toward 5/24 in most cases)\n"
            "- Authorized user cards: DO count toward 5/24 (remove yourself as AU if needed before applying)\n"
            "- Which Chase cards are subject to 5/24: Sapphire Reserve, Sapphire Preferred, Freedom Flex, Freedom Unlimited, Ink Preferred, Ink Cash, Ink Unlimited, all co-branded cards (United, Southwest, Marriott, Hyatt, IHG, BA, etc.)\n\n"
            "OPTIMAL APPLICATION ORDER:\n"
            "1. Apply for Chase cards first (while under 5/24)\n"
            "2. Apply for Amex cards second (no strict 5/24 equivalent, but has own rules)\n"
            "3. Apply for Citi, Capital One, Wells Fargo, others last\n"
            "Reason: Chase's 5/24 rule means every non-Chase personal card you open permanently reduces your Chase card access. Chase first, always.\n\n"
            "BUSINESS CARD STRATEGY:\n"
            "Business cards are your best tool to earn points without burning 5/24 slots:\n"
            "- Chase Ink cards (business) do NOT appear on your personal credit report (usually) and do NOT count toward 5/24\n"
            "- Amex business cards do NOT count toward 5/24\n"
            "- Capital One business cards DO count toward 5/24 (important exception)\n"
            "- You don't need a formal LLC — freelancing, selling items online, or any side income qualifies as a business\n\n"
            "AMEX RULES:\n"
            "- Once per lifetime: You can only earn a specific card's welcome bonus once. If you had an Amex Gold 10 years ago and received the bonus, you cannot get the bonus again on a new Gold application (terms say 'once per lifetime').\n"
            "- 5-card limit: You can hold up to 5 Amex credit cards simultaneously (charge cards like Platinum and Gold are often exempt from this limit)\n"
            "- Application velocity: Amex may decline if you've opened too many Amex cards recently (1/5 days, 2/90 days common limits)\n"
            "- Pop-up denial: Amex shows a 'not eligible for the bonus' pop-up during application if you're targeted as ineligible — use CardMatch or apply anyway as the pop-up isn't 100% accurate\n\n"
            "CITI RULES:\n"
            "- 24-month rule: Cannot receive a bonus on the same card family if you've received a bonus or opened/closed that card in the past 24 months\n"
            "- 48-month rule: Applies to some premium cards (Prestige)\n"
            "- Application velocity: 1 card per 8 days, 2 cards per 65 days recommended\n\n"
            "CAPITAL ONE RULES:\n"
            "- 1 Capital One card every 6 months generally\n"
            "- Capital One business cards DO count toward personal 5/24 (unlike other issuers)\n"
            "- Pulls all 3 credit bureaus (most aggressive hard pull policy in the industry)\n\n"
            "BANK OF AMERICA RULES:\n"
            "- 2/3/4 rule: 2 BOA cards per 2 months, 3 per 12 months, 4 per 24 months\n"
            "- Preferred Rewards relationship affects approval odds and earning rates\n\n"
            "GENERAL TIMING TIPS:\n"
            "- Wait at least 3-4 months between applications to the same bank\n"
            "- Apply before major travel to use welcome bonus miles immediately\n"
            "- Don't close old accounts — they help your credit score (length of history, utilization)\n"
            "- Product change (downgrade) instead of closing to preserve credit line and history\n"
            "- Check credit score impact: each hard pull drops score 3-5 points temporarily; score recovers in 6-12 months\n\n"
            "MANUFACTURED SPENDING: Not covered by Zoe — too many variables, can result in card shutdown.\n\n"
            "RECOMMENDED STARTER SEQUENCE (someone at 0/24):\n"
            "Month 1: Chase Sapphire Preferred (personal)\n"
            "Month 4: Chase Ink Preferred (business — doesn't count toward 5/24)\n"
            "Month 7: Chase Freedom Flex (personal — now at 2/24)\n"
            "Month 10: Chase Ink Cash (business)\n"
            "Month 13: Chase Sapphire Reserve (upgrade from CSP via product change, or wait for new app if want both bonuses)\n"
            "After 5/24 slots are used for Chase: Open Amex Gold, Amex Platinum, Capital One Venture X\n"
            "This sequence maximizes Chase UR earning while 5/24 slots are available, then diversifies."
        ),
    },

    {
        "id": "no-annual-fee-travel-cards",
        "title": "No Annual Fee Travel Cards Worth Holding",
        "category": "credit_cards",
        "tags": ["no annual fee", "free cards", "freedom flex", "freedom unlimited", "quicksilver", "double cash"],
        "valid_as_of": "2026-Q2",
        "summary": "No-annual-fee cards that earn transferable points or have genuine travel value. Chase Freedom Flex and Freedom Unlimited are the best for earning UR points without fees. Citi Double Cash + Strata Premier unlocks ThankYou transfers.",
        "content": (
            "Several no-annual-fee cards are worth holding permanently as part of a travel rewards strategy.\n\n"
            "CHASE FREEDOM FLEX ($0/year):\n"
            "- 5x on rotating quarterly categories (up to $1,500/quarter — activate each quarter)\n"
            "- 5x on Chase Travel purchases\n"
            "- 3x on dining and drugstores\n"
            "- 1x on everything else\n"
            "- CRITICAL: Points earned on Freedom Flex can be transferred to partner airlines/hotels IF you also hold a Sapphire card (Reserve or Preferred) or Ink Preferred. Without a Sapphire, points are worth only 1 cent each via portal.\n"
            "- Rotating categories have historically included gas stations, Amazon, Walmart, PayPal, grocery stores\n\n"
            "CHASE FREEDOM UNLIMITED ($0/year):\n"
            "- 5x on Chase Travel\n"
            "- 3x on dining and drugstores\n"
            "- 1.5x on all other purchases\n"
            "- Same transfer partner unlock: need Sapphire to transfer\n"
            "- Best no-fee catch-all card for non-bonus spending\n\n"
            "CHASE INK CASH ($0/year, business):\n"
            "- 5x on office supply stores, internet/cable/phone (up to $25,000/year)\n"
            "- 2x on gas and dining\n"
            "- 1x everywhere else\n"
            "- Same transfer unlock via Ink Preferred or Sapphire\n\n"
            "CITI DOUBLE CASH ($0/year):\n"
            "- 2% on all purchases (1% when you buy, 1% when you pay)\n"
            "- Earns ThankYou points that can be transferred to airline partners IF you also hold Citi Strata Premier or Prestige\n"
            "- Best 2% everything card in the market\n\n"
            "AMEX BLUE CASH EVERYDAY ($0/year):\n"
            "- 3% on US supermarkets, US gas stations, US online retail (up to $6,000/year each)\n"
            "- Earns cash back, NOT MR points — useful for cash back but not points strategy\n\n"
            "CAPITAL ONE QUICKSILVER ($0/year):\n"
            "- 1.5% on all purchases\n"
            "- NOT transferable to airline partners (need Venture or Venture X for that)\n"
            "- Best as a cash back card, not a points card\n\n"
            "STRATEGY FOR NO-FEE CARDS: The Freedom Flex + Freedom Unlimited + Sapphire Reserve combo is the most powerful Chase trifecta. Freedom Flex covers rotating 5x categories, Freedom Unlimited covers everything at 1.5x, and the Sapphire Reserve unlocks transfers for all earned UR points. Pay $550/year for the Reserve and earn maximized UR points across all spending."
        ),
    },
]
