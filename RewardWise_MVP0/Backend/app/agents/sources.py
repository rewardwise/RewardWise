"""
agents/sources.py
──────────────────
Source registry — maps KB article IDs to official/authoritative URLs.

URL STRATEGY:
  - Prefer official airline/bank/program pages when they expose enough static text.
  - Keep blocked or JS-heavy official pages in reference_urls, not active urls.
  - Use NerdWallet / The Points Guy / AwardWallet / Frequent Miler as secondary sources
    when official pages are JavaScript-heavy, blocked, or do not discuss the exact policy.
  - Avoid old /travel/learn/... slugs that now 404. NerdWallet has moved many of them.
  - Avoid TPG legacy /airline/... and /guide/... slugs that now redirect poorly or 404.
  - Avoid Bilt Zendesk support pages in the scraper path when they return 403; use
    Bilt public pages/newsroom plus NerdWallet as the scrape-friendly fallback.
  - Amex Membership Rewards transfer page is now global.americanexpress.com/rewards/transfer.
  - Alaska/Hawaiian loyalty pages are now Atmos Rewards branded.
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class KBSource:
    article_id:    str
    urls:          list[str]
    cadence:       str   # "weekly" | "monthly" | "quarterly"
    focus:         str
    category:      str
    article_title: str
    reference_urls: list[str] = field(default_factory=list)  # official/manual-reference URLs not scraped automatically


SOURCES: list[KBSource] = [

    # ── CLOSE-IN BOOKING FEES ─────────────────────────────────────────────────

    KBSource(
        article_id="close-in-fee-united",
        article_title="United MileagePlus Close-In Booking Fee",
        category="airline_policies",
        cadence="quarterly",
        focus="Close-in booking fee amount, days threshold, elite status waivers, partner award applicability",
        urls=[
            "https://www.nerdwallet.com/travel/learn/united-airlines-mileageplus-program-the-complete-guide",
            "https://awardwallet.com/airlines/united-mileageplus/award-travel-rules/",
        ],
    ),

    KBSource(
        article_id="close-in-fee-american",
        article_title="American AAdvantage Close-In Booking Fee",
        category="airline_policies",
        cadence="quarterly",
        focus="Close-in booking fee amount, elite waiver levels, partner award applicability",
        urls=[
            "https://awardwallet.com/airlines/american-aadvantage/aa-award-travel-rules/",
            "https://www.nerdwallet.com/travel/learn/american-airlines-aadvantage-complete-guide",
        ],
        reference_urls=[
            "https://www.aa.com/web/i18n/aadvantage-program/answers-support/using-miles-for-travel.html",
            "https://www.aa.com/i18n/aadvantage-program/aadvantage-terms-and-conditions.jsp",
        ],
    ),

    # ── CHANGE/CANCEL FEES ────────────────────────────────────────────────────

    KBSource(
        article_id="change-cancel-united-awards",
        article_title="United MileagePlus Award Change and Cancel Fees",
        category="airline_policies",
        cadence="quarterly",
        focus="Redeposit fee, change fee, no-show fee, elite waivers, 24-hour cancellation",
        urls=[
            "https://www.nerdwallet.com/travel/learn/united-award-travel",
            "https://awardwallet.com/airlines/united-mileageplus/award-travel-rules/",
        ],
        reference_urls=[
            "https://www.united.com/en/us/fly/mileageplus/award-redeposit-fees.html",
            "https://www.united.com/en/us/fly/travel/trip-planning/flight-change.html",
        ],
    ),

    KBSource(
        article_id="change-cancel-american-awards",
        article_title="American AAdvantage Award Change and Cancel Fees",
        category="airline_policies",
        cadence="quarterly",
        focus="Redeposit fee, change/cancel timeline thresholds, elite waiver levels",
        urls=[
            "https://awardwallet.com/airlines/american-aadvantage/aa-award-travel-rules/",
            "https://www.nerdwallet.com/travel/learn/american-airlines-aadvantage-complete-guide",
        ],
        reference_urls=[
            "https://www.aa.com/web/i18n/aadvantage-program/answers-support/using-miles-for-travel.html",
            "https://www.aa.com/i18n/aadvantage-program/aadvantage-terms-and-conditions.jsp",
        ],
    ),

    # ── BAGGAGE FEES ──────────────────────────────────────────────────────────

    KBSource(
        article_id="baggage-fees-major-us-airlines",
        article_title="Checked Baggage Fee Comparison — Major US Airlines",
        category="airline_policies",
        cadence="quarterly",
        focus="First and second checked bag fees per airline, credit card waivers, elite waivers",
        urls=[
            "https://www.delta.com/us/en/baggage/overview",
            "https://www.alaskaair.com/content/travel-info/baggage/checked-bags",
            "https://www.southwest.com/html/customer-service/travel-fees.html",
            "https://www.jetblue.com/help/checked-bags",
            "https://www.nerdwallet.com/travel/learn/which-airlines-have-the-best-and-worst-fees",
        ],
        reference_urls=[
            "https://www.united.com/en/us/fly/baggage/checked-bags.html",
            "https://www.aa.com/i18n/travel-info/baggage/checked-baggage-policy.jsp",
        ],
    ),

    # ── FUEL SURCHARGES ───────────────────────────────────────────────────────

    KBSource(
        article_id="fuel-surcharges-partner-awards",
        article_title="Fuel Surcharges on Partner Award Tickets",
        category="airline_policies",
        cadence="monthly",
        focus="Which programs pass YQ carrier-imposed fees, approximate dollar amounts, programs that avoid surcharges",
        urls=[
            "https://thepointsguy.com/loyalty-programs/avoid-fuel-surcharges-award-travel/",
            "https://www.nerdwallet.com/travel/learn/fuel-surcharge-airlines",
            "https://www.nerdwallet.com/travel/learn/ways-fuel-costs-are-impacting-air-travel",
        ],
    ),

    # ── TRANSFER PARTNERS ─────────────────────────────────────────────────────

    KBSource(
        article_id="chase-ur-transfer-partners",
        article_title="Chase Ultimate Rewards Transfer Partners and Ratios",
        category="program_rules",
        cadence="monthly",
        focus="Transfer partner list, ratios, any new partners added or removed, processing times",
        urls=[
            "https://www.nerdwallet.com/travel/learn/chase-transfer-partners-guide",
            "https://www.nerdwallet.com/credit-cards/learn/chase-ultimate-rewards-program",
            "https://thepointsguy.com/loyalty-programs/chase-ultimate-rewards-transfer-partners/",
            "https://ultimaterewardspoints.chase.com/transfer-points/list-programs",
        ],
    ),

    KBSource(
        article_id="amex-mr-transfer-partners",
        article_title="Amex Membership Rewards Transfer Partners and Ratios",
        category="program_rules",
        cadence="monthly",
        focus="Transfer partner list, ratios (watch for 1:0.75 vs 1:1), new partners, removed partners, Etihad exit June 2026",
        urls=[
            "https://www.nerdwallet.com/travel/learn/american-express-transfer-partners",
            "https://thepointsguy.com/credit-cards/membership-rewards-partner-guide/",
        ],
        reference_urls=[
            "https://global.americanexpress.com/rewards/transfer",
        ],
    ),

    KBSource(
        article_id="capital-one-transfer-partners",
        article_title="Capital One Miles Transfer Partners and Ratios",
        category="program_rules",
        cadence="monthly",
        focus="Transfer partner list, ratios, new partners, processing times",
        urls=[
            "https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/",
            "https://www.nerdwallet.com/travel/learn/capital-one-transfer-partners-guide",
            "https://thepointsguy.com/loyalty-programs/capital-one-transfer-partners/",
        ],
    ),

    KBSource(
        article_id="citi-thankyou-transfer-partners",
        article_title="Citi ThankYou Points Transfer Partners and Ratios",
        category="program_rules",
        cadence="monthly",
        focus="Transfer partner list, ratios, new or removed partners, 1:1 vs reduced ratio differences by card",
        urls=[
            "https://www.nerdwallet.com/travel/learn/citi-transfer-partners-guide",
            "https://thepointsguy.com/loyalty-programs/citi-transfer-partners/",
        ],
        reference_urls=[
            "https://www.thankyou.com/partnerProgramsListing.htm",
        ],
    ),

    KBSource(
        article_id="bilt-transfer-partners",
        article_title="Bilt Rewards Transfer Partners and Ratios",
        category="program_rules",
        cadence="monthly",
        focus="Transfer partner list, ratios, Rent Day bonuses, new partners, Atmos Rewards partnership",
        urls=[
            "https://www.nerdwallet.com/travel/learn/bilt-transfer-partners",
            "https://newsroom.biltrewards.com/meetbiltcard2.0",
        ],
        reference_urls=[
            "https://www.bilt.com/rewards/partner",
            "https://support.biltrewards.com/hc/en-us/articles/19086448638989-Bilt-s-Transfer-Partners",
        ],
    ),

    # ── AWARD CHARTS ──────────────────────────────────────────────────────────

    KBSource(
        article_id="alaska-mileage-plan-award-chart",
        article_title="Alaska / Atmos Rewards Award Chart",
        category="program_rules",
        cadence="monthly",
        focus="Award chart rates by partner and cabin, partner booking fees, any devaluations, new partners",
        urls=[
            "https://www.alaskaair.com/atmosrewards/content/partners/airlines",
            "https://www.nerdwallet.com/travel/learn/your-guide-to-atmos-rewards-award-chart",
            "https://thepointsguy.com/loyalty-programs/alaska-airlines-partners/",
        ],
        reference_urls=[
            "https://www.alaskaair.com/atmosrewards/content/use-points",
        ],
    ),

    KBSource(
        article_id="air-canada-aeroplan-award-chart",
        article_title="Air Canada Aeroplan Award Chart",
        category="program_rules",
        cadence="monthly",
        focus="Distance-based award rates, surcharge policy changes, stopover rule changes, Star Alliance partner pricing",
        urls=[
            "https://www.aircanada.com/ca/en/aco/home/aeroplan/news/2026-an-update-on-the-aeroplan-flight-reward-chart.html",
            "https://www.aircanada.com/content/dam/aircanada/loyalty-content/documents/flight-rewards-chart-june2026-en.pdf",
            "https://thepointsguy.com/loyalty-programs/air-canada-aeroplan/",
            "https://thepointsguy.com/loyalty-programs/aeroplan-routing-stopover-rules/",
        ],
    ),

    KBSource(
        article_id="united-mileageplus-award-chart",
        article_title="United MileagePlus Award Chart",
        category="program_rules",
        cadence="monthly",
        focus="Dynamic pricing ranges, Excursionist Perk changes, cardmember discounts, saver availability for elites",
        urls=[
            "https://www.nerdwallet.com/travel/learn/united-award-travel",
            "https://thepointsguy.com/loyalty-programs/know-united-mileageplus/",
        ],
        reference_urls=[
            "https://www.united.com/en/us/fly/mileageplus/award-redeposit-fees.html",
        ],
    ),

    # ── CREDIT CARDS ──────────────────────────────────────────────────────────

    KBSource(
        article_id="chase-sapphire-reserve",
        article_title="Chase Sapphire Reserve",
        category="credit_cards",
        cadence="quarterly",
        focus="Annual fee, earning rate changes, benefit additions or removals, credit amounts, lounge access changes",
        urls=[
            "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
        ],
    ),

    KBSource(
        article_id="chase-sapphire-preferred",
        article_title="Chase Sapphire Preferred",
        category="credit_cards",
        cadence="quarterly",
        focus="Annual fee, earning rates, benefit changes, hotel credit amount, transfer partners",
        urls=[
            "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
        ],
    ),

    KBSource(
        article_id="amex-platinum",
        article_title="Amex Platinum Card",
        category="credit_cards",
        cadence="quarterly",
        focus="Annual fee, earning rates, credit amounts and categories, lounge access changes, Delta Sky Club visit policy",
        urls=[
            "https://www.americanexpress.com/us/credit-cards/card/platinum/",
            "https://global.americanexpress.com/card-benefits/view-all/platinum",
        ],
    ),

    KBSource(
        article_id="amex-gold",
        article_title="Amex Gold Card",
        category="credit_cards",
        cadence="quarterly",
        focus="Annual fee, earning rates, dining credit changes, Uber Cash amount, hotel credit",
        urls=[
            "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
            "https://global.americanexpress.com/card-benefits/view-all/gold",
        ],
    ),

    KBSource(
        article_id="capital-one-venture-x",
        article_title="Capital One Venture X",
        category="credit_cards",
        cadence="quarterly",
        focus="Annual fee, earning rates, travel credit, anniversary miles, lounge locations expanding",
        urls=[
            "https://www.capitalone.com/credit-cards/venture-x/",
            "https://www.capitalone.com/learn-grow/more-than-money/all-about-venture-x/",
            "https://www.capitalone.com/credit-cards/travel-and-miles/",
        ],
    ),

    KBSource(
        article_id="bilt-mastercard",
        article_title="Bilt Mastercard / Bilt Card 2.0",
        category="credit_cards",
        cadence="monthly",
        focus="Cardless cards launched Feb 2026, earning rates, Rent Day bonus rates, new transfer partners, benefit changes",
        urls=[
            "https://newsroom.biltrewards.com/meetbiltcard2.0",
            "https://www.nerdwallet.com/travel/learn/bilt-mastercard",
            "https://www.nerdwallet.com/credit-cards/reviews/bilt-credit-card",
        ],
        reference_urls=[
            "https://support.biltrewards.com/hc/en-us/articles/42897766682381-Bilt-Card-2-0-Program-Overview",
        ],
    ),

    KBSource(
        article_id="delta-gold-amex",
        article_title="Delta SkyMiles Gold Amex",
        category="credit_cards",
        cadence="quarterly",
        focus=(
            "Annual fee, earning rates, first checked bag free policy, "
            "TakeOff 15, Delta Stays credit, Delta flight credit after spend, "
            "priority boarding, in-flight discount"
        ),
        urls=[
            "https://www.delta.com/us/en/skymiles/airline-credit-cards/american-express-personal-cards",
            "https://www.delta.com/us/en/skymiles/airline-credit-cards/personal",
            "https://www.delta.com/us/en/baggage/checked-baggage/first-checked-bag-free",
            "https://www.delta.com/us/en/baggage/checked-baggage/medallion-baggage-allowance",
            "https://thepointsguy.com/credit-cards/reviews/gold-delta-skymiles-amex-credit-card-review/",
            "https://www.nerdwallet.com/reviews/credit-cards/american-express-delta-gold",
        ],
        reference_urls=[
            "https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold-american-express-card/",
            "https://global.americanexpress.com/card-benefits/view-all/delta-gold",
            "https://www.americanexpress.com/us/credit-cards/category/rewards-delta-skymiles/",
        ],
    ),

    KBSource(
        article_id="alaska-airlines-bank-of-america",
        article_title="Alaska Airlines / Atmos Rewards Ascent Visa",
        category="credit_cards",
        cadence="quarterly",
        focus="Rebranded to Atmos Rewards Ascent, earning rates, companion fare changes, free bag policy, Atmos Rewards integration",
        urls=[
            "https://www.bankofamerica.com/credit-cards/products/alaska-airlines-credit-card/",
            "https://news.alaskaair.com/loyalty/alaska-airlines-and-bank-of-america-present-a-new-premium-credit-card/",
        ],
        reference_urls=[
            "https://www.alaskaair.com/atmosrewards/content/credit-cards/visa-ascent",
            "https://www.alaskaair.com/atmosrewards/content/credit-cards",
        ],
    ),

    # ── ELITE STATUS ──────────────────────────────────────────────────────────

    KBSource(
        article_id="united-elite-status-guide",
        article_title="United MileagePlus Elite Status",
        category="elite_status",
        cadence="quarterly",
        focus="PQF and PQP thresholds per tier, benefit changes, PlusPoints upgrade policy, cardmember discounts",
        urls=[
            "https://thepointsguy.com/loyalty-programs/know-united-mileageplus/",
            "https://thepointsguy.com/news/united-airlines-premier-status-pluspoints-changes/",
        ],
        reference_urls=[
            "https://www.united.com/en/us/fly/mileageplus/premier/qualify.html",
            "https://www.united.com/en/us/fly/mileageplus/premier.html",
        ],
    ),

    KBSource(
        article_id="delta-medallion-status-guide",
        article_title="Delta SkyMiles Medallion Elite Status",
        category="elite_status",
        cadence="quarterly",
        focus="MQD thresholds per tier, benefit changes, GUC counts, Sky Club access rules, credit card MQD accelerators",
        urls=[
            "https://www.delta.com/us/en/skymiles/medallion-program/how-to-qualify",
            "https://www.delta.com/us/en/skymiles/medallion-program/overview",
            "https://www.delta.com/us/en/skymiles/medallion-program/medallion-benefits",
            "https://www.nerdwallet.com/travel/learn/the-complete-guide-to-delta-medallion-elite-status",
        ],
    ),

    KBSource(
        article_id="american-aadvantage-elite-guide",
        article_title="American Airlines AAdvantage Elite Status",
        category="elite_status",
        cadence="quarterly",
        focus="Loyalty Point thresholds, Loyalty Point Rewards, systemwide upgrade counts, Admirals Club access rules, Oneworld status equivalencies",
        urls=[
            "https://www.nerdwallet.com/travel/learn/guide-to-american-airlines-elite-status",
            "https://thepointsguy.com/loyalty-programs/american-airlines-aadvantage/",
        ],
        reference_urls=[
            "https://www.aa.com/web/i18n/aadvantage-program/discover/loyalty-points-status.html",
            "https://www.aa.com/web/i18n/aadvantage-program/discover/benefits-rewards.html",
            "https://www.aa.com/web/i18n/aadvantage-program/aadvantage-status/loyalty-point-rewards.html",
        ],
    ),

    # ── LOUNGES ───────────────────────────────────────────────────────────────

    KBSource(
        article_id="centurion-lounges-guide",
        article_title="Amex Centurion Lounges",
        category="airport_lounges",
        cadence="monthly",
        focus="New lounge openings, guest policy changes, access requirement changes, new locations",
        urls=[
            "https://www.americanexpress.com/en-us/travel/lounges/the-platinum-card/",
            "https://thepointsguy.com/airline/the-ultimate-guide-to-amex-centurion-lounges/",
            "https://www.americanexpress.com/en-us/newsroom/articles/travel-and-dining/with-32-locations-and-growing--american-express-expands-its-indu.html",
        ],
    ),

    KBSource(
        article_id="capital-one-lounges-guide",
        article_title="Capital One Lounges",
        category="airport_lounges",
        cadence="monthly",
        focus="New lounge openings, access policy changes, guest fee changes, new locations",
        urls=[
            "https://www.capitalone.com/learn-grow/more-than-money/capital-one-lounges-arriving-in-airports/",
            "https://capitalonetravel.com/airport-lounges",
            "https://thepointsguy.com/credit-cards/capital-one-lounge/",
        ],
        reference_urls=[
            "https://www.capitalone.com/travel/lounge/",
        ],
    ),

    KBSource(
        article_id="delta-sky-club-guide",
        article_title="Delta Sky Club",
        category="airport_lounges",
        cadence="monthly",
        focus="Visit limit policy, access changes, day pass price, new locations, Reserve card changes",
        urls=[
            "https://www.delta.com/us/en/delta-sky-club/access",
            "https://www.delta.com/us/en/delta-sky-club/overview",
            "https://thepointsguy.com/loyalty-programs/ultimate-guide-delta-sky-club-access/",
        ],
    ),
]


# ── Lookup helpers ────────────────────────────────────────────────────────────

def get_by_cadence(cadence: str) -> list[KBSource]:
    return [s for s in SOURCES if s.cadence == cadence]

def get_by_category(category: str) -> list[KBSource]:
    return [s for s in SOURCES if s.category == category]

def get_by_article_id(article_id: str) -> KBSource | None:
    return next((s for s in SOURCES if s.article_id == article_id), None)
