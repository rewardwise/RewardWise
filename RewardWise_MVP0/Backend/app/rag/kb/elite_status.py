"""
rag/kb/elite_status.py
───────────────────────
Airline elite status knowledge base.
Every major US and international carrier's elite tiers,
qualification requirements, benefits, and strategy.

CATEGORY: elite_status
VALID AS OF: 2026-Q2
UPDATE CADENCE: Annually (programs update qualification thresholds each year).
"""

from __future__ import annotations

ELITE_STATUS_KB: list[dict] = [

    {
        "id": "united-elite-status-guide",
        "title": "United MileagePlus Elite Status — Complete Guide",
        "category": "elite_status",
        "tags": ["united", "mileageplus", "premier", "1K", "platinum", "gold", "silver", "elite status"],
        "valid_as_of": "2026-Q2",
        "summary": "United has 4 elite tiers: Premier Silver, Gold, Platinum, and 1K. Qualification based on PQF (flights) and PQP (spend). Premier 1K is among the most valuable domestic elite statuses — unlimited upgrades, SWU certificates, and access to near-full Y inventory for companion awards.",
        "content": (
            "United MileagePlus elite status is earned through a combination of Premier Qualifying Flights (PQF) and Premier Qualifying Points (PQP, based on spending on United flights).\n\n"
            "ELITE TIERS AND QUALIFICATION (2026):\n\n"
            "PREMIER SILVER:\n"
            "- 12 PQF + 3,500 PQP, OR 4,000 PQP (no flight minimum)\n"
            "- Benefits: 7x PQP multiplier, priority check-in/boarding, free checked bag (1), 25% mileage bonus, upgrade eligibility (waitlist), access to Economy Plus at check-in\n\n"
            "PREMIER GOLD:\n"
            "- 24 PQF + 8,000 PQP, OR 10,000 PQP (no flight minimum)\n"
            "- Benefits: All Silver + 8x multiplier, 2 free checked bags, Premier Access (check-in/security/boarding), upgrade to Economy Plus on booking, higher upgrade priority\n\n"
            "PREMIER PLATINUM:\n"
            "- 36 PQF + 12,000 PQP, OR 15,000 PQP\n"
            "- Benefits: All Gold + 9x multiplier, 3 free checked bags, complimentary United Club access (systemwide), Saver award access improvement, better upgrade priority\n\n"
            "PREMIER 1K:\n"
            "- 54 PQF + 18,000 PQP, OR 24,000 PQP\n"
            "- Benefits: All Platinum + 11x multiplier, 4 free checked bags, United Club access, 6 Regional Upgrade Certificates (RUCs — domestic segment upgrades), 4 Systemwide Upgrade Certificates (SWUs — domestic or international business class upgrades), Global Services invitation eligible, best award availability, complimentary same-day standby\n\n"
            "GLOBAL SERVICES (by invitation only):\n"
            "- United's invite-only tier above 1K, for very high-revenue flyers\n"
            "- Benefits include dedicated phone line, guaranteed upgrades when available, more SWUs, unique recognition\n\n"
            "UPGRADE CERTIFICATES (1K):\n"
            "- RUCs (Regional): Upgrade a domestic flight segment in the continental US, Hawaii, Caribbean, or Mexico\n"
            "- SWUs (Systemwide): Upgrade any United flight worldwide, including international business class on transatlantic/transpacific routes\n"
            "- SWUs are among the most valuable elite perks — an international business class upgrade can be worth $2,000-$5,000 in cash value\n\n"
            "CREDIT CARD ACCELERATORS:\n"
            "- United Club Infinite Card: 3 PQP per $1 spent, plus 1,500 PQP bonus after $30k and $60k spend\n"
            "- United Explorer Card: PQP accelerators for United purchases\n"
            "- Chase Sapphire Reserve or Preferred: No direct PQP but earns UR for flights\n\n"
            "STATUS MATCH: United occasionally offers status matches from other Star Alliance carriers. Contact MileagePlus directly. Requires documentation of current status and recent travel activity.\n\n"
            "STAR ALLIANCE GOLD (Premier Gold+): United Premier Gold and above = Star Alliance Gold = lounge access at partner airline airports when flying internationally on any Star Alliance carrier."
        ),
    },

    {
        "id": "delta-medallion-status-guide",
        "title": "Delta SkyMiles Medallion Elite Status — Complete Guide",
        "category": "elite_status",
        "tags": ["delta", "medallion", "diamond", "platinum", "gold", "silver", "MQD", "elite status"],
        "valid_as_of": "2026-Q2",
        "summary": "Delta has 4 Medallion tiers: Silver, Gold, Platinum, Diamond. Qualification based solely on MQDs (Medallion Qualifying Dollars — spend-based only since 2024). Diamond is the top tier with unlimited Sky Club, confirmed upgrades, and Complimentary Upgrades.",
        "content": (
            "Delta SkyMiles Medallion status underwent a major change in 2024 — qualification now requires only Medallion Qualifying Dollars (MQDs), eliminating the old segment/mile requirements. This makes qualification purely spend-based.\n\n"
            "ELITE TIERS AND QUALIFICATION (2026):\n\n"
            "SILVER MEDALLION:\n"
            "- $5,000 MQD\n"
            "- Benefits: 7x miles on Delta, priority check-in/boarding, 1 free checked bag, complimentary upgrades on day of departure (when available), upgrade eligibility (waitlist), Sky Priority access\n\n"
            "GOLD MEDALLION:\n"
            "- $10,000 MQD\n"
            "- Benefits: All Silver + 8x miles, 2 free checked bags, better upgrade priority, choice benefit (500 bonus miles, lounge access pass, or Delta merchandise)\n\n"
            "PLATINUM MEDALLION:\n"
            "- $15,000 MQD\n"
            "- Benefits: All Gold + 9x miles, 3 free checked bags, unlimited complimentary upgrades (when available), Delta Sky Club access on domestic flights (effective 2024 — limited to 6 visits for domestic-only Platinum, unlimited on international day)\n"
            "- Choice benefits: More valuable options including companion certificate\n\n"
            "DIAMOND MEDALLION:\n"
            "- $28,000 MQD\n"
            "- Benefits: All Platinum + 11x miles, 4 free checked bags, unlimited Delta Sky Club access, 360 complimentary companion upgrades, Global Upgrade Certificates (GUCs — full cabin upgrades on international routes), Rollover MQDs, dedicated Diamond phone line, annual choice gifts\n\n"
            "MQD EARNING WAYS:\n"
            "- Flights on Delta and partners (cents per dollar spent on ticket)\n"
            "- Delta Amex card spending ($1 spend = $0.10 MQD for most cards)\n"
            "- Delta Reserve Amex: $15,000 MQD boost after $60,000 card spend\n"
            "- Hotel and rental car partner spending\n\n"
            "GLOBAL UPGRADE CERTIFICATES (Diamond):\n"
            "- Upgrade a companion from main cabin to Delta One on international flights\n"
            "- GUCs are extremely valuable — Delta One transatlantic can cost $2,000-$6,000 cash\n"
            "- GUCs clear based on availability, best on routes Delta controls\n\n"
            "CREDIT CARD MQD BOOSTS:\n"
            "- Delta Gold Amex: $10,000 MQD spend waiver toward Gold (spend $25,000 on card)\n"
            "- Delta Platinum Amex: Earn 1,500 MQD per $5,000 card spend\n"
            "- Delta Reserve Amex: $15,000 MQD credit after $60,000 card spend\n\n"
            "SKYTEAM ELITE PLUS (Gold+): Delta Gold and above = SkyTeam Elite Plus = lounge access and upgrade benefits on SkyTeam partner airlines."
        ),
    },

    {
        "id": "american-aadvantage-elite-guide",
        "title": "American Airlines AAdvantage Elite Status — Complete Guide",
        "category": "elite_status",
        "tags": ["american airlines", "aadvantage", "executive platinum", "EXP", "platinum pro", "ConciergeKey", "elite"],
        "valid_as_of": "2026-Q2",
        "summary": "American has 4 AAdvantage elite tiers plus the invite-only ConciergeKey. Qualification based on EQMs (miles flown) and EQD (spend). Executive Platinum is the most valuable — 8 complimentary upgrades, systemwide upgrades, and Admirals Club access.",
        "content": (
            "American Airlines AAdvantage elite status is earned through Elite Qualifying Miles (EQMs) and Elite Qualifying Dollars (EQDs).\n\n"
            "ELITE TIERS AND QUALIFICATION (2026):\n\n"
            "GOLD:\n"
            "- 25,000 EQMs + $3,000 EQD, OR $5,000 EQD (no mileage minimum)\n"
            "- Benefits: Priority check-in/boarding, free first checked bag, 40% bonus EQMs, economy upgrade eligibility, preferred seating\n\n"
            "PLATINUM:\n"
            "- 50,000 EQMs + $6,000 EQD, OR $9,000 EQD\n"
            "- Benefits: All Gold + 60% bonus, 2 free checked bags, 500-mile upgrades, better upgrade priority, Main Cabin Extra at check-in\n\n"
            "PLATINUM PRO:\n"
            "- 75,000 EQMs + $9,000 EQD, OR $12,000 EQD\n"
            "- Benefits: All Platinum + 80% bonus, 4 complimentary systemwide upgrades (SWUs — any AA flight in the world), 3 free checked bags, Admirals Club access on day of travel\n\n"
            "EXECUTIVE PLATINUM (EXP):\n"
            "- 100,000 EQMs + $12,000 EQD, OR $16,000 EQD\n"
            "- Benefits: All Platinum Pro + 120% bonus, unlimited Admirals Club access, 8 systemwide upgrade certificates (SWUs), complimentary upgrades on booking (when available), 4 free checked bags, ConciergeKey eligibility, Flagship First Check-in\n\n"
            "CONCIERGEKEY (invitation only):\n"
            "- AA's ultra-elite tier, invite-only, for highest revenue customers\n"
            "- Benefits: Dedicated concierge service, guaranteed upgrades, meet-and-greet at airports, special recognition\n\n"
            "SYSTEMWIDE UPGRADES (SWU) VALUE:\n"
            "- Upgrades any AA flight — domestic, international, business class\n"
            "- Platinum Pro gets 4, EXP gets 8\n"
            "- International business upgrades can be worth $3,000-$8,000 each\n"
            "- SWUs clear based on availability — clear best on AA metal, harder on partners\n\n"
            "ONEWORLD EMERALD (Platinum Pro+): AAdvantage Platinum Pro and Executive Platinum = Oneworld Emerald = access to premium lounges (Cathay, BA, JAL, Qatar) and confirmed upgrades on partner airlines in some cases.\n\n"
            "CREDIT CARD EQD WAIVERS:\n"
            "- Citi AAdvantage Executive: EQD waiver if you spend $40,000 on the card (reduces EQD requirement)\n"
            "- Barclays AAdvantage Aviator Silver: EQD accelerators\n\n"
            "MILLION MILER STATUS:\n"
            "- Fly 1,000,000 miles on AA → Lifetime Platinum status\n"
            "- Fly 2,000,000 miles → Lifetime Platinum Pro\n"
            "- Fly 3,000,000 miles → Lifetime Executive Platinum\n"
            "- Lifetime status never expires even if you stop flying AA"
        ),
    },

    {
        "id": "alaska-elite-status-guide",
        "title": "Alaska Mileage Plan / Atmos Rewards Elite Status — Complete Guide",
        "category": "elite_status",
        "tags": ["alaska airlines", "mileage plan", "atmos", "MVP", "MVP Gold", "MVP Gold 75K", "elite status"],
        "valid_as_of": "2026-Q2",
        "summary": "Alaska has 3 MVP tiers: MVP, MVP Gold, and MVP Gold 75K. Now integrating with Hawaiian into Atmos Rewards. MVP Gold 75K is among the most rewarding domestic elite tiers — complimentary international upgrades, lounge access, and Oneworld Emerald status equivalent.",
        "content": (
            "Alaska Airlines elite status (Mileage Plan, transitioning to Atmos Rewards) has 3 MVP tiers plus integrating Hawaiian elite status.\n\n"
            "ELITE TIERS AND QUALIFICATION (verify Atmos changes):\n\n"
            "MVP:\n"
            "- 20,000 Elite Qualifying Miles (EQM) or 30 Flight Segments\n"
            "- Benefits: Priority check-in/boarding, free first checked bag, 50% mileage bonus, complimentary upgrades (waitlist, day of departure)\n\n"
            "MVP GOLD:\n"
            "- 40,000 EQM or 60 Flight Segments\n"
            "- Benefits: All MVP + 100% mileage bonus, 2 free checked bags, better upgrade priority, coach companion fare offer\n\n"
            "MVP GOLD 75K:\n"
            "- 75,000 EQM or 90 Flight Segments\n"
            "- Benefits: All MVP Gold + better upgrade priority, unlimited companion fare offers, complimentary upgrade on Alaska flights within 24 hours of departure, Alaska Lounge access, free first-class meal in coach (some routes), Oneworld Emerald equivalent when flying on Oneworld partners\n\n"
            "MVP GOLD 100K (new tier being introduced):\n"
            "- 100,000+ EQM\n"
            "- Enhanced benefits over 75K\n\n"
            "WHY MVP GOLD 75K IS SPECIAL:\n"
            "- Access to Oneworld Emerald benefits: When flying on British Airways, Cathay, JAL, AA, or other Oneworld carriers, MVP Gold 75K members access partner business class lounges and priority treatment — effectively Oneworld Emerald recognition without the AA/BA travel required\n"
            "- Alaska's unique partner network (Emirates, Cathay, JAL, BA) makes this status even more valuable for international upgrades\n\n"
            "PARTNER BENEFITS:\n"
            "- Emirates: MVP Gold and above receive dedicated elite lane\n"
            "- British Airways: MVP Gold 75K = Oneworld Emerald = Concorde Room access (First Class lounge at LHR)\n"
            "- Cathay Pacific: Lounge access via Oneworld recognition\n"
            "- JAL: Elite recognition\n\n"
            "ATMOS INTEGRATION: As Alaska and Hawaiian merge loyalty programs into Atmos Rewards, elite tiers and earning rules are evolving. For trips involving Hawaiian routes (Hawaii, Pacific Islands), verify current Atmos benefits as they may differ from legacy Alaska or Hawaiian rules.\n\n"
            "CREDIT CARD ACCELERATORS:\n"
            "- Alaska Airlines Visa: 1 EQM per $1 spent, plus tier-specific bonuses on card spend"
        ),
    },

    {
        "id": "southwest-alist-status-guide",
        "title": "Southwest A-List and A-List Preferred Status — Complete Guide",
        "category": "elite_status",
        "tags": ["southwest", "a-list", "a-list preferred", "companion pass", "rapid rewards", "elite status"],
        "valid_as_of": "2026-Q2",
        "summary": "Southwest's elite tiers are A-List and A-List Preferred. Both offer priority boarding, bonus points, and free same-day standby. Companion Pass is separate from elite status but worth more than either tier.",
        "content": (
            "Southwest Rapid Rewards elite status has two tiers: A-List and A-List Preferred.\n\n"
            "A-LIST QUALIFICATION:\n"
            "- 25 one-way flights OR $3,000 tier qualifying points in a calendar year\n"
            "- Benefits: Priority boarding (A1-A15), same-day standby for earlier flights, dedicated phone line, 25% bonus Rapid Rewards points on Southwest flights\n\n"
            "A-LIST PREFERRED QUALIFICATION:\n"
            "- 50 one-way flights OR $6,000 tier qualifying points\n"
            "- Benefits: All A-List + 100% bonus points, complimentary in-flight Wi-Fi, dedicated A-List Preferred phone line\n\n"
            "COMPANION PASS (separate from elite tiers):\n"
            "Earn 135,000 Rapid Rewards points in a calendar year → designated companion flies free (just pays taxes ~$5.60 each way) for the remainder of that year and ALL of the following year.\n"
            "- Points from credit card welcome bonuses count\n"
            "- Points from Southwest co-branded card spending count\n"
            "- Points from flights, partners, shopping portal count\n"
            "- This is the most valuable benefit in all of US domestic travel rewards\n\n"
            "WHY COMPANION PASS MATTERS MORE THAN ELITE STATUS:\n"
            "A-List gives you priority boarding. Companion Pass lets your companion fly free for up to 2 years on any Southwest flight you book. If you fly Southwest with a partner frequently, the Companion Pass is worth thousands of dollars per year — far exceeding the value of A-List benefits.\n\n"
            "CREDIT CARD STRATEGY FOR COMPANION PASS:\n"
            "Apply for Southwest Rapid Rewards Priority (personal) and Southwest Performance Business in the same month (both are Chase, need to be under 5/24). If you get 80,000 points from each welcome bonus ($16,000 combined spend), plus ongoing spend, you can hit 135,000 points by February-March, earning Companion Pass for almost 2 full years.\n\n"
            "SOUTHWEST CHANGES (2024-2025): Southwest announced significant changes including assigned seating (departing from open seating model) and changes to baggage fees. These changes were controversial. Verify current fare structure and benefits as the airline transitions."
        ),
    },

    {
        "id": "international-elite-status-guide",
        "title": "International Airline Elite Status — Key Tiers and Benefits",
        "category": "elite_status",
        "tags": ["lufthansa", "british airways", "singapore", "cathay", "emirates", "ANA", "JAL", "international elite", "HON circle"],
        "valid_as_of": "2026-Q2",
        "summary": "Elite status at international carriers — Lufthansa HON Circle, British Airways Gold/Silver, Singapore KrisFlyer Elite Gold, Cathay Diamond, Emirates Platinum, ANA Diamond. These are hardest to earn but provide access to the world's best lounges and products.",
        "content": (
            "International airline elite status is harder to earn for US-based travelers but often provides superior lounge access and upgrade benefits.\n\n"
            "LUFTHANSA MILES & MORE:\n"
            "Frequent Traveller (25,000 status miles or 30 flights): Star Alliance Silver. Priority, lounge access on international LH flights.\n"
            "Senator (50,000 status miles or 50 flights): Star Alliance Gold. Business lounge access globally, Senator Lounge access.\n"
            "HON Circle (600,000 status miles in 2 years): The most exclusive status in commercial aviation. Access to Frankfurt First Class Terminal (a separate building with personal valet, private security, gourmet dining, spa), guaranteed seat on full flights, dedicated phone line. Extremely difficult to earn without flying Lufthansa Group carriers in premium cabins regularly.\n\n"
            "BRITISH AIRWAYS EXECUTIVE CLUB:\n"
            "Blue (entry): No significant benefits.\n"
            "Bronze (300 tier points): 25% bonus Avios, preferred seating.\n"
            "Silver (600 tier points): Oneworld Sapphire. Business check-in on any Oneworld carrier, lounge access on international Oneworld flights, extra bag.\n"
            "Gold (1,500 tier points): Oneworld Emerald. Access to first class check-in and lounges (Concorde Room at LHR) on any Oneworld carrier, confirmed upgrades using Avios, 100% bonus Avios.\n"
            "Gold Guest List (invitation only): Enhanced Gold benefits, dedicated service.\n\n"
            "SINGAPORE KRISFLYER:\n"
            "KrisFlyer Elite Silver (25,000 miles flown): Star Alliance Silver. Priority services, lounge access on international flights.\n"
            "KrisFlyer Elite Gold (50,000 miles flown): Star Alliance Gold. Business class lounge access globally, Singapore Airlines Silver Kris Lounge access, priority.\n"
            "PPS Club: Revenue-based, requires significant spending on SQ fares. Access to The Private Room and Suite Lounge at Changi.\n\n"
            "CATHAY PACIFIC ASIA MILES:\n"
            "Green: Basic member.\n"
            "Silver: Oneworld Sapphire. Priority services.\n"
            "Gold: Oneworld Emerald. Business and First class lounge access globally, confirmed companion upgrades.\n"
            "Diamond: Oneworld Emerald. Access to Cathay Pacific's The Pier and The Wing First Class Lounges at HKG — arguably the best airport lounges in the world.\n\n"
            "EMIRATES SKYWARDS:\n"
            "Blue: Base tier.\n"
            "Silver: 25,000 tier miles. Priority check-in, extra bag.\n"
            "Gold: 50,000 tier miles. Business class lounge access, priority boarding, 50% bonus miles.\n"
            "Platinum: 150,000 tier miles. First class lounge access (spectacular at DXB), guaranteed upgrade availability, dedicated service.\n\n"
            "ANA MILEAGE CLUB:\n"
            "Bronze: 15,000 base miles. Star Alliance Silver.\n"
            "Silver (Platinum): 30,000 miles. Star Alliance Gold, ANAtraveling lounge access.\n"
            "Gold (Super Flyers): 50,000 miles + revenue threshold. Full lounge access.\n"
            "Diamond (Platinum Life Member): Highest tier, invitation to use ANA Suite Lounge (only accessible to Suite passengers otherwise).\n\n"
            "JAL MILEAGE BANK:\n"
            "Crystal: 30,000 miles or 30 flights. Oneworld Sapphire equivalent recognition.\n"
            "Sapphire: 50,000 miles or 50 flights. Oneworld Emerald equivalent. Business lounge access.\n"
            "JGC Premier: 80,000 miles or 80 flights + revenue. Enhanced benefits.\n"
            "Diamond: 100,000 miles or 100 flights. Oneworld Emerald. Full lounge access including JAL First Class Lounge (Sakura and Kiku at NRT/HND).\n\n"
            "EARNING INTERNATIONAL STATUS AS US TRAVELER:\n"
            "Most US travelers cannot earn international carrier elite status through mileage runs alone — the qualifying requirements demand actual travel on those carriers in sufficient volume. Status matches are occasionally available:\n"
            "- British Airways: Matches status from other Oneworld or select carriers\n"
            "- Lufthansa: Status match campaigns for Senator+\n"
            "- Singapore: Occasional match campaigns\n"
            "The most practical path: fly business or first class on these carriers for premium cabin lounges, rather than chasing elite status."
        ),
    },

    {
        "id": "status-match-and-challenge-guide",
        "title": "Airline Elite Status Match and Challenge Guide",
        "category": "elite_status",
        "tags": ["status match", "status challenge", "elite status", "match request", "challenge requirements"],
        "valid_as_of": "2026-Q2",
        "summary": "Status matches and challenges allow you to transfer elite status from one airline to another, often requiring just a letter or a short challenge period. Best used when switching allegiance or after earning status on a partner program.",
        "content": (
            "Status matches and challenges are one of the fastest ways to earn elite status at a new airline without flying the required miles or segments.\n\n"
            "HOW STATUS MATCHES WORK:\n"
            "You present your current elite status at one carrier and request matching status at another. The target carrier reviews your status and decides whether to match, offer a challenge, or decline.\n\n"
            "HOW STATUS CHALLENGES WORK:\n"
            "Rather than an outright match, the carrier offers a 'challenge' — fly X segments or earn X miles within 90 days and receive the target status tier.\n\n"
            "UNITED STATUS MATCHES:\n"
            "- United occasionally runs match campaigns, especially for Star Alliance Gold holders\n"
            "- Apply via MileagePlus customer service, provide documentation of current status\n"
            "- Best candidates: Delta Platinum/Diamond, AA Executive Platinum, Alaska MVP Gold\n"
            "- United sometimes matches to Premier Gold or Platinum, rarely to 1K\n\n"
            "DELTA STATUS MATCHES:\n"
            "- Delta has run match campaigns for competing carriers' top elites\n"
            "- Medallion Match program periodically available\n"
            "- Typically matches to Silver or Gold, challenges for Platinum\n\n"
            "AMERICAN STATUS MATCHES:\n"
            "- AA has AAdvantage Status Challenges available\n"
            "- Typically requires flying a set number of segments within 90 days\n"
            "- United 1K, Delta Diamond holders are the best match candidates\n\n"
            "ALASKA STATUS MATCHES:\n"
            "- Alaska regularly runs match campaigns for competing carriers\n"
            "- Strong history of matching Delta, United, and AA status to MVP Gold\n"
            "- Apply via Alaska's status match request page\n\n"
            "INTERNATIONAL CARRIER MATCHES:\n"
            "- British Airways: Matches status from Oneworld partners (AA Executive Platinum → BA Gold)\n"
            "- Lufthansa: Runs periodic Senator match campaigns\n"
            "- Emirates: Has matched status from other carriers occasionally\n\n"
            "TIPS FOR STATUS MATCHES:\n"
            "1. Apply within 30 days of earning the status you want to match from\n"
            "2. Request by email or phone, not just online forms\n"
            "3. Be a new customer to the airline you're matching to (most matches are for 'new' business)\n"
            "4. Have a planned trip on the target airline — they're more likely to match if you have bookings\n"
            "5. Matches are discretionary — polite follow-up helps\n\n"
            "CREDIT CARD TO STATUS SHORTCUT:\n"
            "Some credit cards grant status upon approval or qualifying spend:\n"
            "- Hilton Aspire → Hilton Diamond status immediately\n"
            "- Marriott Brilliant → Platinum Elite status immediately\n"
            "- Delta Gold Amex → Can earn MQD toward Medallion status\n"
            "- Hyatt card → Discoverist immediately + 5 qualifying nights"
        ),
    },
]
