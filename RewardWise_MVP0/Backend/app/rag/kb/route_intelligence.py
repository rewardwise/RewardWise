"""
rag/kb/route_intelligence.py
─────────────────────────────
KB articles for route-specific intelligence:
  - Best programs for specific city pairs
  - Award availability patterns by route
  - Typical cash vs points breakeven
  - Partner routing sweet spots per route

CATEGORY: route_intelligence

DATA STATUS: Completed route-category expansion.
This module covers every route bullet from the route_intelligence checklist:
  - 103 route/group articles
  - 2 cross-cutting meta requirements applied across the relevant articles:
    best programs, typical cash ranges, CPP sweet spots, and premium-cabin
    availability patterns.

Important implementation note:
Cash ranges are planning bands for Zoe's pre-search guidance, not live fare
quotes. Zoe should always prefer live search results when they exist.

UPDATE CADENCE:
  - Monthly for sweet-spot rates and award chart changes
  - Quarterly for route patterns and cash planning bands
"""

from __future__ import annotations

VALID_AS_OF = "2026-Q2"
CATEGORY = "route_intelligence"
CHECKLIST_ROUTE_ARTICLE_COUNT = 103

US_EUROPE_GATEWAYS = "JFK, EWR, BOS, ORD, ATL, DFW, MIA, LAX, SFO, IAD, PHL, CLT"


def _article(article_id: str, title: str, tags: list[str], content: str, summary: str) -> dict:
    """Return a KB article using the shared route_intelligence schema."""
    return {
        "id": article_id,
        "title": title,
        "category": CATEGORY,
        "tags": tags,
        "valid_as_of": VALID_AS_OF,
        "content": content.strip(),
        "summary": summary.strip(),
    }


def _program_sentence(programs: list[str]) -> str:
    return ", ".join(programs)


TRANSCON_ROUTES = [('nyc-lax', 'JFK/EWR/LGA → LAX', 'New York area to Los Angeles', ['JFK', 'EWR', 'LGA', 'LAX']),
 ('nyc-sfo', 'JFK/EWR/LGA → SFO', 'New York area to San Francisco', ['JFK', 'EWR', 'LGA', 'SFO']),
 ('nyc-sea', 'JFK/EWR/LGA → SEA', 'New York area to Seattle', ['JFK', 'EWR', 'LGA', 'SEA']),
 ('nyc-pdx', 'JFK/EWR/LGA → PDX', 'New York area to Portland', ['JFK', 'EWR', 'LGA', 'PDX']),
 ('bos-west-coast', 'BOS → LAX/SFO/SEA', 'Boston to West Coast premium routes', ['BOS', 'LAX', 'SFO', 'SEA']),
 ('ord-west-coast', 'ORD → LAX/SFO/SEA', 'Chicago to West Coast trunk routes', ['ORD', 'LAX', 'SFO', 'SEA']),
 ('atl-west-coast', 'ATL → LAX/SFO/SEA', 'Atlanta to West Coast trunk routes', ['ATL', 'LAX', 'SFO', 'SEA']),
 ('dfw-west-coast', 'DFW → LAX/SFO/SEA', 'Dallas/Fort Worth to West Coast trunk routes', ['DFW', 'LAX', 'SFO', 'SEA']),
 ('mia-west-coast', 'MIA → LAX/SFO/SEA', 'Miami to West Coast trunk routes', ['MIA', 'LAX', 'SFO', 'SEA']),
 ('den-northeast', 'DEN → JFK/EWR/BOS', 'Denver to Northeast trunk routes', ['DEN', 'JFK', 'EWR', 'BOS']),
 ('phx-northeast', 'PHX → JFK/EWR/BOS', 'Phoenix to Northeast trunk routes', ['PHX', 'JFK', 'EWR', 'BOS'])]

WESTERN_EUROPE_DESTINATIONS = [('lhr',
  'LHR',
  'London Heathrow',
  'London',
  ['British Airways', 'Virgin Atlantic', 'United', 'American', 'Delta'],
  'BA/Virgin/United/AA/Delta metal; BA Avios and Virgin are useful, but BA metal can have high surcharges.'),
 ('lgw',
  'LGW',
  'London Gatwick',
  'London Gatwick',
  ['British Airways', 'Norse Atlantic', 'JetBlue', 'Delta'],
  'Best when low-cost cash fares are high or JetBlue/BA space prices cleanly; check surcharges carefully.'),
 ('cdg',
  'CDG',
  'Paris',
  'Paris',
  ['Air France', 'Delta', 'United', 'American'],
  'Flying Blue Promo Rewards are the first place to check; Delta SkyMiles can work only when pricing is unusually low.'),
 ('ams',
  'AMS',
  'Amsterdam',
  'Amsterdam',
  ['KLM', 'Delta', 'United'],
  'Flying Blue is the core program; compare Delta only when SkyMiles calendar shows a real award deal.'),
 ('fra',
  'FRA',
  'Frankfurt',
  'Frankfurt',
  ['Lufthansa', 'United', 'Condor'],
  'Use Aeroplan/United/LifeMiles for Star Alliance availability; Miles & More has access but passes surcharges.'),
 ('muc',
  'MUC',
  'Munich',
  'Munich',
  ['Lufthansa', 'United'],
  'Similar to FRA: Aeroplan/United/LifeMiles for Star Alliance; last-seat Lufthansa premium awards are usually better close-in.'),
 ('zrh',
  'ZRH',
  'Zurich',
  'Zurich',
  ['SWISS', 'United'],
  'Aeroplan and United are the cleanest options for SWISS/United; premium cabin saver space can be scarce.'),
 ('vie',
  'VIE',
  'Vienna',
  'Vienna',
  ['Austrian', 'United'],
  'Aeroplan/United/LifeMiles are usually better than Miles & More when avoiding surcharges.'),
 ('fco',
  'FCO',
  'Rome',
  'Rome',
  ['ITA Airways', 'Delta', 'United', 'American'],
  'Flying Blue/SkyTeam and Star Alliance connections compete; summer cash fares are often high enough for awards.'),
 ('mxp',
  'MXP',
  'Milan',
  'Milan',
  ['Emirates', 'Delta', 'United', 'American'],
  'Look for Emirates fifth-freedom cash/award anomalies, Flying Blue, and Star Alliance connections.'),
 ('mad',
  'MAD',
  'Madrid',
  'Madrid',
  ['Iberia', 'American', 'Air Europa'],
  'Iberia Avios off-peak business is the standout sweet spot from East/Central U.S. gateways.'),
 ('bcn',
  'BCN',
  'Barcelona',
  'Barcelona',
  ['Iberia', 'Level', 'American', 'United'],
  'Iberia/Avios and AA are strong; summer cash fares can justify premium awards.'),
 ('lis',
  'LIS',
  'Lisbon',
  'Lisbon',
  ['TAP Air Portugal', 'United'],
  'TAP nonstop space through Aeroplan/United/LifeMiles can be excellent; compare TAP Miles&Go only case-by-case.'),
 ('dub',
  'DUB',
  'Dublin',
  'Dublin',
  ['Aer Lingus', 'United', 'American'],
  'Aer Lingus Avios can be good with lower fees than BA; AA/United work when nonstop saver space exists.'),
 ('arn',
  'ARN',
  'Stockholm',
  'Stockholm',
  ['SAS', 'Delta', 'United'],
  'SAS/Flying Blue/SkyTeam and Star Alliance routings both matter; direct service is more seasonal than London/Paris.'),
 ('cph',
  'CPH',
  'Copenhagen',
  'Copenhagen',
  ['SAS', 'United'],
  'Check SAS-linked SkyTeam/Flying Blue options and United/Aeroplan connections; nonstop premium space is limited.'),
 ('hel',
  'HEL',
  'Helsinki',
  'Helsinki',
  ['Finnair'],
  'Finnair/Avios and AA/Alaska partner access are the main angles; HEL is useful for Nordic/Baltic connections.'),
 ('osl',
  'OSL',
  'Oslo',
  'Oslo',
  ['Norse Atlantic', 'SAS'],
  'Cash fares can be unusually low; use points only when peak cash pricing or premium cabin value is strong.'),
 ('bru',
  'BRU',
  'Brussels',
  'Brussels',
  ['Brussels Airlines', 'United'],
  'Star Alliance via Aeroplan/United is the cleanest path; Flying Blue/BA connections are fallbacks.')]

