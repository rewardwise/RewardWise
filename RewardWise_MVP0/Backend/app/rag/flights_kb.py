"""
FlightWise Knowledge Base
=========================
Comprehensive knowledge base for a points-vs-cash flight booking assistant.

Covers:
  1. Points vs Cash Math & CPP
  2. Airline Loyalty Programs & Partners
  3. Credit Card Rewards & Transfers
  4. Booking Strategies & Sweet Spots

Structure
---------
Each document has:
  id          – stable slug identifier
  title       – human-readable heading (used in structured FAQ output)
  category    – topic bucket for filtering
  tags        – keyword list for BM25 boosting
  content     – full prose (used for RAG retrieval)
  summary     – 1-2 sentence TL;DR (used in structured FAQ/help center)
  examples    – optional list of concrete worked examples
  related     – list of related doc IDs

Two exported objects:
  FLIGHTS_KB          – list[dict]   raw document store (plug into retriever)
  STRUCTURED_DOCS     – dict[str, list[dict]]  category-grouped FAQ tree
"""
from __future__ import annotations

# ══════════════════════════════════════════════════════════════════════════════
# CATEGORY 1 — POINTS VS CASH MATH & CPP
# ══════════════════════════════════════════════════════════════════════════════

_POINTS_VS_CASH: list[dict] = [
    {
        "id": "cpp-fundamentals",
        "title": "What is CPP (Cent Per Point)?",
        "category": "points_vs_cash",
        "tags": ["cpp", "cent per point", "value", "calculation", "points worth"],
        "summary": (
            "CPP (Cent Per Point) is the universal metric for measuring what a point or mile is "
            "actually worth. Divide the cash price of a redemption by the points required."
        ),
        "content": (
            "CPP stands for Cent Per Point (or Cent Per Mile), the single most important metric "
            "when deciding whether to pay cash or use points for a flight. "
            "Formula: CPP = (Cash Price in USD × 100) ÷ Points Required. "
            "Example: A flight costs $500 cash or 40,000 miles. CPP = (500 × 100) ÷ 40,000 = 1.25 cents per mile. "
            "Whether 1.25¢ is good depends on the program. For United MileagePlus, the baseline is ~1.3¢, "
            "so 1.25¢ is slightly below average — you might be better off paying cash. "
            "For Delta SkyMiles, the baseline is ~1.1¢, so 1.25¢ is a solid redemption. "
            "Context always matters: a 1.5¢ economy redemption might be fine, but if you could redeem "
            "those same miles for a 4¢ business class seat, you should wait. "
            "CPP is best used as a floor, not a target — never redeem below your program's baseline, "
            "and always check whether a better use of those miles exists before booking."
        ),
        "examples": [
            "Flight: NYC→LAX, $320 cash or 25,000 miles → CPP = 1.28¢ (decent for most programs)",
            "Flight: NYC→Tokyo, $1,200 economy or 35,000 miles → CPP = 3.43¢ (excellent, book immediately)",
            "Flight: NYC→Chicago, $189 cash or 25,000 miles → CPP = 0.76¢ (terrible, pay cash)",
        ],
        "related": ["cpp-by-program", "points-vs-cash-decision", "minimum-cpp-thresholds"],
    },
    {
        "id": "cpp-by-program",
        "title": "CPP Benchmarks by Loyalty Program",
        "category": "points_vs_cash",
        "tags": ["cpp", "benchmark", "value", "united", "delta", "american", "chase", "amex", "points value"],
        "summary": (
            "Each loyalty program has a different baseline CPP. Knowing the floor for your program "
            "prevents you from accepting a bad redemption."
        ),
        "content": (
            "CPP benchmarks vary significantly by program type. "
            "Transferable bank currencies (highest flexibility): "
            "Chase Ultimate Rewards: 1.8–2.1¢ (transfer to Hyatt, United, Southwest); "
            "Amex Membership Rewards: 1.7–2.0¢ (transfer to Air France/KLM, ANA, Virgin Atlantic); "
            "Capital One Miles: 1.5–1.85¢ (transfer to Air Canada, Turkish, Avianca); "
            "Citi ThankYou Points: 1.5–1.7¢ (transfer to Turkish, Singapore, Air France). "
            "Airline miles (medium flexibility): "
            "United MileagePlus: 1.2–1.5¢ (use for Star Alliance partners, avoid domestic economy); "
            "Delta SkyMiles: 1.0–1.3¢ (highly variable, check cash price every time); "
            "American AAdvantage: 1.3–1.6¢ (strong for Oneworld partners, Japan Airlines first class); "
            "Alaska Mileage Plan: 1.5–1.8¢ (phenomenal partner chart, best for Emirates and Cathay Pacific); "
            "Southwest Rapid Rewards: 1.3–1.5¢ (flat rate, consistent, great for domestic); "
            "Air Canada Aeroplan: 1.4–1.7¢ (excellent Star Alliance access, no fuel surcharges on partners). "
            "Hotel programs (lowest CPP, use only for premium redemptions): "
            "Hilton Honors: 0.4–0.6¢; Marriott Bonvoy: 0.6–0.9¢; Hyatt World of Hyatt: 1.5–2.3¢. "
            "Rule of thumb: never transfer bank points to hotel programs except Hyatt."
        ),
        "examples": [
            "50k Chase UR at 1.9¢ avg = $950 in value; at 1cpp (cash back) = $500 — transfers unlock 90% more value",
            "Delta 60k miles: at 1.1¢ = $660; same 60k United miles at 1.4¢ = $840 — program choice matters",
        ],
        "related": ["cpp-fundamentals", "transfer-partners-guide", "which-program-is-best"],
    },
    {
        "id": "points-vs-cash-decision",
        "title": "When to Pay Cash vs Use Points",
        "category": "points_vs_cash",
        "tags": ["cash", "points", "decision", "when", "pay", "redeem", "strategy"],
        "summary": (
            "Use points when CPP exceeds your program's baseline — especially for premium cabins "
            "and long-haul international routes. Pay cash for cheap short-haul flights."
        ),
        "content": (
            "The points-vs-cash decision comes down to three factors: CPP, opportunity cost, and flight type. "
            "Pay cash when: (1) the cash price is very low (under $150 for domestic); paying $120 with cash "
            "instead of 10,000 miles saves those miles for a $1,200 redemption later. "
            "(2) The CPP math is under 1.0¢ — you're destroying value. "
            "(3) You're close to elite status and need paid fares to earn qualifying miles/segments. "
            "Use points when: (1) CPP is well above the program benchmark — especially for business or first class, "
            "where the cash price is $3,000+ but the points cost is 60,000–80,000 miles. "
            "(2) Traveling internationally on a partner award — many programs price partner business class "
            "at the same rate as domestic economy in points but the cash equivalent is 5–10x higher. "
            "(3) You have a points surplus and an upcoming trip — points can devalue, cash doesn't. "
            "The sweet spot: redeeming points for flights where the cash price is high (peak travel, "
            "last-minute fares, premium cabins) gives the best return. Never use points to offset "
            "a $200 economy flight when those same miles can cover a $1,800 business class fare."
        ),
        "examples": [
            "NYC→Miami, $179 cash vs 15k miles (1.19¢): pay cash, save miles for better use",
            "NYC→London business, $4,200 cash vs 57.5k Virgin Atlantic miles (7.3¢): use miles, massive win",
            "NYC→Tokyo economy, $890 cash vs 35k ANA miles via Virgin Atlantic (2.54¢): use miles",
        ],
        "related": ["cpp-fundamentals", "sweet-spots-guide", "opportunity-cost-miles"],
    },
    {
        "id": "minimum-cpp-thresholds",
        "title": "Minimum CPP Thresholds — When a Redemption Is Too Cheap",
        "category": "points_vs_cash",
        "tags": ["minimum", "threshold", "floor", "bad redemption", "gift card", "cash back"],
        "summary": (
            "Never redeem miles for gift cards, merchandise, or statement credits — "
            "these always deliver well below 1¢/point. Set a floor and stick to it."
        ),
        "content": (
            "One of the most common mistakes travelers make is accepting any redemption offer without "
            "checking the CPP. Programs actively encourage low-value redemptions because they expire "
            "liability at almost no cost to the airline. "
            "Redemptions to always avoid: "
            "Gift cards: 0.5–0.7¢ per mile, regardless of program. "
            "Merchandise (electronics, luggage): 0.3–0.6¢ per mile. "
            "Statement credits against travel purchases: 0.6–1.0¢ (varies). "
            "Miles.com and PointsHound marketplace redemptions: often 0.4–0.8¢. "
            "Hotel redemptions with non-Hyatt programs: typically 0.4–0.7¢. "
            "Minimum CPP floors by program: "
            "Chase Ultimate Rewards: never below 1.5¢ (use Pay Yourself Back at 1.25¢ only as last resort). "
            "Amex MR: never below 1.4¢ (Amex Travel portal gives 1.0¢ — avoid unless no transfer option). "
            "United MileagePlus: never below 1.1¢ for domestic; 1.4¢ for international. "
            "Delta SkyMiles: never below 1.0¢ — delta.com dynamic pricing often goes below this. "
            "American AAdvantage: never below 1.2¢. "
            "Alaska Mileage Plan: never below 1.4¢. "
            "The rule: if a redemption doesn't clear your floor, bank the points and pay cash today."
        ),
        "examples": [
            "40k Delta miles for $320 flight = 0.80¢/mile: below the 1.0¢ floor, pay cash",
            "25k United miles for $380 flight = 1.52¢/mile: above the 1.1¢ floor, use miles",
        ],
        "related": ["cpp-fundamentals", "cpp-by-program", "points-vs-cash-decision"],
    },
    {
        "id": "opportunity-cost-miles",
        "title": "Opportunity Cost — The Hidden Factor in Every Redemption",
        "category": "points_vs_cash",
        "tags": ["opportunity cost", "hoarding", "save", "devalue", "expiration", "hold"],
        "summary": (
            "Miles sitting unused lose value over time through devaluations. Balance "
            "maximizing CPP against the risk of holding too long."
        ),
        "content": (
            "Opportunity cost works both ways with miles. Holding points waiting for the 'perfect' "
            "redemption means risking devaluation — airlines routinely increase award prices 10–30% "
            "overnight with no notice. United, Delta, and British Airways have all had significant "
            "devaluations in the past 5 years. "
            "On the other hand, burning miles impulsively at 1.0¢ when a 3.0¢ opportunity is within "
            "your planning horizon destroys two-thirds of the value. "
            "How to balance it: (1) Never let miles expire — most programs now have no expiration with "
            "any account activity; keep your account active with a small card spend every 18 months. "
            "(2) If you have over 200,000 miles in a single program with no near-term redemption plan, "
            "consider whether a partial redemption now hedges devaluation risk. "
            "(3) Bank currencies (Chase UR, Amex MR) are safer to hold than airline miles because they "
            "can be redirected to multiple programs — flexibility itself is a hedge. "
            "(4) If a program announces a major devaluation effective in 30 days, book anything above "
            "your floor CPP before it takes effect, even if travel is months away. "
            "Rule of thumb: aim to redeem within 18 months of earning; never hold more than "
            "2–3 years without a concrete plan."
        ),
        "related": ["cpp-fundamentals", "points-vs-cash-decision", "bank-currencies-guide"],
    },
    {
        "id": "dynamic-vs-fixed-awards",
        "title": "Dynamic Pricing vs Fixed Award Charts",
        "category": "points_vs_cash",
        "tags": ["dynamic pricing", "award chart", "fixed", "saver", "variable", "delta", "southwest"],
        "summary": (
            "Fixed award charts let you plan redemptions with certainty. Dynamic pricing "
            "means award costs fluctuate with demand — sometimes good, often bad."
        ),
        "content": (
            "Award pricing models fall into two camps, and the model affects your booking strategy. "
            "Fixed award charts: programs publish a chart showing exactly how many miles a route costs "
            "based on distance or region. Examples: American AAdvantage, Air Canada Aeroplan, "
            "United MileagePlus (partially), Alaska Mileage Plan. "
            "Advantage: you can calculate CPP before searching; you know the price for any route in advance. "
            "Disadvantage: everyone knows the sweet spots, so availability can be scarce. "
            "Dynamic pricing: award costs mirror cash fares — when cash prices rise (holidays, peak travel), "
            "so do points prices. Examples: Delta SkyMiles, JetBlue TrueBlue, Air France Flying Blue (partially). "
            "Advantage: occasionally, off-peak award prices drop very low — sometimes lower than fixed charts. "
            "Disadvantage: for peak travel dates, dynamic programs are almost always worse value than "
            "fixed-chart programs for the same route. "
            "Best strategy for dynamic programs: always search multiple dates to find the lowest "
            "award price; avoid holiday and summer peak travel with dynamic currency if possible. "
            "Use fixed-chart programs for peak travel where the cash equivalent is highest."
        ),
        "related": ["cpp-fundamentals", "sweet-spots-guide", "booking-award-seats"],
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# CATEGORY 2 — AIRLINE PROGRAMS & PARTNERS
# ══════════════════════════════════════════════════════════════════════════════

_AIRLINE_PROGRAMS: list[dict] = [
    {
        "id": "airline-alliances-overview",
        "title": "Airline Alliances: Star Alliance, Oneworld, SkyTeam",
        "category": "airline_programs",
        "tags": ["alliance", "star alliance", "oneworld", "skyteam", "partner", "awards"],
        "summary": (
            "The three major alliances let you earn and redeem miles across member airlines. "
            "Booking partner awards often delivers the best value."
        ),
        "content": (
            "The three alliances are the backbone of international award travel. "
            "Star Alliance (United, Lufthansa, ANA, Singapore, Air Canada, Thai, Swiss, and 22 others): "
            "Best redeemed through: United MileagePlus, Air Canada Aeroplan, ANA Mileage Club. "
            "Aeroplan is widely considered the best Star Alliance redemption currency — "
            "no fuel surcharges on most partners, excellent business class pricing. "
            "Oneworld (American, British Airways, Cathay Pacific, Japan Airlines, Finnair, Iberia, Qatar): "
            "Best redeemed through: Alaska Mileage Plan (best rates to Cathay Pacific, Emirates, "
            "Japan Airlines), American AAdvantage (Japan Airlines first class — a legendary sweet spot). "
            "Avoid: British Airways Avios for most US–Europe redemptions due to punishing fuel surcharges. "
            "SkyTeam (Delta, Air France/KLM, Korean Air, Virgin Atlantic partner, Aeromexico): "
            "Best redeemed through: Flying Blue (Air France/KLM) — promo awards monthly, "
            "Korean Air SkyPass (outstanding first class redemptions). "
            "Avoid: Delta SkyMiles for partner redemptions — notoriously poor value and scarce availability. "
            "Alliance membership is key: a United MileagePlus mile can buy you a Lufthansa first class seat "
            "at a fraction of the cash price — that's the power of partner awards."
        ),
        "examples": [
            "Lufthansa Business (JFK→FRA): 88k United miles vs ~$3,800 cash = 4.3¢/mile",
            "ANA Business (LAX→NRT): 88k Virgin Atlantic miles vs ~$5,000 cash = 5.68¢/mile (legendary)",
        ],
        "related": ["transfer-partners-guide", "sweet-spots-guide", "fuel-surcharges"],
    },
    {
        "id": "united-mileageplus-guide",
        "title": "United MileagePlus — Complete Guide",
        "category": "airline_programs",
        "tags": ["united", "mileageplus", "star alliance", "saver", "excursionist", "partner"],
        "summary": (
            "MileagePlus is one of the most flexible Star Alliance currencies with strong partner "
            "availability and the valuable Excursionist Perk for free stopovers."
        ),
        "content": (
            "United MileagePlus is a partially fixed, partially dynamic award program. "
            "Key pricing: Domestic US saver awards start at 12,500 miles one-way in economy. "
            "US to Europe saver economy starts at 30,000 miles one-way; business at 70,000. "
            "US to Japan/Asia economy starts at 35,000 miles; business at 80,000. "
            "Best uses: (1) Star Alliance partners where United is the redemption currency — "
            "Lufthansa first class (transatlantic) at 110,000 miles round trip, ANA business class. "
            "(2) The Excursionist Perk: on multi-city awards, one segment within a region can be free. "
            "E.g. fly JFK→FRA→ZRH→JFK — the FRA→ZRH leg is included at no extra miles. "
            "(3) Stopover awards: United allows one free stopover on round-trip international awards. "
            "Avoid: US domestic economy with dynamic pricing — often 30k+ miles for a $150 flight. "
            "Earning: Chase Sapphire Preferred/Reserve transfer 1:1, Marriott transfers 3:1 (poor), "
            "United Explorer/Quest/Club cards earn directly. "
            "Expiration: Miles do not expire as long as you have account activity every 18 months."
        ),
        "examples": [
            "NYC→Tokyo business (ANA): 80k United miles = 5.0¢/mile vs $4,000 cash",
            "Excursionist: NYC→Paris→Nice→NYC = same miles as NYC→Paris→NYC",
        ],
        "related": ["airline-alliances-overview", "sweet-spots-guide", "transfer-partners-guide"],
    },
    {
        "id": "delta-skymiles-guide",
        "title": "Delta SkyMiles — Complete Guide",
        "category": "airline_programs",
        "tags": ["delta", "skymiles", "dynamic", "medallion", "partner", "amex"],
        "summary": (
            "Delta SkyMiles uses dynamic pricing — award costs fluctuate daily. "
            "Best strategy: search for low-demand dates and compare cash prices every time."
        ),
        "content": (
            "Delta SkyMiles is a fully dynamic award program — there is no fixed award chart. "
            "Award prices change daily based on demand and are often tied to the cash fare. "
            "This makes Delta miles harder to maximize but occasionally produces bargains. "
            "Key characteristics: No published award chart — you must search to find prices. "
            "SkyMiles can be used on Delta, and on SkyTeam partners including Air France, KLM, "
            "Virgin Atlantic, Korean Air, and Aeromexico. "
            "Best uses: (1) Off-peak domestic and Caribbean routes where award prices drop to "
            "8,000–12,000 miles one-way — check the 'low' filter on delta.com. "
            "(2) Partner awards on Virgin Atlantic and Air France long-haul routes when availability opens. "
            "(3) Last-minute premium cabin upgrades for Medallion members. "
            "Avoid: (1) Booking during peak periods — award prices can reach 100,000+ miles for a $500 flight. "
            "(2) Using SkyMiles for Delta One business class unless the CPP is confirmed above 1.2¢. "
            "Earning: Amex Delta cards, Amex Membership Rewards do NOT transfer to Delta directly "
            "(a common misconception) — Delta is not an Amex MR transfer partner. "
            "Best earning path: Delta credit cards or flying Delta/partners. "
            "Expiration: Miles do not expire with any account activity in 24 months."
        ),
        "examples": [
            "Off-peak ATL→NYC: 8,000 miles = 1.5¢/mile vs $120 cash — solid if you have surplus miles",
            "Peak holiday ATL→NYC: 45,000 miles = 0.44¢/mile vs $200 cash — terrible, pay cash",
        ],
        "related": ["airline-alliances-overview", "dynamic-vs-fixed-awards", "cpp-by-program"],
    },
    {
        "id": "american-aadvantage-guide",
        "title": "American AAdvantage — Complete Guide",
        "category": "airline_programs",
        "tags": ["american", "aadvantage", "oneworld", "japan airlines", "cathay", "partner"],
        "summary": (
            "AAdvantage shines for Oneworld partner redemptions, especially Japan Airlines "
            "first class and Cathay Pacific business class — some of the best value in all of award travel."
        ),
        "content": (
            "American AAdvantage offers a mix of fixed and dynamic pricing. "
            "Key award rates (partner/saver-level availability required): "
            "US to Europe economy: 30,000 miles one-way; business: 57,500 miles one-way. "
            "US to Japan economy: 35,000 miles one-way; business: 60,000; first: 80,000. "
            "US to Asia economy: 35,000 miles one-way; business: 60,000; first: 75,000. "
            "Best uses: "
            "(1) Japan Airlines first class: 80,000 AAdvantage miles round-trip between the US and Japan — "
            "a legendary sweet spot, one of the most opulent first class products in the world. "
            "(2) Japan Airlines business class: 60,000 miles round-trip — excellent value. "
            "(3) Cathay Pacific business class (Hong Kong): 50,000 miles one-way — strong CPP. "
            "(4) Iberia business class to Europe: 34,000 miles one-way — very strong on the right routes. "
            "(5) Qatar Qsuites (business): 70,000 miles one-way transatlantic — one of the best business "
            "class products at a reasonable miles price. "
            "Avoid: British Airways redemptions via AAdvantage — British Airways charges its own fuel "
            "surcharges which flow through to AAdvantage bookings on BA metal. "
            "Earning: Citi AAdvantage cards, Barclays AAdvantage cards; no major bank transfer partner "
            "(Citi ThankYou does NOT transfer to AAdvantage). "
            "Expiration: Miles expire after 24 months of no qualifying activity."
        ),
        "examples": [
            "JFK→HND First (Japan Airlines): 80k miles round-trip vs $12,000+ cash = ~7.5¢/mile",
            "JFK→DOH Business (Qatar Qsuites): 70k miles vs $4,800 cash = 6.86¢/mile",
        ],
        "related": ["airline-alliances-overview", "sweet-spots-guide", "fuel-surcharges"],
    },
    {
        "id": "alaska-mileage-plan-guide",
        "title": "Alaska Mileage Plan — Complete Guide",
        "category": "airline_programs",
        "tags": ["alaska", "mileage plan", "emirates", "cathay", "british airways", "partner chart"],
        "summary": (
            "Alaska Mileage Plan is arguably the best-value frequent flyer program for "
            "premium international partner awards, with special rates to Emirates, Cathay Pacific, and more."
        ),
        "content": (
            "Alaska Mileage Plan has one of the most generous fixed partner award charts in the industry. "
            "Unlike most programs, Alaska maintains deep partnerships outside its own alliance. "
            "Key award rates: "
            "US to Europe economy: 25,000 miles one-way; business: 50,000 one-way. "
            "US to Middle East economy: 27,500 one-way; business: 70,000. "
            "US to Asia economy: 35,000 one-way; business: 50,000; first: 70,000. "
            "Best partner sweet spots: "
            "(1) Emirates first class: 70,000 Alaska miles for US–Dubai first class — "
            "the same seat costs $20,000+ cash or 180,000+ Emirates Skywards miles. "
            "(2) Cathay Pacific first class to Hong Kong: 70,000 miles — legendary product, top CPP. "
            "(3) British Airways Club World (business) to Europe: 50,000 miles. Fuel surcharges apply "
            "on British Airways metal but Alaska's award rate is still competitive. "
            "(4) Finnair business to Europe/Asia: strong availability, no fuel surcharges. "
            "(5) Japan Airlines business to Japan: 55,000 miles — strong alternative to AAdvantage. "
            "Earning: Bank of America Alaska cards (1.5× on all purchases). "
            "Transfer partners: None — Alaska miles cannot be bought from bank currencies. "
            "Must be earned via flights or Alaska credit cards. "
            "Expiration: Miles expire after 24 months of inactivity — set a credit card reminder."
        ),
        "examples": [
            "LAX→DXB Emirates First: 70k miles vs $20,000+ cash = 14.3¢+ per mile — extraordinary",
            "SEA→HKG Cathay First: 70k miles vs $7,000 cash = 10.0¢/mile",
        ],
        "related": ["sweet-spots-guide", "airline-alliances-overview", "fuel-surcharges"],
    },
    {
        "id": "aeroplan-guide",
        "title": "Air Canada Aeroplan — Complete Guide",
        "category": "airline_programs",
        "tags": ["aeroplan", "air canada", "star alliance", "stopover", "fuel surcharge", "distance"],
        "summary": (
            "Aeroplan is the best Star Alliance award currency — distance-based pricing, "
            "no fuel surcharges on most partners, and generous stopover/open-jaw policies."
        ),
        "content": (
            "Air Canada Aeroplan relaunched in 2020 with a completely redesigned award structure "
            "that made it one of the most flexible and valuable programs for international travel. "
            "Key structure: Aeroplan uses distance-based pricing (like the old United chart), "
            "not a region-based chart. This rewards short-to-medium haul redemptions. "
            "Key features: "
            "(1) No fuel surcharges on most Star Alliance partners including Lufthansa, Swiss, and ANA. "
            "This is a major advantage — British Airways miles carry $500+ in surcharges on BA transatlantic. "
            "(2) Free stopovers on one-way awards (unique among most programs). "
            "(3) 'Neighbor airport' flexibility — can fly into or out of nearby airports at no extra cost. "
            "(4) Mixed-cabin awards — book business to your hub and economy for the short connection. "
            "Key award rates: "
            "US to Europe economy: 30,000–45,000 miles one-way depending on distance. "
            "US to Europe business: 55,000–85,000 miles one-way. "
            "US to Japan economy: 35,000 miles; business: 65,000. "
            "Best uses: "
            "Lufthansa Senator/First class to Europe (no fuel surcharges!); "
            "ANA business/first class to Japan; "
            "Swiss business class from the US. "
            "Transfer partners: Chase Ultimate Rewards 1:1, Amex MR 1:1, Capital One 1:1, "
            "TD and RBC (Canada). Extremely well-connected for a bank point transfer. "
            "Expiration: Points do not expire with account activity every 12 months."
        ),
        "examples": [
            "JFK→ZRH→FRA Lufthansa Business: ~85k Aeroplan vs $4,500 cash, no fuel surcharge",
            "LAX→NRT ANA Business: 65k Aeroplan vs $4,200 cash = 6.46¢/mile",
        ],
        "related": ["airline-alliances-overview", "fuel-surcharges", "transfer-partners-guide"],
    },
    {
        "id": "fuel-surcharges",
        "title": "Fuel Surcharges on Award Tickets — The Hidden Cost",
        "category": "airline_programs",
        "tags": ["fuel surcharge", "YQ", "carrier imposed", "british airways", "fees", "taxes"],
        "summary": (
            "Some programs pass fuel surcharges (up to $800+) onto award tickets. "
            "Knowing which programs avoid them can save hundreds of dollars per booking."
        ),
        "content": (
            "Fuel surcharges (technically called 'carrier-imposed surcharges' or YQ fees) are "
            "fees added on top of taxes on some award tickets. They have nothing to do with actual "
            "fuel costs — they're revenue recovery charges that can completely erode award value. "
            "Programs with HEAVY fuel surcharges (avoid or factor in): "
            "British Airways Avios: $400–$800 on transatlantic business class awards on BA metal. "
            "Lufthansa Miles & More: $500–$900 on Lufthansa-operated long-haul routes. "
            "Singapore KrisFlyer: $200–$600 on Singapore Airlines metal for certain routes. "
            "Air France/KLM Flying Blue: $150–$500 on AF/KL operated long-haul flights. "
            "Programs with NO or LOW fuel surcharges: "
            "United MileagePlus: no YQ on United-operated flights. "
            "Air Canada Aeroplan: no YQ on most Star Alliance partners (including Lufthansa!). "
            "American AAdvantage: no YQ on AA-operated flights. "
            "Alaska Mileage Plan: YQ varies by partner — no surcharges on most Alaska-operated. "
            "Chase Pay Yourself Back / Travel Portal: taxes only, no YQ. "
            "Pro tip: when booking a Lufthansa flight, use Aeroplan or United miles instead of "
            "Lufthansa's own Miles & More — you fly the same seat but pay $0 instead of $700 in surcharges."
        ),
        "examples": [
            "Lufthansa Business via Miles&More: 100k miles + $700 fees vs Aeroplan: 85k miles + $60 fees",
            "BA Club World via Avios: 50k miles + $650 fees vs AA miles: 57.5k miles + $90 fees",
        ],
        "related": ["aeroplan-guide", "american-aadvantage-guide", "sweet-spots-guide"],
    },
    {
        "id": "stopover-open-jaw",
        "title": "Stopovers and Open-Jaw Awards — Fly More for the Same Miles",
        "category": "airline_programs",
        "tags": ["stopover", "open jaw", "multi-city", "free stopover", "routing"],
        "summary": (
            "Many programs allow free stopovers or open-jaw routing on international awards — "
            "letting you visit two destinations for the miles price of one."
        ),
        "content": (
            "Stopovers and open-jaws are among the most underused tools in award travel. "
            "Stopover: a connection that exceeds 24 hours. Some programs include one free stopover "
            "on round-trip international awards, letting you visit a hub city at no extra miles cost. "
            "Open-jaw: flying into one city and home from a different city — 'fly into Paris, home from Rome.' "
            "Programs with generous stopover/open-jaw policies: "
            "United MileagePlus: one free stopover on round-trip international awards. "
            "Example: JFK→Tokyo→Seoul and back (stopover in Tokyo both directions) — "
            "effectively visiting two cities for one award price. "
            "Air Canada Aeroplan: free stopover on one-way awards (unique), open-jaws allowed. "
            "Example: NYC→London→Paris (stopover in London) as a one-way award. "
            "Alaska Mileage Plan: open-jaws allowed on most partners. "
            "Fly JFK→HKG on Cathay Pacific, then Tokyo→JFK on a return — visit two Asian cities. "
            "American AAdvantage: open-jaws allowed. No free stopovers on standard awards. "
            "Programs with poor stopover policies: "
            "Delta SkyMiles: stopovers are not allowed on award tickets. "
            "British Airways Avios: heavily distance-based, stopovers add cost quickly. "
            "Practical advice: always check the 'open-jaw' and 'multi-city' options when booking. "
            "The one-stopover trick can effectively give you two vacations for the price of one award."
        ),
        "related": ["united-mileageplus-guide", "aeroplan-guide", "sweet-spots-guide"],
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# CATEGORY 3 — CREDIT CARD REWARDS & TRANSFERS
# ══════════════════════════════════════════════════════════════════════════════

_CREDIT_CARDS: list[dict] = [
    {
        "id": "bank-currencies-guide",
        "title": "Bank Point Currencies — The Most Flexible Miles",
        "category": "credit_cards",
        "tags": ["chase", "amex", "capital one", "citi", "transfer", "flexible", "bank points", "ultimate rewards", "membership rewards"],
        "summary": (
            "Bank currencies (Chase UR, Amex MR, Capital One, Citi TY) can transfer to multiple "
            "airlines, giving you flexibility that airline-specific cards can't match."
        ),
        "content": (
            "Bank point currencies are the most powerful points you can earn because they are not "
            "locked to a single airline or hotel program. You earn them via credit card spend and "
            "can redirect them to whichever partner offers the best value for your trip. "
            "Chase Ultimate Rewards: Transfer 1:1 to United, Southwest, Hyatt, Marriott, IHG, "
            "British Airways, Air France/KLM Flying Blue, Singapore KrisFlyer, Iberia, Aer Lingus, "
            "Air Canada Aeroplan (1:1), Emirates. "
            "Best travel partners: United, Hyatt, Air Canada Aeroplan. "
            "Best cards: Sapphire Reserve (3x travel/dining, $300 travel credit), "
            "Sapphire Preferred (3x dining, 2x travel, $95 fee), Ink Preferred (3x business). "
            "Amex Membership Rewards: Transfer 1:1 to Air France/KLM Flying Blue, ANA, "
            "British Airways, Delta (no), Singapore KrisFlyer, Cathay Pacific, Iberia, Aer Lingus, "
            "Air Canada Aeroplan (1:1), Virgin Atlantic, Turkish Airlines, Qatar Privilege Club. "
            "Note: Amex does NOT transfer to United, Delta directly, or American. "
            "Best partners: Air Canada Aeroplan, Virgin Atlantic, ANA (1:1). "
            "Best cards: Amex Gold (4x dining/US groceries), Platinum (5x flights), "
            "Business Platinum (1.5x on large purchases). "
            "Capital One Miles: Transfer to Air Canada Aeroplan, Turkish Airlines, Avianca, "
            "Air France/KLM, British Airways, Singapore KrisFlyer, and others. "
            "Best cards: Venture X (2x all purchases, airport lounge access). "
            "Citi ThankYou Points: Transfer to Turkish Airlines, Singapore KrisFlyer, "
            "Air France/KLM Flying Blue, Avianca, Qatar Privilege Club. "
            "Best cards: Citi Strata Premier (3x travel/dining/grocery)."
        ),
        "related": ["transfer-partners-guide", "cpp-by-program", "best-cards-for-flights"],
    },
    {
        "id": "transfer-partners-guide",
        "title": "How Point Transfers Work — Timing, Ratios, and Best Practices",
        "category": "credit_cards",
        "tags": ["transfer", "transfer time", "ratio", "instant", "1:1", "transfer partner", "convert"],
        "summary": (
            "Most bank-to-airline transfers are 1:1 and process in minutes to 2 days. "
            "Only transfer what you need — transfers are almost always one-way and irreversible."
        ),
        "content": (
            "Understanding transfers is critical to maximizing bank point currencies. "
            "Transfer ratios: Most Chase and Amex partners transfer at 1:1 (1,000 bank points = 1,000 miles). "
            "Exceptions: Marriott Bonvoy transfers at 3:1 (3,000 Marriott = 1,000 airline miles) — poor value. "
            "Some Amex partners offer periodic transfer bonuses (30–50% bonus miles). "
            "Transfer speed: "
            "Chase → United: instant. Chase → Hyatt: instant. Chase → Southwest: instant. "
            "Chase → British Airways: 1–2 business days. "
            "Amex → Air Canada Aeroplan: instant. Amex → ANA: 2–5 business days. "
            "Amex → Delta: Not available (common misconception — Delta is NOT an Amex MR partner). "
            "Capital One → Aeroplan: instant. "
            "Critical rules: "
            "(1) Transfers are almost always ONE-WAY and IRREVERSIBLE. Never transfer speculatively. "
            "(2) Verify award space BEFORE transferring — search availability in the airline's own portal "
            "or an OTA like Point.me, then transfer, then book quickly. "
            "(3) For instant-transfer partners (Chase→United, Amex→Aeroplan), you can search and transfer "
            "in one session. For slow transfers (Amex→ANA), contact the airline first to hold space. "
            "(4) Transfer bonuses: Amex frequently offers 20–40% transfer bonuses to specific partners. "
            "Sign up for alerts at creditcards.com or the Points Guy — booking during a bonus can "
            "save thousands of miles. "
            "(5) Points never expire after transfer — they follow the destination program's rules."
        ),
        "related": ["bank-currencies-guide", "booking-award-seats", "cpp-by-program"],
    },
    {
        "id": "best-cards-for-flights",
        "title": "Best Credit Cards for Earning Miles on Flights",
        "category": "credit_cards",
        "tags": ["best card", "earn", "miles", "travel card", "flights", "5x", "3x", "recommend"],
        "summary": (
            "For earning on flights, Amex Platinum (5x) leads on airfare. "
            "For everyday spending that converts to miles, Chase Sapphire Reserve or Amex Gold are strongest."
        ),
        "content": (
            "Choosing the right card for earning miles depends on your spending mix. "
            "Best for booking flights directly: "
            "Amex Platinum: 5x Membership Rewards on flights booked directly with airlines or Amex Travel. "
            "Best for flight purchases — but $695 annual fee requires using perks to break even. "
            "Chase Sapphire Reserve: 3x UR on all travel (including flights), $300 travel credit, "
            "Priority Pass lounge access. After $300 credit, effective fee is $250. "
            "Best all-around travel card for most people. "
            "Best for dining and everyday spend (which you then transfer to miles): "
            "Amex Gold: 4x MR on dining and US supermarkets (up to $25k/yr), 3x on flights. "
            "Chase Sapphire Preferred: 3x on dining, 2x on travel — strong for the $95 fee. "
            "Best for flat-rate earning on everything: "
            "Capital One Venture X: 2x on all purchases + 10x on hotels/5x on flights via C1 Travel. "
            "Citi Double Cash: 2% cash back convertible to ThankYou points. "
            "Airline co-branded cards (earn faster in one program): "
            "United Explorer: 2x United, restaurants, hotels. Best for earning MileagePlus faster. "
            "Delta Gold Amex: 2x Delta, restaurants, US supermarkets. Good for Medallion status earners. "
            "Southwest Priority: 3x Southwest purchases — best for Companion Pass qualification. "
            "Alaska Airlines Visa: 3x Alaska purchases, 1x everything else — critical for Mileage Plan earning. "
            "Strategy: pair a strong bank card (Amex Gold or Chase Sapphire) for dining/everyday, "
            "plus an airline card for flights in your preferred program. Two-card setups beat single cards."
        ),
        "related": ["bank-currencies-guide", "transfer-partners-guide", "cpp-by-program"],
    },
    {
        "id": "welcome-bonus-flight-strategy",
        "title": "Using Welcome Bonuses to Fund Award Flights",
        "category": "credit_cards",
        "tags": ["welcome bonus", "sign up bonus", "SUB", "new card", "minimum spend", "100k", "75k"],
        "summary": (
            "A single 75,000-point welcome bonus can cover a round-trip business class flight. "
            "Welcome bonuses are the fastest way to earn enough miles for a premium redemption."
        ),
        "content": (
            "Welcome bonuses (sign-up bonuses) are the fastest path to a premium award redemption. "
            "A single Chase Sapphire Preferred bonus (75,000 UR after $4,000 spend) can cover: "
            "A round-trip economy flight to Europe via partner transfer, or "
            "A one-way business class flight to Japan (80k United miles), or "
            "Multiple short-haul domestic round trips. "
            "Best current welcome bonuses for travel (verify current offers, as they change): "
            "Chase Sapphire Preferred: 60,000–75,000 UR (check for elevated offers). "
            "Chase Sapphire Reserve: 60,000 UR + $300 travel credit. "
            "Amex Platinum: 80,000–150,000 MR (elevated offers appear periodically via CardMatch). "
            "Amex Gold: 60,000–90,000 MR. "
            "Capital One Venture X: 75,000 miles. "
            "Citi Strata Premier: 60,000–75,000 TY. "
            "How to maximize welcome bonuses: "
            "(1) Apply before a large planned purchase to meet minimum spend naturally — never spend "
            "beyond your means to chase a bonus. "
            "(2) Use CardMatch tool (no hard pull) to check for targeted elevated offers before applying. "
            "(3) Avoid the same bank's product for 48 months if you've already received the bonus "
            "(Chase Sapphire family 48-month rule). "
            "(4) Chase 5/24 rule: Chase denies most cards if you've opened 5+ cards in 24 months. "
            "Apply for Chase cards first in your card strategy. "
            "(5) Time applications: getting 2 cards in one month (from different banks) doubles bonuses "
            "while only triggering one credit score impact window."
        ),
        "related": ["bank-currencies-guide", "chase-5-24-rule", "best-cards-for-flights"],
    },
    {
        "id": "chase-5-24-rule",
        "title": "Chase 5/24 Rule — What It Is and How to Navigate It",
        "category": "credit_cards",
        "tags": ["5/24", "chase", "application", "approval", "hard pull", "credit cards opened"],
        "summary": (
            "Chase denies most card applications if you've opened 5+ credit cards (any bank) "
            "in the past 24 months. Apply for Chase cards early in your rewards journey."
        ),
        "content": (
            "Chase's 5/24 rule is the most important application restriction in the hobby. "
            "Definition: Chase will deny most of its personal credit card applications if your credit "
            "report shows 5 or more new accounts opened across ALL issuers in the past 24 months. "
            "Affected cards: Sapphire Preferred, Sapphire Reserve, Freedom Flex, Freedom Unlimited, "
            "Ink Business Preferred, Ink Business Cash, and most co-branded cards (United, Southwest, Hyatt). "
            "Not affected (business cards typically exempt from 5/24 counting): "
            "Amex business cards, Chase Ink business cards are subject to 5/24 but don't add to your 5/24 count. "
            "How to check your 5/24 count: log into a free credit monitoring service (Credit Karma, Experian) "
            "and count all accounts opened in the last 24 months — credit cards, store cards, and lines of credit. "
            "Authorized user accounts may count toward 5/24 (have the primary holder remove you before applying). "
            "Strategy: "
            "(1) If you're new to rewards, apply for Chase cards FIRST before opening cards from other banks. "
            "(2) If you're at 4/24, apply for your most-wanted Chase card immediately. "
            "(3) If you're at 5+/24, focus on Amex, Capital One, and Citi cards while waiting. "
            "(4) The clock runs from account opening date — plan 24 months ahead."
        ),
        "related": ["best-cards-for-flights", "welcome-bonus-flight-strategy", "bank-currencies-guide"],
    },
    {
        "id": "companion-pass-guide",
        "title": "Southwest Companion Pass — Fly Your +1 Free All Year",
        "category": "credit_cards",
        "tags": ["southwest", "companion pass", "plus one", "free flight", "rapid rewards", "status"],
        "summary": (
            "The Southwest Companion Pass lets a designated companion fly free (just pay taxes) "
            "on every Southwest flight for up to two years — one of the best benefits in US travel."
        ),
        "content": (
            "The Southwest Companion Pass is considered one of the highest-value perks in US domestic travel. "
            "How it works: earn 135,000 Rapid Rewards points in a calendar year, and a companion flies "
            "free (plus taxes) on every Southwest flight for the rest of that year AND all of the next. "
            "The 135,000 points can come from: flying Southwest, credit card spend, and critically, "
            "welcome bonuses from Southwest credit cards. "
            "Fastest path to Companion Pass: "
            "Apply for two Southwest personal cards (Priority + Premier/Plus) in one year — "
            "combined welcome bonuses typically offer 120,000–130,000 points, requiring only "
            "5,000–15,000 more from card spend or flights to trigger the pass. "
            "Timing: apply in January to maximize the pass duration (earn by March, valid for 22 months). "
            "What the companion pass covers: any Southwest flight your companion is on — "
            "they pay taxes only (typically $5.60 each way). This can save $300–$600 per round trip "
            "for two people. "
            "Best use case: couples, families, or frequent travelers with a consistent travel partner. "
            "Over 22 months, a companion who flies 6 round trips saves $2,000–$4,000. "
            "Limitations: companion must be designated in advance; can change 3 times per calendar year. "
            "Pass does not apply to international itineraries or partner codeshares."
        ),
        "related": ["best-cards-for-flights", "welcome-bonus-flight-strategy", "dynamic-vs-fixed-awards"],
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# CATEGORY 4 — BOOKING STRATEGIES & SWEET SPOTS
# ══════════════════════════════════════════════════════════════════════════════

_BOOKING_STRATEGIES: list[dict] = [
    {
        "id": "sweet-spots-guide",
        "title": "Top Award Travel Sweet Spots — Best Value Redemptions",
        "category": "booking_strategies",
        "tags": ["sweet spot", "best value", "japan airlines", "virgin atlantic", "ana", "emirates", "business class", "first class"],
        "summary": (
            "Sweet spots are specific redemptions where the points cost is low relative to "
            "the cash value — often premium cabins to Japan, Europe, and the Middle East."
        ),
        "content": (
            "Award sweet spots are the Holy Grail of points travel — fixed-chart quirks or "
            "partner pricing mismatches that let you get outsized value. These change over time "
            "as programs devalue, so always verify current pricing before transferring points. "
            "Top sweet spots (as of current pricing): "
            "(1) ANA Business Class via Virgin Atlantic: JFK/LAX→NRT, 88,000 Virgin Atlantic points "
            "one-way in business class (~$4,500–$6,000 cash). CPP: 5–7¢. "
            "Transfer Amex MR or Chase UR to Virgin Atlantic, book on virgin-atlantic.com. "
            "(2) Japan Airlines First Class via AAdvantage: round-trip JFK→NRT in first class "
            "for 80,000 AAdvantage miles. The same seat retails for $12,000–$20,000. CPP: 10–15¢+. "
            "(3) Emirates First Class via Alaska: one-way US→Dubai in Emirates first class "
            "for 70,000 Alaska miles. The A380 first class suite is $10,000–$25,000 cash. CPP: 14¢+. "
            "(4) Lufthansa Business to Europe via Aeroplan: 85,000 Aeroplan miles round-trip "
            "in business class, no fuel surcharges. Cash: $3,500–$5,000. CPP: 4–6¢. "
            "(5) Cathay Pacific Business via Alaska: LAX→HKG in business for 50,000 Alaska miles "
            "one-way. Cash: $2,500–$4,000. CPP: 5–8¢. "
            "(6) Flying Blue Promo Awards: monthly, Air France/KLM offers 20–50% discount awards "
            "on specific routes. E.g. NYC→Paris business for 45,000 miles vs 75,000 normal. "
            "Transfer Chase UR or Amex MR to Flying Blue only during these promos. "
            "(7) Avianca LifeMiles for United-operated flights: prices Polaris (business) at 63,000 "
            "miles round-trip vs 140,000 United miles — same seat. Transfer Amex MR or Capital One. "
            "How to find sweet spots: use ThePointsGuy.com award chart index, Frequent Miler "
            "program analysis, or tools like Point.me and AwardHacker to compare prices."
        ),
        "related": ["alaska-mileage-plan-guide", "american-aadvantage-guide", "aeroplan-guide", "fuel-surcharges"],
    },
    {
        "id": "booking-award-seats",
        "title": "How to Find and Book Award Seats",
        "category": "booking_strategies",
        "tags": ["award availability", "saver", "book", "search", "waitlist", "partner availability", "excursionist"],
        "summary": (
            "Saver-level award availability is limited. Search 1–11 months out, be flexible "
            "on dates and routes, and use tools like ExpertFlyer or Point.me for partner awards."
        ),
        "content": (
            "Finding award seats is often the biggest challenge in points travel. "
            "Airlines release award inventory in two tiers: saver (low miles, limited seats) and "
            "standard/anytime (more seats, often 2-3x the miles). Always target saver-level. "
            "When to search: "
            "Premium cabin international awards: start searching 9–11 months out when seats first open. "
            "Many airlines release long-haul business class at the 330-day mark. "
            "Domestic economy: 1–3 months out is usually sufficient. "
            "Last-minute premium cabin: airlines sometimes open award space 3–7 days before departure "
            "to fill unsold seats — set alerts for this. "
            "Best search tools: "
            "Google Flights: use for cash price benchmarking, not award search. "
            "United.com: searches own and some partner inventory; good for Star Alliance. "
            "ANA website: shows ANA-operated flights with award pricing in miles (check multiple programs). "
            "Aeroplan.com: excellent for Star Alliance partner searching. "
            "Alaska.com: searches own and partner award inventory including Emirates, Cathay, JAL. "
            "ExpertFlyer (paid, ~$10/month): searches real-time award inventory across most carriers; "
            "essential for finding scarce partner availability and setting email alerts. "
            "Point.me (free/paid): searches award inventory across all programs you could transfer to. "
            "AwardHacker: find which programs can book a specific route. "
            "Award booking tips: "
            "(1) Be flexible on dates: shift ±3 days to find availability. Off-peak dates (Tue/Wed) "
            "often have better premium cabin availability. "
            "(2) Try alternative routing: if JFK→NRT is unavailable, try EWR→ORD→NRT or JFK→LAX→NRT. "
            "(3) Mixed-cabin awards: some programs let you book business one-way + economy return "
            "for a blended price — useful when one direction lacks business availability. "
            "(4) Phone agents: for complex itineraries, calling the airline's award desk "
            "(especially United or Aeroplan) can unlock inventory not visible online. "
            "(5) Waitlists: some programs (United, Alaska) offer award waitlists — set one if "
            "your preferred flight shows no availability."
        ),
        "related": ["sweet-spots-guide", "transfer-partners-guide", "stopover-open-jaw"],
    },
    {
        "id": "positioning-flights",
        "title": "Positioning Flights — Getting to the Best Award Hubs",
        "category": "booking_strategies",
        "tags": ["positioning", "deadhead", "hub", "LAX", "JFK", "ORD", "award hub", "connecting"],
        "summary": (
            "Flying to a major hub to connect to an international award can save significant miles. "
            "Cheap domestic positioning flights often open access to long-haul sweet spots."
        ),
        "content": (
            "Not all award journeys start at your home airport. Positioning flights are short "
            "domestic or regional flights to reach an international award hub. "
            "When it makes sense to position: "
            "(1) The best award space to Japan, Europe, or the Middle East departs from JFK, LAX, "
            "ORD, SFO, or IAH — not your local airport. A $79 Southwest fare from Nashville to LAX "
            "might unlock an 88k ANA business class award that departs from LAX only. "
            "(2) Your home airport has poor international connections. Travelers in secondary markets "
            "(Phoenix, Raleigh, Denver) often find better award variety by connecting to a hub. "
            "Best positioning strategies: "
            "Southwest Companion Pass + cheap Wanna Get Away fares for domestic positioning. "
            "Points bookable for 3,000–5,000 miles on short domestic hops (often not worth it — "
            "compare cash fare first). "
            "JetBlue TrueBlue for cheap East Coast positioning to JFK or BOS. "
            "How to incorporate into award booking: "
            "Book the positioning flight separately from the international award. Do not connect them "
            "on the same PNR — a delay on the domestic leg misses the international flight and causes "
            "the award to be cancelled. Build in at least a 3-hour buffer between the positioning "
            "arrival and the international award departure, plus one night hotel if traveling day before. "
            "Cost-benefit: a $79 positioning flight + $60 hotel = $139 to access a $5,000 business "
            "class seat via a sweet spot redemption — almost always worth it."
        ),
        "related": ["sweet-spots-guide", "booking-award-seats", "stopover-open-jaw"],
    },
    {
        "id": "mistake-fares-guide",
        "title": "Mistake Fares and Flash Sales — When Cash Beats Points",
        "category": "booking_strategies",
        "tags": ["mistake fare", "error fare", "flash sale", "cash", "deal", "cheap flight"],
        "summary": (
            "Mistake fares (airline pricing errors) and flash sales can deliver $1,000+ tickets "
            "for under $200. When these occur, paying cash is almost always better than points."
        ),
        "content": (
            "Not every premium travel opportunity requires points. Airlines occasionally make pricing "
            "errors (mistake fares) or run time-sensitive flash sales that make cash prices so low "
            "that using points would be wasteful. "
            "What is a mistake fare: a pricing error where an airline (or booking site) accidentally "
            "publishes a fare at a fraction of its intended price. "
            "Examples: a $147 round-trip to Paris in business class (happened), "
            "$300 round-trip to Tokyo in economy (happens several times per year). "
            "How airlines handle mistake fares: mixed. Most airlines honor confirmed tickets. "
            "DOT requires airlines to honor fares if a ticket was issued, with exceptions for "
            "'obvious errors' — enforcement is inconsistent. Book quickly, don't make non-refundable "
            "hotel/visa commitments until the ticket is confirmed days later. "
            "Where to find mistake fares and deals: "
            "Scott's Cheap Flights (now Going.com): email alerts, premium tier ~$50/year, "
            "consistently finds fares 40–90% below market — worth every dollar. "
            "Secret Flying (secretflying.com): free, real-time mistake fares from global contributors. "
            "The Flight Deal (theflightdeal.com): curated great fares, mostly legitimate low fares. "
            "Airfarewatchdog.com: general fare alerts by route. "
            "Dollar Flight Club: budget-focused alerts. "
            "When to use points vs catch a deal: "
            "If a deal brings a $1,200 economy fare to $350, pay cash — using 30k miles for a $350 "
            "ticket is 1.17¢/mile when those miles could cover a $3,000 business seat. "
            "Save points for premium cabin redemptions where deals rarely appear."
        ),
        "related": ["points-vs-cash-decision", "cpp-fundamentals", "dynamic-vs-fixed-awards"],
    },
    {
        "id": "award-travel-calendar",
        "title": "Award Travel Calendar — Best Times to Fly with Points",
        "category": "booking_strategies",
        "tags": ["calendar", "timing", "off peak", "peak", "saver", "availability", "holidays", "school"],
        "summary": (
            "Off-peak dates (January–March, September–October) offer the most award availability "
            "and sometimes lower mileage costs. Avoid summer, holidays, and school breaks."
        ),
        "content": (
            "Award availability and pricing follow a seasonal pattern almost identical to cash fares. "
            "Understanding the calendar maximizes your chances of finding saver-level seats. "
            "Best months for award travel (high availability, sometimes lower mileage cost): "
            "January 7 – March 14: post-holiday lull, excellent availability even in premium cabins. "
            "September 8 – October 31: post-summer, before Thanksgiving rush. Shoulder season. "
            "Early May (first 2 weeks): before peak summer begins. "
            "Mid-November (before Thanksgiving week): brief window of good availability. "
            "Worst months for award availability (avoid if possible): "
            "June, July, August: summer peak — business class availability drops sharply. "
            "Thanksgiving week (Nov 20–Dec 1): saver availability nearly zero on popular routes. "
            "Christmas/New Year (Dec 20 – Jan 6): premium awards nearly impossible without booking "
            "11 months in advance. "
            "Spring break (March 15 – April 15): variable but often difficult. "
            "By destination: "
            "Japan: best availability October–November and January–February. Cherry blossom season "
            "(late March–April) is extremely difficult for premium award seats. "
            "Europe: January–March is best; avoid July–August and all holidays. "
            "Caribbean: January–April is peak for cash but award seats are often available. "
            "Tip for premium cabin awards: search and book 9–11 months out regardless of season. "
            "For January travel, start searching February of the prior year."
        ),
        "related": ["booking-award-seats", "sweet-spots-guide", "points-vs-cash-decision"],
    },
    {
        "id": "credit-card-travel-protections",
        "title": "Credit Card Travel Protections — Why They Matter for Points Bookings",
        "category": "booking_strategies",
        "tags": ["travel insurance", "trip delay", "cancellation", "protection", "baggage", "lost luggage"],
        "summary": (
            "Many premium travel cards include trip delay, cancellation, and baggage insurance. "
            "Using the right card for award taxes and fees unlocks valuable protections."
        ),
        "content": (
            "When booking award flights, you still pay taxes and fees with a credit card. The card "
            "you use for that small charge determines what travel protections apply to the entire trip. "
            "Best travel protections by card: "
            "Chase Sapphire Reserve: "
            "Trip delay: reimbursement up to $500/ticket after 6-hour delays (meals, hotel, transport). "
            "Trip cancellation/interruption: up to $10,000/person, $20,000/trip. "
            "Baggage delay: up to $100/day for 5 days if bags delayed 6+ hours. "
            "Lost baggage: up to $3,000/passenger. "
            "Auto rental CDW: primary coverage (doesn't bill your own insurance first). "
            "Chase Sapphire Preferred: "
            "Similar to Reserve but trip delay kicks in after 12 hours (not 6) and $500 cap is the same. "
            "Amex Platinum: "
            "Trip delay: up to $500 after 6 hours (must pay with Platinum). "
            "Trip cancellation: up to $10,000/trip (specific covered reasons). "
            "Baggage insurance plan: up to $3,000 carry-on, $2,000 checked. "
            "How to activate protections on award flights: "
            "Pay the taxes/fees portion of your award ticket with the card offering protections. "
            "Even $5.60 in taxes on a Southwest award activates Chase Sapphire's full coverage. "
            "Keep all receipts for delay-related expenses — file claims promptly (often within 60–90 days). "
            "Important: travel protections do NOT apply if you book through a third-party OTA. "
            "Book award tickets directly with the airline or through the bank's own portal."
        ),
        "related": ["best-cards-for-flights", "booking-award-seats", "mistake-fares-guide"],
    },
    {
        "id": "points-and-cash-awards",
        "title": "Points + Cash Awards — When Hybrid Redemptions Make Sense",
        "category": "booking_strategies",
        "tags": ["points plus cash", "hybrid", "co-pay", "pluspoints", "cash copay", "pay with points"],
        "summary": (
            "Some programs let you pay with a combination of miles and cash. "
            "These are useful when your balance is too low for a full award."
        ),
        "content": (
            "Points + cash options let you top up a shortfall in your miles balance with a cash co-pay "
            "rather than waiting to accumulate more points. "
            "How it works: instead of needing 75,000 miles for a flight, you might pay "
            "40,000 miles + $150 cash — if the implied CPP on the miles portion is above your floor. "
            "Programs with strong points+cash options: "
            "United MileagePlus: PlusPoints (upgrade currency) can be combined with miles. "
            "British Airways Avios: 'Combine Points and Cash' lets you pay any portion in cash. "
            "Hilton Honors: points+cash for hotel stays, occasionally useful for airline partner bookings. "
            "American AAdvantage: co-pay options on some partner awards. "
            "Chase Travel Portal: 'Pay Yourself Back' lets you offset any travel charge with points "
            "at 1.25–1.5¢/point (Preferred/Reserve) — useful for taxes and fees you've already charged. "
            "When it makes sense: "
            "(1) You're 10,000–20,000 miles short of a sweet spot and the cash co-pay is reasonable. "
            "(2) The CPP on the miles portion still exceeds your floor after the cash co-pay. "
            "Example: 40k miles + $100 cash for a $500 flight. "
            "If 75k miles gets the same flight for $0 cash, the 40k miles are worth $400 (1.0¢/mile) — "
            "below most floors. Pay cash instead and save miles. "
            "When it doesn't make sense: "
            "Never use points+cash if it drops your effective CPP below your floor. "
            "Never use 'points as currency' programs (like Chase Pay Yourself Back) at 1.0¢/point — "
            "you can always do better by transferring to a partner."
        ),
        "related": ["cpp-fundamentals", "minimum-cpp-thresholds", "bank-currencies-guide"],
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# ASSEMBLE FULL KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════════════════════

FLIGHTS_KB: list[dict] = (
    _POINTS_VS_CASH
    + _AIRLINE_PROGRAMS
    + _CREDIT_CARDS
    + _BOOKING_STRATEGIES
)

# ── Validate uniqueness ──────────────────────────────────────────────────────
_ids = [doc["id"] for doc in FLIGHTS_KB]
assert len(_ids) == len(set(_ids)), f"Duplicate KB document IDs: {[x for x in _ids if _ids.count(x) > 1]}"

# ── Build structured/FAQ tree ────────────────────────────────────────────────
STRUCTURED_DOCS: dict[str, list[dict]] = {}
for _doc in FLIGHTS_KB:
    _cat = _doc["category"]
    if _cat not in STRUCTURED_DOCS:
        STRUCTURED_DOCS[_cat] = []
    STRUCTURED_DOCS[_cat].append({
        "id": _doc["id"],
        "title": _doc["title"],
        "summary": _doc["summary"],
        "examples": _doc.get("examples", []),
        "related": _doc.get("related", []),
    })

# ── Category metadata ────────────────────────────────────────────────────────
CATEGORY_META: dict[str, dict] = {
    "points_vs_cash": {
        "label": "Points vs Cash Math",
        "icon": "⚖️",
        "description": "How to calculate whether to pay cash or use points for any flight.",
    },
    "airline_programs": {
        "label": "Airline Programs & Partners",
        "icon": "✈️",
        "description": "Deep-dives on the major loyalty programs, alliances, and partner redemptions.",
    },
    "credit_cards": {
        "label": "Credit Card Rewards & Transfers",
        "icon": "💳",
        "description": "Which cards to hold, how transfers work, and the best earning strategies.",
    },
    "booking_strategies": {
        "label": "Booking Strategies & Sweet Spots",
        "icon": "🎯",
        "description": "Where and how to find the best award deals, timing, and tools.",
    },
}
