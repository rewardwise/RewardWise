"""
rag/kb/program_rules.py
───────────────────────
KB articles for transferable bank currencies, airline loyalty program rules,
award-chart behavior, transfer partners, hotel programs, and redemption strategy.

CATEGORY: program_rules

DATA STATUS: Policy content filled and expanded for Zoe RAG.
Each article includes a `valid_as_of` date.

DATA SOURCES TO USE (when refreshing):
  - Official bank, airline, and hotel loyalty-program pages (primary)
  - Official award charts/calculators and terms pages
  - The Points Guy / NerdWallet / Frequent Miler / One Mile at a Time / Upgraded Points for secondary verification
  - FlyerTalk wiki and program-specific forums for award-search quirks only, not primary facts

UPDATE CADENCE: Quarterly — transfer partners, award charts, and hotel pricing change frequently.
"""

from __future__ import annotations

PROGRAM_RULES_KB: list[dict] = [
    {'id': 'transfer-partners-chase-ultimate-rewards',
     'title': 'Chase Ultimate Rewards Transfer Partners and Rules',
     'category': 'program_rules',
     'tags': ['bank points', 'transfer partners', 'chase', 'ultimate rewards', 'hyatt', 'united', 'southwest'],
     'valid_as_of': '2026-Q2',
     'content': 'Chase Ultimate Rewards is a transferable bank currency. Eligible Ultimate Rewards points transfer to all '
                'Chase airline and hotel partners at a 1:1 ratio, generally in 1,000-point increments. Transfers are '
                'one-way and cannot be reversed, so Zoe should tell users to confirm award space before moving points.\n'
                '\n'
                'Airline partners requested for this KB: United MileagePlus 1:1, usually instant; Southwest Rapid Rewards '
                '1:1, usually instant; British Airways Executive Club / British Airways Club Avios 1:1, usually instant; '
                'Air France/KLM Flying Blue 1:1, usually instant; Singapore KrisFlyer 1:1, often 12-48 hours and sometimes '
                'longer; Virgin Atlantic Flying Club / Virgin Red 1:1, usually instant; Iberia Plus Avios 1:1, usually '
                'instant once accounts are eligible and matched; Aer Lingus AerClub Avios 1:1, usually instant; Emirates '
                'Skywards 1:1, usually instant; Air Canada Aeroplan 1:1, usually instant. Chase transfer bonuses are not '
                'fixed benefits; they appear as limited-time promotions and are commonly in the 15%-30% range when '
                'offered, but Zoe must check the live Chase portal before quoting an active bonus.\n'
                '\n'
                'Hotel partners requested for this KB: World of Hyatt 1:1, usually instant and normally the best hotel use '
                'of Chase points; IHG One Rewards 1:1, usually instant or same day, usually weak because IHG points are '
                'commonly worth far less than Chase points; Marriott Bonvoy 1:1, usually same day to 1-2 days, usually '
                'poor value because Marriott pricing is dynamic and Marriott points are generally less valuable than '
                'transferable Chase points.\n'
                '\n'
                'Cards that earn or can access Ultimate Rewards transfers: Chase Sapphire Reserve, Chase Sapphire '
                'Preferred, and Ink Business Preferred unlock transfers to airline and hotel partners. Ink Business Cash, '
                'Ink Business Unlimited, Freedom, Freedom Flex, and Freedom Unlimited earn Ultimate Rewards-style points '
                'but are non-transferable by themselves; they can become transferable only if the points are combined into '
                'a transfer-capable Sapphire Reserve, Sapphire Preferred, or Ink Business Preferred account owned by the '
                'same person or eligible business relationship.\n'
                '\n'
                'Points pooling and household rules: Chase allows a cardmember to combine Ultimate Rewards points between '
                'their own eligible Chase cards. Chase also allows moving points to one member of the household or, for '
                'business cards, an owner/co-owner of the company where permitted. Once pooled into a transfer-capable '
                'card account, the combined balance can be transferred to partners. Zoe should avoid telling users to '
                'transfer to unrelated friends because Chase can restrict or claw back improper transfers.\n'
                '\n'
                'Best-value guidance: Chase to Hyatt is usually the strongest hotel transfer path. Chase to United is '
                'useful for simple Star Alliance awards and no fuel surcharges, but Aeroplan, Flying Blue, Virgin '
                'Atlantic, British Airways/Iberia Avios, and Singapore can beat United on specific routes. Chase Travel '
                'portal redemptions can be useful when cash prices are low or awards are unavailable, but transfer '
                'partners usually create the upside for premium cabins.',
     'summary': 'Chase transfers to its listed airline and hotel partners at 1:1 when the user has a Sapphire Reserve, '
                'Sapphire Preferred, or Ink Business Preferred. Hyatt is usually the standout hotel transfer; Marriott and '
                'IHG are usually weak despite also being 1:1.'},

    {'id': 'transfer-partners-amex-membership-rewards',
     'title': 'American Express Membership Rewards Transfer Partners and Rules',
     'category': 'program_rules',
     'tags': ['bank points', 'transfer partners', 'amex', 'membership rewards', 'pay with points'],
     'valid_as_of': '2026-Q2',
     'content': 'American Express Membership Rewards is a transferable bank currency with many airline and hotel partners. '
                'Transfers are irreversible and the ratio varies by partner; Zoe should always check the live Amex '
                'transfer page for an active transfer bonus before quoting a promotion.\n'
                '\n'
                'Airline partners requested for this KB: Air Canada Aeroplan 1:1, usually instant; Air France/KLM Flying '
                'Blue 1:1, usually instant; ANA Mileage Club 1:1, often 24-72 hours and sometimes longer; British Airways '
                'Executive Club / British Airways Club Avios 1:1, usually instant; Cathay Pacific Asia Miles 1:1, often '
                'instant to 24 hours; Delta SkyMiles 1:1, usually instant, but U.S. Amex transfers to U.S. airlines can '
                'trigger an excise tax offset fee; Emirates Skywards 1:1, usually instant; Etihad Guest 1:1, often instant '
                'to 24 hours; Iberia Plus Avios 1:1, often instant after account eligibility requirements are met; JetBlue '
                'TrueBlue typically transfers at 250 Membership Rewards points to 200 TrueBlue points in the U.S. program, '
                'so it is not a full 1:1 transfer; Qantas Frequent Flyer 1:1, often instant to 24 hours; Singapore '
                'KrisFlyer 1:1, commonly 12-48 hours; Virgin Atlantic Flying Club / Virgin Red 1:1, usually instant. Amex '
                'also has partners beyond this requested list, so this article is scoped to the requested Zoe coverage.\n'
                '\n'
                'Hotel partners requested for this KB: Choice Privileges 1:1, useful only for specific high-value Choice '
                'redemptions; Hilton Honors 1:2, one of the few hotel transfers that can make sense because the ratio '
                'doubles the points, especially during expensive stays or high-end redemptions; Marriott Bonvoy 1:1, '
                'generally not recommended because Marriott uses dynamic pricing and Bonvoy points are usually worth less '
                'than Membership Rewards points.\n'
                '\n'
                'Cards that earn Membership Rewards: consumer Platinum, Gold, and Green cards earn Membership Rewards; '
                'Business Platinum, Business Gold, and Business Green cards also earn Membership Rewards. Some '
                'no-annual-fee or cash-back style Amex products earn different currencies and should not be assumed to '
                'transfer.\n'
                '\n'
                'Supplementary/additional cardholder transfer rules: Amex generally requires the external loyalty account '
                'to belong to the primary cardmember or an authorized/additional cardmember who has been on the account '
                'long enough under Amex rules. Zoe should not recommend transferring Amex points directly into an '
                "unrelated person's loyalty account.\n"
                '\n'
                'Pay with Points comparison: Pay with Points through Amex Travel often gives around 1.0 cent per point '
                'toward flights for many Membership Rewards cards and lower value for many non-flight redemptions. '
                'Business Platinum can rebate a portion of points on eligible airline redemptions, improving effective '
                'value for those users. Transfers can exceed portal value, especially for business/first class or '
                'high-cash-price economy awards, but a poor transfer can be worse than Pay with Points. Zoe should compare '
                'cash price, award price, taxes/fees, and transfer time before recommending a transfer.\n'
                '\n'
                'Transfer bonuses: Amex frequently runs limited-time bonuses to programs such as Flying Blue, Virgin '
                'Atlantic, British Airways/Iberia/Aer Lingus Avios, Hilton, Marriott, and others. Typical bonuses are '
                'often 15%-40%, but there is no permanent bonus. Use only live portal data when telling a user a bonus is '
                'currently active.',
     'summary': 'Amex Membership Rewards has broad airline coverage, including Aeroplan, Flying Blue, ANA, Delta, '
                'Emirates, Singapore, and Virgin. Hilton at 1:2 can sometimes work, JetBlue is not full 1:1 in the U.S., '
                'and Pay with Points is usually a floor rather than the best upside.'},

    {'id': 'transfer-partners-capital-one-miles',
     'title': 'Capital One Miles Transfer Partners and Rules',
     'category': 'program_rules',
     'tags': ['bank points', 'transfer partners', 'capital one', 'venture x', 'venture', 'spark miles'],
     'valid_as_of': '2026-Q2',
     'content': 'Capital One Miles are transferable from eligible Capital One miles-earning cards. Most airline and hotel '
                'partners transfer at 1:1, but some partners have weaker ratios. Transfers are irreversible.\n'
                '\n'
                'Partners requested for this KB: Air Canada Aeroplan 1:1, usually instant; Air France/KLM Flying Blue 1:1, '
                'usually instant; Avianca LifeMiles 1:1, usually instant; British Airways Executive Club / Avios 1:1, '
                'usually instant; Emirates Skywards is commonly 2:1.5 rather than 1:1; EVA Air Infinity MileageLands is '
                '2:1.5, so 1,000 Capital One miles becomes 750 EVA miles; Finnair Plus Avios 1:1 where available; Qantas '
                'Frequent Flyer 1:1; Singapore KrisFlyer 1:1, often 12-48 hours; TAP Miles&Go 1:1; Turkish Miles&Smiles '
                '1:1; Wyndham Rewards 1:1; Choice Privileges 1:1. Capital One also has partners beyond this requested '
                "list, so this content is scoped to Zoe's requested coverage.\n"
                '\n'
                'Cards requested for this KB: Venture X, Venture, and Spark Miles earn transferable Capital One miles. '
                'Other Capital One cash-back products may not transfer directly unless Capital One allows '
                'conversion/combining into an eligible miles account.\n'
                '\n'
                'Processing time: many Capital One transfers are instant or near-instant, especially Aeroplan, Flying '
                'Blue, Avianca, British Airways, Qantas, Turkish, and Wyndham. Singapore KrisFlyer and some international '
                'partners can take 12-48 hours or longer. Because partner availability can disappear during a transfer '
                'delay, Zoe should flag slow partners before recommending a speculative transfer.\n'
                '\n'
                'Transfer bonuses: Capital One periodically offers transfer bonuses, often 15%-30%, to selected airline or '
                'hotel partners. Bonuses are not guaranteed and must be checked live in the Capital One portal.\n'
                '\n'
                'Best-value guidance: Aeroplan, Avianca LifeMiles, Flying Blue, Turkish, British Airways/Iberia/Finnair '
                'Avios, and Singapore can all be high-value airline paths. Choice and Wyndham can be useful for specific '
                'hotel use cases, but Hyatt is not a Capital One partner, so users with Capital One miles should not be '
                'told to transfer directly to Hyatt.',
     'summary': 'Capital One miles mostly transfer 1:1, but EVA and Emirates are weaker at 2:1.5 in current public '
                'guidance. Venture X, Venture, and Spark Miles are the key transferable-card families.'},

    {'id': 'transfer-partners-citi-thankyou-points',
     'title': 'Citi ThankYou Points Transfer Partners and Rules',
     'category': 'program_rules',
     'tags': ['bank points', 'transfer partners', 'citi', 'thankyou', 'strata premier'],
     'valid_as_of': '2026-Q2',
     'content': 'Citi ThankYou Points are transferable when the user has an eligible premium ThankYou card. Transfers are '
                'one-way and partner ratios can depend on the card product.\n'
                '\n'
                'Partners requested for this KB: Air France/KLM Flying Blue 1:1 for eligible premium cards; Avianca '
                'LifeMiles 1:1; Cathay Pacific Asia Miles 1:1; Etihad Guest 1:1; EVA Air Infinity MileageLands 1:1; '
                'JetBlue TrueBlue commonly 1:1 for premium ThankYou cards and weaker for some no-fee cards; Singapore '
                'KrisFlyer 1:1; Thai Royal Orchid Plus 1:1; Turkish Miles&Smiles 1:1; Virgin Atlantic Flying Club / Virgin '
                "Red 1:1; Wyndham Rewards usually 1:1 for premium cards, but ratios can vary by card. Citi's current "
                'partner list may include additional partners beyond the requested list, so Zoe should not treat this '
                'article as the entire Citi ecosystem when doing a live account-specific answer.\n'
                '\n'
                'Cards requested for this KB: Citi Strata Premier unlocks full transferable ThankYou functionality for '
                'many users. Citi Prestige is discontinued to new applicants, but existing cardholders may retain transfer '
                'functionality. Citi Custom Cash and Citi Double Cash earn ThankYou-style points but are not full '
                'transferable currencies by themselves; pairing/combining with a Strata Premier or Prestige-style premium '
                'account is the usual way to unlock partner transfers.\n'
                '\n'
                'Processing time: many Citi transfers are instant or same day, including Flying Blue, Avianca, JetBlue, '
                'Virgin, and Wyndham in many cases. Singapore, Turkish, Thai, EVA, Cathay, and Etihad can take longer, '
                'commonly 12-48 hours and occasionally several days. Zoe should warn users not to transfer until award '
                'space is verified, especially for scarce premium cabins.\n'
                '\n'
                'Transfer bonuses: Citi periodically runs transfer bonuses, often 15%-30%, to selected partners. Bonuses '
                'are not permanent and must be checked in the live Citi ThankYou portal.\n'
                '\n'
                'Best-value guidance: Citi is especially useful for Avianca LifeMiles, Turkish Miles&Smiles, Flying Blue, '
                'Virgin Atlantic, and Choice/Wyndham-style hotel redemptions where applicable. It is weaker for users who '
                'need United, Southwest, or Hyatt because Citi does not directly transfer to those programs.',
     'summary': 'Citi transfers are strongest with Strata Premier/Prestige-style accounts. Custom Cash and Double Cash '
                'usually need pairing with a premium ThankYou account to become truly useful for airline transfers.'},

    {'id': 'transfer-partners-bilt-rewards',
     'title': 'Bilt Rewards Transfer Partners and Rules',
     'category': 'program_rules',
     'tags': ['bank points', 'transfer partners', 'bilt', 'rent day', 'hyatt', 'alaska', 'american'],
     'valid_as_of': '2026-Q2',
     'content': 'Bilt Rewards is a transferable rewards currency earned primarily through the Bilt World Elite Mastercard '
                'and the Bilt Rewards ecosystem. Transfers are generally irreversible.\n'
                '\n'
                'Airline partners requested for this KB: United MileagePlus 1:1; American AAdvantage is important '
                'historically because Bilt previously transferred to American, but American is not a current '
                'always-available Bilt transfer partner as of the post-2024 changes and should not be recommended unless '
                'the live Bilt app shows a temporary or account-specific option; Alaska Mileage Plan / Atmos Rewards 1:1 '
                'where available; Air Canada Aeroplan 1:1; British Airways Executive Club / Avios 1:1; Air France/KLM '
                'Flying Blue 1:1; Cathay Pacific Asia Miles 1:1 where available; Turkish Miles&Smiles 1:1; Emirates '
                'Skywards 1:1 where available; Virgin Atlantic Flying Club / Virgin Red 1:1; Singapore KrisFlyer 1:1. '
                "Bilt's partner roster changes more often than older bank programs, so Zoe should check live Bilt data "
                'before giving a final recommendation.\n'
                '\n'
                "Hotel partners requested for this KB: World of Hyatt 1:1 is the standout hotel transfer and one of Bilt's "
                'best uses; IHG One Rewards may be available at 1:1 but is usually weaker; the checklist lists both Hyatt '
                'and World of Hyatt, which are the same loyalty program, so do not double-count them as separate hotel '
                'partners. Bilt may have additional hotel partners that vary over time.\n'
                '\n'
                'Card requested for this KB: Bilt World Elite Mastercard is the primary card. Bilt points can also be '
                'earned through eligible rent-payment and ecosystem activity even without a traditional transferable '
                'bank-card setup, but the Bilt Mastercard is the only requested card product.\n'
                '\n'
                'Rent Day rules: Rent Day is the first day of each month. Bilt commonly offers boosted earning on the 1st, '
                'with cardholders historically earning double points on many non-rent purchases subject to category caps '
                'and program rules. Dining and travel can have higher multipliers on Rent Day than everyday spend, but '
                'exact multipliers and caps can change; Zoe must check the current Bilt Rent Day terms before quoting a '
                'live promotion. Rent payments themselves are not generally doubled the same way normal purchases can be.\n'
                '\n'
                'Transfer processing times: many Bilt transfers are instant or near-instant, especially Hyatt, United, '
                'Flying Blue, Avios, and Virgin. Singapore, Turkish, Cathay, and some international programs can take '
                'longer. Because Bilt sometimes offers Rent Day transfer bonuses, users should verify award space, then '
                'transfer during a bonus window only if the award can survive the timing risk.\n'
                '\n'
                'Points pooling with roommates/family: Bilt is not a general household pooling currency like some airline '
                'programs. Users can earn points related to rent payments and roommate/rent workflows, but points are '
                "generally held in the individual member's Bilt account and transfers go to that member's eligible loyalty "
                "account. Do not tell users they can freely pool Bilt points with roommates or family unless Bilt's live "
                'terms explicitly allow the specific transfer.',
     'summary': 'Bilt is excellent because it has Hyatt plus strong airline partners, but American Airlines should be '
                'treated as historical unless the live Bilt app shows otherwise. Rent Day bonuses are powerful but must be '
                'checked live because terms change monthly.'},

    {'id': 'transfer-partners-wells-fargo-rewards',
     'title': 'Wells Fargo Autograph and Autograph Journey Transfer Partners',
     'category': 'program_rules',
     'tags': ['bank points', 'transfer partners', 'wells fargo', 'autograph', 'autograph journey'],
     'valid_as_of': '2026-Q2',
     'content': 'Wells Fargo Rewards has become a transferable-points program for eligible Autograph-family cardholders. '
                "This is a newer ecosystem than Chase/Amex/Citi, so Zoe should verify partner availability in the user's "
                'live Wells Fargo account before recommending a transfer.\n'
                '\n'
                'Partners requested for this KB: Air France/KLM Flying Blue 1:1; Avianca LifeMiles 1:1; British Airways '
                'Executive Club / Avios 1:1; Iberia Plus Avios 1:1; Aer Lingus AerClub Avios 1:1; Korean Air SKYPASS is '
                'requested in the checklist but is not a broadly published Wells Fargo transfer partner in current public '
                "lists, so do not recommend it unless the user's live portal shows it; Turkish Miles&Smiles is requested "
                'but is not consistently listed in current public Wells Fargo partner rosters, so verify live; Qantas '
                'Frequent Flyer is requested but must be verified live; Singapore KrisFlyer is requested but must be '
                'verified live; TAP Miles&Go is requested but must be verified live. Current public partner lists commonly '
                'include partners such as Cathay Pacific, JetBlue, Virgin Atlantic/Virgin Red, Choice, and Wyndham, which '
                'means the checklist may lag the live Wells Fargo roster.\n'
                '\n'
                'Cards requested for this KB: Autograph Journey is transferable. The checklist says Autograph is '
                'non-transferable, but current public reporting indicates the no-annual-fee Wells Fargo Autograph card may '
                'also access transfers; because this has changed, Zoe should not give a hard no without checking the '
                "user's live account. Use the safe answer: transfer capability depends on the specific Wells Fargo Rewards "
                'account and product eligibility.\n'
                '\n'
                'Processing times: many Wells Fargo transfers are expected to be instant or near-instant, but the '
                'ecosystem is newer and partner-specific. Zoe should warn users to verify award space and not make '
                'speculative transfers.\n'
                '\n'
                'Best-value guidance: Flying Blue, Avianca LifeMiles, British Airways/Iberia/Aer Lingus Avios, Virgin '
                'Atlantic, Choice, and Wyndham can be valuable depending on route or property. Do not position Wells Fargo '
                'as a Hyatt/United/Southwest replacement because those are not standard Wells Fargo partners.',
     'summary': 'Wells Fargo has transferable partners for eligible Autograph-family accounts, but the checklist contains '
                'partners that are not consistently in public current rosters. Zoe should verify the live portal before '
                'recommending Korean, Turkish, Qantas, Singapore, or TAP from Wells Fargo.'},

    {'id': 'bank-of-america-travel-rewards-premium-rewards-model',
     'title': 'Bank of America Travel Rewards and Premium Rewards Redemption Model',
     'category': 'program_rules',
     'tags': ['bank points', 'bank of america', 'statement credit', 'travel rewards', 'premium rewards'],
     'valid_as_of': '2026-Q2',
     'content': 'Bank of America Travel Rewards and Premium Rewards are not true airline/hotel transfer programs in the '
                'same way Chase Ultimate Rewards, Amex Membership Rewards, Capital One Miles, Citi ThankYou, Bilt, or '
                'Wells Fargo Rewards are. They generally operate as fixed-value or statement-credit style rewards against '
                'eligible travel and dining purchases.\n'
                '\n'
                'Transfer-program note: users should not expect Bank of America Travel Rewards or Premium Rewards points '
                'to transfer 1:1 to airline programs like United, American, Delta, Aeroplan, Flying Blue, or Hyatt. If a '
                'user wants award-chart arbitrage, premium-cabin sweet spots, or partner award routing, Bank of America '
                'Travel Rewards/Premium Rewards is usually the wrong currency.\n'
                '\n'
                'When it makes sense: Bank of America points can make sense when the user values simplicity, wants to '
                'erase a cheap cash fare, has a strong Preferred Rewards banking bonus that increases earning rate, or is '
                'buying a ticket/hotel that has no good award space. It also avoids transfer delays and orphaned airline '
                'miles.\n'
                '\n'
                'When to use a real transfer program instead: use Chase/Amex/Capital One/Citi/Bilt/Wells Fargo when the '
                'user can unlock outsized value, especially business/first class flights, Hyatt stays, Flying Blue Promo '
                'Rewards, Aeroplan partner awards, Avios short-haul awards, Virgin/ANA-style sweet spots, or other '
                'redemptions where cents-per-point materially exceeds the fixed statement-credit value.\n'
                '\n'
                'Zoe decision rule: treat Bank of America travel points as cash-equivalent. Compare the redemption value '
                "to the cash fare and avoid calling them 'miles' that transfer to airline partners unless the user is "
                'talking about a separate co-branded airline card such as Alaska/Hawaiian/other partner products.',
     'summary': 'Bank of America Travel Rewards/Premium Rewards are cash-equivalent statement-credit style programs, not '
                'true transfer currencies. They are simple but usually lack the upside of transferable bank points.'},

    {'id': 'barclays-arrival-wyndham-earner-rules',
     'title': 'Barclays Arrival and Wyndham Earner Redemption Rules',
     'category': 'program_rules',
     'tags': ['bank points', 'barclays', 'arrival', 'wyndham', 'wyndham earner'],
     'valid_as_of': '2026-Q2',
     'content': 'Barclays has multiple rewards products that should not be treated as one interchangeable currency. '
                'Barclays Arrival-style miles and Wyndham Earner rewards behave differently.\n'
                '\n'
                'Wyndham Earner transfer/reward rules: Wyndham Earner cards earn Wyndham Rewards points directly. Wyndham '
                'Rewards uses a simple award-night structure for many properties and vacation rentals, commonly priced in '
                'fixed tiers such as 7,500, 15,000, or 30,000 Wyndham points per bedroom/night depending on property and '
                'redemption type, though taxes, fees, cash copays, and vacation rental rules can vary. Wyndham points can '
                'be valuable for Vacasa-style rentals or expensive properties when the fixed tier is favorable, but users '
                'should check live property pricing.\n'
                '\n'
                'Arrival redemption model: Barclays Arrival-style miles are generally used as statement credits against '
                'eligible travel purchases at a fixed value rather than transferred into airline/hotel partners. That '
                'makes Arrival simpler and more cash-like but usually weaker than flexible transferable currencies for '
                'premium-cabin awards.\n'
                '\n'
                'When it makes sense: Arrival-style redemptions are useful for non-chain hotels, taxes/fees, budget '
                'flights, tours, trains, or travel purchases that cannot be booked well with airline/hotel points. Wyndham '
                "Earner makes sense when Wyndham's fixed tier creates high value compared with the cash price.\n"
                '\n'
                'When not to use it: do not recommend Barclays Arrival as a path to United, Hyatt, Aeroplan, Flying Blue, '
                'or other transfer-partner sweet spots. Do not recommend Wyndham points for flights unless a specific '
                'Wyndham airline-transfer path is live and favorable; hotel redemptions are usually the main use case.',
     'summary': 'Arrival is a travel statement-credit model, while Wyndham Earner earns Wyndham points directly. Treat '
                'Arrival as cash-like and Wyndham as a hotel-specific fixed-tier opportunity.'},

    {'id': 'program-rules-united-mileageplus',
     'title': 'United MileagePlus Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'united', 'mileageplus', 'star alliance', 'pluspoints', 'chase'],
     'valid_as_of': '2026-Q2',
     'content': 'United MileagePlus no longer has a simple fixed public award chart for United-operated awards, and '
                'partner award pricing can also vary. Zoe should not quote a guaranteed Saver/Standard table as current '
                "policy. Instead, describe United pricing as dynamic, with lower 'saver' inventory still relevant for "
                'partner availability and some internal pricing logic, but no stable public all-region award chart that '
                'can be used without a live search.\n'
                '\n'
                'Saver vs Standard: historically, United used Saver and Standard award levels by cabin and region. Current '
                'consumer-facing pricing is dynamic. Saver-like space is still important because it can be bookable by '
                'partners and can be much cheaper, but users must search live. Cabins include economy, premium economy '
                'where offered, business/Polaris, and first where offered.\n'
                '\n'
                'Star Alliance partner rates: United can book Star Alliance and other partners, but partner awards are no '
                'longer governed by a simple public fixed chart. Pricing varies by region, route, cabin, partner, and '
                'demand. The useful Zoe rule is that United generally avoids passing large fuel surcharges on Star '
                'Alliance partners, making it simpler than Miles & More or ANA in high-YQ situations.\n'
                '\n'
                "Dynamic pricing caveat: when a user asks 'how many United miles should this cost?', Zoe should run/search "
                'rather than quote a fixed chart. If no live search is available, give a range-style answer and say United '
                'is dynamic.\n'
                '\n'
                'Excursionist Perk: United historically allowed a free one-way segment inside a single region on eligible '
                'multi-city international round-trip awards, called the Excursionist Perk. United has announced '
                'MileagePlus changes for 2026 that affect the Excursionist Perk, so Zoe should treat it as a '
                'current/transition item and verify before recommending it for a new booking.\n'
                '\n'
                'PlusPoints: Premier Platinum and Premier 1K members can use PlusPoints for upgrade requests on eligible '
                'United and some partner flights. PlusPoints are an elite upgrade currency, not an award booking currency. '
                'Availability is capacity controlled and not guaranteed.\n'
                '\n'
                'Chase UR feed-in: Chase Ultimate Rewards transfers 1:1 to United MileagePlus and is the primary bank '
                'feed-in for most U.S. users. Use Chase-to-United when simplicity, United availability, or no-YQ Star '
                'Alliance partner booking matters, but compare Aeroplan, LifeMiles, ANA, Turkish, and Singapore for the '
                'same Star Alliance route before assuming United is best.',
     'summary': 'United is dynamic, so Zoe should not use an old fixed Saver/Standard chart as current. Chase transfers '
                '1:1, United usually avoids major Star Alliance fuel surcharges, and PlusPoints are separate elite upgrade '
                'instruments.'},

    {'id': 'program-rules-delta-skymiles',
     'title': 'Delta SkyMiles Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'delta', 'skymiles', 'skyteam', 'amex'],
     'valid_as_of': '2026-Q2',
     'content': 'Delta SkyMiles does not publish a fixed award chart for Delta-operated flights. Award pricing is dynamic '
                'and can vary dramatically by route, date, cabin, demand, and sale activity. Zoe should evaluate Delta by '
                'comparing live SkyMiles price plus taxes against the cash fare and against other transferable-point '
                'options.\n'
                '\n'
                'Dynamic pricing: there is no stable Saver/Standard chart. Domestic economy awards can sometimes price low '
                'during sales, while premium cabin and international awards can price extremely high. Delta One awards '
                'booked with SkyMiles are often poor cents-per-point unless there is a sale or the cash fare is unusually '
                'high.\n'
                '\n'
                'Partner award rates: partner awards booked through Delta are also variable and not governed by a '
                'user-friendly public chart. SkyTeam partners can be useful on specific routes, but Delta often prices '
                'international premium cabins high.\n'
                '\n'
                'SkyMiles credit card feed-in: American Express issues Delta co-branded cards that earn SkyMiles directly. '
                'Amex Membership Rewards also transfers to Delta SkyMiles 1:1, but U.S. transfers to Delta can trigger '
                "Amex's excise tax offset fee. Zoe should compare transferring MR to Delta against Flying Blue, Virgin "
                'Atlantic, Aeroplan, or other partners before recommending it.\n'
                '\n'
                'SkyMiles auctions and unique redemptions: Delta offers non-flight redemption paths such as experiences, '
                'SkyMiles Marketplace-style uses, upgrades, and other promotions. These are usually not the best baseline '
                "value for Zoe's flight-decision engine unless the user explicitly asks.\n"
                '\n'
                'CPP guidance: Delta miles often produce the lowest consistent cents-per-point among the big three U.S. '
                'programs because the program closely ties many awards to cash prices and often prices premium cabins '
                'aggressively. Do not say Delta miles are worthless; say they are useful for flash sales, domestic trips, '
                'and simple redemptions, but less reliable for outsized premium-cabin value.',
     'summary': 'Delta has no fixed award chart and must be evaluated using live SkyMiles price versus cash. Amex feeds '
                'Delta, but Delta often gives lower consistent CPP than United or AA-style partner sweet spots.'},

    {'id': 'program-rules-american-aadvantage',
     'title': 'American AAdvantage Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'american', 'aadvantage', 'oneworld', 'citi', 'barclays'],
     'valid_as_of': '2026-Q2',
     'content': 'American AAdvantage is hybrid: American-operated flights use dynamic pricing, while partner awards still '
                'reference published region-based starting levels. Zoe should separate AA metal from partner metal.\n'
                '\n'
                'Fixed vs dynamic pricing: AA-operated awards can price dynamically and may be below or above historical '
                'MileSAAver/AAnytime levels. The old MileSAAver and AAnytime language is still useful historically, but '
                'users should not rely on it as a current fixed price for AA-operated flights. Partner awards are the more '
                'chart-like side of AAdvantage.\n'
                '\n'
                'Partner rates: one-way partner economy/business/first examples from the U.S. region include Europe around '
                '30,000 / 57,500 / 85,000 miles; Japan/Korea/Asia 1 around 35,000 / 60,000 / 80,000 miles; much of Asia 2 '
                'around 37,500 / 70,000 / 110,000 miles; South Pacific around 40,000 / 80,000 / 110,000 miles; Middle '
                'East/Indian Subcontinent around 40,000 / 70,000 / 115,000 miles; Africa around 40,000 / 75,000 / 120,000 '
                'miles; South America 1 around 20,000 / 30,000 in economy/business; South America 2 around 30,000 / 57,500 '
                '/ 85,000. Domestic U.S./Canada partner awards are often around 12,500 economy and 25,000 premium cabin. '
                "Rates and region definitions must be checked against AA's live chart.\n"
                '\n'
                'Oneworld and non-Oneworld partners: AAdvantage can book Oneworld partners such as British Airways, Cathay '
                'Pacific, Finnair, Iberia, Japan Airlines, Qantas, Qatar, Royal Jordanian, Royal Air Maroc, SriLankan, and '
                'others, plus non-Oneworld partners such as Etihad and sometimes Alaska-related inventory depending on '
                'current partnership rules.\n'
                '\n'
                'Business and first sweet spots: Japan Airlines business and first class via AAdvantage are major sweet '
                'spots when saver space exists. Current common U.S.-Japan partner rates are about 60,000 miles one-way in '
                'business and about 80,000 miles one-way in first, plus taxes/fees that are often far lower than booking '
                'BA long-haul awards.\n'
                '\n'
                'AAnytime vs MileSAAver: treat these as historical AA-operated award concepts. For current user advice, '
                'use live pricing for AA-operated flights and partner chart logic for partner flights.\n'
                '\n'
                'Citi/Barclays feed-in: Citi and Barclays AAdvantage cards earn AA miles directly. Citi ThankYou does not '
                'universally transfer to AA for all users unless a current partner relationship or eligible card-specific '
                "rule is active. Bilt's old AA transfer partnership should not be assumed current.",
     'summary': 'AAdvantage is strongest when partner awards price from the region chart, especially '
                'JAL/Cathay/Qatar-style premium cabins. AA-operated awards are dynamic, so Zoe needs live pricing for '
                'those.'},

    {'id': 'program-rules-alaska-mileage-plan-atmos',
     'title': 'Alaska Mileage Plan / Atmos Rewards Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'alaska', 'mileage plan', 'atmos', 'oneworld', 'hawaiian'],
     'valid_as_of': '2026-Q2',
     'content': 'Alaska Mileage Plan has been moving into the combined Alaska/Hawaiian Atmos Rewards ecosystem. Zoe should '
                "use Atmos/Alaska terminology where current, while recognizing that many users still say 'Alaska miles' or "
                "'Mileage Plan miles.'\n"
                '\n'
                'Award chart model: Alaska/Atmos partner awards use published distance/region style pricing with starting '
                'rates by distance band and cabin, while Alaska/Hawaiian-operated pricing can vary. The exact chart '
                'depends on region and partner, so Zoe should run a live search for final pricing.\n'
                '\n'
                'Partner rates and carriers requested for this KB: American Airlines partner awards are available through '
                'Oneworld/Alaska partnerships where inventory exists; British Airways awards are bookable but can include '
                'BA surcharges/taxes; Cathay Pacific awards can be excellent for Asia premium cabins when space exists; '
                'Emirates First Class was historically an Alaska sweet spot, but Emirates awards via Alaska have changed '
                'dramatically over time and should not be promoted as a current guaranteed first-class sweet spot without '
                'live confirmation; Finnair is an Avios/Oneworld partner with good Europe/Nordic routing; Japan Airlines '
                'first class remains one of the highest-value Alaska/Atmos partner goals when space exists; Korean Air '
                'awards can be useful but have partner-specific rules; LATAM can be useful for South America; Qantas can '
                'be valuable but scarce in premium cabins; Singapore Airlines access has limitations; Condor can be a '
                "strong transatlantic partner; El Al and Icelandair can be useful niche partners. 'And all others' means "
                'Zoe should not assume a partner is excluded just because it is not listed here; check the live '
                'Alaska/Atmos partner page.\n'
                '\n'
                "Starting-rate guidance: Alaska's newer partner pricing often starts at low levels for short economy hops "
                'and increases by distance and region. Long-haul premium cabin partner awards can start in the '
                '45,000-85,000+ mile range depending on distance, region, and cabin, with first class higher where '
                'offered. Because Alaska has changed charts repeatedly, do not quote old Emirates/Cathay/JAL prices unless '
                'the live chart confirms them.\n'
                '\n'
                'No fuel surcharges: Alaska historically does not pass large fuel surcharges on most partner awards, which '
                'is a core selling point. Zoe should still mention normal taxes, government fees, partner booking fees, '
                'and any carrier-specific exceptions shown at checkout.\n'
                '\n'
                'Bank of America feed-in: Alaska Airlines Visa and business cards from Bank of America earn Alaska/Atmos '
                'points directly and can include companion fare and free checked bag benefits. Alaska/Atmos is not a '
                'standard Chase/Amex/Citi transfer partner, though Bilt and other partners may be available depending on '
                'current agreements.\n'
                '\n'
                'Strategic guidance: Alaska/Atmos is best for partner premium cabins, '
                'Condor/Finnair/JAL/Cathay/Qantas-style redemptions, and users with Alaska card earning. It is less useful '
                'when dynamic Alaska/Hawaiian pricing is high or partner premium space is unavailable.',
     'summary': 'Alaska/Atmos is partner-award focused, with strong value when JAL/Cathay/Condor/Qantas-style space exists '
                'and low/no fuel surcharge exposure. Do not rely on old Emirates First pricing without live confirmation.'},

    {'id': 'program-rules-southwest-rapid-rewards',
     'title': 'Southwest Rapid Rewards Award Pricing and Companion Pass Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'southwest', 'rapid rewards', 'companion pass', 'chase'],
     'valid_as_of': '2026-Q2',
     'content': 'Southwest Rapid Rewards uses a fare-linked points model rather than a traditional award chart. Points '
                'prices move with the cash fare, taxes, and fare product selected. There are no blackout dates for points '
                'redemptions on available Southwest seats, but if the cash fare is high, the points price will also be '
                'high.\n'
                '\n'
                'CPP formula: cents per point equals (cash price minus taxes/fees you still pay on an award) divided by '
                'points required, multiplied by 100. Example: if a ticket costs $200 cash, the award costs 14,000 points '
                "plus $5.60, value is (($200 - $5.60) / 14,000) * 100 = about 1.39 cents per point. Southwest's CPP is "
                'relatively consistent because awards are linked to fare price, but exact value varies by fare, taxes, and '
                'promotions.\n'
                '\n'
                'Companion Pass: Companion Pass lets the member choose one companion to fly with them for only required '
                'taxes and fees, including on award tickets. Standard earning requires 135,000 qualifying points in a '
                'calendar year or 100 qualifying one-way flights, though promotional rules can differ. It is valuable when '
                'the user repeatedly travels with the same person, especially on paid or points tickets.\n'
                '\n'
                'Chase feed-in and card strategy: Chase Ultimate Rewards transfers 1:1 to Southwest Rapid Rewards. Chase '
                'Southwest co-branded credit cards can help earn Rapid Rewards points and Companion Pass qualifying points '
                'depending on current card rules. Chase UR to Southwest can make sense for Companion Pass users because '
                'the companion can fly on the same itinerary for taxes/fees only.\n'
                '\n'
                'Fare products: Southwest historically used Wanna Get Away, Wanna Get Away Plus, Anytime, and Business '
                'Select. Current fare names and benefits have evolved into Basic/Choice/Choice Preferred/Choice '
                'Extra-style products. Higher fare products cost more points but can include more flexibility, earning, '
                'refundability, seat/bag/boarding benefits, or other perks depending on current rules.\n'
                '\n'
                'No blackout dates and change fees: Southwest points can generally be used for any available seat with no '
                'blackout dates. Southwest is known for flexible changes, but users must follow fare rules and '
                'cancel/change before the deadline, generally at least 10 minutes before departure, to preserve value. '
                'Fare differences still apply.',
     'summary': 'Southwest points track cash fares, so the math is straightforward and consistent. Companion Pass is the '
                'main upside because it can double the value of paid or points bookings for two travelers.'},

    {'id': 'program-rules-jetblue-trueblue',
     'title': 'JetBlue TrueBlue Award Pricing and Mosaic Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'jetblue', 'trueblue', 'mosaic', 'mint', 'tiles'],
     'valid_as_of': '2026-Q2',
     'content': 'JetBlue TrueBlue uses a dynamic, fare-linked points model. Award prices generally track the cash price, '
                'route, demand, fare type, and cabin. There is no fixed award chart that guarantees a route price.\n'
                '\n'
                'Dynamic pricing model: Zoe should calculate value by comparing cash price to points required plus '
                'taxes/fees. TrueBlue can be good for simple domestic and Caribbean redemptions, but it usually does not '
                'create the same outsized premium-cabin arbitrage as a fixed partner chart.\n'
                '\n'
                'Mint business class: Mint awards price dynamically and can require very high points when cash fares are '
                'high. Mint redemptions can still be worthwhile on transcontinental, Caribbean, Latin America, and '
                'transatlantic routes when the cash fare is expensive and points price is reasonable. Do not quote a fixed '
                'Mint award chart.\n'
                '\n'
                'Mosaic benefits: Mosaic status provides JetBlue elite benefits that can matter on award travel, including '
                'perks around seats, bags, changes, priority services, and extra-value benefits depending on Mosaic level '
                'and current Perks You Pick rules. Mosaic does not convert TrueBlue into a fixed award-chart program.\n'
                '\n'
                'Transfer feed-in: Chase Ultimate Rewards transfers to JetBlue, and Amex Membership Rewards transfers to '
                'JetBlue at a weaker U.S. ratio than 1:1 in many cases. Citi and Capital One/Wells Fargo relationships can '
                'vary by current partner roster. Zoe should compare transfer ratio before recommending a bank-to-JetBlue '
                'transfer.\n'
                '\n'
                'JetBlue card feed-in: Barclays issues JetBlue co-branded cards that earn TrueBlue points directly and may '
                'provide checked bag, rebate, or other benefits depending on product.\n'
                '\n'
                'Tile points: JetBlue uses Tiles to track progress toward perks and Mosaic status. Tiles are '
                'status-progress units, not redeemable award points. Partner earning can help earn TrueBlue points and/or '
                'tiles depending on the partner and offer.',
     'summary': 'JetBlue is dynamic and fare-linked; Mint can be good but has no fixed chart. Mosaic/tiles affect benefits '
                'and status, while Barclays JetBlue cards and some bank transfers feed the program.'},

    {'id': 'program-rules-hawaiianmiles-atmos',
     'title': 'HawaiianMiles / Atmos Rewards Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'hawaiian', 'hawaiianmiles', 'alaska', 'atmos', 'bank of america'],
     'valid_as_of': '2026-Q2',
     'content': 'HawaiianMiles has been folded into the Alaska/Hawaiian Atmos Rewards transition. Zoe should use current '
                'Atmos guidance for new strategy but understand that users may still refer to HawaiianMiles balances, '
                'Hawaiian cards, and old Hawaiian award charts.\n'
                '\n'
                'Award chart: legacy HawaiianMiles used separate pricing concepts for inter-island, U.S. mainland, and '
                'international flights, with inter-island awards historically much cheaper than mainland/international '
                'redemptions. Under the Alaska/Hawaiian integration, pricing, earning, elite status, and redemption '
                'behavior are transitioning into Atmos Rewards, so Zoe should not hardcode old HawaiianMiles chart numbers '
                'without confirming the current booking flow.\n'
                '\n'
                'Partner rates: Hawaiian historically had partner redemption relationships and region-based partner '
                'pricing, but the practical user guidance in 2026 is to check the Atmos/Alaska/Hawaiian booking engine. '
                'Partner availability, pricing, and program branding may change as integration continues.\n'
                '\n'
                'Bank of America feed-in: the Hawaiian Airlines Mastercard / Bank of America-issued products historically '
                'earned HawaiianMiles and now need to be interpreted under the Atmos/Hawaiian transition rules. Alaska '
                'Bank of America cards also feed Alaska/Atmos.\n'
                '\n'
                'Merger implications: Alaska completed the Hawaiian acquisition process and the loyalty programs have '
                'moved toward a unified Atmos Rewards platform. This is a high-change area. Zoe should flag the policy as '
                'update-sensitive and verify live terms for Hawaiian-operated awards, inter-island benefits, resident '
                'benefits, and card benefits.\n'
                '\n'
                'Strategic guidance: for Hawaii travel, compare cash fares, Southwest where available, Alaska/Atmos, '
                'Hawaiian-operated awards, United/American/Delta awards, and transferable partner options. Do not assume '
                'legacy HawaiianMiles pricing is still the best path.',
     'summary': 'HawaiianMiles is a transition-sensitive program because of Alaska/Hawaiian Atmos Rewards integration. Zoe '
                'should avoid hardcoding old HawaiianMiles award chart rates without checking live pricing.'},

    {'id': 'program-rules-air-canada-aeroplan',
     'title': 'Air Canada Aeroplan Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'air canada', 'aeroplan', 'star alliance', 'stopover', 'amex', 'chase', 'capital one'],
     'valid_as_of': '2026-Q2',
     'content': 'Air Canada Aeroplan uses a zone-and-distance-based award chart with dynamic ranges for Air Canada/select '
                'partners and fixed or chart-like pricing for many other partners. Pricing is based on actual distance '
                'flown, region pairs, cabin, and operating carrier type.\n'
                '\n'
                'How to calculate: identify the origin and destination zones, add up the flown distance of the itinerary, '
                'then use the applicable distance band and cabin. Air Canada/select partner pricing may show starting and '
                'median prices, while all-other-partner pricing is more chart-like. Aeroplan also charges a partner '
                'booking fee on partner flight rewards.\n'
                '\n'
                'Star Alliance partner rates: Aeroplan can book Star Alliance partners such as United, Lufthansa, Swiss, '
                'ANA, EVA Air, Turkish, Singapore, TAP, Air India, Thai, South African, and others where partner award '
                'space exists. Official chart examples include within-Pacific bands such as 0-1,000 miles at 8,000 economy '
                '/ 20,000 business / 25,000 first, 1,001-2,000 at 12,500 / 30,000 / 50,000, and 2,001-5,000 at 25,000 / '
                '45,000 / 60,000 for many partners; other region pairs have different bands and rates. Aeroplan announced '
                'June 2026 chart updates, so Zoe should verify the applicable effective date.\n'
                '\n'
                'Stopover policy: Aeroplan is known for generous stopovers. A stopover can often be added to a one-way '
                'international award for 5,000 Aeroplan points, subject to routing and region restrictions. Canada '
                'stopover/free-stopover wording has changed across promotions and rules, so Zoe should quote the current '
                'stopover fee/rule rather than saying all Canada stopovers are free.\n'
                '\n'
                'Fuel surcharges: Aeroplan generally does not pass traditional carrier-imposed fuel surcharges on most '
                'Star Alliance partner awards, which is a major advantage over programs like Miles & More or ANA on some '
                'carriers. Users still pay taxes, airport fees, the partner booking fee, and any program-imposed charges. '
                'Some select partners/carriers may have pricing or fees that differ, so final taxes must be checked.\n'
                '\n'
                'Sweet spots: Lufthansa, Swiss, ANA, EVA Air, Turkish, and United premium cabins can be strong when award '
                'space exists and taxes/fees stay reasonable. The value is especially good when compared with programs '
                'that pass heavy surcharges.\n'
                '\n'
                'Transfer feed-in: Aeroplan is unusually accessible because Amex Membership Rewards, Chase Ultimate '
                'Rewards, Capital One Miles, and Bilt can transfer to Aeroplan. That makes it a default comparison path '
                'for many U.S. users.\n'
                '\n'
                '25% discount via Canada routing: Air Canada has offered preferred-pricing/discount behaviors for certain '
                'Air Canada cardholders, elite members, or routes that connect through Canada, but Zoe should not quote a '
                'universal 25% discount for all users. Treat the 25% routing trick as a strategy that must be validated '
                "against the user's account, card, and live search.",
     'summary': 'Aeroplan is zone-and-distance based, accessible from multiple banks, and often avoids big fuel '
                'surcharges. It is powerful, but June 2026 chart changes and partner booking fees mean Zoe should verify '
                'live pricing.'},

    {'id': 'program-rules-flying-blue',
     'title': 'Air France/KLM Flying Blue Award Pricing and Promo Rewards',
     'category': 'program_rules',
     'tags': ['airline program', 'flying blue', 'air france', 'klm', 'skyteam', 'promo rewards'],
     'valid_as_of': '2026-Q2',
     'content': 'Flying Blue uses dynamic award pricing rather than a simple fixed global chart, but it publishes useful '
                'starting-price concepts and regularly runs Promo Rewards.\n'
                '\n'
                'Monthly Promo Awards: Promo Rewards are monthly discounted award offers on selected routes, cabins, and '
                'travel windows. Discounts are commonly around 25% and can sometimes be higher or lower depending on the '
                "promotion. Users find them on Flying Blue's Promo Rewards page. They can be excellent when the "
                "route/cabin matches the user's needs, but dates and routes are restricted.\n"
                '\n'
                'SkyTeam partner rates: Flying Blue can book Air France, KLM, and SkyTeam partners such as Delta, Virgin '
                'Atlantic, Korean Air, China Airlines, Kenya Airways, Saudia, Vietnam Airlines, and others where award '
                'space exists. Partner pricing is variable and must be searched live.\n'
                '\n'
                'Fuel surcharges: Flying Blue passes carrier-imposed surcharges on many Air France/KLM-operated long-haul '
                'awards, especially premium cabins. These fees can be meaningful, but often lower than British Airways or '
                'Lufthansa-family surcharges. Partner awards may have lower or different fees depending on carrier and '
                'route.\n'
                '\n'
                'Partners without surcharges: some partner awards show modest taxes/fees, but there is no universal no-YQ '
                'partner rule. Zoe should quote fees only after seeing the booking result.\n'
                '\n'
                'Transfer partners: Flying Blue is easy to access from Chase Ultimate Rewards, Amex Membership Rewards, '
                'Capital One Miles, Citi ThankYou, Bilt, and Wells Fargo where available. Frequent transfer bonuses make '
                'Flying Blue a common first place to check for transatlantic economy, premium economy, and business-class '
                'deals.\n'
                '\n'
                'Strategic guidance: Flying Blue is best for Promo Rewards, U.S.-Europe availability, family pooling with '
                'Flying Blue Family, and transfer-bonus redemptions. It is weaker when dynamic pricing spikes or '
                'surcharges make the award close to a cash fare.',
     'summary': 'Flying Blue is dynamic but very useful because Promo Rewards and bank transfer bonuses can create strong '
                'value. Always compare points plus surcharges against the cash fare.'},

    {'id': 'program-rules-british-airways-avios',
     'title': 'British Airways Executive Club / British Airways Club Avios Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'british airways', 'avios', 'oneworld', 'distance based', 'household account'],
     'valid_as_of': '2026-Q2',
     'content': 'British Airways Avios uses distance-based pricing principles, but exact pricing can vary by carrier, '
                'route, peak/off-peak dates, Reward Flight Saver availability, and Avios & Money option selected.\n'
                '\n'
                'Distance zone table: common BA distance bands are Zone 1 up to about 650 miles, Zone 2 about 651-1,150 '
                'miles, Zone 3 about 1,151-2,000 miles, Zone 4 about 2,001-3,000 miles, Zone 5 about 3,001-4,000 miles, '
                'Zone 6 about 4,001-5,500 miles, Zone 7 about 5,501-6,500 miles, Zone 8 about 6,501-7,000 miles, and Zone '
                '9 7,001+ miles. BA can price short-haul awards cheaply, but some North America domestic partner pricing '
                'has separate minimums.\n'
                '\n'
                'Partner rates: Avios can book Oneworld partners such as American Airlines, Alaska, Iberia, Finnair, '
                'Qatar, Cathay Pacific, Qantas, Royal Jordanian, Royal Air Maroc, SriLankan, Malaysia Airlines, and Japan '
                'Airlines where inventory exists. Each segment prices separately, so nonstop flights are usually better '
                'than connections.\n'
                '\n'
                'Fuel surcharges: BA passes high carrier-imposed surcharges on many British Airways long-haul awards and '
                'can also pass surcharges on some partner metal. Iberia, Aer Lingus, American domestic, Alaska, and some '
                'other partners may price with lower fees depending on route and booking channel. Do not assume every '
                'Avios award has BA-level surcharges.\n'
                '\n'
                'Avios sharing: British Airways allows Household Accounts that pool Avios among eligible household '
                'members. Household members can redeem from the pooled balance under BA rules. Avios can also be moved '
                'among BA, Iberia, Aer Lingus, Qatar, and Finnair Avios ecosystems when accounts are eligible and properly '
                'linked.\n'
                '\n'
                'Short-haul sweet spots: flights under roughly 650 miles can be very cheap in Avios, especially outside '
                'the U.S. where Zone 1 pricing is available. U.S. domestic AA/Alaska awards can still be useful but may '
                'have higher minimum pricing than old 4,500-Avios examples.\n'
                '\n'
                'AA metal via Avios: American Airlines flights bookable with Avios usually avoid British Airways long-haul '
                'fuel surcharges, making BA Avios useful for U.S. domestic nonstop routes, short international hops, and '
                'routes where AA saver space exists.\n'
                '\n'
                'Transfer partners: Chase Ultimate Rewards, Amex Membership Rewards, Capital One Miles, Citi ThankYou, '
                'Bilt, and Wells Fargo/other Avios partners may transfer to BA/Avios depending on current partner roster. '
                'Transfer bonuses are common, so check live offers.',
     'summary': 'BA Avios is distance-based and great for nonstop short-haul awards, but BA long-haul surcharges can be '
                'painful. Avios can be pooled/moved across BA/Iberia/Aer Lingus/Qatar/Finnair when accounts are eligible.'},

    {'id': 'program-rules-iberia-plus-avios',
     'title': 'Iberia Plus Avios Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'iberia', 'avios', 'oneworld', 'chase'],
     'valid_as_of': '2026-Q2',
     'content': 'Iberia Plus uses Avios but has its own award pricing, account rules, and sweet spots separate from '
                'British Airways. Iberia Avios can often be moved between Iberia Plus, British Airways, Aer Lingus, Qatar, '
                'and Finnair Avios accounts if accounts meet age/activity/name-matching requirements.\n'
                '\n'
                'Separate from BA but poolable: Iberia Plus is not the same account as BA Executive Club/British Airways '
                "Club. A user can pool/move Avios across the Avios ecosystem when eligible, but each program's booking "
                'engine, fees, and award rules differ.\n'
                '\n'
                'Transatlantic sweet spot: Iberia business class between the U.S. and Madrid is one of the best Avios '
                'redemptions when off-peak pricing and saver space exist. Common historical examples include U.S. East '
                'Coast/Chicago to Madrid at roughly 34,000 Avios one-way in business off-peak and higher pricing for '
                'longer West Coast routes, often around 42,500+ Avios one-way off-peak. Current prices must be verified '
                'because Avios programs can devalue or vary by route.\n'
                '\n'
                'Transfer rules: Chase Ultimate Rewards transfers 1:1 to Iberia Plus. Amex, Capital One, Bilt, and other '
                'currencies may also feed Avios through BA/Aer Lingus/Qatar/Finnair routes where direct Iberia transfer is '
                'not available. Iberia accounts often need to be open and have activity before Combine My Avios works.\n'
                '\n'
                'Fees: Iberia-operated awards usually have much lower surcharges than British Airways long-haul awards, '
                'making Iberia Avios especially useful for Spain/Europe trips. Changes/cancellations and refundability '
                'depend on fare/award type.\n'
                '\n'
                'Zoe guidance: use Iberia when the user wants Spain/Europe, has Avios or Chase/Amex/Capital One/Bilt '
                'points, and can find Iberia saver space. Avoid routing through London on BA if fees erase the value.',
     'summary': 'Iberia Plus is part of Avios but has separate pricing and lower-fee transatlantic sweet spots. Chase '
                'transfers 1:1 and Iberia business to Madrid is often a top Europe play.'},

    {'id': 'program-rules-aer-lingus-aerclub-avios',
     'title': 'Aer Lingus AerClub Avios Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'aer lingus', 'aerclub', 'avios', 'chase'],
     'valid_as_of': '2026-Q2',
     'content': 'Aer Lingus AerClub uses Avios and is tied into the wider Avios ecosystem. It is useful for transatlantic '
                'flights to Ireland and beyond, especially when fees and pricing beat British Airways.\n'
                '\n'
                'Transatlantic rates: Aer Lingus awards between Dublin/Shannon and the U.S. price by distance and '
                'peak/off-peak logic. Historical useful examples include Northeast U.S. to Dublin/Shannon economy from '
                'around 13,000 Avios off-peak one-way and business from around 45,000 Avios off-peak one-way, with higher '
                'prices for longer routes and peak dates. Current pricing must be verified in the Avios booking flow.\n'
                '\n'
                'Pooling with BA/Iberia Avios: AerClub Avios can often be moved between Aer Lingus, BA, Iberia, Qatar, and '
                'Finnair Avios programs when accounts are eligible. This lets users transfer Chase to BA/Iberia/Aer Lingus '
                'paths and book through whichever Avios program has the best price/fees.\n'
                '\n'
                'Chase feed-in: Chase Ultimate Rewards transfers 1:1 to Aer Lingus AerClub. Amex, Capital One, Bilt, and '
                'others may also access Aer Lingus through direct or Avios ecosystem routes depending on current partner '
                'lists.\n'
                '\n'
                'Strategic guidance: Aer Lingus is useful for Ireland trips, avoiding UK Air Passenger Duty on some '
                'itineraries, and connecting onward in Europe. Compare Aer Lingus Avios taxes/fees to BA, Iberia, Flying '
                'Blue, United, and Aeroplan before recommending.',
     'summary': 'Aer Lingus AerClub is an Avios path focused on Ireland/transatlantic trips. It can be cheaper and '
                'lower-fee than BA, and Chase transfers 1:1.'},

    {'id': 'program-rules-lufthansa-miles-and-more',
     'title': 'Lufthansa Miles & More Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'lufthansa', 'miles and more', 'star alliance', 'swiss', 'austrian'],
     'valid_as_of': '2026-Q2',
     'content': 'Miles & More is the loyalty program for Lufthansa Group airlines including Lufthansa, SWISS, Austrian, '
                'Brussels Airlines, Eurowings, and others. It publishes award-chart style pricing by region and cabin, but '
                'taxes and carrier-imposed surcharges can be high.\n'
                '\n'
                'Award chart: Miles & More uses region/cabin award tables for Lufthansa Group and partner awards. Typical '
                'long-haul region awards can require tens of thousands of miles one-way in economy and substantially more '
                'in business/first. Because Miles & More periodically changes charts and may price round-trip/one-way '
                'differently by rule, Zoe should verify the current chart before quoting final numbers.\n'
                '\n'
                'Partner rates: Miles & More can book Star Alliance partners and selected other partners. Star Alliance '
                'partner awards are governed by Miles & More award rules, but availability comes from partner saver '
                'inventory.\n'
                '\n'
                'Fuel surcharges: Miles & More frequently passes high carrier-imposed surcharges on Lufthansa, SWISS, '
                'Austrian, Brussels, and other partner/Group flights. This can make an award look cheap in miles but '
                'expensive in cash.\n'
                '\n'
                'HON Circle sweet spots: elite members, especially HON Circle and Senator members, can access better '
                'availability, service handling, waitlist priority, and first-class opportunities. The best-known sweet '
                'spot is Lufthansa First Class access, especially close to departure, but fees and availability remain '
                'major factors.\n'
                '\n'
                'Acquisition strategies: Miles & More is difficult for many U.S. users to earn without flying Lufthansa '
                'Group/Star Alliance or using Miles & More co-branded cards where available. It is not a standard 1:1 '
                'Chase/Amex/Capital One/Citi transfer partner in the U.S. The practical U.S. strategy is often to book '
                'Lufthansa Group flights through Aeroplan, United, Avianca, ANA, or other Star Alliance programs rather '
                'than accumulating Miles & More directly.\n'
                '\n'
                'Program family: SWISS, Austrian, Brussels Airlines, and Eurowings participate in Miles & More, so do not '
                'describe them as separate primary mileage programs for redemption strategy.',
     'summary': 'Miles & More has chart-style awards and access to Lufthansa Group, but U.S. users face earning difficulty '
                'and often high surcharges. Aeroplan/United/LifeMiles may be better for the same flights.'},

    {'id': 'program-rules-turkish-miles-and-smiles',
     'title': 'Turkish Miles&Smiles Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'turkish', 'miles&smiles', 'star alliance', 'capital one', 'citi'],
     'valid_as_of': '2026-Q2',
     'content': 'Turkish Miles&Smiles uses award-chart style pricing for Turkish Airlines and Star Alliance awards, but '
                'the program has had major chart changes and booking-process quirks. Zoe should verify current rates '
                'before quoting final prices.\n'
                '\n'
                'Award chart: Turkish historically offered extremely cheap Star Alliance awards, including business class '
                'to Europe, domestic U.S./Hawaii awards on United, and long-haul business class sweet spots. After '
                'devaluations, many awards are still useful but not as universally cheap as older blogs suggest. Cabins '
                'include economy, business, and first where available.\n'
                '\n'
                'Star Alliance partner rates: Turkish can book Star Alliance partners such as United, Lufthansa Group, Air '
                'Canada, ANA, EVA, Singapore, TAP, Thai, and others when saver space exists. Partner rules may differ from '
                'Turkish-operated awards.\n'
                '\n'
                'Sweet spots: business class to Europe and Japan can still be attractive when the Turkish chart prices '
                'favorably and taxes/fees are reasonable. Istanbul routing can be valuable for Europe, Middle East, '
                'Africa, and Asia trips.\n'
                '\n'
                "Booking quirks: Turkish's website may fail to show some partner space, price incorrectly, or require "
                'phone/email/ticket-office handling. Phone agents can vary in knowledge, and ticketing can require '
                'persistence.\n'
                '\n'
                'Istanbul connection requirement: some Turkish-operated awards route naturally through Istanbul, and '
                'certain award/routing rules can require or favor Istanbul connections. Zoe should not promise '
                'non-Istanbul routing on Turkish metal.\n'
                '\n'
                'Transfer partners: Capital One and Citi transfer to Turkish Miles&Smiles, generally 1:1 for eligible '
                'accounts. Bilt and other partners may also be available depending on current roster.',
     'summary': 'Turkish can still be valuable for Star Alliance business awards, but devaluations and booking friction '
                'mean Zoe must verify live pricing and space.'},

    {'id': 'program-rules-emirates-skywards',
     'title': 'Emirates Skywards Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'emirates', 'skywards', 'first class', 'amex'],
     'valid_as_of': '2026-Q2',
     'content': 'Emirates Skywards uses route/fare-based award pricing rather than a simple global partner sweet-spot '
                'chart. Pricing differs by route, cabin, one-way versus round-trip, and Saver/Flex/Flex Plus '
                'availability.\n'
                '\n'
                'Award chart: Emirates publishes calculators and route-based pricing for economy, premium economy, '
                'business, and first where offered. Saver awards are cheaper but capacity controlled; Flex/Flex Plus costs '
                'more and can be more available. Always search live.\n'
                '\n'
                'Partner rates: Emirates has partner awards, but meaningful partner value is limited compared with using '
                'Skywards for Emirates-operated flights. Partner charts/rules vary by partner.\n'
                '\n'
                'Fuel surcharges: Emirates Skywards awards on Emirates metal can carry substantial carrier-imposed '
                'charges, especially in premium cabins. Zoe must compare cash copay plus miles against cash fares and '
                'other programs.\n'
                '\n'
                'First Class analysis: Emirates First can be worth Skywards miles when the user specifically wants the '
                'product, space is available, and fees are acceptable. The old Alaska Mileage Plan Emirates First sweet '
                'spot should be treated as historical, not a guaranteed current route.\n'
                '\n'
                'Business Class analysis: Emirates Business can be worthwhile on fifth-freedom routes such as JFK-Milan or '
                'Newark-Athens when price/fees are reasonable, but it often loses value if surcharges are high.\n'
                '\n'
                'Amex feed-in: Amex Membership Rewards transfers to Emirates Skywards. Chase, Capital One, and other banks '
                'may also transfer depending on current rosters, but the checklist specifically requested Amex.',
     'summary': 'Emirates Skywards is mainly for Emirates-operated awards, especially premium cabins when the user values '
                'the product. Watch high surcharges and do not rely on old Alaska Emirates First sweet spots.'},

    {'id': 'program-rules-etihad-guest',
     'title': 'Etihad Guest Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'etihad', 'guest', 'first apartment', 'business studio', 'citi'],
     'valid_as_of': '2026-Q2',
     'content': 'Etihad Guest uses carrier/route-based award pricing with a mix of Etihad-operated awards and partner '
                'awards. The program has changed charts several times, so Zoe should use live pricing for final numbers.\n'
                '\n'
                'Award chart: Etihad-operated awards price by route, cabin, and availability. Economy, business, and '
                'first/redemption availability vary widely.\n'
                '\n'
                'Partner rates: Etihad Guest has partner redemptions with selected airlines, but partner rates and booking '
                'processes vary by partner. Some partners require phone handling or special rules.\n'
                '\n'
                'Etihad Business Studio and First Apartment: premium Etihad products can be aspirational redemptions, '
                'especially Business Studio and First Apartment on aircraft/routes where available. Rates can be high and '
                'fees vary, so the recommendation should depend on live price and route.\n'
                '\n'
                'Transfer partners: Citi ThankYou transfers to Etihad Guest for eligible cards. Amex, Capital One, and '
                'other bank routes may exist in some markets, but the checklist requested Citi as the direct feed-in.\n'
                '\n'
                'Strategic guidance: use Etihad Guest when Etihad premium-cabin space is available at favorable pricing or '
                'when a partner sweet spot is confirmed. Compare against Aeroplan, American AAdvantage, and other partners '
                'for Etihad-operated flights.',
     'summary': 'Etihad Guest is useful for Etihad premium products and specific partner opportunities, but charts change '
                'and live pricing matters.'},

    {'id': 'program-rules-qatar-privilege-club',
     'title': 'Qatar Privilege Club Avios Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'qatar', 'privilege club', 'avios', 'q suite', 'oneworld'],
     'valid_as_of': '2026-Q2',
     'content': 'Qatar Privilege Club uses Avios and is part of the wider Avios ecosystem. It is often the most natural '
                'way to book Qatar Airways Qsuite awards when saver space exists.\n'
                '\n'
                'Award chart: Qatar uses Avios pricing by route/distance/region logic through its calculator and booking '
                'engine. Oneworld and partner rates vary, and the final number should be verified live.\n'
                '\n'
                'Qsuite business class: Qatar Qsuite is one of the strongest business-class redemptions. Common U.S.-Doha '
                'one-way saver-level pricing has often been around 70,000 Avios from the East Coast/Midwest and higher '
                'from the West Coast, with onward pricing to the Maldives, Africa, India, or Asia depending on '
                'segment/routing. Verify live because Qatar can vary pricing and availability.\n'
                '\n'
                'Avios integration: Qatar Avios can be linked and moved with British Airways Avios and other Avios '
                'programs when accounts are eligible. This lets users transfer to BA or another Avios program and move '
                'Avios to Qatar if that is the best booking engine.\n'
                '\n'
                'Transfer partners: direct bank feed-in can be limited depending on country, but users can often access '
                'Qatar through the Avios ecosystem using BA/Iberia/Aer Lingus/Finnair transfer paths. '
                'Bilt/Chase/Amex/Capital One/Citi may feed Avios depending on current partner roster.\n'
                '\n'
                'Strategic guidance: Qatar is best for Qsuite and Qatar-operated premium cabins. Compare fees and pricing '
                'with American AAdvantage and British Airways Avios for the same space.',
     'summary': 'Qatar Privilege Club is an Avios program and a key Qsuite booking path. Use live pricing and consider '
                'moving Avios from BA/Iberia/etc. when direct bank transfer is limited.'},

    {'id': 'program-rules-singapore-krisflyer',
     'title': 'Singapore KrisFlyer Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'singapore', 'krisflyer', 'star alliance', 'amex', 'capital one', 'citi', 'chase'],
     'valid_as_of': '2026-Q2',
     'content': 'Singapore KrisFlyer publishes award charts for Singapore Airlines/SilkAir-style awards and Star Alliance '
                'partner awards. It is often the best or only practical way to book Singapore Airlines long-haul premium '
                'cabin space.\n'
                '\n'
                'Award chart: Singapore uses zone-based Saver and Advantage pricing on Singapore-operated flights, with '
                'economy, premium economy, business, first, and Suites where offered. Saver awards are cheaper but '
                'capacity controlled; Advantage awards cost more but can be more available.\n'
                '\n'
                'Star Alliance partner rates: KrisFlyer has a separate Star Alliance partner chart. It can book partners '
                'such as United, Air Canada, Lufthansa, ANA, EVA, Turkish, TAP, Thai, and others where partner inventory '
                'exists.\n'
                '\n'
                'Fuel surcharges: Singapore generally does not add fuel surcharges on Singapore Airlines-operated awards, '
                'but it can pass carrier-imposed surcharges on some partner awards where the operating carrier imposes '
                'them.\n'
                '\n'
                'Sweet spots: Singapore fifth-freedom routes, Singapore premium cabins, and selected Star Alliance partner '
                'awards can be valuable. ANA and other partners may price better through ANA, Virgin, Aeroplan, or United '
                'depending on route and fees.\n'
                '\n'
                'Elite benefits: KrisFlyer Elite Silver and Elite Gold add Star Alliance Silver/Gold-style benefits and '
                'Singapore-specific perks, but they do not guarantee award seats. PPS Club is separate from basic '
                'KrisFlyer elite status.\n'
                '\n'
                'Transfer partners: Amex Membership Rewards, Capital One Miles, Citi ThankYou, and Chase Ultimate Rewards '
                'can feed KrisFlyer in many U.S. contexts, though some paths are indirect or slow. Transfer times are '
                'often not instant, so confirm award space and hold options if possible.',
     'summary': 'KrisFlyer is essential for Singapore Airlines premium space and has separate Singapore and Star Alliance '
                'charts. Transfers can be slow, so avoid speculative moves.'},

    {'id': 'program-rules-cathay-asia-miles',
     'title': 'Cathay Asia Miles Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'cathay', 'asia miles', 'oneworld', 'amex', 'first class'],
     'valid_as_of': '2026-Q2',
     'content': 'Cathay Asia Miles uses distance-based award pricing for Cathay Pacific and partner awards. It can be '
                'strong for Cathay Pacific premium cabins and certain Oneworld itineraries.\n'
                '\n'
                'Award chart: Asia Miles prices by distance band and cabin, with economy, premium economy, business, and '
                'first where offered. Multi-carrier Oneworld awards can have separate rules.\n'
                '\n'
                'Oneworld partner rates: Asia Miles can book Oneworld carriers such as American, British Airways, Iberia, '
                'Finnair, Japan Airlines, Qatar, Qantas, Malaysia Airlines, Royal Jordanian, Royal Air Maroc, SriLankan, '
                'and others where award space exists.\n'
                '\n'
                'Fuel surcharges: Asia Miles can pass carrier-imposed charges depending on operating carrier. '
                'Cathay-operated awards may have moderate fees, while BA-operated long-haul awards can be expensive.\n'
                '\n'
                'Cathay Pacific First Class sweet spot: Cathay First is one of the best first-class products, but space is '
                'scarce and route availability has changed. Use Asia Miles, Alaska/Atmos, American, BA Avios, or other '
                'partners depending on space and pricing.\n'
                '\n'
                'Transfer partners: Amex Membership Rewards transfers to Cathay Asia Miles. Capital One, Citi, Bilt, and '
                'Wells Fargo may also transfer depending on current partner rosters, but Amex was specifically requested.',
     'summary': 'Asia Miles is useful for Cathay and Oneworld awards, especially premium cabins, but distance bands and '
                'surcharges require live verification.'},

    {'id': 'program-rules-ana-mileage-club',
     'title': 'ANA Mileage Club Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'ana', 'mileage club', 'star alliance', 'round the world', 'virgin atlantic'],
     'valid_as_of': '2026-Q2',
     'content': 'ANA Mileage Club uses zone/season-based award charts and is one of the most powerful but rule-heavy Star '
                'Alliance programs. Many ANA awards require round-trip booking, especially international partner awards.\n'
                '\n'
                'Award chart: ANA publishes separate charts for ANA-operated awards, partner awards, and Round the World '
                'awards. Pricing varies by zone, season, and cabin. Cabins include economy, premium economy where '
                'available, business, and first.\n'
                '\n'
                'Partner rates: ANA can book Star Alliance partners such as United, Air Canada, Lufthansa Group, Turkish, '
                'EVA, Thai, Singapore, TAP, Air India, and others. Partner awards can carry fuel surcharges depending on '
                'operating carrier.\n'
                '\n'
                "ANA Business Class 'The Room': ANA's newest business class is an aspirational product, and ANA business "
                'awards are often discussed through Virgin Atlantic or United because those can be easier for U.S. users. '
                'Current Virgin pricing and access can change, so verify live.\n'
                '\n'
                'Round the World awards: ANA Round the World awards are distance-based and can be extremely valuable for '
                'complex premium-cabin itineraries, but they require careful routing, directionality, stopover, segment, '
                'and availability rules.\n'
                '\n'
                'Transfer from JAL miles: JAL Mileage Bank miles do not transfer to ANA Mileage Club. They are separate '
                'competing Japanese airline programs with no direct JAL-to-ANA conversion path.\n'
                '\n'
                'How to accumulate: Amex Membership Rewards transfers directly to ANA. A common U.S. strategy is also Amex '
                'MR to Virgin Atlantic to book ANA where space/pricing works, or using United/Aeroplan/LifeMiles for ANA '
                'space. Transfers to ANA can be slow, so avoid speculative transfers.',
     'summary': 'ANA is powerful for Star Alliance, ANA premium cabins, and Round the World awards, but it is rule-heavy '
                'and transfers can be slow. JAL miles do not transfer to ANA.'},

    {'id': 'program-rules-jal-mileage-bank',
     'title': 'JAL Mileage Bank Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'jal', 'japan airlines', 'mileage bank', 'oneworld', 'first class'],
     'valid_as_of': '2026-Q2',
     'content': 'JAL Mileage Bank uses distance/region-style award pricing for JAL-operated and partner awards, with '
                'separate charts and rules. U.S. users often book JAL through partner programs instead of earning JAL '
                'miles directly.\n'
                '\n'
                'Award chart: JAL publishes award charts for JAL international awards, domestic awards, partner awards, '
                'and Oneworld awards. Rates vary by distance/zone, cabin, and season/rules.\n'
                '\n'
                'Oneworld partner rates: JAL can book Oneworld partners such as American, British Airways, Cathay Pacific, '
                'Finnair, Iberia, Qatar, Qantas, Malaysia Airlines, Royal Jordanian, Royal Air Maroc, SriLankan, and '
                'others.\n'
                '\n'
                "JAL First Class Suites: JAL First is one of the world's best first-class redemptions, but award space is "
                'scarce. Rates and fees differ depending on whether booked through JAL, American AAdvantage, Alaska/Atmos, '
                'British Airways Avios, Cathay Asia Miles, or another partner.\n'
                '\n'
                'Best programs to book JAL: American AAdvantage, Alaska/Atmos, and British Airways Avios are common U.S. '
                'booking paths. AAdvantage and Alaska can be especially compelling when first/business saver space '
                'appears; BA Avios can work but may price by distance and segment.\n'
                '\n'
                'Transfer partners: direct U.S. bank transfer access to JAL Mileage Bank is limited. Many U.S. users '
                'accumulate JAL miles by flying JAL/Oneworld, using JAL co-branded options where available, or booking JAL '
                'through partner programs instead.',
     'summary': 'JAL Mileage Bank has charts, but U.S. users often book JAL through AA, Alaska/Atmos, or BA Avios. JAL '
                'First is excellent but scarce.'},

    {'id': 'program-rules-korean-air-skypass',
     'title': 'Korean Air SKYPASS Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'korean air', 'skypass', 'skyteam', 'morning calm'],
     'valid_as_of': '2026-Q2',
     'content': 'Korean Air SKYPASS uses award charts for Korean-operated and partner awards, but earning options for U.S. '
                'users are more limited than when Chase was a transfer partner.\n'
                '\n'
                'Award chart: SKYPASS publishes zone/season-based rates for Korean Air awards and partner awards. Peak '
                'dates can cost more than off-peak dates. Cabins include economy, prestige/business, and first where '
                'offered.\n'
                '\n'
                'SkyTeam partner rates: Korean can book SkyTeam partners such as Delta, Air France, KLM, Virgin Atlantic, '
                'China Airlines, Vietnam Airlines, Saudia, and others where partner inventory exists. Partner award rules '
                'can be stricter than Korean-operated awards.\n'
                '\n'
                'Sweet spots: Korean Air Prestige/business and first class can be excellent, especially transpacific. '
                'Availability, family-registration rules, and peak pricing matter.\n'
                '\n'
                'SKYPASS Prestige and Morning Calm: Morning Calm, Morning Calm Premium, and Million Miler are elite tiers. '
                "Prestige is Korean's business-class cabin branding. Elite status can affect benefits but does not "
                'guarantee award space.\n'
                '\n'
                'Chase UR path: Chase Ultimate Rewards used to transfer to Korean Air, but that partnership ended years '
                'ago and should be treated as historical, not current. If the checklist asks for Chase UR to Korean Air, '
                'mark it as no longer a current standard path.',
     'summary': 'Korean SKYPASS has useful charts and premium cabins, but Chase transfers are historical, not current. '
                'Treat Korean earning as more limited for U.S. users.'},

    {'id': 'program-rules-asiana-club',
     'title': 'Asiana Club Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'asiana', 'asiana club', 'star alliance'],
     'valid_as_of': '2026-Q2',
     'content': 'Asiana Club uses award charts for Asiana-operated and Star Alliance partner awards. The program can be '
                'valuable but has booking friction and uncertainty due to Korean Air/Asiana integration developments.\n'
                '\n'
                'Award chart: Asiana publishes region/cabin-based rates for Asiana and Star Alliance awards. Cabins '
                'include economy, business, and first where offered.\n'
                '\n'
                'Star Alliance rates: Asiana Club can book Star Alliance partners such as United, Air Canada, Lufthansa '
                'Group, ANA, EVA, Turkish, Thai, Singapore, TAP, and others where partner availability exists.\n'
                '\n'
                'Business class sweet spots: Asiana business class has historically been underrated, with good service and '
                'reasonable award pricing. Partner business awards can also be attractive if fuel surcharges are '
                'acceptable.\n'
                '\n'
                'Award processing quirks: bookings can involve phone handling, strict routing rules, family-member '
                'registration, fees, and partner availability limitations. Verify current booking procedures before '
                'recommending Asiana as the easiest path.',
     'summary': 'Asiana Club can be valuable for Star Alliance business awards, but booking friction and merger-related '
                'uncertainty make live verification important.'},

    {'id': 'program-rules-eva-infinity-mileagelands',
     'title': 'EVA Air Infinity MileageLands Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'eva', 'infinity mileagelands', 'star alliance', 'capital one', 'citi'],
     'valid_as_of': '2026-Q2',
     'content': "EVA Air Infinity MileageLands uses award charts for EVA-operated and Star Alliance partner awards. EVA's "
                'Royal Laurel business class is a strong transpacific product.\n'
                '\n'
                'Award chart: EVA publishes zone/cabin charts for EVA awards and Star Alliance awards. Cabins include '
                'economy, premium economy where available, business/Royal Laurel, and first only where partner/aircraft '
                'permits.\n'
                '\n'
                'Star Alliance partner rates: EVA miles can book Star Alliance partners such as United, Air Canada, ANA, '
                'Singapore, Thai, Turkish, Lufthansa Group, TAP, and others where saver space exists.\n'
                '\n'
                'Royal Laurel business class: EVA Royal Laurel is one of the best business-class products across the '
                'Pacific. Award rates vary by route/zone and should be checked live; availability can be better through '
                'EVA for its own members than through partners in some cases.\n'
                '\n'
                'Transfer partners: Capital One transfers to EVA at 2:1.5, meaning 1,000 Capital One miles becomes 750 EVA '
                'miles. Citi ThankYou may transfer to EVA for eligible accounts. Because the Capital One ratio is not 1:1, '
                'Zoe should compare against Aeroplan, United, LifeMiles, or Singapore before recommending EVA transfers.',
     'summary': 'EVA has a strong business-class product and Star Alliance chart, but Capital One transfers at 2:1.5, so '
                'compare alternatives before moving points.'},

    {'id': 'program-rules-thai-royal-orchid-plus',
     'title': 'Thai Royal Orchid Plus Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'thai', 'royal orchid plus', 'star alliance'],
     'valid_as_of': '2026-Q2',
     'content': 'Thai Royal Orchid Plus uses award charts for Thai-operated and Star Alliance partner awards. It is niche '
                'for U.S. users because earning transferable points into Thai can be difficult.\n'
                '\n'
                'Award chart: Thai publishes zone/cabin award charts. Cabins include economy, business/Royal Silk, and '
                'first/Royal First where offered.\n'
                '\n'
                'Star Alliance partner rates: Thai miles can book Star Alliance partners such as United, Air Canada, '
                'Lufthansa Group, ANA, EVA, Singapore, Turkish, TAP, and others where partner award space exists.\n'
                '\n'
                'Sweet spots: Thai First Class was historically famous partly because of the Bangkok ground experience and '
                'spa services, but product/route availability has changed. Do not promise the spa or first-class product '
                'on a route without checking current operations.\n'
                '\n'
                'Accumulation challenges: U.S. travelers generally have fewer easy ways to earn Thai miles. It is often '
                'easier to book Thai or Star Alliance flights using Aeroplan, United, LifeMiles, Singapore, ANA, or '
                'Turkish than to accumulate Royal Orchid Plus miles directly.',
     'summary': 'Thai Royal Orchid Plus is niche for U.S. users. Thai First/Royal Silk can be interesting, but earning and '
                'current product availability are the constraints.'},

    {'id': 'program-rules-qantas-frequent-flyer',
     'title': 'Qantas Frequent Flyer Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'qantas', 'frequent flyer', 'oneworld', 'classic rewards', 'classic plus', 'points club'],
     'valid_as_of': '2026-Q2',
     'content': 'Qantas Frequent Flyer has several redemption types, most importantly Classic Flight Rewards and Classic '
                'Plus Flight Rewards. Classic Flight Rewards are the traditional award-seat product; Classic Plus is more '
                'dynamically tied to commercial availability and can cost more points.\n'
                '\n'
                'Award chart: Qantas uses distance-based pricing tables for Classic Flight Rewards by cabin, including '
                'economy, premium economy, business, and first where offered. Multi-segment itineraries price by distance '
                'bands and carrier/routing rules.\n'
                '\n'
                'Oneworld and partner rates: Qantas points can book Qantas, Jetstar, Oneworld partners such as American, '
                'British Airways, Cathay Pacific, Finnair, Iberia, Japan Airlines, Qatar, Malaysia, Royal Jordanian, Royal '
                'Air Maroc, SriLankan, and partners such as Emirates and others depending on current agreements.\n'
                '\n'
                'Fuel surcharges: Qantas passes carrier charges on many Qantas and partner awards, and BA/Emirates-style '
                'awards can have high cash components. Always compare taxes/fees.\n'
                '\n'
                'Sweet spots: Qantas and partner business/first class can be valuable when Classic Reward seats exist, but '
                'premium cabin space on Qantas is notoriously scarce. Partner short/medium-haul and intra-region awards '
                'can be better value.\n'
                '\n'
                'Transfer partners: Amex Membership Rewards and Capital One can transfer to Qantas in many U.S. contexts. '
                'Other bank routes may vary.\n'
                '\n'
                'Points Club and Points Club Plus: these tiers recognize members who earn large quantities of Qantas '
                'points on the ground. They can provide benefits such as status-credit earning on rewards or lounge offers '
                'depending on current tier rules, but they do not guarantee Classic Reward availability.',
     'summary': 'Qantas has Classic Flight Rewards with distance bands and newer Classic Plus pricing. Great when premium '
                'Classic space exists, but fees and scarcity are real.'},

    {'id': 'program-rules-virgin-australia-velocity',
     'title': 'Virgin Australia Velocity Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'virgin australia', 'velocity', 'business class'],
     'valid_as_of': '2026-Q2',
     'content': 'Virgin Australia Velocity uses points for Virgin Australia and partner redemptions. For U.S. users it is '
                'less central than Virgin Atlantic Flying Club, but it can matter for Australia-region travel.\n'
                '\n'
                'Award chart: Velocity publishes reward seat pricing by route/distance/cabin for Virgin Australia-operated '
                'flights and partners. Cabins include economy and business where offered.\n'
                '\n'
                'Partner rates: Velocity partners can include international airlines such as United, Qatar, Singapore, '
                'Etihad, ANA, Air Canada, Hawaiian/others depending on current partnerships, but partner access changes '
                'and should be verified live.\n'
                '\n'
                'Transfer partners: U.S. access to Velocity can be limited. Amex Membership Rewards access is '
                'market-dependent and may not be available for U.S. Membership Rewards the same way it is in Australia. Do '
                'not assume a U.S. Amex user can transfer directly.\n'
                '\n'
                'Business class on partners: partner business-class awards can be valuable when Velocity has access, '
                'especially within or to/from Australia. Compare taxes/fees and partner availability before recommending.',
     'summary': 'Velocity is mainly useful for Australia-region and partner awards, but U.S. transfer access is limited '
                'and must be verified.'},

    {'id': 'program-rules-air-new-zealand-airpoints',
     'title': 'Air New Zealand Airpoints Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'air new zealand', 'airpoints', 'star alliance', 'airpoints dollars'],
     'valid_as_of': '2026-Q2',
     'content': 'Air New Zealand Airpoints is different from mileage programs because it uses Airpoints Dollars, a '
                'cash-like loyalty currency. One Airpoints Dollar generally functions like one New Zealand dollar toward '
                'eligible Air New Zealand travel.\n'
                '\n'
                'Airpoints Dollar model: because Airpoints is cash-like, redemptions do not usually create the same '
                'outsized award-chart value as fixed mileage programs. Zoe should evaluate Airpoints more like travel '
                'credit than like Aeroplan or LifeMiles.\n'
                '\n'
                'Redemption for premium cabins: Airpoints can be used toward premium cabin fares when available, but the '
                'cost tends to track cash pricing. This can be simple but not necessarily high CPP.\n'
                '\n'
                'Star Alliance access: Air New Zealand is a Star Alliance member, but Airpoints redemption mechanics '
                'differ from traditional Star Alliance mileage charts. U.S. users often get better value booking Air New '
                'Zealand space through partners like United, Aeroplan, or LifeMiles when saver inventory exists.\n'
                '\n'
                'Strategic guidance: use Airpoints when the user already has Airpoints Dollars or wants simplicity on Air '
                'New Zealand. For transferable bank points, compare Aeroplan/United/LifeMiles/Singapore before trying to '
                'build an Airpoints strategy.',
     'summary': 'Air New Zealand Airpoints is cash-like, not a classic miles chart. Treat it like travel credit and '
                'compare partner programs for saver awards.'},

    {'id': 'program-rules-latam-pass',
     'title': 'LATAM Pass Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'latam', 'latam pass', 'south america'],
     'valid_as_of': '2026-Q2',
     'content': "LATAM Pass is LATAM's loyalty program. It is relevant for South America travel but less accessible from "
                'U.S. bank currencies than major transfer programs.\n'
                '\n'
                'Award chart: LATAM Pass award pricing can vary by route, region, cabin, demand, and partner. The program '
                'has changed charts and partnerships over time, so live pricing is required.\n'
                '\n'
                'Oneworld and partner rates: LATAM left Oneworld, but maintains selected partnerships. Users may still '
                'book LATAM through programs such as Delta, Alaska/Atmos, British Airways/Iberia Avios, or other partners '
                'depending on route and inventory.\n'
                '\n'
                'Accumulation strategies from the U.S.: U.S. users usually accumulate LATAM Pass miles by flying LATAM, '
                'using LATAM co-branded or partner earning channels where available, Marriott-style transfers, or booking '
                'LATAM flights through other partner programs instead.\n'
                '\n'
                'Strategic guidance: for South America, compare LATAM Pass against Delta SkyMiles, Alaska/Atmos, Avios, '
                'American partners where relevant, cash fares, and Avianca LifeMiles/Copa for Star Alliance alternatives.',
     'summary': 'LATAM Pass matters for South America, but U.S. users often book LATAM through partners or use cash '
                'because direct bank feed-in is limited.'},

    {'id': 'program-rules-avianca-lifemiles',
     'title': 'Avianca LifeMiles Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'avianca', 'lifemiles', 'star alliance', 'amex', 'capital one', 'citi'],
     'valid_as_of': '2026-Q2',
     'content': 'Avianca LifeMiles is a Star Alliance loyalty program known for no fuel surcharges, frequent mileage '
                'sales, and useful premium-cabin sweet spots.\n'
                '\n'
                'Award chart: LifeMiles uses region/zone-based pricing with quirks and occasional mixed-cabin pricing '
                'behavior. Common U.S.-Europe business class awards have historically priced around 63,000 miles one-way, '
                'with economy lower and first higher where available. Exact pricing can vary by route and LifeMiles IT.\n'
                '\n'
                'Star Alliance partner rates: LifeMiles can book Star Alliance partners including United, Air Canada, '
                'Lufthansa Group, Turkish, ANA, EVA, Thai, TAP, Singapore where released, and others. The website may not '
                'show every itinerary that other Star Alliance programs can see.\n'
                '\n'
                'Sweet spots: business class to Europe and South America are common LifeMiles strengths. LifeMiles can '
                'also be useful for domestic United awards and transpacific Star Alliance awards when pricing and space '
                'align.\n'
                '\n'
                'No fuel surcharges: LifeMiles generally does not pass carrier-imposed fuel surcharges on most partner '
                'awards. Users still pay taxes and LifeMiles fees.\n'
                '\n'
                'Transfer partners: Amex Membership Rewards, Capital One Miles, and Citi ThankYou transfer to LifeMiles '
                'for eligible accounts. Bilt and Wells Fargo may also be available depending on current partner roster.\n'
                '\n'
                'Flash sales: LifeMiles regularly sells miles with bonuses or runs redemption promotions. Buying miles can '
                'make sense only when award space is verified and the all-in cost beats cash/other miles.',
     'summary': 'LifeMiles is valuable for Star Alliance awards because it often avoids fuel surcharges and has good '
                'Europe/South America business-class pricing. Watch IT quirks and verify space first.'},

    {'id': 'program-rules-copa-connectmiles',
     'title': 'Copa ConnectMiles Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'copa', 'connectmiles', 'star alliance', 'panama'],
     'valid_as_of': '2026-Q2',
     'content': "Copa ConnectMiles is Copa Airlines' Star Alliance program. It is most relevant for travel via Panama City "
                'and Latin America.\n'
                '\n'
                'Award chart: ConnectMiles uses award-chart style pricing for Copa and Star Alliance partner awards. Rates '
                'vary by region, cabin, and partner.\n'
                '\n'
                'Star Alliance partner rates: ConnectMiles can book Star Alliance partners such as United, Air Canada, '
                'Lufthansa Group, Avianca, Turkish, TAP, ANA, EVA, and others where saver space exists.\n'
                '\n'
                "Panama City hub: Copa's Panama City hub is useful for Central America, South America, and Caribbean "
                'connectivity. For routes to secondary Latin American cities, Copa can offer efficient one-stop '
                'itineraries that U.S. carriers may not.\n'
                '\n'
                'Strategic guidance: compare ConnectMiles with LifeMiles, United, Aeroplan, and cash fares. ConnectMiles '
                'can be useful if the user flies Copa often or has a route where Copa availability is good.',
     'summary': 'ConnectMiles is a Copa/Panama-focused Star Alliance program. It can be useful for Latin America, but '
                'compare it against LifeMiles, United, and Aeroplan.'},

    {'id': 'program-rules-tap-miles-and-go',
     'title': 'TAP Miles&Go Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'tap', 'miles&go', 'star alliance', 'capital one', 'citi'],
     'valid_as_of': '2026-Q2',
     'content': "TAP Miles&Go is TAP Air Portugal's Star Alliance program. The checklist mentions Avios, but TAP Miles&Go "
                'is not part of the Avios ecosystem; it is a separate Star Alliance mileage program.\n'
                '\n'
                'Award chart: TAP publishes award pricing for TAP-operated and partner awards. Rates vary by region, '
                'cabin, and whether the flight is TAP or partner-operated.\n'
                '\n'
                'Star Alliance partner rates: TAP miles can book Star Alliance partners such as United, Air Canada, '
                'Lufthansa Group, Turkish, ANA, EVA, Singapore, Thai, and others where saver space exists.\n'
                '\n'
                'Avios clarification: TAP is not an Avios program. Do not tell users TAP points pool with '
                'BA/Iberia/Qatar/Finnair Avios.\n'
                '\n'
                'Transfer partners: Capital One and Citi can transfer to TAP Miles&Go for eligible users. Other transfer '
                'paths may vary by market.\n'
                '\n'
                'Strategic guidance: TAP is useful for Portugal/Europe-focused travelers and occasional Star Alliance '
                'opportunities, but Aeroplan, LifeMiles, United, Turkish, and ANA may be better for many U.S. users.',
     'summary': 'TAP Miles&Go is Star Alliance, not Avios. Capital One and Citi can feed it, but compare against stronger '
                'Star Alliance programs.'},

    {'id': 'program-rules-sas-eurobonus',
     'title': 'SAS EuroBonus Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'sas', 'eurobonus', 'skyteam', 'amex'],
     'valid_as_of': '2026-Q2',
     'content': 'SAS EuroBonus has moved from Star Alliance context to SkyTeam context after SAS changed alliance '
                'membership. Zoe must not describe current SAS as a Star Alliance partner program without checking the '
                'date.\n'
                '\n'
                'Award chart: EuroBonus uses award-chart style pricing for SAS and partner awards, with region/cabin '
                'rules. Rates and partners changed with the alliance shift.\n'
                '\n'
                "Partner rates: current partner award access should be evaluated under SAS's current alliance and partner "
                'table. Historical Star Alliance partner rates are no longer safe as current guidance.\n'
                '\n'
                'Amex feed-in: Amex feed-in is limited for U.S. users and more relevant in Nordic/European markets. Do not '
                'assume U.S. Amex Membership Rewards transfers directly to SAS EuroBonus.\n'
                '\n'
                'Strategic guidance: SAS is useful for Nordic travelers and specific partner availability. For U.S. users, '
                'Flying Blue, Delta, Virgin Atlantic, or other SkyTeam-related currencies may be easier to earn.',
     'summary': 'SAS EuroBonus is update-sensitive because SAS changed alliance context. Do not use old Star Alliance '
                'assumptions for current bookings.'},

    {'id': 'program-rules-finnair-plus',
     'title': 'Finnair Plus Avios Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'finnair', 'finnair plus', 'avios', 'oneworld'],
     'valid_as_of': '2026-Q2',
     'content': 'Finnair Plus now uses Avios, tying it into the broader Avios ecosystem with British Airways, Iberia, Aer '
                'Lingus, Qatar, and others.\n'
                '\n'
                'Award chart: Finnair Plus uses Avios pricing for Finnair-operated and partner awards. Rates vary by '
                'route, cabin, and partner.\n'
                '\n'
                'Oneworld partner rates: Finnair Plus can book Oneworld partners such as American, British Airways, Cathay '
                'Pacific, Iberia, Japan Airlines, Qantas, Qatar, Royal Jordanian, Royal Air Maroc, SriLankan, and others '
                'where space exists.\n'
                '\n'
                'Nordic/Europe sweet spots: Finnair can be useful for routing between North America and '
                'Helsinki/Nordics/Baltics/Europe, especially when fees and availability beat BA. Avios ecosystem transfers '
                'can make Finnair easy to access.\n'
                '\n'
                'Strategic guidance: compare Finnair Plus pricing to BA Avios, Iberia Plus, Qatar Privilege Club, American '
                'AAdvantage, and Alaska/Atmos for the same Oneworld space.',
     'summary': 'Finnair Plus is an Avios/Oneworld program. It is useful for Nordic routing and can be accessed through '
                'the Avios ecosystem.'},

    {'id': 'program-rules-air-india-flying-returns',
     'title': 'Air India Flying Returns Award Chart and Program Rules',
     'category': 'program_rules',
     'tags': ['airline program', 'air india', 'flying returns', 'star alliance'],
     'valid_as_of': '2026-Q2',
     'content': "Air India Flying Returns is Air India's loyalty program and participates in Star Alliance. It is relevant "
                'for India travel but can be less practical for U.S. transferable-points users than Aeroplan, United, '
                'LifeMiles, or Singapore.\n'
                '\n'
                'Award chart: Flying Returns uses published award rules for Air India-operated flights and partner awards. '
                'Rates vary by distance/zone, cabin, and partner rules.\n'
                '\n'
                'Star Alliance partner rates: Flying Returns can access Star Alliance partners where award space exists, '
                'including United, Air Canada, Lufthansa Group, Turkish, Singapore, Thai, ANA, EVA, and others. '
                'Availability and booking flow should be verified live.\n'
                '\n'
                'Accumulation challenges: U.S. users generally have limited direct bank transfer paths into Flying '
                'Returns. Many users are better off booking Air India or India-bound Star Alliance space using Aeroplan, '
                'United, LifeMiles, Singapore, or Turkish.\n'
                '\n'
                'Strategic guidance: use Flying Returns when the user already has Air India points, flies Air India '
                'frequently, or has an India-specific earning path. Otherwise compare transferable currencies first.',
     'summary': 'Flying Returns is Star Alliance and relevant for India, but U.S. earning paths are limited, so partner '
                'programs may be easier.'},

    {'id': 'program-rules-world-of-hyatt',
     'title': 'World of Hyatt Award Chart and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'hyatt', 'world of hyatt', 'chase', 'bilt', 'globalist'],
     'valid_as_of': '2026-Q2',
     'content': 'World of Hyatt remains the strongest major hotel transfer partner for many U.S. users because it keeps an '
                'award chart and Chase/Bilt transfer 1:1.\n'
                '\n'
                'Category chart: standard rooms in Categories 1-8 price as follows: Category 1 = 3,500 off-peak / 5,000 '
                'standard / 6,500 peak; Category 2 = 6,500 / 8,000 / 9,500; Category 3 = 9,000 / 12,000 / 15,000; Category '
                '4 = 12,000 / 15,000 / 18,000; Category 5 = 17,000 / 20,000 / 23,000; Category 6 = 21,000 / 25,000 / '
                '29,000; Category 7 = 25,000 / 30,000 / 35,000; Category 8 = 35,000 / 40,000 / 45,000. Hyatt has also '
                'added expanded high-end award categories/levels for select properties and all-inclusive charts, so check '
                'live pricing.\n'
                '\n'
                "SLH note: the checklist says Cat 1-8 + SLH, but Hyatt's old Small Luxury Hotels partnership ended and "
                'many luxury independent properties moved/changed, including Mr & Mrs Smith-style integration. Do not '
                'promise SLH availability as a current Hyatt feature without checking.\n'
                '\n'
                'Why Chase UR to Hyatt is best: Chase transfers 1:1 to Hyatt and Hyatt points commonly redeem for more '
                'than 1.5-2+ cents per point at expensive hotels, making it one of the best hotel transfers in the '
                'market.\n'
                '\n'
                'Bilt to Hyatt: Bilt also transfers 1:1 to Hyatt and is equally strong when the user has Bilt points.\n'
                '\n'
                'Peak/off-peak/standard: Hyatt uses off-peak, standard, and peak pricing within each category, though new '
                'high-demand/luxury structures may add additional levels for some properties. Always check live hotel '
                'dates.\n'
                '\n'
                'Elite benefits: Discoverist gets entry-level perks; Explorist gets stronger upgrade/check-in benefits; '
                'Globalist is the top tier with breakfast/lounge access, waived resort fees on eligible stays, better '
                'upgrades, Guest of Honor, and other benefits under current rules.\n'
                '\n'
                'Point sharing: Hyatt allows members to combine/share points with another member under Hyatt rules, '
                "generally using Hyatt's point-combining form and restrictions. Do not describe it as unlimited instant "
                'pooling.\n'
                '\n'
                'Amex MR to Hyatt: Amex Membership Rewards does not transfer directly to Hyatt in the U.S. There is no '
                'clean direct workaround; users should use Chase or Bilt for Hyatt or book through Amex Travel/cash if '
                'they only have MR.',
     'summary': 'Hyatt is the best hotel transfer for Chase and Bilt users because it has a chart and strong redemption '
                'values. Amex does not transfer directly to Hyatt.'},

    {'id': 'program-rules-marriott-bonvoy',
     'title': 'Marriott Bonvoy Award and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'marriott', 'bonvoy', 'dynamic pricing', 'airline transfer'],
     'valid_as_of': '2026-Q2',
     'content': 'Marriott Bonvoy uses dynamic award pricing and no longer has a fixed category chart for standard hotel '
                'awards. Award costs vary by hotel, date, demand, and cash price.\n'
                '\n'
                'Dynamic pricing: because there is no fixed chart, Zoe should compare the live Marriott points price plus '
                'resort fees/taxes to the cash price. Marriott can still be valuable, but the old category 1-8 chart '
                'should not be used for current pricing.\n'
                '\n'
                'Amex MR to Marriott: Amex transfers to Marriott at 1:1, but this is almost never a strong use because '
                'Marriott points are usually worth less than Membership Rewards points and Marriott pricing is dynamic. '
                'Transfer only for a specific high-value stay or to top off a small balance.\n'
                '\n'
                'When Marriott points have value: low-category legacy-style properties, PointSavers rates, expensive cash '
                'nights, fifth-night-free award stays for eligible redemptions, and luxury redemptions can still produce '
                'good value.\n'
                '\n'
                'Status benefits: Silver, Gold, Platinum, Titanium, and Ambassador benefits can affect late checkout, '
                'upgrades, breakfast/lounge access, welcome gifts, and fees. Platinum and above matter most for award '
                'stays.\n'
                '\n'
                'Airline transfers: Marriott transfers to many airlines, usually at 3:1. For every 60,000 Marriott points '
                'transferred, Marriott adds 5,000 bonus miles with many programs, making 60,000 Marriott points often '
                'become 25,000 airline miles. United can receive a larger bonus under the RewardsPlus relationship. This '
                'can make sense for rare airline top-offs but is usually not better than direct bank transfers.',
     'summary': 'Marriott is dynamic, so transfers from Amex/Chase at 1:1 are usually weak. Airline transfers are usually '
                '3:1 with a 5k bonus per 60k points, useful mainly for top-offs.'},

    {'id': 'program-rules-hilton-honors',
     'title': 'Hilton Honors Award and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'hilton', 'honors', 'amex', 'fifth night free'],
     'valid_as_of': '2026-Q2',
     'content': 'Hilton Honors uses dynamic pricing for most award nights, with points prices generally tied to property '
                'category behavior, demand, and cash rates. Hilton no longer uses a simple public fixed award chart for '
                'all hotels.\n'
                '\n'
                'Dynamic pricing: Zoe should compare live Hilton points price to cash price and account for resort fees, '
                'taxes, and elite benefits. Premium room rewards can be extremely poor value compared with standard room '
                'rewards.\n'
                '\n'
                'Amex MR to Hilton: Amex transfers to Hilton at 1:2. This is one of the few hotel transfer ratios that can '
                'make sense because one Amex point becomes two Hilton points. Still, transfer only after confirming the '
                'award stay because Hilton pricing is dynamic.\n'
                '\n'
                'Fifth night free: Hilton elite members receive the fifth night free on standard room reward stays of 5+ '
                "nights, subject to Hilton rules. The checklist says 'with Hilton Aspire card,' but the benefit is tied to "
                'Silver/Gold/Diamond elite status; the Aspire card grants top-tier status, which unlocks it.\n'
                '\n'
                'When Hilton points have value: high-cash-rate standard rooms, five-night stays using fifth-night-free, '
                'resort/luxury redemptions with waived resort fees on awards where applicable, and Amex transfer bonuses '
                'can make Hilton attractive. Avoid transferring for poor premium-room pricing.',
     'summary': 'Hilton is dynamic, but Amex to Hilton at 1:2 can work for standard room awards, especially 5-night stays '
                'with elite fifth-night-free.'},

    {'id': 'program-rules-ihg-one-rewards',
     'title': 'IHG One Rewards Award and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'ihg', 'one rewards', 'chase', 'fourth night free'],
     'valid_as_of': '2026-Q2',
     'content': 'IHG One Rewards uses dynamic award pricing. Award prices vary by hotel, date, demand, cash rate, and '
                'promotion.\n'
                '\n'
                'Dynamic pricing: there is no stable fixed award chart. Zoe should compare live points price to cash price '
                'and consider taxes, resort/destination fees, and elite benefits.\n'
                '\n'
                'Fourth night free: eligible IHG co-branded cardholders can receive the fourth night free on award stays '
                'of four or more consecutive nights, subject to card and program rules. This can materially improve '
                'value.\n'
                '\n'
                'Chase to IHG: Chase Ultimate Rewards transfers to IHG at 1:1, but this is usually poor value compared '
                'with Chase to Hyatt because IHG points are generally worth much less than Chase points. Transfer only to '
                'top off or for a specific high-value award, especially with fourth-night-free.\n'
                '\n'
                'When IHG points make sense: discounted award pricing, fourth-night-free cardholder stays, high-cash-rate '
                'hotels, Kimpton/InterContinental redemptions, and purchased-point promotions can work. Avoid blanket '
                'Chase-to-IHG recommendations.',
     'summary': 'IHG is dynamic and Chase transfers 1:1, but Hyatt is usually far better. IHG is strongest for cardholders '
                'using the fourth-night-free benefit.'},

    {'id': 'program-rules-wyndham-rewards',
     'title': 'Wyndham Rewards Award and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'wyndham', 'capital one', 'bilt', 'citi', 'flat rate'],
     'valid_as_of': '2026-Q2',
     'content': 'Wyndham Rewards is more fixed-tier than many hotel programs, making it surprisingly useful in specific '
                'cases.\n'
                '\n'
                'Flat-rate pricing model: many Wyndham awards price in simple tiers such as 7,500, 15,000, or 30,000 '
                'points per bedroom/night, though property type, cash+points, vacation rentals, taxes/fees, and exclusions '
                'can affect final cost. This consistency can create outsized value when cash rates are high.\n'
                '\n'
                'Transfer partners: Capital One, Bilt, Citi, and Wells Fargo/other partners may transfer to Wyndham '
                'depending on current roster. Ratios are often 1:1 for eligible accounts, but confirm live.\n'
                '\n'
                'When Wyndham makes sense: Vacasa-style vacation rentals, expensive Wyndham properties in high-demand '
                'areas, road-trip hotels, and redemptions where the fixed tier beats cash. It is weaker when cash rates '
                'are low or property quality is inconsistent.',
     'summary': 'Wyndham can be surprisingly strong because many awards use fixed tiers. Capital One, Bilt, Citi, and '
                'other bank paths may feed it.'},

    {'id': 'program-rules-choice-privileges',
     'title': 'Choice Privileges Award and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'choice', 'amex', 'capital one', 'citi'],
     'valid_as_of': '2026-Q2',
     'content': 'Choice Privileges can be valuable in specific markets but is not usually a first-choice hotel transfer '
                'for broad luxury travel.\n'
                '\n'
                'Amex MR to Choice: Amex transfers to Choice at 1:1 in the requested checklist. Depending on market and '
                'current Amex rules, Choice transfer ratios can vary, so verify live. Capital One, Citi, and Wells Fargo '
                'may also transfer to Choice under current partner lists.\n'
                '\n'
                'Value profile: Choice can be useful for Nordic hotels, Japan, Europe, roadside stays, and specific '
                'high-cash-rate properties. It is often limited value in markets where Choice properties are inexpensive '
                'in cash or award availability/rules are restrictive.\n'
                '\n'
                'Recommendation rule: use Choice when there is a specific property with favorable live pricing. Do not '
                'recommend speculative transfers because Choice points can be harder to use at high value than Hyatt or '
                'strong airline partners.',
     'summary': 'Choice is situational. Transfer only for a specific property where live points pricing beats cash.'},

    {'id': 'program-rules-radisson-rewards',
     'title': 'Radisson Rewards Award and Transfer Rules',
     'category': 'program_rules',
     'tags': ['hotel program', 'radisson', 'amex', 'limited use'],
     'valid_as_of': '2026-Q2',
     'content': 'Radisson Rewards has become a limited-use program for many U.S. travelers because the global Radisson '
                'ecosystem and Americas footprint changed over time.\n'
                '\n'
                'Amex MR to Radisson: the checklist requests Amex MR to Radisson, but U.S. Membership Rewards transfer '
                'access to Radisson depends on current Amex partner availability and region. Verify live before '
                'recommending.\n'
                '\n'
                'Limited use cases: Radisson can make sense for specific international properties, Europe-focused travel, '
                'or users who already hold Radisson points. It is not usually a top transfer target compared with Hyatt, '
                'airline partners, or Hilton during strong 1:2/bonus opportunities.\n'
                '\n'
                'Recommendation rule: do not recommend moving flexible bank points to Radisson speculatively. Only '
                'transfer when the exact property, dates, award price, and cancellation rules are confirmed.',
     'summary': 'Radisson is niche and region-dependent. Verify live Amex transfer availability and use only for a '
                'specific confirmed property.'},

]