EASTERN_EUROPE_ROUTES = [('waw',
  'JFK/EWR → WAW',
  'Warsaw',
  ['LOT Polish', 'United partners'],
  'Aeroplan/United/LifeMiles for LOT/Star Alliance; Miles & More can see space but surcharges may hurt.'),
 ('prg',
  'JFK/EWR → PRG',
  'Prague',
  ['Delta seasonal', 'United partners', 'Lufthansa Group'],
  'Often one-stop via AMS/CDG/FRA/MUC/ZRH/VIE; Flying Blue and Aeroplan are usually the first checks.'),
 ('bud',
  'JFK/EWR → BUD',
  'Budapest',
  ['LOT', 'Lufthansa Group', 'KLM/Air France'],
  'Often one-stop; Aeroplan/United for Star Alliance or Flying Blue for CDG/AMS routings.'),
 ('ath',
  'JFK/EWR → ATH',
  'Athens',
  ['Delta', 'United', 'American', 'Emirates'],
  'Summer demand is heavy; compare Flying Blue/Delta, United/Aeroplan, and AA/BA/Alaska.'),
 ('ist',
  'JFK/EWR → IST',
  'Istanbul',
  ['Turkish Airlines'],
  'Turkish Miles&Smiles can be strong, but Aeroplan/United/LifeMiles may be simpler and avoid some booking friction.')]

EAST_ASIA_ROUTES = [('nrt',
  'LAX/SFO/SEA → NRT',
  'Tokyo Narita',
  ['ANA', 'JAL', 'United', 'American', 'Delta'],
  'Virgin Atlantic to ANA, ANA Mileage Club, Aeroplan/United for ANA, and AA/Alaska for JAL are the key premium paths.'),
 ('hnd',
  'LAX/SFO/SEA → HND',
  'Tokyo Haneda',
  ['ANA', 'JAL', 'United', 'American', 'Delta'],
  'Same sweet spots as NRT, but HND is more convenient and often more competitive for premium awards.'),
 ('kix',
  'LAX/SFO/SEA → KIX',
  'Osaka Kansai',
  ['JAL', 'ANA', 'United partners'],
  'Nonstop/one-stop mix; Tokyo/Seoul/Taipei connections are common, so compare final itinerary time.'),
 ('ngo',
  'LAX/SFO/SEA → NGO',
  'Nagoya',
  ['ANA', 'JAL'],
  'Usually best via Tokyo; direct award space is less common, so set alerts through ANA/JAL partner programs.'),
 ('icn',
  'LAX/SFO/SEA → ICN',
  'Seoul Incheon',
  ['Korean Air', 'Asiana', 'Delta', 'United'],
  'Aeroplan/United for Asiana/Star Alliance and Flying Blue/Virgin/Delta angles for Korean/Delta; Delta can price high.'),
 ('pvg',
  'LAX/SFO/SEA → PVG',
  'Shanghai Pudong',
  ['United', 'Delta', 'China Eastern', 'Air China'],
  'Capacity and rules shift often; use Aeroplan/United for Star Alliance or Flying Blue/Delta for SkyTeam when space exists.'),
 ('pek-pkx',
  'LAX/SFO/SEA → PEK/PKX',
  'Beijing',
  ['Air China', 'United', 'Hainan'],
  'Air China via Aeroplan/United/LifeMiles is the cleanest alliance path; cash fares can swing widely.'),
 ('hkg',
  'LAX/SFO/SEA → HKG',
  'Hong Kong',
  ['Cathay Pacific', 'United'],
  'Cathay through Asia Miles/AA/Alaska/BA/Qatar Avios; United/Aeroplan for Star Alliance alternatives.'),
 ('tpe',
  'LAX/SFO/SEA → TPE',
  'Taipei',
  ['EVA Air', 'China Airlines', 'United', 'Starlux'],
  'EVA Royal Laurel via Aeroplan/United/LifeMiles is the premium sweet spot; China Airlines via Flying Blue/Delta can be useful.'),
 ('mnl',
  'LAX/SFO → MNL',
  'Manila',
  ['Philippine Airlines', 'United partners', 'Cathay/EVA/ANA/JAL connections'],
  'Nonstop cash can be high; awards often route through TPE/HKG/TYO/ICN.'),
 ('kul',
  'LAX/SFO → KUL',
  'Kuala Lumpur',
  ['Malaysia Airlines', 'Singapore Airlines', 'Cathay', 'JAL'],
  'Usually one-stop; compare oneworld through HKG/TYO and Star Alliance through SIN/TPE.'),
 ('sin',
  'LAX/SFO → SIN',
  'Singapore',
  ['Singapore Airlines', 'United'],
  'Singapore KrisFlyer and Aeroplan are core; ultra-long-haul nonstop premium awards are valuable but scarce.'),
 ('bkk',
  'LAX/SFO → BKK',
  'Bangkok',
  ['Thai', 'EVA', 'ANA', 'JAL', 'Cathay', 'Singapore'],
  'No dominant U.S. nonstop; the best award is usually whichever premium seat opens via TPE/TYO/HKG/SIN/ICN.'),
 ('cgk',
  'LAX/SFO → CGK',
  'Jakarta',
  ['Singapore', 'ANA', 'JAL', 'Cathay', 'EVA'],
  'Treat as Southeast Asia long-haul; Aeroplan/KrisFlyer/AA/Alaska can all win depending on connection.'),
 ('sgn',
  'LAX/SFO → SGN',
  'Ho Chi Minh City',
  ['Vietnam Airlines partners', 'EVA', 'ANA', 'JAL', 'Cathay'],
  'Often best via TPE/TYO/HKG/ICN; cash can be competitive in economy, points shine in business.'),
 ('han',
  'LAX/SFO → HAN',
  'Hanoi',
  ['Vietnam Airlines partners', 'EVA', 'ANA', 'JAL', 'Cathay'],
  'Same logic as SGN, with fewer nonstop-style options; premium awards usually require one connection.')]

