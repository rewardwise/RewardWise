"""
rag/kb/historical_patterns.py
───────────────────────────────
KB articles for historical pricing and availability patterns:
  - When award space typically opens on popular routes
  - Seasonal pricing trends
  - Best months to fly specific routes on points
  - Award calendar patterns (when airlines release more space)
  - Booking windows by airline and route type

CATEGORY: historical_patterns

DATA STATUS: Complete baseline coverage for the uploaded historical_patterns checklist.
All cash ranges are directional historical planning bands, not live fares.
Live platform search data should override these patterns whenever available.

DATA SOURCES:
  - Platform search data as it accumulates
  - Airline award calendar rules and public booking-window guidance
  - Award availability monitoring tools and community reports
  - Historical airfare and seasonality patterns

UPDATE CADENCE:
  - Bi-annually for seasonal patterns
  - Quarterly once platform-derived route and award-search data accumulates
  - Immediately when a loyalty program changes booking windows, award access, or status rules
"""

from __future__ import annotations

HISTORICAL_PATTERNS_KB: list[dict] = [
    {'id': 'award-release-united-mileageplus',
     'title': 'United MileagePlus Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'United',
              'MileagePlus',
              'award release',
              'Star Alliance',
              'close-in'],
     'valid_as_of': '2026-Q2',
     'content': 'United normally sells and displays its own award flights when its schedule opens, roughly 330 '
                'to 337 days before departure. United no longer has a simple fixed saver-award calendar for its '
                'own flights, so the presence of a flight at schedule open does not mean saver inventory will be '
                'available.\n'
                "Partner availability through MileagePlus is controlled by the operating partner and by United's "
                'display/access rules. For Star Alliance awards, users should check when the partner opens '
                "space, then remember United may not be able to book until United's own calendar is open.\n"
                'Close-in behavior is important: United and Star Alliance partners can release saver or '
                'partner-accessible seats inside 30 days, especially 21 to 7 days before departure, when unsold '
                'premium seats are less likely to sell for cash. This is not guaranteed and varies by route.\n'
                'Zoe should advise: book peak international premium cabins as soon as useful space appears, but '
                'keep checking at 60, 30, 14, and 7 days out. For flexible users, close-in Star Alliance space '
                'can be better than the 11-month mark.',
     'summary': 'United opens award booking roughly 330-337 days out, but saver/partner space is dynamic. '
                'Close-in checks inside 30 days are worth it, especially for Star Alliance premium cabins.'},

    {'id': 'award-release-delta-skymiles',
     'title': 'Delta SkyMiles Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Delta',
              'SkyMiles',
              'award release',
              'dynamic pricing'],
     'valid_as_of': '2026-Q2',
     'content': 'Delta usually makes its own schedule bookable roughly 331 days before departure, but SkyMiles '
                'uses dynamic award pricing rather than a reliable saver chart. There is no dependable moment '
                'when low-level award space appears across the network.\n'
                'Own-metal timing patterns are price-driven: awards often price high on peak dates, hub-to-hub '
                'business routes, holidays, and last-minute flights, but can dip during fare sales or low-demand '
                "periods. Delta's cardholder TakeOff 15 discount can change the practical break-even for "
                'eligible Delta-operated awards.\n'
                'Partner space is separate and can be limited, especially for premium cabins. Korean Air, Air '
                'France/KLM, Virgin Atlantic, and other partners may expose space to Delta differently than to '
                'their own members.\n'
                'Zoe should advise: treat Delta awards like cash fares. Watch for flash sales, compare '
                'cents-per-point, and do not assume booking at calendar open is best.',
     'summary': 'Delta awards are dynamic, so timing matters less than price monitoring. Calendar-open searches '
                'help for planning, but sales and off-peak dips often matter more.'},

    {'id': 'award-release-american-aadvantage',
     'title': 'American AAdvantage Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'American',
              'AAdvantage',
              'award release',
              'Oneworld',
              'partner availability'],
     'valid_as_of': '2026-Q2',
     'content': 'American publishes flights up to about 331 days before departure on aa.com and the American '
                'app. AAdvantage award pricing on American-operated flights is dynamic, so the calendar opening '
                'does not guarantee low awards.\n'
                'The checklist mentions elite-first release. In practice, American does not publish a clean '
                'public rule that all award seats release to elites before the public; elites and cardholders '
                'can receive better access, discounts, or web-special behavior in some contexts, but Zoe should '
                'not promise elite-first award inventory.\n'
                'Partner awards follow partner release behavior. British Airways, Iberia, Qatar, Japan Airlines, '
                'Cathay Pacific, Qantas, and other partners may release seats earlier to their own members than '
                "American can book them because American's 331-day window can be the limiting factor.\n"
                'Zoe should advise: search at 331 days for peak partner premium cabins, then re-check 6-9 '
                'months, 3 months, and inside 14 days. Off-peak routes and midweek departures are usually '
                'easier.',
     'summary': 'American can book about 331 days out, with dynamic own-metal pricing and partner-specific '
                'release behavior. Partner premium awards often require repeat searches.'},

    {'id': 'award-release-alaska-mileage-plan',
     'title': 'Alaska Mileage Plan / Atmos Rewards Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Alaska',
              'Mileage Plan',
              'Atmos',
              'JAL',
              'partner awards'],
     'valid_as_of': '2026-Q2',
     'content': 'Alaska award booking historically opened around 330-331 days before departure. As Alaska and '
                'Hawaiian moved into Atmos Rewards, Zoe should treat current award behavior as evolving and '
                'verify live search results whenever possible.\n'
                'Own-metal Alaska/Hawaiian availability often follows revenue demand and route seasonality. '
                "Partner windows depend on the partner and may appear later or earlier than Alaska's own "
                'schedule.\n'
                'JAL partner space can be valuable, but Japan Airlines publishes its own booking window at 360 '
                "days. Alaska/Atmos access is constrained by the partner's release and Alaska/Atmos display "
                'capability. Space can be excellent at schedule open for some cabins but may disappear quickly '
                'on Japan routes.\n'
                'The checklist mentions Emirates timing. Alaska-Emirates redemptions were a historical sweet '
                'spot and are not a current standard Alaska/Atmos redemption path; do not tell users to rely on '
                'Alaska for Emirates.\n'
                'Zoe should advise: for JAL or other premium partners, search as soon as the Alaska/Atmos window '
                'opens and set alerts, but verify current partner availability and program rules before '
                'recommending a transfer.',
     'summary': 'Alaska/Atmos timing is partner-dependent. JAL can be valuable, but Emirates via Alaska is '
                'historical and should not be treated as current.'},

    {'id': 'award-release-southwest-rapid-rewards',
     'title': 'Southwest Rapid Rewards Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Southwest',
              'Rapid Rewards',
              'award release',
              'cash-linked',
              'no blackout'],
     'valid_as_of': '2026-Q2',
     'content': 'Southwest does not use a traditional saver-award calendar. Rapid Rewards points price as a '
                'function of the cash fare, so award availability generally follows seats available for sale '
                'rather than a hidden saver bucket.\n'
                "Because the points price tracks the fare, there is no specific 'release moment' that creates "
                'outsized value. The best timing is the same as a cash-fare strategy: book when fares are low, '
                'reprice when fares drop, and avoid peak leisure weekends.\n'
                'No-blackout behavior is the main user benefit: if a seat is available for sale and points '
                'booking is supported, the user can usually redeem points for it. The value is consistency, not '
                'a premium-cabin sweet spot.\n'
                "Zoe should advise: use Southwest points when the cash fare is high enough to beat the user's "
                'cash-back alternative or when flexibility/repricing is valuable. Do not frame Southwest as a '
                'saver-award hunt.',
     'summary': 'Southwest has no traditional award calendar because points track cash fares. Search and reprice '
                'like a cash fare, not like saver inventory.'},

    {'id': 'award-release-jetblue-trueblue',
     'title': 'JetBlue TrueBlue Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'JetBlue',
              'TrueBlue',
              'Mint',
              'award release',
              'dynamic pricing'],
     'valid_as_of': '2026-Q2',
     'content': 'JetBlue TrueBlue awards generally track cash pricing, so there is not a fixed saver-award '
                'release window. Standard economy redemptions are usually available when the seat is for sale, '
                'but the points price rises and falls with cash fare behavior.\n'
                'Mint is the key pattern. Mint awards can be very expensive when cash Mint fares are high, but '
                'they become attractive during fare sales, off-peak weekdays, or routes where Mint cash prices '
                'temporarily drop. Space is less about a hidden award bucket and more about revenue pricing.\n'
                'Peak Mint pressure is strongest on JFK/EWR/BOS to LAX/SFO, holiday periods, Sundays, Mondays, '
                'Thursdays, and Fridays. Tuesday, Wednesday, and Saturday departures can be better.\n'
                'Zoe should advise: check Mint early for popular transcon dates, but also track cash sales. '
                'TrueBlue value is strongest when the cash fare is high relative to points, not simply when a '
                'seat appears.',
     'summary': 'JetBlue awards are price-linked, and Mint value depends heavily on cash fare dips. Monitor '
                'off-peak Mint sales rather than waiting for a fixed saver release.'},

    {'id': 'award-release-hawaiian-atmos',
     'title': 'Hawaiian Airlines / Atmos Rewards Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Hawaiian',
              'HawaiianMiles',
              'Atmos',
              'award release',
              'Hawaii'],
     'valid_as_of': '2026-Q2',
     'content': 'HawaiianMiles became part of Atmos Rewards, so standalone HawaiianMiles release guidance is '
                'historical. Zoe should discuss Hawaiian award patterns through the current Alaska/Hawaiian '
                'Atmos Rewards lens and verify live award results.\n'
                'Hawaiian-operated routes to Hawaii historically showed the best award value in shoulder periods '
                'such as late January, spring outside school breaks, September, and October. Peak family travel '
                'dates, especially summer and Dec 20-Jan 6, are much harder.\n'
                "Partner access may vary by partner and by the combined program's current integration rules. "
                'Oneworld and Alaska/Hawaiian partner behavior can change as the combined platform matures.\n'
                'Zoe should advise: for Hawaii, search early for school-holiday trips, but monitor '
                'shoulder-season dates and West Coast gateways for better award availability.',
     'summary': 'Hawaiian award behavior should now be treated through Atmos Rewards. Hawaii award space is best '
                'in shoulder seasons and toughest during summer and winter holidays.'},

    {'id': 'award-release-air-canada-aeroplan',
     'title': 'Air Canada Aeroplan Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Air Canada',
              'Aeroplan',
              'award release',
              'Star Alliance',
              'partner booking'],
     'valid_as_of': '2026-Q2',
     'content': 'Aeroplan can book Air Canada and many Star Alliance partner awards, but availability is '
                'controlled by the operating carrier. Air Canada-operated awards use dynamic pricing inside '
                "Aeroplan's published ranges, while partner awards are generally more predictable by chart "
                'logic.\n'
                'Air Canada flights can appear near schedule open, but good pricing is not guaranteed. Partner '
                'awards are constrained by partner release windows and may appear later or close-in.\n'
                'Aeroplan is especially useful because it does not add traditional fuel surcharges and instead '
                'applies a flat partner booking fee on partner flight rewards. That makes close-in premium '
                'partner space valuable when it appears.\n'
                'Zoe should advise: search 11 months out for peak premium travel, then check again inside 60 and '
                '30 days for Star Alliance partner drops. Aeroplan is often better for users with flexible dates '
                'and willingness to connect.',
     'summary': 'Aeroplan combines Air Canada dynamic awards with partner-driven Star Alliance availability. '
                'Check early, then again close-in for premium partner space.'},

    {'id': 'award-release-british-airways-executive-club',
     'title': 'British Airways Executive Club Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'British Airways',
              'Avios',
              'award release',
              'Oneworld',
              '355 days'],
     'valid_as_of': '2026-Q2',
     'content': 'British Airways reward flights are generally bookable up to 355 days before departure. BA '
                'guarantees some reward availability on many BA-operated flights, but premium cabin seats on '
                'high-demand routes can disappear quickly.\n'
                'Oneworld partner space depends on the operating carrier. BA may show partner seats once the '
                'partner releases them and once the BA booking window can access them. For Qatar and some '
                'Oneworld partners, another program may access space slightly earlier.\n'
                'The major pattern is not just timing but surcharges. London long-haul awards can carry high '
                'carrier-imposed charges, so an award seat at calendar open may still be poor value.\n'
                'Zoe should advise: for BA premium cabins, search at T-355 and be ready. For Oneworld partners, '
                'compare Avios pricing and fees against American, Alaska/Atmos, Qatar, or Cathay before '
                'transferring.',
     'summary': 'BA Avios reward flights are usually bookable 355 days out. Availability can be good at release, '
                'but surcharges make value route-dependent.'},

    {'id': 'award-release-air-france-klm-flying-blue',
     'title': 'Air France/KLM Flying Blue Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Flying Blue',
              'Air France',
              'KLM',
              'Promo Rewards',
              'monthly'],
     'valid_as_of': '2026-Q2',
     'content': 'Flying Blue uses dynamic pricing for Air France and KLM awards, with monthly Promo Rewards as a '
                'recurring discount mechanism. Promo Rewards are normally announced monthly and cover selected '
                'routes, cabins, and booking/travel windows.\n'
                'The best timing pattern is to check at the beginning of each month for Promo Rewards, then '
                'compare against normal pricing. North America-Europe Promo Awards can be excellent when the '
                "user's city is included.\n"
                'Partner space, including Delta, Virgin Atlantic, Kenya Airways, Korean Air, and other '
                "SkyTeam/partners, depends on partner release behavior and Flying Blue's access. Partner "
                'availability is less predictable than AF/KLM own-metal pricing.\n'
                'Zoe should advise: for Europe, check Flying Blue monthly, especially on the first few days of '
                'the month. Promo discounts can beat fixed-chart programs, but carrier-imposed fees and dynamic '
                'pricing must be included in CPP.',
     'summary': 'Flying Blue is monthly-promo driven. Check Promo Rewards early each month and compare full '
                'taxes/fees against normal dynamic pricing.'},

    {'id': 'award-release-lufthansa-miles-and-more',
     'title': 'Lufthansa Miles & More Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Lufthansa',
              'Miles & More',
              'award release',
              'Star Alliance',
              'first class'],
     'valid_as_of': '2026-Q2',
     'content': 'Lufthansa Group award behavior varies by cabin. Economy and business awards can appear earlier, '
                'while Lufthansa First Class is famous for being most reliably released to partners close to '
                'departure, often within about 14 days, and sometimes only within a few days.\n'
                'Miles & More members may access Lufthansa Group space that partners cannot see, but awards can '
                'carry high surcharges on Lufthansa, SWISS, Austrian, Brussels, and related carriers.\n'
                "Star Alliance partner space follows the operating partner's release schedule. Lufthansa's own "
                'schedule access is not the same as partner-accessible saver availability.\n'
                'Zoe should advise: for Lufthansa First, tell users to monitor close-in and have backup plans. '
                'For business class, search early and again within 30 days, but include surcharges in the value '
                'calculation.',
     'summary': 'Lufthansa premium space, especially First, is often a close-in game. Miles & More may access '
                'more space but surcharges can be high.'},

    {'id': 'award-release-turkish-miles-smiles',
     'title': 'Turkish Miles&Smiles Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Turkish',
              'Miles&Smiles',
              'award release',
              'Star Alliance',
              'Istanbul'],
     'valid_as_of': '2026-Q2',
     'content': 'Turkish Miles&Smiles can show excellent Star Alliance value, but availability and booking '
                'reliability can be uneven. Turkish-operated award space may appear early on some routes, while '
                "partner space depends on the operating carrier and Turkish's display/access quirks.\n"
                'Historically, the best time to find Turkish-operated space is either far ahead on off-peak '
                'dates or during shoulder-season windows where Istanbul connecting traffic is lower. Peak '
                'summer, religious holidays, and school holidays are much harder.\n'
                "Website limitations matter. Turkish's site may not show all partner options, and some awards "
                'may require phone, email, ticket office, or repeated searches.\n'
                'Zoe should advise: verify Turkish space before transferring, screenshot availability, and be '
                'ready for manual booking. Do not present Turkish availability as guaranteed until ticketed.',
     'summary': 'Turkish can be high-value but operationally quirky. Find space before transferring and expect '
                'some awards to require manual follow-up.'},

    {'id': 'award-release-emirates-skywards',
     'title': 'Emirates Skywards Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Emirates',
              'Skywards',
              'award release',
              'First Class',
              'Business'],
     'valid_as_of': '2026-Q2',
     'content': 'Emirates Skywards has the strongest access to Emirates-operated awards compared with most '
                'partners. Emirates premium award space can appear at schedule open, but the airline also '
                'manages inventory dynamically and may release more seats closer to departure.\n'
                'First Class is limited on many routes and can be extremely capacity-sensitive. Business Class '
                'is more available but still gets tight during peak periods, major events in Dubai, and school '
                'holidays.\n'
                'Partner access to Emirates premium cabins is limited and has changed materially over time. Zoe '
                'should not assume a partner program can book Emirates First or Business unless the current '
                'program rules confirm it.\n'
                'Zoe should advise: for Emirates, Skywards is often the practical path despite surcharges. '
                'Search early for First, monitor periodically, and compare Business cash fares against high '
                'taxes/fees.',
     'summary': 'Emirates premium awards are best searched through Skywards. Space can appear early or close-in, '
                'but partner access is limited and surcharges matter.'},

    {'id': 'award-release-etihad-guest',
     'title': 'Etihad Guest Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Etihad',
              'Etihad Guest',
              'award release',
              'Abu Dhabi'],
     'valid_as_of': '2026-Q2',
     'content': 'Etihad Guest own-metal availability is route- and cabin-dependent. Economy and business can '
                'appear far ahead, while premium cabins on high-demand routes like New York, Chicago, '
                'Washington, and London are more limited.\n'
                'Etihad has changed partner award rules and pricing multiple times, so partner-accessible value '
                "requires current verification. The practical pattern is to search Etihad's own site first, then "
                'compare partner access if relevant.\n'
                'Close-in premium seats can appear when cabins are unsold, but users should not rely on this for '
                'peak holidays or major events in Abu Dhabi/Dubai.\n'
                'Zoe should advise: treat Etihad as a live-search program. Search early for aspirational cabins, '
                'then monitor 30/14/7 days out for additional release.',
     'summary': 'Etihad premium space is live-search dependent. Search early, then monitor close-in for unsold '
                'premium seats.'},

    {'id': 'award-release-qatar-privilege-club',
     'title': 'Qatar Privilege Club Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Qatar',
              'Privilege Club',
              'Avios',
              'Qsuite',
              'award release'],
     'valid_as_of': '2026-Q2',
     'content': 'Qatar Privilege Club can access Qatar-operated awards earlier than some partner programs, with '
                'many reports and current tools showing roughly 360-361 days of access, while BA Avios access is '
                'commonly around 355 days. Exact availability is route-specific.\n'
                'Qsuite awards are capacity-controlled and can disappear quickly on U.S.-Doha and Doha-onward '
                'routes. Flexi awards may show when saver is gone but cost more Avios.\n'
                'Partner programs such as American, Alaska/Atmos, British Airways, and Cathay may not see the '
                "same Qatar space at the same time. Qatar's own site is often the first place to check.\n"
                'Zoe should advise: for Qsuite, search through Qatar Privilege Club first, especially at the '
                "edge of the booking window. If using partner miles, re-check when that partner's calendar "
                'opens.',
     'summary': 'Qatar Qsuite space is often best checked through Qatar first, roughly 360-361 days out. Partner '
                'access can lag and saver seats disappear fast.'},

    {'id': 'award-release-singapore-krisflyer',
     'title': 'Singapore KrisFlyer Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Singapore',
              'KrisFlyer',
              'award release',
              'Star Alliance',
              '355 days'],
     'valid_as_of': '2026-Q2',
     'content': 'Singapore KrisFlyer historically makes Singapore Airlines awards searchable around 355 days '
                'out, though timing can vary with schedule loads and operational updates. Saver space is '
                'capacity-controlled and can be scarce on U.S. routes.\n'
                'Singapore often reserves more premium-cabin access for KrisFlyer members than for partners. '
                'Partner programs may see little or no long-haul premium space even when KrisFlyer can book it.\n'
                "Star Alliance partner awards through KrisFlyer depend on the partner's release and may not "
                'match what United, Aeroplan, or ANA shows.\n'
                'Zoe should advise: for Singapore-operated premium cabins, KrisFlyer is usually the right search '
                'path. Search at calendar open for fixed-date trips, waitlist when appropriate, and monitor for '
                'schedule changes or additional releases.',
     'summary': 'Singapore premium awards are best searched with KrisFlyer around 355 days out. Partner access '
                'to Singapore premium cabins is often limited.'},

    {'id': 'award-release-cathay-asia-miles',
     'title': 'Cathay Asia Miles Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Cathay',
              'Asia Miles',
              'award release',
              'Oneworld',
              'Hong Kong'],
     'valid_as_of': '2026-Q2',
     'content': 'Cathay Pacific Asia Miles can access Cathay-operated awards and Oneworld partners, but release '
                'behavior varies by route, cabin, and Hong Kong demand. Premium cabins can be difficult on North '
                'America-Hong Kong routes.\n'
                'Cathay may make some space available to its own members before or differently than partners. '
                'Oneworld partners like British Airways, American, Alaska/Atmos, and Qantas may not see '
                'identical space.\n'
                'Close-in space can appear if premium cabins are unsold, but Hong Kong holiday peaks, Lunar New '
                'Year, summer, and Christmas/New Year remain challenging.\n'
                'Zoe should advise: search Asia Miles first for Cathay premium cabins, then cross-check with '
                'AA/Alaska/BA for fee and price comparisons. For fixed dates, set alerts rather than relying on '
                'one search.',
     'summary': 'Cathay premium awards are partner-sensitive and route-sensitive. Search Asia Miles first, then '
                'compare Oneworld partners for price and fees.'},

    {'id': 'award-release-ana-mileage-club',
     'title': 'ANA Mileage Club Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'ANA',
              'Mileage Club',
              '355 days',
              'United',
              'Virgin Atlantic',
              'Japan'],
     'valid_as_of': '2026-Q2',
     'content': 'ANA publishes reservations for ANA international flight awards up to 355 days before departure. '
                'ANA partner awards are also generally tied to a 355-day application window, but '
                'partner-specific availability can vary.\n'
                'For U.S.-Japan routes, the hardest periods are cherry blossom, Golden Week, Obon, and New Year. '
                'Business and First availability at calendar open can disappear quickly. Round-trip requirements '
                'and booking rules matter when using ANA miles directly.\n'
                'Partner releases to United, Virgin Atlantic, Aeroplan, and other programs may not match '
                'ANA-member access. Virgin Atlantic historically offered a famous ANA sweet spot, but the user '
                'must find actual ANA partner space before transferring.\n'
                'Zoe should advise: for ANA premium cabins, search at 355 days for peak dates and set alerts for '
                'close-in releases. Do not promise Virgin/United access unless the partner can see the seat.',
     'summary': 'ANA opens around 355 days out and Japan premium awards disappear fast. Partner access to ANA '
                'space must be verified before transfer.'},

    {'id': 'award-release-jal-mileage-bank',
     'title': 'JAL Mileage Bank Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'JAL',
              'Mileage Bank',
              '360 days',
              'Oneworld',
              'Japan'],
     'valid_as_of': '2026-Q2',
     'content': 'The checklist mentions a 355-day window, but JAL currently publishes international award '
                "reservations at up to 360 days before departure, counted from the itinerary's final return "
                'sector for round trips. Zoe should use the current 360-day figure rather than repeating 355 as '
                'a hard rule.\n'
                'JAL releases some space to partners such as American, Alaska/Atmos, British Airways, and '
                "Cathay, but partner access can be limited by each partner's own booking window. American's "
                "331-day window, for example, can make AA later than JAL's own members.\n"
                'Japan peak periods are especially hard: cherry blossom, Golden Week, Obon, and New Year. First '
                'Class and business seats can be claimed quickly when released.\n'
                'Zoe should advise: check JAL Mileage Bank or an early-access Oneworld program first for peak '
                'premium cabins, then re-check partner programs as their calendars open.',
     'summary': 'JAL currently publishes a 360-day award window, not 355. Partner access depends on each '
                "partner's own calendar and JAL's released space."},

    {'id': 'award-release-korean-air-skypass',
     'title': 'Korean Air SKYPASS Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Korean Air',
              'SKYPASS',
              'award release',
              'SkyTeam',
              'Korea'],
     'valid_as_of': '2026-Q2',
     'content': 'Korean Air SKYPASS own-metal awards are capacity-controlled and strongly affected by Korean '
                'holiday demand. Peak Korean travel periods, including Chuseok, Lunar New Year, summer, and '
                'year-end, can be very difficult.\n'
                'Own-metal premium availability may be better to SKYPASS members than to partners. Partner '
                'access through Delta or other SkyTeam programs is limited and can price poorly or '
                'unpredictably.\n'
                'Because Korean Air has historically offered strong own-program access but limited U.S. transfer '
                'paths, the search strategy depends on whether the user already has SKYPASS miles or '
                'transferable options.\n'
                'Zoe should advise: search early for Korea peak dates, avoid Chuseok/Lunar New Year if flexible, '
                'and verify Delta/partner visibility before assigning value to SkyTeam transfers.',
     'summary': 'Korean Air award space is highly holiday-sensitive and often better through SKYPASS than '
                'partners. Verify partner visibility before recommending.'},

    {'id': 'award-release-asiana-club',
     'title': 'Asiana Club Award Release Window and Availability Patterns',
     'category': 'historical_patterns',
     'tags': ['award release',
              'booking window',
              'historical patterns',
              'Asiana',
              'Asiana Club',
              'award release',
              'Star Alliance',
              'Korea'],
     'valid_as_of': '2026-Q2',
     'content': 'Asiana Club own-metal awards and Star Alliance partner awards follow capacity-controlled '
                'release rules. Availability patterns are affected by Korea peak dates, Star Alliance partner '
                'release behavior, and the evolving Korean Air/Asiana merger environment.\n'
                'Asiana business-class space can be attractive when available, especially on U.S.-Seoul routes, '
                'but it is not consistently visible to every partner program.\n'
                'Star Alliance partner bookings depend on the operating carrier. United, Aeroplan, ANA, and '
                'Avianca may show different results for the same Asiana or Star Alliance seat.\n'
                'Zoe should advise: treat Asiana guidance as live-search dependent. Search early and close-in, '
                'and cross-check multiple Star Alliance programs before recommending a transfer.',
     'summary': 'Asiana space is partner-sensitive and affected by Korea demand and merger changes. Always '
                'cross-check live Star Alliance availability.'},

    {'id': 'seasonal-transatlantic-europe',
     'title': 'Transatlantic Europe Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'transatlantic',
              'Europe',
              'summer',
              'Christmas',
              'shoulder season'],
     'valid_as_of': '2026-Q2',
     'content': 'Summer peak, June through August, is the highest-demand transatlantic period. Cash economy '
                'fares rise, premium cabins sell heavily, and saver award availability is limited. For summer '
                'Europe, Zoe should tell users to search 10-11 months out for premium cabins and to keep backup '
                'gateways open.\n'
                'Christmas and New Year, roughly Dec 22-Jan 3, is the second-hardest period. Award space should '
                'be booked as soon as practical, and cash fares often rise sharply after fall.\n'
                'Spring, March through May, is a shoulder season, but not uniformly cheap. Easter, school '
                'breaks, and major events can spike prices. Europe does not have one single cherry-blossom '
                'equivalent, but spring weather creates strong leisure demand.\n'
                'January and February are usually the cheapest transatlantic months and often have the best '
                "award availability, excluding New Year's return dates, MLK weekend, and major events.\n"
                'October is often overlooked: weather remains mild in many cities, summer demand is gone, and '
                'both cash and award availability can improve.\n'
                'Thanksgiving week is tricky. U.S.-origin travel to Europe can spike around school breaks, so '
                'users should book 9+ months out for fixed premium cabins or use flexible date searches.\n'
                'Spring break demand depends on school calendars. Late March and early April can price like peak '
                'travel on leisure-heavy Europe routes.\n'
                'Zoe should advise: use points for transatlantic business when cash is high and saver/partner '
                "pricing is available; pay cash for cheap winter economy unless CPP still clears the user's "
                'threshold.',
     'summary': 'Europe is hardest in summer and Christmas/New Year, easiest in January-February and often '
                'October. Fixed-date premium trips should be searched far ahead.'},

    {'id': 'seasonal-transpacific-east-asia',
     'title': 'Transpacific East Asia Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'transpacific',
              'Japan',
              'Korea',
              'China',
              'cherry blossom',
              'Golden Week'],
     'valid_as_of': '2026-Q2',
     'content': 'Cherry blossom season in Japan, usually late March to early April, is one of the hardest award '
                'periods. Exact timing varies by year and region, so Zoe should avoid giving a single guaranteed '
                'date range beyond the broad window.\n'
                'Golden Week in Japan, late April through around May 5, creates massive domestic and outbound '
                'demand. Premium awards to and from Japan are difficult and should be searched at calendar '
                'open.\n'
                'Obon in mid-August is a domestic Japan travel peak that also affects international award space '
                'because aircraft and premium cabins are under stronger demand.\n'
                'Japan New Year, roughly Dec 28-Jan 5, is a major demand spike. Cash fares and award scarcity '
                'both rise.\n'
                'Chinese New Year, varying in January or February, is one of the largest travel events in the '
                'world. China, Hong Kong, Taiwan, and Southeast Asia connections can all be affected.\n'
                'Chinese Golden Week, Oct 1-7, creates strong domestic and outbound demand and can reduce award '
                'space across East Asia.\n'
                'Korean Chuseok varies in September or October and can make Korea awards extremely difficult. '
                "Zoe should check the current year's calendar before advising exact dates.\n"
                'Summer, June through August, can be surprisingly workable for Japan because heat and humidity '
                'reduce some leisure demand, though family travel still matters.\n'
                'February is one of the best off-peak windows for East Asia award availability, excluding Lunar '
                'New Year dates.\n'
                'Zoe should advise: for Japan/Korea/China peak cultural holidays, search at calendar open; for '
                'flexible users, February and parts of June can be strong.',
     'summary': 'East Asia awards are hardest around cherry blossom, Golden Week, Obon, New Year, Lunar New '
                'Year, and Chuseok. February and some summer dates can be better.'},

    {'id': 'seasonal-transpacific-southeast-asia',
     'title': 'Transpacific Southeast Asia Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'Southeast Asia',
              'Thailand',
              'Vietnam',
              'Songkran',
              'Tet'],
     'valid_as_of': '2026-Q2',
     'content': 'Songkran in Thailand, usually mid-April, is a major demand spike for Bangkok and domestic '
                'Thailand connections. Awards into BKK and onward beach markets can tighten around this window.\n'
                'Tet in Vietnam varies in January or February and creates a major demand spike for Vietnam '
                'routes and connecting traffic to SGN/HAN/DAD. Zoe should check the exact lunar-calendar dates '
                'each year.\n'
                'May and June can be good shoulder months before the monsoon peak in much of the region. Cash '
                'fares may soften, and award space can be better than winter peak.\n'
                'November and December are popular for beach destinations because weather improves and U.S. '
                'travelers seek warm-weather trips. Availability can tighten, especially around Christmas/New '
                'Year.\n'
                'Zoe should advise: use flexible dates and consider gateways like SIN, BKK, KUL, SGN, and '
                'TPE/HKG connections. Premium awards are often best booked far ahead or close-in through '
                'alliance partners.',
     'summary': 'Southeast Asia spikes around Songkran, Tet, and winter beach season. May-June can be a strong '
                'shoulder window.'},

    {'id': 'seasonal-australia-new-zealand',
     'title': 'Australia and New Zealand Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'Australia',
              'New Zealand',
              'SYD',
              'MEL',
              'AKL',
              'austral summer'],
     'valid_as_of': '2026-Q2',
     'content': 'Austral summer, December through February, is peak season for Australia and New Zealand. It '
                'overlaps with U.S. winter holidays, school breaks, beach weather, and high inbound tourism. '
                'Cash fares and award scarcity rise sharply.\n'
                'U.S. summer, June through August, is austral winter and often a shoulder-value window. Cash '
                'fares can be lower, and award space may be easier, though ski and school-holiday demand can '
                'still affect specific dates.\n'
                'Australian school holidays vary by state, so Zoe should not rely on one national school '
                'calendar. New South Wales, Victoria, Queensland, and other states can have different holiday '
                'periods.\n'
                'Zoe should advise: for Australia/New Zealand premium cabins, search early, use West Coast '
                'gateways, and consider Fiji, Tahiti, Hawaii, or Asia connections if nonstop awards are '
                'unavailable.',
     'summary': 'Australia/NZ is toughest during Dec-Feb and easier in U.S. summer/austral winter. State school '
                'holidays can shift demand.'},

    {'id': 'seasonal-caribbean-mexico',
     'title': 'Caribbean and Mexico Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'Caribbean',
              'Mexico',
              'Cancun',
              'spring break',
              'hurricane season'],
     'valid_as_of': '2026-Q2',
     'content': 'Spring break, varying from March through April, is the biggest demand spike for Caribbean and '
                'Mexico leisure routes. Family and college-break markets can price very differently by week.\n'
                'Christmas-New Year is the second-biggest spike. Warm-weather demand, limited nonstop capacity, '
                'and resort travel push cash fares up and reduce cheap awards.\n'
                "President's Day weekend creates a smaller but noticeable spike, especially from Northeast and "
                'Midwest gateways to Mexico, Florida, and the Caribbean.\n'
                'September and October are often the lowest-price months because of hurricane risk and lower '
                'leisure demand. Weather can still be good, but users must understand disruption risk.\n'
                'Thanksgiving is popular for Mexico and Caribbean trips, and prices can spike earlier than users '
                'expect.\n'
                'January after New Year can be a solid value window after holiday travelers return home.\n'
                "February can see a Valentine's/Presidents' Day spike followed by a dip before spring-break "
                'waves begin.\n'
                'Zoe should advise: Caribbean/Mexico economy often produces low CPP when cash is cheap. Use '
                'points when cash spikes during school breaks or when refundable/flexible points pricing is '
                'useful.',
     'summary': 'Caribbean/Mexico is most expensive around spring break and winter holidays, cheapest in '
                'September-October and parts of January/February.'},

    {'id': 'seasonal-south-america',
     'title': 'South America Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'South America',
              'Brazil',
              'Argentina',
              'Carnival',
              'Rio'],
     'valid_as_of': '2026-Q2',
     'content': 'Carnival in Brazil, varying in February or March, creates massive demand for Rio de Janeiro, '
                'São Paulo, and domestic Brazil connections. Cash fares and award scarcity can spike well beyond '
                'the exact parade dates.\n'
                'New Year in Rio is another major spike. Beach destinations and premium cabins can be very '
                'expensive around late December and early January.\n'
                'Argentine summer, December through February, is an internal peak for Argentina and '
                'Patagonia-adjacent travel, with high domestic and regional demand.\n'
                'Best value windows are often April-June and September-November. These shoulder periods can '
                'combine milder weather, lower cash fares, and better award access.\n'
                'Zoe should advise: for Brazil Carnival or Rio New Year, book far ahead. For general South '
                'America, compare cash carefully because economy fares can be reasonable while premium-cabin '
                'awards still offer strong value.',
     'summary': 'South America spikes around Brazil Carnival, Rio New Year, and Argentine summer. April-June and '
                'September-November are often better value.'},

    {'id': 'seasonal-middle-east',
     'title': 'Middle East Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns', 'historical pricing', 'Middle East', 'Dubai', 'Doha', 'Ramadan', 'Hajj'],
     'valid_as_of': '2026-Q2',
     'content': 'Ramadan follows the lunar calendar and shifts each year. Demand patterns vary by route: some '
                'leisure demand softens during fasting periods, while visiting-family and religious travel can '
                'rise around Eid.\n'
                'Hajj season creates a capacity crush for Saudi-adjacent routes and can affect connecting hubs '
                'in the Gulf. Even if the user is not flying to Saudi Arabia, regional capacity and fares can be '
                'affected.\n'
                'Dubai Expo-like mega-event periods, major conferences, and large sports events can create '
                'route-specific spikes. Zoe should check the event calendar for Dubai, Doha, Abu Dhabi, and '
                'Riyadh before assuming normal pricing.\n'
                'August can be a best-value period for Gulf leisure because extreme heat reduces tourist demand, '
                'though premium cabins may still price high on long-haul routes.\n'
                'Zoe should advise: for Middle East trips, compare premium-cabin award space through Qatar, '
                'Emirates, Etihad, Aeroplan, and American. Live search matters more than generic seasonality '
                'during event periods.',
     'summary': 'Middle East demand shifts with Ramadan, Eid/Hajj, and major events. August can be cheap for '
                'leisure because of heat.'},

    {'id': 'seasonal-india',
     'title': 'India Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns', 'historical pricing', 'India', 'Diwali', 'Holi', 'DEL', 'BOM'],
     'valid_as_of': '2026-Q2',
     'content': 'Diwali, varying in October or November, creates a huge international and domestic demand spike. '
                'U.S.-India flights can price very high and premium award space becomes scarce.\n'
                'Holi, varying in March, is a smaller but meaningful spike, especially around family travel and '
                'domestic India connections.\n'
                'April through June is extremely hot in much of India and also overlaps with school-break '
                'demand. Users should not assume low demand just because weather is difficult.\n'
                'Best value windows are often January-February outside New Year returns, and July-August during '
                'monsoon/low-tourist periods, though regional conditions vary.\n'
                'Zoe should advise: U.S.-India premium awards are among the hardest. Use flexible gateways and '
                'partners such as Aeroplan, United, Qatar, Emirates, Etihad, Turkish, Singapore, and Air India '
                'when available.',
     'summary': 'India demand spikes around Diwali and school breaks. January-February and July-August can be '
                'better, but U.S.-India premium awards remain difficult.'},

    {'id': 'seasonal-domestic-us',
     'title': 'Domestic US Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns',
              'historical pricing',
              'domestic US',
              'Thanksgiving',
              'Christmas',
              'Super Bowl',
              'spring break'],
     'valid_as_of': '2026-Q2',
     'content': 'Thanksgiving week is typically the highest domestic-demand week of the year. Fixed-date users '
                'should book 4-6 months out for reasonable cash fares, and awards should be checked early and '
                'again after schedule changes.\n'
                'Christmas-New Year is the second-highest domestic peak. The hardest dates are usually Dec '
                '20-24, Dec 26-31, and Jan 1-5.\n'
                'Memorial Day, Labor Day, and July 4th create short spikes. Prices can be especially high when '
                'the holiday falls near a weekend and turns into a 3-4 day trip.\n'
                'Spring break varies by market. College towns, Florida, Arizona, Mexico gateways, and family '
                'leisure routes can spike on different weeks.\n'
                'January-February, excluding MLK weekend and major local events, is usually the cheapest '
                'domestic flying period.\n'
                'Super Bowl city demand creates a massive local spike for the host market and sometimes nearby '
                'alternate airports. Zoe should check the event host city and dates before assuming normal '
                'fares.\n'
                'Zoe should advise: pay cash for cheap domestic flights, use points when holiday cash fares '
                'spike or when Southwest/JetBlue-style price-linked points still compare favorably.',
     'summary': 'Domestic U.S. peaks around Thanksgiving, Christmas/New Year, summer holidays, spring break, and '
                'major events. January-February is usually cheapest.'},

    {'id': 'seasonal-hawaii',
     'title': 'Hawaii Seasonal Pricing and Award Patterns',
     'category': 'historical_patterns',
     'tags': ['seasonal patterns', 'historical pricing', 'Hawaii', 'HNL', 'OGG', 'KOA', 'LIH', 'school holidays'],
     'valid_as_of': '2026-Q2',
     'content': 'Summer is a family-travel spike for Hawaii. Cash fares rise, award availability tightens, and '
                'nonstop West Coast flights can sell out or price high.\n'
                'Winter holidays, roughly Dec 20-Jan 6, are a massive spike. Premium cabins and nonstop awards '
                'are especially hard.\n'
                'Spring can be a shoulder season and a good time to use points, especially outside spring break '
                'and Easter weeks.\n'
                'Best award availability is often in September, October, and late January. These windows can '
                'combine lower cash fares, more open seats, and less family-travel pressure.\n'
                'Zoe should advise: Hawaii economy redemptions are not always great if cash is cheap, but '
                'premium cabins to Hawaii can be worthwhile during peaks if saver space appears.',
     'summary': 'Hawaii is hardest in summer and winter holidays. September, October, late January, and spring '
                'outside breaks are better award windows.'},

    {'id': 'cash-range-short-haul-domestic',
     'title': 'Short-Haul Domestic Cash Price Ranges Under 500 Miles',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'short-haul',
              'domestic',
              'cash range',
              'under 500 miles'],
     'valid_as_of': '2026-Q2',
     'content': 'Short-haul domestic flights under 500 miles often have low cash fares, especially on '
                'competitive routes and basic economy fares. Historical planning bands: off-peak $49-$150 '
                'one-way, normal $90-$220 one-way, peak or last-minute $180-$350+ one-way.\n'
                'Seasonality matters less than day-of-week and competition. Friday/Sunday, holiday weekends, and '
                'small regional airports raise prices. Tuesday/Wednesday/Saturday flights are often cheaper.\n'
                'Points guidance: it almost never makes sense to burn transferable bank points for cheap '
                'sub-$150 short-haul flights unless the user has orphan miles, needs flexibility, or cash prices '
                'spike. Southwest/JetBlue-style points can be fine because they track cash.\n'
                'Zoe should use live fares as the source of truth and treat these as planning ranges only.',
     'summary': 'Short-haul cash fares are often cheap enough that points produce poor CPP. Use points mainly '
                'for spikes, flexibility, or orphan balances.'},

    {'id': 'cash-range-medium-haul-domestic',
     'title': 'Medium-Haul Domestic Cash Price Ranges 500 to 1,500 Miles',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'medium-haul',
              'domestic',
              'cash range',
              '500-1500 miles'],
     'valid_as_of': '2026-Q2',
     'content': 'Medium-haul domestic routes, 500-1,500 miles, show wider variation. Planning bands: off-peak '
                '$90-$220 one-way, normal $150-$350 one-way, peak/holiday $300-$650+ one-way.\n'
                'Hub-to-hub competition can suppress fares, while monopoly routes and leisure peaks can spike '
                'quickly. Checked bags and seat fees can change the true cash comparison.\n'
                'Points guidance: cash below $200 is often better. Points become more compelling when cash is '
                'above $300 one-way or when saver awards price at low fixed levels. Dynamic programs must be '
                'checked against CPP.\n'
                'Zoe should compare total trip cost, including baggage, because a points ticket on an airline '
                'with waived bags can beat a slightly cheaper basic economy fare.',
     'summary': 'Medium-haul domestic points start making sense when cash climbs above about $300 one-way or '
                'saver pricing appears.'},

    {'id': 'cash-range-transcon',
     'title': 'US Transcon Cash Price Bands Economy vs Premium',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transcon',
              'Mint',
              'Polaris',
              'Delta One',
              'cash range'],
     'valid_as_of': '2026-Q2',
     'content': 'Transcon economy is competitive but volatile. Planning bands: off-peak/sale $150-$300 one-way, '
                'normal $250-$500 one-way, peak/holiday/last-minute $450-$900+ one-way.\n'
                'Premium transcon cabins such as JetBlue Mint, Delta One, United premium '
                'transcon/Polaris-marketed service, and American premium A321 service vary much more. Planning '
                'bands: sale/off-peak $599-$1,200 one-way, normal $1,200-$2,500 one-way, peak/last-minute '
                '$2,500-$4,500+ one-way.\n'
                'Seasonality is strongest around Monday/Thursday business travel, Friday/Sunday leisure returns, '
                'summer, Thanksgiving, and Christmas/New Year. Tuesday, Wednesday, and Saturday can be better.\n'
                'Points guidance: economy often requires a high cash fare to justify points. Premium transcon '
                'redemptions can be excellent if points pricing stays reasonable and cash is above $1,200 '
                'one-way.\n'
                'Zoe should call out Mint/Delta One/United premium availability patterns and avoid treating '
                'normal domestic first class as equal to lie-flat premium transcon.',
     'summary': 'Transcon economy is often cash-friendly, but lie-flat premium cabins can create strong points '
                'value when cash exceeds $1,200 one-way.'},

    {'id': 'cash-range-transatlantic-economy',
     'title': 'Transatlantic Economy Cash Bands by Gateway City',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transatlantic',
              'economy',
              'cash range',
              'gateway'],
     'valid_as_of': '2026-Q2',
     'content': 'Transatlantic economy depends heavily on gateway, competition, and season. East Coast gateway '
                'planning bands: winter/off-peak $300-$600 round trip, shoulder $450-$850, summer/holiday '
                '$800-$1,500+. Midwest/South gateways often run $500-$1,000 shoulder and $900-$1,700 peak. West '
                'Coast gateways often run $550-$1,100 shoulder and $1,000-$1,900 peak.\n'
                'London, Paris, Amsterdam, Dublin, Lisbon, Madrid, and Barcelona see frequent fare sales from '
                'major gateways. Smaller European destinations can price higher unless connected through a '
                'competitive hub.\n'
                'Points guidance: transatlantic economy is often not a good use of transferable points when cash '
                'is under $600 round trip, especially if award taxes/surcharges are high. Points become more '
                'useful during summer, Christmas, and one-way needs.\n'
                'Zoe should compare all-in taxes and surcharges because BA and some other awards can look cheap '
                'in miles but expensive in cash fees.',
     'summary': 'Transatlantic economy is often cheap in winter and shoulder periods. Points are most useful in '
                'peak periods or when cash exceeds normal bands.'},

    {'id': 'cash-range-transatlantic-business',
     'title': 'Transatlantic Business Class Cash Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transatlantic',
              'business class',
              'cash range',
              'CPP'],
     'valid_as_of': '2026-Q2',
     'content': 'Transatlantic business class planning bands: sale fares $1,800-$3,000 round trip, common '
                'shoulder-season fares $3,000-$5,500, normal peak fares $4,500-$8,000, and '
                'last-minute/high-demand fares $8,000-$12,000+.\n'
                'Gateway competition matters. New York, Boston, Chicago, Washington, Miami, Los Angeles, and San '
                'Francisco can see sales, while smaller gateways often require positioning or connecting.\n'
                'Points guidance: business awards are compelling when fixed or partner pricing is available '
                'around 45k-88k miles each way and fees are reasonable. CPP over 2.0 cents is common when cash '
                'fares are $3,000+ round trip, but high surcharges can reduce true value.\n'
                'Zoe should recommend comparing Aeroplan, Flying Blue, Virgin Atlantic, United, American, '
                'Alaska/Atmos, Iberia Avios, and BA Avios depending on route and fees.',
     'summary': 'Transatlantic business is a classic points sweet spot when cash is $3,000+ and saver/partner '
                'pricing is available.'},

    {'id': 'cash-range-transatlantic-first',
     'title': 'Transatlantic First Class Cash Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transatlantic',
              'first class',
              'cash range',
              'Lufthansa First'],
     'valid_as_of': '2026-Q2',
     'content': 'Transatlantic first class is limited to fewer carriers and routes than business. Planning '
                'bands: discounted/rare sales $4,000-$7,000 round trip, normal $7,000-$15,000, and '
                'peak/last-minute $15,000-$25,000+.\n'
                'Availability is highly airline-specific. Lufthansa First is often close-in to partners, British '
                'Airways First can have high surcharges, and some U.S. carriers do not operate a true '
                'international first cabin.\n'
                'Points guidance: first class CPP can look enormous, but Zoe should not overvalue a redemption '
                "simply because the cash fare is inflated. Compare against the user's willingness to pay and "
                'against business-class alternatives.\n'
                'Zoe should present first class as aspirational and availability-driven, not as the default best '
                'value.',
     'summary': 'Transatlantic first can show huge theoretical CPP, but availability and surcharges make it an '
                'aspirational, route-specific play.'},

    {'id': 'cash-range-transpacific-economy',
     'title': 'Transpacific Economy Cash Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transpacific',
              'economy',
              'cash range',
              'Asia'],
     'valid_as_of': '2026-Q2',
     'content': 'Transpacific economy planning bands: off-peak/sale $500-$850 round trip to '
                'Japan/Korea/China/Taiwan, normal $800-$1,300, peak $1,300-$2,200+, and last-minute/holiday '
                '$2,000-$3,000+.\n'
                'Southeast Asia can be more expensive because of distance and connections: sale $650-$1,000, '
                'normal $900-$1,600, peak $1,500-$2,500+.\n'
                'Seasonal spikes include Japan cherry blossom/Golden Week/New Year, Korean Chuseok, Lunar New '
                'Year, and major school holidays.\n'
                'Points guidance: economy awards can be useful when peak cash prices spike, but transferable '
                'points are often better saved for premium cabins if cash is under $900 round trip.\n'
                'Zoe should compare gateway positioning costs because a cheap West Coast fare can beat an '
                'expensive local-origin award.',
     'summary': 'Transpacific economy ranges from cheap sales to very high holiday fares. Points are best during '
                'peaks or when cash exceeds about $1,200-$1,500.'},

    {'id': 'cash-range-transpacific-business',
     'title': 'Transpacific Business Class Cash Bands and Sweet Spot Data',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transpacific',
              'business class',
              'cash range',
              'sweet spot'],
     'valid_as_of': '2026-Q2',
     'content': 'Transpacific business class is one of the strongest historical points uses. Planning bands: '
                'rare sale fares $2,800-$4,500 round trip, normal $5,000-$9,000, peak $8,000-$14,000+, and '
                'last-minute premium fares $10,000-$18,000+.\n'
                'Japan, Korea, Taiwan, Singapore, and Hong Kong premium routes produce high CPP when partner '
                'saver space exists. ANA, JAL, EVA, Singapore, Cathay, Korean Air, and Asiana can all be strong, '
                'depending on program access.\n'
                'Sweet spot guidance: Virgin Atlantic to ANA, American/Alaska/Atmos to JAL, Aeroplan/United to '
                'Star Alliance, and Avianca LifeMiles to some Star Alliance routes can all outperform cash when '
                'space exists.\n'
                'Zoe should warn that the best transpacific business awards are scarce and should be searched at '
                'calendar open, shoulder periods, and close-in.',
     'summary': 'Transpacific business is one of the best points uses, often producing 3-5+ CPP when '
                'saver/partner space exists.'},

    {'id': 'cash-range-transpacific-first',
     'title': 'Transpacific First Class Cash Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'transpacific',
              'first class',
              'cash range',
              'ANA',
              'JAL'],
     'valid_as_of': '2026-Q2',
     'content': 'Transpacific first class planning bands: discounted/rare fares $6,000-$10,000 round trip, '
                'normal $10,000-$18,000, and peak/last-minute $18,000-$30,000+.\n'
                'True first class is limited and shrinking. ANA First, JAL First, Singapore Suites/First, Cathay '
                'First, and Korean Air First depend heavily on route, aircraft, and partner access.\n'
                'Points guidance: CPP can be extremely high, but awards are scarce. Zoe should not use inflated '
                'first-class cash fares as the only justification; compare to what the user would otherwise pay '
                'for business class.\n'
                'Zoe should present first class as a high-upside alert/search target, not a guaranteed booking '
                'path.',
     'summary': 'Transpacific first can be spectacular but scarce. Use alerts and compare against business-class '
                'alternatives rather than chasing inflated CPP alone.'},

    {'id': 'cash-range-caribbean-mexico-economy',
     'title': 'Caribbean and Mexico Economy Cash Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'Caribbean',
              'Mexico',
              'economy',
              'cash range'],
     'valid_as_of': '2026-Q2',
     'content': 'Caribbean and Mexico economy planning bands from major U.S. gateways: off-peak $150-$350 round '
                'trip, normal $300-$650, spring break/holiday $600-$1,200+, and last-minute peak leisure dates '
                '$900-$1,500+.\n'
                'Cancun, Punta Cana, Montego Bay, Nassau, San Juan, Los Cabos, and Puerto Vallarta can swing '
                'sharply by week. Low-cost carriers may lower base fares but increase true cost with bags and '
                'seats.\n'
                'Points guidance: cash often wins when fares are under $350-$400 round trip. Points become '
                'compelling during spring break, Christmas/New Year, and when award tickets include flexibility '
                'or bag benefits.\n'
                'Zoe should compare all-in cost and warn that Caribbean economy awards often produce below 1.0 '
                'CPP in off-peak sale windows.',
     'summary': 'Caribbean/Mexico cash fares can be very low off-peak, so points are best saved for school-break '
                'and holiday spikes.'},

    {'id': 'cash-range-south-america',
     'title': 'South America Cash Price Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'South America',
              'Brazil',
              'Argentina',
              'cash range'],
     'valid_as_of': '2026-Q2',
     'content': 'South America economy planning bands: northern South America $300-$700 round trip off-peak and '
                '$600-$1,200 peak; deep South America such as Brazil, Argentina, Chile, and Uruguay $500-$1,000 '
                'shoulder and $900-$1,700+ peak.\n'
                'Business-class planning bands: sale $1,800-$3,500 round trip, normal $3,000-$6,500, '
                'peak/last-minute $6,000-$10,000+.\n'
                'Carnival, Rio New Year, Argentine summer, and major holidays can drive spikes. Shoulder periods '
                'April-June and September-November often price better.\n'
                'Points guidance: economy can be cash-friendly, but business class to deep South America can be '
                'a good use of American, Alaska/Atmos, Aeroplan, Avianca, United, or Delta/Virgin/Flying Blue '
                'depending on route.\n'
                'Zoe should compare nonstop convenience against partner routings through Panama, Bogota, Lima, '
                'São Paulo, or Santiago.',
     'summary': 'South America economy can be reasonable, but business-class awards to deep South America can be '
                'strong during peak cash periods.'},

    {'id': 'cash-range-middle-east',
     'title': 'Middle East Cash Price Bands',
     'category': 'historical_patterns',
     'tags': ['cash price ranges',
              'historical pricing',
              'points vs cash',
              'Middle East',
              'Dubai',
              'Doha',
              'Abu Dhabi',
              'cash range'],
     'valid_as_of': '2026-Q2',
     'content': 'Middle East economy planning bands: sale/off-peak $600-$900 round trip, normal $900-$1,500, '
                'peak/holiday/event $1,400-$2,500+. Ultra-long-haul routes and conflict/security disruptions can '
                'raise fares quickly.\n'
                'Business-class planning bands: sale $2,500-$4,000 round trip, normal $4,000-$8,000, '
                'peak/last-minute $8,000-$12,000+. First class can exceed $15,000-$25,000 on premium Gulf '
                'carriers.\n'
                'Demand spikes around Eid/Hajj-adjacent periods, school holidays, major Dubai/Doha/Abu Dhabi '
                'events, and winter tourism. August can be cheaper for leisure because of heat.\n'
                'Points guidance: Qatar Qsuite, Emirates Business/First, Etihad premium cabins, Turkish, and '
                'Aeroplan/Star Alliance routings can all be strong, but surcharges and partner availability '
                'vary.\n'
                'Zoe should always compare taxes/fees and availability before telling users to transfer points '
                'for Gulf carrier awards.',
     'summary': 'Middle East economy and business prices swing with events, holidays, and season. Premium awards '
                'can be excellent but fees and availability matter.'},

    {'id': 'breakeven-low-cash-price-thresholds',
     'title': 'When Cash Prices Are Too Low to Use Points',
     'category': 'historical_patterns',
     'tags': ['points vs cash',
              'breakeven',
              'historical patterns',
              'breakeven',
              'low cash fares',
              'CPP threshold'],
     'valid_as_of': '2026-Q2',
     'content': 'Under what cash price does it almost never make sense to use points? Directional thresholds: '
                'short-haul domestic under $150 one-way, medium-haul domestic under $200 one-way, transcon '
                'economy under $300 one-way, Caribbean/Mexico under $350-$400 round trip, transatlantic economy '
                'under $600 round trip, and transpacific economy under $900 round trip usually favor cash.\n'
                'These thresholds assume the user is spending transferable bank points or valuable airline '
                'miles. Price-linked currencies such as Southwest or JetBlue can be acceptable at lower cash '
                'prices because they behave closer to cash rebates.\n'
                'Taxes, baggage, seat fees, cancellation flexibility, and expiring miles can override the simple '
                "threshold. Zoe should never blindly say 'always pay cash' without checking total trip cost and "
                "the user's balances.\n"
                "Zoe should phrase this as: 'At that cash price, I would usually save transferable points unless "
                "the award has unusual flexibility or you are trying to burn orphan miles.'",
     'summary': 'Very low cash fares usually beat points, especially for transferable currencies. Exceptions '
                'include flexibility, bag benefits, and orphan miles.'},

    {'id': 'breakeven-high-cash-price-thresholds',
     'title': 'When High Cash Prices Make Points Compelling',
     'category': 'historical_patterns',
     'tags': ['points vs cash',
              'breakeven',
              'historical patterns',
              'breakeven',
              'high cash fares',
              'compelling points use'],
     'valid_as_of': '2026-Q2',
     'content': 'Over what cash price do points become compelling? Directional thresholds: domestic economy '
                'above $300 one-way, transcon economy above $450 one-way, Caribbean/Mexico above $600 round '
                'trip, transatlantic economy above $900-$1,000 round trip, transpacific economy above '
                '$1,300-$1,500 round trip, and long-haul business above $3,000 round trip can make points '
                'attractive if award pricing is reasonable.\n'
                'Premium cabins have a different threshold because cash prices can be inflated. A business-class '
                'award is compelling when it clears roughly 2.0 CPP after taxes/fees and the user actually '
                'values the cabin upgrade. Transpacific business can justify 3.0+ CPP targets.\n'
                'Dynamic awards should be compared to live cash prices. Fixed-chart partner awards can produce '
                'strong value even when cash fares are only moderately high.\n'
                "Zoe should phrase this as: 'The cash fare is high enough that points are worth checking, but I "
                "need the award price and fees to confirm.'",
     'summary': 'High cash fares make points worth checking, but Zoe needs award cost and fees before declaring '
                'a points win.'},

    {'id': 'breakeven-premium-cabin-by-program-route',
     'title': 'Premium Cabin Breakeven by Program and Route',
     'category': 'historical_patterns',
     'tags': ['points vs cash',
              'breakeven',
              'historical patterns',
              'premium cabin',
              'business class',
              'first class',
              'program breakeven'],
     'valid_as_of': '2026-Q2',
     'content': 'Premium cabin breakeven depends on program and route. United/Aeroplan/ANA/Avianca are strongest '
                'for Star Alliance premium space when surcharges are low. '
                'American/Alaska/Atmos/BA/Iberia/Cathay/Qatar are strongest for Oneworld depending on fees. '
                'Flying Blue/Virgin/Delta/Korean vary heavily because of dynamic or limited partner access.\n'
                'Transatlantic business is compelling around 45k-88k miles each way if fees are controlled and '
                'cash is above $3,000 round trip. Iberia off-peak, Flying Blue Promo Rewards, Aeroplan, and '
                'American/Alaska/Atmos partner awards are common targets.\n'
                'Transpacific business is compelling around 60k-110k miles each way when cash is $5,000-$10,000. '
                'ANA/JAL/EVA/Singapore/Cathay/Korean/Asiana space can create exceptional value.\n'
                'Middle East business is compelling when Qatar/Emirates/Etihad/Turkish/Aeroplan routings keep '
                'fees and mileage reasonable. First class should be treated as aspirational value, not a normal '
                'breakeven calculation.\n'
                "Zoe should compare against the user's realistic willingness to pay, not just retail premium "
                'cash fares.',
     'summary': 'Premium-cabin breakeven is program- and route-specific. Long-haul business often wins with '
                'saver space, while first class needs a realism check.'},

    {'id': 'breakeven-orphan-miles-problem',
     'title': 'The Orphan Miles Problem and When Lower CPP Is Acceptable',
     'category': 'historical_patterns',
     'tags': ['points vs cash',
              'breakeven',
              'historical patterns',
              'orphan miles',
              'miles expiration',
              'CPP',
              'breakage'],
     'valid_as_of': '2026-Q2',
     'content': 'The orphan miles problem happens when a user has miles in a program they rarely use, cannot '
                'easily top up, or risks losing to expiration or devaluation. In those cases, accepting lower '
                'CPP can be rational.\n'
                'A redemption below the usual threshold can make sense if it clears out a stranded balance, '
                'avoids expiration, prevents paying cash for a trip the user already needs, or uses miles in a '
                "program that is likely to devalue before the user's next use.\n"
                'Zoe should be careful not to over-recommend low-value redemptions with flexible bank points. '
                'The orphan-miles logic applies more to isolated airline/hotel balances than to Chase UR, Amex '
                'MR, Capital One, Citi, or Bilt points.\n'
                "Suggested Zoe phrasing: 'This is not a great theoretical CPP, but if these miles are stranded "
                "and you would otherwise pay cash, using them can still be reasonable.'",
     'summary': 'Lower CPP can be acceptable when miles are stranded, expiring, or hard to use. Do not apply '
                'this logic casually to flexible bank points.'},

    {'id': 'mileage-run-best-spend-per-mile-routes',
     'title': 'Mileage Run Patterns: Best Spend-Per-Mile Route Types',
     'category': 'historical_patterns',
     'tags': ['mileage run',
              'status',
              'historical patterns',
              'mileage run',
              'status',
              'spend per mile',
              'elite qualification'],
     'valid_as_of': '2026-Q2',
     'content': 'Mileage runs are advanced and should be framed carefully because modern airline status is often '
                'spend-based, not purely mileage-based. The historical best spend-per-mile opportunities come '
                'from long-distance discounted economy fares, partner premium fares with favorable earning '
                'tables, mistake fares, and unusual routings that add distance without much extra cost.\n'
                'Route types to watch: transcons on competitive markets, U.S.-Europe sale fares from secondary '
                "gateways, West Coast to Asia sales, and partner-operated long-haul fares credited to the user's "
                'target program. Hub-to-hub routes can be bad for mileage runs when fares are high, but good '
                'during fare wars.\n'
                'Zoe should not promise status from distance alone. United uses PQP/PQF logic, American uses '
                'Loyalty Points, Delta uses MQD logic, and Alaska/Atmos status has its own points and '
                'partner-earning rules.\n'
                'Suggested advice: calculate earning before booking. A cheap long route is only a mileage run if '
                'the fare class earns enough qualifying credit in the target program.',
     'summary': "Mileage runs now depend on each program's status math. The best candidates are discounted "
                'long-haul or partner fares with favorable earning rules.'},

    {'id': 'mileage-run-last-minute-status-runs',
     'title': 'Mileage Run Patterns: Last-Minute Status Runs',
     'category': 'historical_patterns',
     'tags': ['mileage run',
              'status',
              'historical patterns',
              'mileage run',
              'last-minute',
              'status requalification',
              'fare sales'],
     'valid_as_of': '2026-Q2',
     'content': 'Last-minute status runs usually occur in November and December when travelers realize they are '
                'short of elite qualification. Airlines do not reliably release cheap tickets for this purpose, '
                'but fare sales, low-demand weekends, and odd routings can create opportunities.\n'
                'The best last-minute patterns are Saturday turns, holiday-lull dates before Christmas week, '
                'early December midweek travel, and partner premium fares that post qualifying credit quickly. '
                'Same-day turns can work domestically, but long-haul partner runs require more risk tolerance.\n'
                'Users should avoid status runs that depend on uncertain posting times, tight connections, or '
                'pending partner credit when the qualification year is almost over. Missing credit can arrive '
                'after the deadline depending on program rules.\n'
                'Zoe should advise: verify fare class, qualifying credit, posting timeline, and whether the '
                'incremental benefits of status exceed the cost and time.',
     'summary': 'Last-minute status runs cluster in November/December but are risky. Verify fare class, '
                'crediting, and posting timing before booking.'},

    {'id': 'mileage-run-best-markets-by-status-target',
     'title': 'Mileage Run Patterns by Status Target: UA 1K, AA EXP, DL Diamond, AS MVP Gold 75K',
     'category': 'historical_patterns',
     'tags': ['mileage run',
              'status',
              'historical patterns',
              'United 1K',
              'AA Executive Platinum',
              'Delta Diamond',
              'Alaska MVP Gold 75K',
              'status target'],
     'valid_as_of': '2026-Q2',
     'content': 'For United 1K, historically useful markets include United hubs such as EWR, ORD, DEN, IAH, SFO, '
                'and LAX, especially when long-haul partner or premium fares produce meaningful PQP. Pure '
                'distance is less important than PQP and segment/PQF rules.\n'
                'For American Executive Platinum, the Loyalty Points system means status chasing can involve '
                'flights, portals, hotels, cards, shopping, and partner earning. Route markets like DFW, MIA, '
                'CLT, ORD, JFK, and PHL matter for flight options, but non-flight Loyalty Points can be more '
                'efficient.\n'
                'For Delta Diamond, MQD requirements make true mileage runs expensive. Useful patterns include '
                'Delta premium fare sales, partner-marketed/operated opportunities where crediting is favorable, '
                'and Delta Vacations or card-based status boosts when applicable.\n'
                'For Alaska/Atmos MVP Gold 75K-style targets, West Coast markets such as SEA, PDX, SFO, LAX, '
                'SAN, and ANC historically matter, plus partner long-haul earning. The Alaska/Hawaiian '
                'integration means Zoe must verify current Atmos earning choices and partner charts.\n'
                "Zoe should advise: status runs should start with the user's exact current progress, target "
                'tier, credit cards, fare class, and opportunity cost. Without that, give only general patterns.',
     'summary': 'Best status-run markets depend on the target program. UA, AA, Delta, and Alaska/Atmos all '
                'require different qualification math.'},

]