SOUTH_ASIA_ROUTES = [('del',
  'JFK/EWR/ORD/LAX/SFO → DEL',
  'Delhi',
  ['Air India', 'United', 'Qatar', 'Emirates', 'Etihad', 'Turkish'],
  'Compare Star Alliance nonstop/one-stop via Aeroplan/United/LifeMiles against Middle East routings through AA/Qatar, Emirates, Etihad, '
  'or Turkish.'),
 ('bom',
  'JFK/EWR/ORD/LAX/SFO → BOM',
  'Mumbai',
  ['Air India', 'United partners', 'Qatar', 'Emirates', 'Etihad', 'Turkish'],
  'Premium cash is often high; Qsuite/Etihad/Emirates/Turkish and Star Alliance are all viable.'),
 ('blr',
  'JFK/EWR → BLR',
  'Bangalore',
  ['Air India', 'Lufthansa Group', 'Qatar', 'Emirates', 'Etihad'],
  'Usually one-stop; Aeroplan/United for Star Alliance or AA/Qatar/Etihad/Emirates paths depending availability.')]

AUSTRALIA_NEW_ZEALAND_ROUTES = [('syd',
  'LAX/SFO → SYD',
  'Sydney',
  ['United', 'American', 'Qantas', 'Delta'],
  'Qantas/AA premium space is extremely hard; United/Aeroplan and Fiji/Alaska/AA alternatives can help.'),
 ('mel',
  'LAX/SFO → MEL',
  'Melbourne',
  ['United', 'Qantas'],
  'Premium awards are scarce; book at schedule open or close-in and compare United/Aeroplan/Qantas/AA.'),
 ('bne',
  'LAX/SFO → BNE',
  'Brisbane',
  ['United', 'Qantas'],
  'Slightly less searched than SYD/MEL but still scarce; flexibility and alerts matter.'),
 ('akl',
  'LAX/SFO → AKL',
  'Auckland',
  ['Air New Zealand', 'United', 'American/Qantas'],
  'Air New Zealand premium awards are rare; United/Aeroplan, AA/Qantas, and cash premium sales should all be compared.')]

MIDDLE_EAST_ROUTES = [('dxb',
  'JFK/EWR/ORD/ATL/LAX → DXB',
  'Dubai',
  ['Emirates', 'United partners'],
  'Emirates Skywards is the direct path but surcharges can be high; compare Air Canada Aeroplan where Emirates pricing is favorable.'),
 ('doh',
  'JFK/EWR/ORD/ATL/LAX → DOH',
  'Doha',
  ['Qatar Airways'],
  'Qatar Qsuite through Qatar Avios, BA Avios, AA, or Alaska is the premium target; saver/non-flex availability matters.'),
 ('auh',
  'JFK/EWR/ORD/LAX → AUH',
  'Abu Dhabi',
  ['Etihad'],
  'Etihad Guest and AAdvantage-style partner access can be valuable; First Apartment is aircraft/route dependent.'),
 ('tlv',
  'JFK/EWR/LAX → TLV',
  'Tel Aviv',
  ['El Al', 'United', 'Delta', 'American partners'],
  'Availability and operations can change quickly; check live schedules, security-related disruptions, and alliance alternatives.'),
 ('amm',
  'JFK/EWR/LAX → AMM',
  'Amman',
  ['Royal Jordanian'],
  'Royal Jordanian via AAdvantage/BA/Qatar Avios is the core path; connections through Europe/Doha/Istanbul are fallbacks.'),
 ('bey',
  'JFK/EWR/LAX → BEY',
  'Beirut',
  ['MEA', 'Turkish', 'Qatar', 'Emirates'],
  'Usually one-stop; Flying Blue for MEA/SkyTeam and Turkish/Qatar/Emirates routings can all work.')]

AFRICA_ROUTES = [('jnb',
  'JFK/EWR → JNB',
  'Johannesburg',
  ['United', 'Delta', 'South African partners', 'Qatar', 'Emirates', 'Ethiopian'],
  'Nonstop premium awards are very scarce; Star Alliance and Middle East routings are the main alternatives.'),
 ('cpt',
  'JFK/EWR → CPT',
  'Cape Town',
  ['United', 'Delta', 'Qatar', 'Emirates', 'Ethiopian'],
  'Seasonality is heavy; premium cabins price high in cash, so flexible award alerts are essential.'),
 ('nbo',
  'JFK/EWR → NBO',
  'Nairobi',
  ['Kenya Airways', 'KLM', 'Air France', 'Qatar', 'Ethiopian'],
  'Flying Blue for Kenya/KLM/Air France and Aeroplan/United for Ethiopian are key.'),
 ('add',
  'JFK/EWR → ADD',
  'Addis Ababa',
  ['Ethiopian Airlines'],
  'Ethiopian via Aeroplan/United/LifeMiles is the primary play; connections onward in Africa can add value.'),
 ('cmn',
  'JFK/EWR → CMN',
  'Casablanca',
  ['Royal Air Maroc'],
  'Royal Air Maroc via AAdvantage/BA/Qatar Avios is the key partner path; useful gateway to North/West Africa.'),
 ('los',
  'JFK/EWR → LOS',
  'Lagos',
  ['Delta', 'United', 'British Airways', 'KLM', 'Air France', 'Qatar'],
  'Cash fares can be high; compare Flying Blue, Virgin/Delta, United/Aeroplan, and BA/AA routes.'),
 ('acc',
  'JFK/EWR → ACC',
  'Accra',
  ['Delta', 'United partners', 'British Airways', 'KLM', 'Air France'],
  'Similar to LOS; Flying Blue and Delta/United partner options are often the first checks.')]

LATIN_AMERICA_CARIBBEAN_ROUTES = [('cun',
  'JFK/MIA/ATL → CUN',
  'Cancun',
  ['American', 'Delta', 'United', 'JetBlue', 'Southwest'],
  'Cash is often cheap; use points only when peak school-holiday pricing pushes cpp above threshold.'),
 ('mbj',
  'JFK/MIA → MBJ',
  'Montego Bay',
  ['American', 'JetBlue', 'Delta', 'United', 'Southwest'],
  'Good for JetBlue/Southwest/AA when cash spikes; nonstop leisure demand is seasonal.'),
 ('puj',
  'JFK/MIA → PUJ',
  'Punta Cana',
  ['JetBlue', 'American', 'Delta', 'United'],
  'Usually cash-first unless holidays/school breaks; JetBlue TrueBlue tracks cash closely.'),
 ('nas',
  'JFK/MIA → NAS',
  'Nassau',
  ['American', 'JetBlue', 'Delta', 'United'],
  'Short-haul Avios/AA can work from MIA; NYC cash often wins off-peak.'),
 ('gcm',
  'JFK/MIA → GCM',
  'Grand Cayman',
  ['American', 'JetBlue', 'United'],
  'AA from MIA can be a good short-haul award; otherwise compare cash.'),
 ('sju',
  'JFK/MIA → SJU',
  'San Juan',
  ['JetBlue', 'American', 'Delta', 'United', 'Southwest'],
  'High frequencies make cash competitive; points shine around holidays or last-minute trips.'),
 ('bda',
  'JFK/MIA → BDA',
  'Bermuda',
  ['JetBlue', 'American', 'Delta'],
  'Short flight, seasonal fare spikes; Avios/AA/JetBlue can work when cash jumps.'),
 ('uvf',
  'JFK/MIA → UVF',
  'St. Lucia',
  ['JetBlue', 'American', 'Delta'],
  'Less frequency means higher peak cash; award space is best in shoulder season.'),
 ('anu',
  'JFK/MIA → ANU',
  'Antigua',
  ['JetBlue', 'American', 'Delta'],
  'Similar to UVF: cash-first off-peak, points valuable around winter/spring breaks.'),
 ('gru',
  'MIA/JFK → GRU',
  'São Paulo',
  ['American', 'Delta/LATAM', 'United', 'LATAM'],
  'Premium awards via AA, Delta/LATAM, United/Aeroplan, or Avios partners; cash sales happen.'),
 ('gig',
  'MIA/JFK → GIG',
  'Rio de Janeiro',
  ['American', 'Delta/LATAM', 'United'],
  'Seasonal demand for Carnival/New Year; compare cash sales vs AA/Delta/United awards.'),
 ('eze',
  'MIA/JFK → EZE',
  'Buenos Aires',
  ['American', 'Delta/LATAM', 'United', 'Aerolineas Argentinas'],
  'Long distance makes premium awards attractive; cash can swing due to season/currency effects.'),
 ('lim',
  'MIA/JFK → LIM',
  'Lima',
  ['American', 'Delta/LATAM', 'United', 'Avianca'],
  'MIA has strong nonstop coverage; Avios/AA can be good when cash is high.'),
 ('bog',
  'MIA/JFK → BOG',
  'Bogotá',
  ['Avianca', 'American', 'Delta', 'United'],
  'Avianca LifeMiles and United/Aeroplan can be strong; cash often wins in economy.'),
 ('scl',
  'MIA/JFK → SCL',
  'Santiago',
  ['American', 'Delta/LATAM'],
  'Long nonstop, premium cash high; AA/LATAM/Delta availability drives the decision.'),
 ('uio',
  'MIA/JFK → UIO',
  'Quito',
  ['Avianca', 'American', 'Delta', 'United'],
  'Often one-stop; LifeMiles/Aeroplan/AA are useful but compare cash closely.'),
 ('mvd',
  'MIA/JFK → MVD',
  'Montevideo',
  ['American partners', 'LATAM', 'Copa', 'Avianca'],
  'Limited nonstop options; Panama/Bogotá/Lima/São Paulo connections are common.'),
 ('asu',
  'MIA/JFK → ASU',
  'Asunción',
  ['Copa', 'Avianca', 'LATAM'],
  'Usually one-stop; Copa via United/Aeroplan/ConnectMiles and Avianca LifeMiles can be useful.'),
 ('pty',
  'MIA → PTY',
  'Panama City',
  ['Copa', 'United partners'],
  'Short, high-frequency business/leisure route; cash often wins unless last-minute.')]

MEXICO_ROUTES = [('mex',
  'US → MEX',
  'Mexico City',
  ['Aeromexico', 'Delta', 'United', 'American', 'Volaris'],
  'Delta/Aeromexico and Flying Blue/SkyTeam can work; cash often competitive from major U.S. gateways.'),
 ('gdl',
  'US → GDL',
  'Guadalajara',
  ['Volaris', 'Aeromexico', 'American', 'United'],
  'Cash/low-cost carriers often dominate; points become useful last-minute or holidays.'),
 ('sjd',
  'US → SJD',
  'Los Cabos',
  ['American', 'Delta', 'United', 'Alaska', 'Southwest'],
  'Peak resort dates can make awards valuable; otherwise cash-first.'),
 ('pvr',
  'US → PVR',
  'Puerto Vallarta',
  ['American', 'Delta', 'United', 'Alaska', 'Southwest'],
  'Similar to SJD, with winter/spring break spikes.'),
 ('mzt', 'US → MZT', 'Mazatlán', ['American', 'Alaska', 'United'], 'Fewer flights; check Alaska/AA/United awards when cash rises.'),
 ('zih',
  'US → ZIH',
  'Zihuatanejo',
  ['American', 'United', 'Alaska'],
  'Thin service means cash can spike; points are best during peak resort season.'),
 ('hux', 'US → HUX', 'Huatulco', ['American', 'United', 'Aeromexico'], 'Limited service; awards can be useful when cash pricing is high.'),
 ('oax',
  'US → OAX',
  'Oaxaca',
  ['American', 'United', 'Aeromexico', 'Volaris'],
  'Cash-first from many gateways; points useful during festivals/holidays.')]

DOMESTIC_LEISURE_ROUTES = [('east-coast-florida',
  'East Coast → Florida (JFK/BOS/ORD → MIA/MCO/TPA/FLL)',
  'Florida leisure routes',
  ['American', 'JetBlue', 'Delta', 'United', 'Southwest'],
  'High frequency keeps cash low; points are mostly for holidays, last-minute trips, or family flexibility.'),
 ('las',
  'US → LAS',
  'Las Vegas',
  ['Southwest', 'Spirit', 'Frontier', 'Delta', 'United', 'American'],
  'Almost always pay cash in economy unless cash is high and flexible points price well.'),
 ('hnl',
  'US → HNL',
  'Honolulu',
  ['United', 'American', 'Delta', 'Hawaiian', 'Alaska', 'Southwest'],
  'Economy can be cash-first, but premium cabin awards can be excellent, especially from West Coast gateways.'),
 ('hawaii-neighbor-islands',
  'US → OGG/KOA/LIH',
  'Maui, Kona, Kauai',
  ['United', 'American', 'Delta', 'Hawaiian', 'Alaska', 'Southwest'],
  'Neighbor-island demand is seasonal; premium awards and family trips can justify points.'),
 ('anc',
  'US → ANC',
  'Anchorage',
  ['Alaska', 'Delta', 'United', 'American'],
  'Alaska Mileage Plan and cash sales both matter; summer cash spikes can make points valuable.')]


def _make_transcon_article(slug: str, route_set: str, label: str, tags: list[str]) -> dict:
    premium_note = (
        "Mint/Polaris/Delta One availability patterns: JFK-LAX and JFK-SFO are the deepest premium transcon markets. "
        "JetBlue Mint can price attractively when cash is high but TrueBlue generally tracks the cash fare. "
        "United premium transcon space is strongest around EWR-SFO/LAX and is best checked with United/Aeroplan. "
        "Delta One space is most useful when Virgin Atlantic or Delta itself shows unusually low pricing. "
        "On non-NYC transcons, domestic first often replaces true lie-flat business, so Zoe should not imply Mint/Polaris/Delta One unless the operating flight actually offers it."
    )
    content = f"""
Route set: {route_set}.
Route category: U.S. transcontinental / long domestic trunk route.
Typical cash ranges: economy $120-$420 one-way in normal periods, $450-$850+ one-way around peak holidays or last-minute business demand; premium economy/domestic extra-legroom $220-$700 one-way; lie-flat Mint/Polaris/Delta One or premium transcon business $650-$1,900 one-way when offered. For BOS/ORD/ATL/DFW/MIA/DEN/PHX variants, expect fewer true lie-flat frequencies than JFK/EWR-LAX/SFO.
Best programs: JetBlue TrueBlue for Mint when point pricing is favorable; American AAdvantage or Alaska Mileage Plan for AA-operated premium routes; United MileagePlus or Air Canada Aeroplan for United-operated transcon space; Delta SkyMiles or Virgin Atlantic for Delta One only when the award price is unusually low; Southwest Rapid Rewards for cash-linked economy when flexibility matters.
CPP sweet spots: economy is usually a cash booking unless the redemption clears 1.3 cpp; flexible bank points should generally target 1.5 cpp+; premium transcon awards are good at 1.8 cpp+, strong at 2.2 cpp+, and excellent above 3.0 cpp when cash fares are over $1,200 one-way.
Availability patterns: Tuesday/Wednesday/Saturday departures price better than Monday/Thursday/Friday business peaks; holiday weekends, Thanksgiving, Christmas/New Year, spring break, and late-summer Sundays are the hardest. Search 2-5 months out for leisure dates and again inside 14 days for unsold premium seats.
{premium_note}
Zoe recommendation template: For {route_set}, start with cash if economy is under $250 one-way. Use points only if the live search beats the cpp thresholds above or if the user specifically wants lie-flat premium space and cash is high.
"""
    return _article(
        f"route-{slug}-transcon",
        f"{route_set} — Transcon Route Intelligence",
        tags + ["transcon", "domestic premium", "Mint", "Polaris", "Delta One", "cash vs points"],
        content,
        f"Covers {route_set} with best programs, cash planning bands, cpp thresholds, and premium transcon availability patterns.",
    )


def _make_western_europe_article(slug: str, airport: str, city: str, label: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {US_EUROPE_GATEWAYS} → {airport} ({city}).
Route category: Transatlantic — U.S. to Western Europe.
Operating airlines to check first: {_program_sentence(operators)}. Exact nonstop availability varies by gateway and season, so Zoe should verify live schedules before naming a nonstop.
Typical cash ranges: economy $450-$950 round-trip in shoulder/off-peak periods and $900-$1,600+ in peak summer/holidays; premium economy $900-$1,900 round-trip; business class $2,200-$6,500 round-trip, with London and summer Italy/Spain often pricing higher.
Best programs: Flying Blue for Air France/KLM routes and Promo Rewards; Air Canada Aeroplan, United MileagePlus, and Avianca LifeMiles for Star Alliance-operated routes; American AAdvantage and Alaska Mileage Plan for American/Oneworld partners; British Airways/Iberia/Qatar Avios for Avios-accessible space; Virgin Atlantic for Virgin-operated or select Delta/Virgin partner opportunities.
Route-specific play: {note}
CPP sweet spots: transatlantic economy is only compelling above 1.3-1.5 cpp; premium economy should clear 1.6 cpp+; business class is strong at 2.0 cpp+ and excellent at 3.0 cpp+. Iberia off-peak Spain routes and Flying Blue Promo Rewards can beat these thresholds by a lot.
Fuel surcharge warning: British Airways metal can carry large surcharges through Avios and AAdvantage/Alaska partners; Lufthansa Group and Air France/KLM can also add carrier-imposed charges depending on booking program. United, Aeroplan, LifeMiles, and Alaska-style partner bookings are often cleaner when saver space exists.
Availability patterns: book 10-11 months out for hard-to-get summer business class, watch monthly Flying Blue Promo Rewards, and re-check inside 14 days for Lufthansa Group and some last-seat premium releases. Avoid assuming nonstop availability from every gateway.
Zoe recommendation template: For {airport}, compare live cash against Flying Blue, Aeroplan/United/LifeMiles, AAdvantage/Alaska, and Avios options. Push users away from high-surcharge Avios bookings unless the mileage price is unusually low or cash is extremely high.
"""
    return _article(
        f"route-us-{slug}-western-europe",
        f"US Gateways to {airport} {city} — Western Europe Award Guide",
        ["transatlantic", "Western Europe", airport, city, "award availability", "cash vs points"] + operators,
        content,
        f"Covers all major U.S. gateways to {airport} with best programs, cash ranges, surcharge traps, cpp thresholds, and booking windows.",
    )


def _make_eastern_europe_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Transatlantic — U.S. to Eastern Europe / Balkans.
Typical cash ranges: economy $550-$1,150 round-trip in shoulder periods and $1,000-$1,900+ in summer/holidays; business class $2,800-$7,000 round-trip.
Best programs: Air Canada Aeroplan, United MileagePlus, and Avianca LifeMiles for Star Alliance routings; Flying Blue for Air France/KLM connections; American AAdvantage, Alaska, BA Avios, or Qatar Avios for Oneworld options; Turkish Miles&Smiles when Turkish routing is available and pricing beats the easier programs.
Route-specific play: {note}
CPP sweet spots: economy needs 1.4 cpp+ to justify flexible points; business class is attractive above 2.2 cpp and excellent above 3.0 cpp because cash fares are often high and nonstop competition is thinner.
Availability patterns: nonstop service is more seasonal and less frequent than London/Paris; one-stop routings through FRA/MUC/ZRH/VIE/AMS/CDG/IST are often better. Search 9-11 months out for summer, then again inside 21 days for late premium releases.
Zoe recommendation template: Treat {city} as a connection-sensitive route. Ask whether the user values nonstop convenience or lowest points, then compare Star Alliance, Flying Blue/SkyTeam, Oneworld, and Turkish options.
"""
    return _article(
        f"route-{slug}-eastern-europe",
        f"{route_set} — {city} Award Guide",
        [slug.upper(), city, "Eastern Europe", "Balkans", "transatlantic"] + operators,
        content,
        f"Covers {route_set} with route-specific programs, cash bands, cpp thresholds, and connection guidance.",
    )


def _make_east_asia_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Transpacific — U.S. to East Asia.
Typical cash ranges: economy $650-$1,350 round-trip in normal periods and $1,200-$2,200+ during peak school holidays, cherry blossom, Golden Week, Christmas/New Year, or major events; premium economy $1,200-$2,600; business class $3,200-$9,000+ round-trip.
Best programs: Air Canada Aeroplan and United MileagePlus for Star Alliance; Avianca LifeMiles where pricing/search works; American AAdvantage and Alaska Mileage Plan for JAL/Cathay/Oneworld; Virgin Atlantic for ANA where partner chart space exists; ANA Mileage Club for advanced round-trip users; Cathay Asia Miles for Cathay; Flying Blue/Delta/Virgin paths for SkyTeam/Korean/China Airlines routes.
Route-specific play: {note}
CPP sweet spots: economy usually needs 1.4 cpp+; premium economy should be 1.7 cpp+; business class is strong at 2.5 cpp+ and excellent above 4.0 cpp because cash prices are high. First class redemptions can exceed 5.0 cpp but availability is extremely limited.
Availability patterns: ANA/JAL premium space is best at schedule open, with occasional close-in releases; Korea/Taiwan/Hong Kong routes can open in waves; peak periods include cherry blossom, Golden Week, summer family travel, and year-end. Search by individual segment and be flexible between LAX/SFO/SEA.
Zoe recommendation template: For {route_set}, prioritize live award availability over theoretical sweet spots. If no nonstop premium award exists, compare one-stop routings through Tokyo, Seoul, Taipei, Hong Kong, or Singapore before recommending cash.
"""
    return _article(
        f"route-{slug}-east-asia",
        f"{route_set} — East Asia Award Guide",
        [slug.upper(), city, "East Asia", "transpacific", "business class"] + operators,
        content,
        f"Covers {route_set} with best programs, premium cabin sweet spots, cash ranges, and East Asia availability patterns.",
    )


def _make_south_asia_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Transpacific / polar / Middle East connecting — U.S. to South Asia.
Typical cash ranges: economy $750-$1,600 round-trip in normal periods and $1,300-$2,500+ around school breaks, wedding season, Diwali, Eid, and December/January; business class $3,500-$10,000+ round-trip.
Best programs: Air Canada Aeroplan, United MileagePlus, and LifeMiles for Air India/Star Alliance; American AAdvantage, Qatar Avios, and Alaska for Qatar/Qsuite or other oneworld routings; Emirates Skywards/Aeroplan for Emirates when pricing is acceptable; Etihad Guest or partner access for Etihad; Turkish Miles&Smiles/Capital One/Citi for Turkish routings.
Route-specific play: {note}
CPP sweet spots: economy should usually clear 1.5 cpp+; business class is strong at 2.5 cpp+ and excellent above 4.0 cpp. Middle East business class routings can be worth extra time if they avoid poor hard products or high cash fares.
Availability patterns: nonstop and one-stop premium space is hard during India peak travel windows. Search 10-11 months out, use nearby gateways, and consider split tickets if domestic positioning unlocks a major premium award.
Zoe recommendation template: For {city}, compare total trip time, surcharge exposure, and aircraft quality. Do not recommend the lowest-mile option if it creates a bad long layover or inferior cabin.
"""
    return _article(
        f"route-{slug}-south-asia",
        f"{route_set} — South Asia Award Guide",
        [slug.upper(), city, "South Asia", "India", "business class"] + operators,
        content,
        f"Covers {route_set} with India/South Asia cash bands, programs, cpp thresholds, and peak-season warnings.",
    )


def _make_australia_nz_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Transpacific — U.S. to Australia/New Zealand.
Typical cash ranges: economy $750-$1,600 round-trip in shoulder periods and $1,300-$2,500+ in peak U.S./Australia/NZ summer; premium economy $1,600-$3,200; business class $4,500-$11,000+ round-trip.
Best programs: United MileagePlus and Air Canada Aeroplan for United/Air New Zealand/Star Alliance; American AAdvantage, Alaska Mileage Plan, and Qantas Frequent Flyer for Qantas/American; Fiji Airways through Alaska/AAdvantage/partner programs as a useful connection; Delta/Virgin-style options where Delta space exists.
Route-specific play: {note}
CPP sweet spots: economy needs 1.5 cpp+; business class is strong at 2.8 cpp+ and excellent above 4.5 cpp due to extreme cash prices and scarce saver inventory.
Availability patterns: premium awards are among the hardest in the world. Search at schedule open, set alerts, consider Fiji/Nadi, Honolulu, Tokyo, or Auckland positioning, and re-check close-in for unsold premium seats.
Zoe recommendation template: For {route_set}, tell users to be flexible first. If premium cabin space appears at a sane rate, it is usually worth booking immediately before optimizing further.
"""
    return _article(
        f"route-{slug}-australia-new-zealand",
        f"{route_set} — Australia/New Zealand Award Guide",
        [slug.upper(), city, "Australia", "New Zealand", "transpacific", "scarce award space"] + operators,
        content,
        f"Covers {route_set} with cash bands, scarce premium award patterns, best programs, and cpp thresholds.",
    )


def _make_middle_east_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Middle East.
Typical cash ranges: economy $700-$1,400 round-trip in normal periods and $1,200-$2,300+ peak; business class $3,000-$9,500+ round-trip, with premium products like Qsuite, Emirates business/first, and Etihad premium cabins commanding high cash prices.
Best programs: Qatar Privilege Club/BA Avios/American AAdvantage/Alaska for Qatar and oneworld; Emirates Skywards or Air Canada Aeroplan for Emirates; Etihad Guest and partner programs for Etihad; Air Canada Aeroplan, United, LifeMiles, or Turkish for Star Alliance/Turkish routings.
Route-specific play: {note}
CPP sweet spots: economy needs 1.4 cpp+; business class is strong at 2.3 cpp+ and excellent at 3.5 cpp+. First class can be exceptional but may include high surcharges or limited availability.
Availability patterns: award space is aircraft, gateway, and political/security dependent. Qsuite saver space can disappear quickly; Emirates premium awards price high but can still beat cash; TLV/AMM/BEY require extra schedule verification.
Zoe recommendation template: For {city}, prioritize product quality, total taxes/fees, and routing. Warn users when the award has high surcharges or operational uncertainty.
"""
    return _article(
        f"route-{slug}-middle-east",
        f"{route_set} — Middle East Award Guide",
        [slug.upper(), city, "Middle East", "Qsuite", "Emirates", "Etihad"] + operators,
        content,
        f"Covers {route_set} with Middle East programs, cash bands, cpp thresholds, surcharge cautions, and availability notes.",
    )


def _make_africa_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Africa.
Typical cash ranges: economy $850-$1,700 round-trip in normal periods and $1,400-$2,800+ peak; business class $3,800-$10,000+ round-trip, especially for Southern Africa and limited nonstop markets.
Best programs: Air Canada Aeroplan, United MileagePlus, and LifeMiles for Ethiopian/Star Alliance; Flying Blue for Air France/KLM/Kenya Airways/SkyTeam; Virgin Atlantic/Delta where Delta space exists; American AAdvantage, Alaska, Qatar Avios, or BA Avios for Qatar/BA/Royal Air Maroc/onward oneworld routings.
Route-specific play: {note}
CPP sweet spots: economy should clear 1.5 cpp+; business class is strong at 2.5 cpp+ and excellent at 4.0 cpp+. High cash fares and long trip duration make good premium awards especially valuable.
Availability patterns: nonstop premium space is rare; one-stop routings through ADD, DOH, DXB, IST, AMS, CDG, LHR, or CMN often beat waiting for a nonstop. Search 9-11 months out and again inside 30 days.
Zoe recommendation template: For {city}, compare nonstop convenience against one-stop award value. Do not overvalue a cheap award if it adds multiple stops or risky connections.
"""
    return _article(
        f"route-{slug}-africa",
        f"{route_set} — Africa Award Guide",
        [slug.upper(), city, "Africa", "business class", "long haul"] + operators,
        content,
        f"Covers {route_set} with Africa route programs, cash bands, premium-cabin guidance, and routing patterns.",
    )


def _make_latin_caribbean_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    is_south_america = slug in {"gru", "gig", "eze", "lim", "bog", "scl", "uio", "mvd", "asu", "pty"}
    cash = "$350-$900 round-trip for Caribbean/Mexico-style leisure routes, $700-$1,600+ for longer South America routes" if is_south_america else "$220-$650 round-trip in normal periods and $550-$1,100+ around school breaks, winter holidays, and peak resort weeks"
    premium = "$1,800-$5,500+ round-trip for lie-flat/long-haul premium cabins" if is_south_america else "$500-$1,500+ round-trip for domestic-style first/business where offered"
    content = f"""
Route set: {route_set} ({city}).
Route category: Latin America / Caribbean.
Typical cash ranges: economy {cash}; premium cabin {premium}. These are planning bands only; live fare search should override.
Best programs: American AAdvantage and British Airways/Qatar Avios for AA-operated short and medium-haul routes; JetBlue TrueBlue where JetBlue operates; Southwest Rapid Rewards for leisure markets it serves; United MileagePlus/Aeroplan/LifeMiles for United/Avianca/Copa/Star Alliance; Delta SkyMiles/Flying Blue/Virgin-style access for Delta/LATAM/SkyTeam-style options.
Route-specific play: {note}
CPP sweet spots: for Caribbean leisure, economy awards should usually beat 1.3 cpp and ideally 1.5 cpp because cash is often cheap; for South America, economy should clear 1.4 cpp and business class is strong above 2.2 cpp. Family trips can justify slightly lower cpp if cash outlay is large.
Availability patterns: resort routes peak around Christmas/New Year, Presidents' Week, spring break, and summer weekends; South America premium space is route-specific and often improves at schedule open or close-in. MIA routes often have the best nonstop coverage.
Zoe recommendation template: For {route_set}, default to cash when economy fares are cheap. Recommend points when live cash spikes, the user needs flexibility, or a premium South America award clears the cpp thresholds.
"""
    return _article(
        f"route-{slug}-latin-caribbean",
        f"{route_set} — Latin America/Caribbean Points vs Cash Guide",
        [slug.upper(), city, "Latin America", "Caribbean", "leisure", "cash vs points"] + operators,
        content,
        f"Covers {route_set} with cash-vs-points guidance, best programs, cpp thresholds, and peak leisure timing.",
    )


def _make_mexico_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Mexico beyond Cancun.
Typical cash ranges: economy $220-$650 round-trip from major U.S. gateways, $500-$1,100+ around holidays, spring break, festivals, and last-minute trips; premium/domestic first $500-$1,600+ round-trip where offered.
Best programs: American AAdvantage and Avios for AA-operated routes; United MileagePlus/Aeroplan/LifeMiles for United routes; Delta SkyMiles/Flying Blue for Delta/Aeromexico; Southwest Rapid Rewards where Southwest serves the city; Alaska Mileage Plan for Alaska-heavy West Coast Mexico service.
Route-specific play: {note}
CPP sweet spots: Mexico economy awards should usually clear 1.3 cpp and ideally 1.5 cpp because cash can be low; points make more sense for holidays, remote resort airports, multiple travelers, or when baggage/flexibility changes the cash comparison.
Availability patterns: resort destinations spike winter through spring; Mexico City/Guadalajara have steadier business/VFR demand; smaller airports like ZIH/HUX/MZT can have thin schedules and higher peak fares.
Zoe recommendation template: For {route_set}, tell users cash is usually the baseline, then compare live awards only if fares are above normal or the user has expiring/stranded airline miles.
"""
    return _article(
        f"route-{slug}-mexico",
        f"{route_set} — Mexico Route Intelligence",
        [slug.upper(), city, "Mexico", "leisure", "cash vs points"] + operators,
        content,
        f"Covers {route_set} with Mexico-specific cash bands, programs, cpp thresholds, and peak timing.",
    )


def _make_domestic_leisure_article(slug: str, route_set: str, city: str, operators: list[str], note: str) -> dict:
    content = f"""
Route set: {route_set} ({city}).
Route category: Domestic leisure route where points are often less valuable.
Typical cash ranges: economy $120-$380 round-trip on competitive mainland leisure routes, $350-$850+ round-trip for Hawaii/Alaska or peak holiday periods; domestic first/premium $450-$1,800+ depending distance and aircraft.
Best programs: Southwest Rapid Rewards for flexibility and Companion Pass value where Southwest operates; JetBlue TrueBlue for Northeast/Florida and some leisure routes; American/Delta/United miles only when dynamic pricing is low or cash is high; Alaska Mileage Plan for Alaska/Hawaii/West Coast-heavy routes; Avios can work on short AA segments when cash is high.
Route-specific play: {note}
CPP sweet spots: domestic leisure economy is usually cash-first below 1.3 cpp; consider points at 1.4-1.6 cpp; Hawaii/Alaska premium awards become attractive at 2.0 cpp+ and excellent above 3.0 cpp.
Availability patterns: LAS and Florida have heavy low-cost competition; Hawaii and Anchorage spike in school breaks and summer; holiday weekends are the main time points outperform cash for families.
Zoe recommendation template: For {route_set}, default to cash unless live awards beat the cpp threshold, the user needs free cancellation/flexibility, or the route is Hawaii/Alaska premium cabin.
"""
    return _article(
        f"route-{slug}-domestic-leisure",
        f"{route_set} — Domestic Leisure Points vs Cash Guide",
        [slug.upper(), city, "domestic leisure", "cash vs points", "low cpp"] + operators,
        content,
        f"Covers {route_set} with cash-first guidance, exceptions where points work, and domestic leisure cpp thresholds.",
    )


ROUTE_INTELLIGENCE_KB: list[dict] = []

for route in TRANSCON_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_transcon_article(*route))

for route in WESTERN_EUROPE_DESTINATIONS:
    ROUTE_INTELLIGENCE_KB.append(_make_western_europe_article(*route))

for route in EASTERN_EUROPE_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_eastern_europe_article(*route))

for route in EAST_ASIA_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_east_asia_article(*route))

for route in SOUTH_ASIA_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_south_asia_article(*route))

for route in AUSTRALIA_NEW_ZEALAND_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_australia_nz_article(*route))

for route in MIDDLE_EAST_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_middle_east_article(*route))

for route in AFRICA_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_africa_article(*route))

for route in LATIN_AMERICA_CARIBBEAN_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_latin_caribbean_article(*route))

for route in MEXICO_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_mexico_article(*route))

for route in DOMESTIC_LEISURE_ROUTES:
    ROUTE_INTELLIGENCE_KB.append(_make_domestic_leisure_article(*route))


# Import-time sanity checks keep this KB aligned with the checklist.
if len(ROUTE_INTELLIGENCE_KB) != CHECKLIST_ROUTE_ARTICLE_COUNT:
    raise RuntimeError(
        f"Expected {CHECKLIST_ROUTE_ARTICLE_COUNT} route intelligence articles, "
        f"found {len(ROUTE_INTELLIGENCE_KB)}."
    )

if len({article["id"] for article in ROUTE_INTELLIGENCE_KB}) != len(ROUTE_INTELLIGENCE_KB):
    raise RuntimeError("Duplicate route_intelligence KB article IDs detected.")

if any(not article["content"] or not article["summary"] or article["valid_as_of"] is None for article in ROUTE_INTELLIGENCE_KB):
    raise RuntimeError("Route intelligence KB contains an empty content/summary/valid_as_of field.")
