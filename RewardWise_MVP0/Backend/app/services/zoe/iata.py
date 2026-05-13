"""
zoe/iata.py
───────────
IATA airport code lookup and validation.
Pure Python — no external API dependency.

Covers the ~250 most-booked airports globally. Falls back to
a fuzzy city-name match when a code isn't found directly.
"""

from __future__ import annotations

import re

# ── Master airport table ──────────────────────────────────────────────────────
# Format: IATA_CODE -> (city_name, country, aliases...)
# Aliases are additional strings that should resolve to this airport.

_AIRPORTS: dict[str, tuple[str, ...]] = {
    # United States
    "ATL": ("Atlanta", "US", "hartsfield", "hartsfield-jackson"),
    "LAX": ("Los Angeles", "US", "los angeles", "la", "lax"),
    "ORD": ("Chicago", "US", "o'hare", "ohare", "chicago ohare"),
    "DFW": ("Dallas", "US", "dallas fort worth", "dallas", "fort worth"),
    "DEN": ("Denver", "US", "denver"),
    "JFK": ("New York", "US", "john f kennedy", "kennedy", "new york jfk", "nyc jfk"),
    "SFO": ("San Francisco", "US", "san francisco", "sf", "bay area"),
    "SEA": ("Seattle", "US", "seattle", "seattle-tacoma", "seatac"),
    "LAS": ("Las Vegas", "US", "las vegas", "vegas"),
    "MCO": ("Orlando", "US", "orlando"),
    "EWR": ("Newark", "US", "newark", "new york newark", "nyc newark"),
    "MIA": ("Miami", "US", "miami"),
    "PHX": ("Phoenix", "US", "phoenix"),
    "IAH": ("Houston", "US", "houston intercontinental", "houston iah"),
    "HOU": ("Houston Hobby", "US", "hobby", "houston hobby"),
    "BOS": ("Boston", "US", "boston", "logan"),
    "MSP": ("Minneapolis", "US", "minneapolis", "saint paul", "minneapolis-saint paul"),
    "DTW": ("Detroit", "US", "detroit", "metro detroit"),
    "PHL": ("Philadelphia", "US", "philadelphia", "philly"),
    "LGA": ("New York LaGuardia", "US", "laguardia", "la guardia", "new york lga"),
    "CLT": ("Charlotte", "US", "charlotte"),
    "SLC": ("Salt Lake City", "US", "salt lake city", "salt lake"),
    "SAN": ("San Diego", "US", "san diego"),
    "PDX": ("Portland", "US", "portland oregon"),
    "AUS": ("Austin", "US", "austin"),
    "BNA": ("Nashville", "US", "nashville"),
    "MCI": ("Kansas City", "US", "kansas city"),
    "STL": ("St. Louis", "US", "st louis", "saint louis"),
    "RDU": ("Raleigh-Durham", "US", "raleigh", "durham", "raleigh durham"),
    "IAD": ("Washington Dulles", "US", "dulles", "washington dulles"),
    "DCA": ("Washington Reagan", "US", "reagan", "reagan national", "washington national", "dca"),
    "BWI": ("Baltimore", "US", "baltimore", "bwi"),
    "MKE": ("Milwaukee", "US", "milwaukee"),
    "CLE": ("Cleveland", "US", "cleveland"),
    "CMH": ("Columbus", "US", "columbus ohio"),
    "IND": ("Indianapolis", "US", "indianapolis"),
    "PIT": ("Pittsburgh", "US", "pittsburgh"),
    "MEM": ("Memphis", "US", "memphis"),
    "OAK": ("Oakland", "US", "oakland"),
    "SJC": ("San Jose", "US", "san jose", "silicon valley"),
    "SMF": ("Sacramento", "US", "sacramento"),
    "HNL": ("Honolulu", "US", "honolulu", "hawaii", "oahu"),
    "ANC": ("Anchorage", "US", "anchorage"),
    "FAI": ("Fairbanks", "US", "fairbanks"),
    "OGG": ("Maui", "US", "maui", "kahului"),
    "KOA": ("Kona", "US", "kona", "big island kona"),
    "ITO": ("Hilo", "US", "hilo", "big island hilo"),
    "LIH": ("Kauai", "US", "kauai", "lihue"),
    "TPA": ("Tampa", "US", "tampa"),
    "FLL": ("Fort Lauderdale", "US", "fort lauderdale", "ft lauderdale"),
    "PBI": ("West Palm Beach", "US", "west palm beach", "palm beach"),
    "JAX": ("Jacksonville", "US", "jacksonville"),
    "MSY": ("New Orleans", "US", "new orleans"),
    "SAT": ("San Antonio", "US", "san antonio"),
    "DAL": ("Dallas Love Field", "US", "love field", "dallas love"),
    "ABQ": ("Albuquerque", "US", "albuquerque"),
    "TUS": ("Tucson", "US", "tucson"),
    "ELP": ("El Paso", "US", "el paso"),
    "OKC": ("Oklahoma City", "US", "oklahoma city"),
    "TUL": ("Tulsa", "US", "tulsa"),
    "LIT": ("Little Rock", "US", "little rock"),
    "BHM": ("Birmingham", "US", "birmingham alabama"),
    "GSP": ("Greenville", "US", "greenville", "spartanburg"),
    "CHS": ("Charleston", "US", "charleston sc"),
    "SAV": ("Savannah", "US", "savannah"),
    "ORF": ("Norfolk", "US", "norfolk virginia"),
    "RIC": ("Richmond", "US", "richmond virginia"),
    "GRR": ("Grand Rapids", "US", "grand rapids"),
    "DSM": ("Des Moines", "US", "des moines"),
    "OMA": ("Omaha", "US", "omaha"),
    "MHT": ("Manchester", "US", "manchester nh"),
    "BUF": ("Buffalo", "US", "buffalo"),
    "SYR": ("Syracuse", "US", "syracuse"),
    "ALB": ("Albany", "US", "albany ny"),
    "ROC": ("Rochester", "US", "rochester ny"),
    "BTV": ("Burlington", "US", "burlington vermont"),
    "PWM": ("Portland ME", "US", "portland maine"),
    "BQN": ("Aguadilla", "US", "aguadilla", "puerto rico west"),
    "SJU": ("San Juan", "US", "san juan", "puerto rico"),

    # Canada
    "YYZ": ("Toronto", "CA", "toronto", "pearson"),
    "YVR": ("Vancouver", "CA", "vancouver bc"),
    "YUL": ("Montreal", "CA", "montreal", "trudeau"),
    "YYC": ("Calgary", "CA", "calgary"),
    "YEG": ("Edmonton", "CA", "edmonton"),
    "YOW": ("Ottawa", "CA", "ottawa"),
    "YWG": ("Winnipeg", "CA", "winnipeg"),
    "YHZ": ("Halifax", "CA", "halifax"),
    "YQB": ("Quebec City", "CA", "quebec city"),

    # Mexico & Central America
    "MEX": ("Mexico City", "MX", "mexico city", "ciudad de mexico"),
    "CUN": ("Cancun", "MX", "cancun"),
    "GDL": ("Guadalajara", "MX", "guadalajara"),
    "MTY": ("Monterrey", "MX", "monterrey"),
    "SJD": ("Los Cabos", "MX", "los cabos", "cabo", "cabo san lucas", "san jose del cabo"),
    "PVR": ("Puerto Vallarta", "MX", "puerto vallarta"),
    "MZT": ("Mazatlan", "MX", "mazatlan"),
    "OAX": ("Oaxaca", "MX", "oaxaca"),
    "GUA": ("Guatemala City", "GT", "guatemala city", "guatemala"),
    "SAL": ("San Salvador", "SV", "san salvador", "el salvador"),
    "MGA": ("Managua", "NI", "managua", "nicaragua"),
    "SJO": ("San Jose", "CR", "san jose costa rica", "costa rica"),
    "PTY": ("Panama City", "PA", "panama city", "tocumen"),
    "BOG": ("Bogota", "CO", "bogota", "colombia"),
    "MDE": ("Medellin", "CO", "medellin"),
    "CLO": ("Cali", "CO", "cali colombia"),
    "CTG": ("Cartagena", "CO", "cartagena"),
    "GIG": ("Rio de Janeiro", "BR", "rio de janeiro", "rio", "galeao"),
    "GRU": ("Sao Paulo", "BR", "sao paulo", "guarulhos"),
    "BSB": ("Brasilia", "BR", "brasilia"),
    "SSA": ("Salvador", "BR", "salvador bahia"),
    "FOR": ("Fortaleza", "BR", "fortaleza"),
    "REC": ("Recife", "BR", "recife"),
    "LIM": ("Lima", "PE", "lima", "peru"),
    "SCL": ("Santiago", "CL", "santiago", "chile"),
    "EZE": ("Buenos Aires", "AR", "buenos aires", "ezeiza"),
    "AEP": ("Buenos Aires City", "AR", "aeroparque", "buenos aires aeroparque"),
    "MVD": ("Montevideo", "UY", "montevideo", "uruguay"),
    "ASU": ("Asuncion", "PY", "asuncion", "paraguay"),
    "LPB": ("La Paz", "BO", "la paz", "bolivia"),
    "UIO": ("Quito", "EC", "quito", "ecuador"),
    "GYE": ("Guayaquil", "EC", "guayaquil"),
    "CCS": ("Caracas", "VE", "caracas", "venezuela"),
    "HAV": ("Havana", "CU", "havana", "cuba"),
    "NAS": ("Nassau", "BS", "nassau", "bahamas"),
    "POS": ("Port of Spain", "TT", "port of spain", "trinidad"),
    "BGI": ("Bridgetown", "BB", "barbados", "bridgetown"),
    "SDQ": ("Santo Domingo", "DO", "santo domingo", "dominican republic"),
    "PUJ": ("Punta Cana", "DO", "punta cana"),
    "KIN": ("Kingston", "JM", "kingston", "jamaica"),
    "MBJ": ("Montego Bay", "JM", "montego bay"),
    "SXM": ("Sint Maarten", "SX", "st maarten", "sint maarten"),
    "SJU": ("San Juan", "PR", "san juan", "puerto rico"),

    # Europe — UK & Ireland
    "LHR": ("London Heathrow", "GB", "heathrow", "london heathrow"),
    "LGW": ("London Gatwick", "GB", "gatwick", "london gatwick"),
    "STN": ("London Stansted", "GB", "stansted", "london stansted"),
    "LTN": ("London Luton", "GB", "luton", "london luton"),
    "LCY": ("London City", "GB", "london city", "city airport"),
    "MAN": ("Manchester", "GB", "manchester uk", "manchester england"),
    "EDI": ("Edinburgh", "GB", "edinburgh"),
    "GLA": ("Glasgow", "GB", "glasgow"),
    "BHX": ("Birmingham UK", "GB", "birmingham uk", "birmingham england"),
    "BRS": ("Bristol", "GB", "bristol"),
    "DUB": ("Dublin", "IE", "dublin", "ireland"),
    "SNN": ("Shannon", "IE", "shannon", "shannon ireland"),
    "ORK": ("Cork", "IE", "cork ireland"),

    # Europe — Western
    "CDG": ("Paris Charles de Gaulle", "FR", "paris cdg", "charles de gaulle", "paris charles de gaulle"),
    "ORY": ("Paris Orly", "FR", "orly", "paris orly"),
    "AMS": ("Amsterdam", "NL", "amsterdam", "schiphol"),
    "FRA": ("Frankfurt", "DE", "frankfurt"),
    "MUC": ("Munich", "DE", "munich"),
    "BER": ("Berlin", "DE", "berlin", "berlin brandenburg"),
    "HAM": ("Hamburg", "DE", "hamburg"),
    "DUS": ("Dusseldorf", "DE", "dusseldorf", "düsseldorf"),
    "CGN": ("Cologne", "DE", "cologne", "köln"),
    "STR": ("Stuttgart", "DE", "stuttgart"),
    "ZRH": ("Zurich", "CH", "zurich", "zürich"),
    "GVA": ("Geneva", "CH", "geneva"),
    "BSL": ("Basel", "CH", "basel", "mulhouse"),
    "VIE": ("Vienna", "AT", "vienna", "wien"),
    "SZG": ("Salzburg", "AT", "salzburg"),
    "BRU": ("Brussels", "BE", "brussels", "brussel"),
    "LUX": ("Luxembourg", "LU", "luxembourg"),
    "LIS": ("Lisbon", "PT", "lisbon", "lisboa"),
    "OPO": ("Porto", "PT", "porto"),
    "FAO": ("Faro", "PT", "faro", "algarve"),
    "MAD": ("Madrid", "ES", "madrid"),
    "BCN": ("Barcelona", "ES", "barcelona"),
    "AGP": ("Malaga", "ES", "malaga", "costa del sol"),
    "PMI": ("Palma de Mallorca", "ES", "mallorca", "majorca", "palma"),
    "IBZ": ("Ibiza", "ES", "ibiza"),
    "VLC": ("Valencia", "ES", "valencia spain"),
    "SVQ": ("Seville", "ES", "seville", "sevilla"),
    "TFS": ("Tenerife South", "ES", "tenerife", "tenerife south"),
    "LPA": ("Gran Canaria", "ES", "gran canaria", "las palmas"),
    "FCO": ("Rome Fiumicino", "IT", "rome", "fiumicino", "rome fiumicino", "roma"),
    "CIA": ("Rome Ciampino", "IT", "ciampino", "rome ciampino"),
    "MXP": ("Milan Malpensa", "IT", "milan", "malpensa", "milan malpensa"),
    "LIN": ("Milan Linate", "IT", "linate", "milan linate"),
    "BGY": ("Milan Bergamo", "IT", "bergamo"),
    "VCE": ("Venice", "IT", "venice", "venezia"),
    "FLR": ("Florence", "IT", "florence", "firenze"),
    "NAP": ("Naples", "IT", "naples", "napoli"),
    "CTA": ("Catania", "IT", "catania", "sicily"),
    "PMO": ("Palermo", "IT", "palermo"),
    "BLQ": ("Bologna", "IT", "bologna"),
    "ATH": ("Athens", "GR", "athens"),
    "SKG": ("Thessaloniki", "GR", "thessaloniki"),
    "HER": ("Heraklion", "GR", "crete", "heraklion", "heraklio"),
    "CFU": ("Corfu", "GR", "corfu", "kerkyra"),
    "JMK": ("Mykonos", "GR", "mykonos"),
    "JTR": ("Santorini", "GR", "santorini", "thira"),
    "RHO": ("Rhodes", "GR", "rhodes"),
    "CPH": ("Copenhagen", "DK", "copenhagen"),
    "OSL": ("Oslo", "NO", "oslo"),
    "BGO": ("Bergen", "NO", "bergen"),
    "SVG": ("Stavanger", "NO", "stavanger"),
    "TOS": ("Tromso", "NO", "tromso", "tromsø"),
    "ARN": ("Stockholm", "SE", "stockholm", "arlanda"),
    "GOT": ("Gothenburg", "SE", "gothenburg", "goteborg"),
    "HEL": ("Helsinki", "FI", "helsinki"),
    "RVN": ("Rovaniemi", "FI", "rovaniemi", "lapland finland"),
    "KEF": ("Reykjavik", "IS", "reykjavik", "iceland", "keflavik"),
    "TLL": ("Tallinn", "EE", "tallinn", "estonia"),
    "RIX": ("Riga", "LV", "riga", "latvia"),
    "VNO": ("Vilnius", "LT", "vilnius", "lithuania"),
    "WAW": ("Warsaw", "PL", "warsaw", "warsaw chopin"),
    "KRK": ("Krakow", "PL", "krakow", "cracow"),
    "GDN": ("Gdansk", "PL", "gdansk"),
    "PRG": ("Prague", "CZ", "prague"),
    "BUD": ("Budapest", "HU", "budapest"),
    "BTS": ("Bratislava", "SK", "bratislava"),
    "OTP": ("Bucharest", "RO", "bucharest"),
    "CLJ": ("Cluj-Napoca", "RO", "cluj"),
    "SOF": ("Sofia", "BG", "sofia", "bulgaria"),
    "SKP": ("Skopje", "MK", "skopje"),
    "BEG": ("Belgrade", "RS", "belgrade"),
    "TIV": ("Tivat", "ME", "tivat", "montenegro"),
    "DBV": ("Dubrovnik", "HR", "dubrovnik"),
    "SPU": ("Split", "HR", "split croatia"),
    "ZAG": ("Zagreb", "HR", "zagreb"),
    "LJU": ("Ljubljana", "SI", "ljubljana", "slovenia"),
    "SJJ": ("Sarajevo", "BA", "sarajevo"),
    "TIA": ("Tirana", "AL", "tirana"),

    # Europe — Eastern & Russia
    "SVO": ("Moscow Sheremetyevo", "RU", "moscow", "sheremetyevo"),
    "DME": ("Moscow Domodedovo", "RU", "domodedovo"),
    "LED": ("St Petersburg", "RU", "st petersburg", "saint petersburg"),
    "KBP": ("Kyiv", "UA", "kyiv", "kiev"),
    "TBS": ("Tbilisi", "GE", "tbilisi", "georgia"),
    "EVN": ("Yerevan", "AM", "yerevan", "armenia"),
    "GYD": ("Baku", "AZ", "baku", "azerbaijan"),
    "ALA": ("Almaty", "KZ", "almaty", "kazakhstan"),

    # Middle East
    "DXB": ("Dubai", "AE", "dubai"),
    "AUH": ("Abu Dhabi", "AE", "abu dhabi"),
    "SHJ": ("Sharjah", "AE", "sharjah"),
    "DOH": ("Doha", "QA", "doha", "qatar"),
    "BAH": ("Bahrain", "BH", "bahrain", "manama"),
    "KWI": ("Kuwait City", "KW", "kuwait city", "kuwait"),
    "RUH": ("Riyadh", "SA", "riyadh"),
    "JED": ("Jeddah", "SA", "jeddah"),
    "MED": ("Medina", "SA", "medina"),
    "MCT": ("Muscat", "OM", "muscat", "oman"),
    "AMM": ("Amman", "JO", "amman", "jordan"),
    "BEY": ("Beirut", "LB", "beirut", "lebanon"),
    "TLV": ("Tel Aviv", "IL", "tel aviv", "ben gurion"),
    "CAI": ("Cairo", "EG", "cairo", "egypt"),
    "SSH": ("Sharm el-Sheikh", "EG", "sharm el sheikh", "sharm"),
    "HRG": ("Hurghada", "EG", "hurghada"),
    "BGW": ("Baghdad", "IQ", "baghdad"),
    "IKA": ("Tehran", "IR", "tehran"),
    "IST": ("Istanbul", "TR", "istanbul", "istanbul airport"),
    "SAW": ("Istanbul Sabiha", "TR", "sabiha gokcen", "istanbul sabiha"),
    "AYT": ("Antalya", "TR", "antalya"),
    "ADB": ("Izmir", "TR", "izmir"),
    "ESB": ("Ankara", "TR", "ankara"),

    # Africa
    "JNB": ("Johannesburg", "ZA", "johannesburg", "joburg", "or tambo"),
    "CPT": ("Cape Town", "ZA", "cape town"),
    "DUR": ("Durban", "ZA", "durban"),
    "NBO": ("Nairobi", "KE", "nairobi", "kenya"),
    "MBA": ("Mombasa", "KE", "mombasa"),
    "DAR": ("Dar es Salaam", "TZ", "dar es salaam", "tanzania"),
    "JRO": ("Kilimanjaro", "TZ", "kilimanjaro"),
    "ZNZ": ("Zanzibar", "TZ", "zanzibar"),
    "EBB": ("Kampala", "UG", "kampala", "uganda", "entebbe"),
    "ADD": ("Addis Ababa", "ET", "addis ababa", "ethiopia"),
    "ACC": ("Accra", "GH", "accra", "ghana"),
    "LOS": ("Lagos", "NG", "lagos", "nigeria"),
    "ABV": ("Abuja", "NG", "abuja"),
    "DKR": ("Dakar", "SN", "dakar", "senegal"),
    "CMN": ("Casablanca", "MA", "casablanca", "morocco", "mohammed v"),
    "RAK": ("Marrakech", "MA", "marrakech", "marrakesh"),
    "TNG": ("Tangier", "MA", "tangier"),
    "TUN": ("Tunis", "TN", "tunis", "tunisia"),
    "ALG": ("Algiers", "DZ", "algiers", "algeria"),
    "MRU": ("Mauritius", "MU", "mauritius"),
    "SEZ": ("Seychelles", "SC", "seychelles", "mahe"),
    "NOU": ("Noumea", "NC", "noumea", "new caledonia"),

    # Asia — East
    "NRT": ("Tokyo Narita", "JP", "narita", "tokyo narita"),
    "HND": ("Tokyo Haneda", "JP", "haneda", "tokyo haneda", "tokyo"),
    "KIX": ("Osaka Kansai", "JP", "osaka", "kansai"),
    "ITM": ("Osaka Itami", "JP", "itami", "osaka itami"),
    "CTS": ("Sapporo", "JP", "sapporo"),
    "FUK": ("Fukuoka", "JP", "fukuoka"),
    "OKA": ("Okinawa", "JP", "okinawa", "naha"),
    "ICN": ("Seoul Incheon", "KR", "seoul", "incheon", "seoul incheon"),
    "GMP": ("Seoul Gimpo", "KR", "gimpo", "seoul gimpo"),
    "PUS": ("Busan", "KR", "busan"),
    "PEK": ("Beijing Capital", "CN", "beijing", "capital airport"),
    "PKX": ("Beijing Daxing", "CN", "beijing daxing", "daxing"),
    "PVG": ("Shanghai Pudong", "CN", "shanghai", "pudong"),
    "SHA": ("Shanghai Hongqiao", "CN", "hongqiao", "shanghai hongqiao"),
    "CAN": ("Guangzhou", "CN", "guangzhou", "canton"),
    "SZX": ("Shenzhen", "CN", "shenzhen"),
    "CTU": ("Chengdu", "CN", "chengdu"),
    "XIY": ("Xian", "CN", "xian", "xi'an"),
    "KMG": ("Kunming", "CN", "kunming"),
    "HKG": ("Hong Kong", "HK", "hong kong"),
    "MFM": ("Macau", "MO", "macau"),
    "TPE": ("Taipei", "TW", "taipei", "taoyuan"),
    "RMQ": ("Taichung", "TW", "taichung"),
    "KHH": ("Kaohsiung", "TW", "kaohsiung"),
    "ULN": ("Ulaanbaatar", "MN", "ulaanbaatar", "mongolia"),

    # Asia — Southeast
    "BKK": ("Bangkok Suvarnabhumi", "TH", "bangkok", "suvarnabhumi"),
    "DMK": ("Bangkok Don Mueang", "TH", "don mueang", "bangkok don mueang"),
    "HKT": ("Phuket", "TH", "phuket"),
    "CNX": ("Chiang Mai", "TH", "chiang mai"),
    "KBV": ("Krabi", "TH", "krabi"),
    "USM": ("Koh Samui", "TH", "koh samui", "samui"),
    "SIN": ("Singapore", "SG", "singapore", "changi"),
    "KUL": ("Kuala Lumpur", "MY", "kuala lumpur", "klia"),
    "PEN": ("Penang", "MY", "penang"),
    "BKI": ("Kota Kinabalu", "MY", "kota kinabalu", "borneo malaysia"),
    "CGK": ("Jakarta", "ID", "jakarta"),
    "DPS": ("Bali", "ID", "bali", "denpasar"),
    "SUB": ("Surabaya", "ID", "surabaya"),
    "LOP": ("Lombok", "ID", "lombok"),
    "MNL": ("Manila", "PH", "manila", "philippines"),
    "CEB": ("Cebu", "PH", "cebu"),
    "DVO": ("Davao", "PH", "davao"),
    "SGN": ("Ho Chi Minh City", "VN", "ho chi minh city", "saigon", "hcmc"),
    "HAN": ("Hanoi", "VN", "hanoi"),
    "DAD": ("Da Nang", "VN", "da nang", "danang"),
    "PQC": ("Phu Quoc", "VN", "phu quoc"),
    "REP": ("Siem Reap", "KH", "siem reap", "angkor", "cambodia"),
    "PNH": ("Phnom Penh", "KH", "phnom penh"),
    "VTE": ("Vientiane", "LA", "vientiane", "laos"),
    "LPQ": ("Luang Prabang", "LA", "luang prabang"),
    "RGN": ("Yangon", "MM", "yangon", "rangoon", "myanmar"),
    "MDL": ("Mandalay", "MM", "mandalay"),

    # Asia — South
    "DEL": ("Delhi", "IN", "delhi", "new delhi", "indira gandhi"),
    "BOM": ("Mumbai", "IN", "mumbai", "bombay"),
    "BLR": ("Bangalore", "IN", "bangalore", "bengaluru"),
    "MAA": ("Chennai", "IN", "chennai", "madras"),
    "HYD": ("Hyderabad", "IN", "hyderabad"),
    "CCU": ("Kolkata", "IN", "kolkata", "calcutta"),
    "COK": ("Cochin", "IN", "cochin", "kochi"),
    "GOI": ("Goa", "IN", "goa"),
    "JAI": ("Jaipur", "IN", "jaipur"),
    "AMD": ("Ahmedabad", "IN", "ahmedabad"),
    "CMB": ("Colombo", "LK", "colombo", "sri lanka"),
    "KTM": ("Kathmandu", "NP", "kathmandu", "nepal"),
    "DAC": ("Dhaka", "BD", "dhaka", "bangladesh"),
    "KHI": ("Karachi", "PK", "karachi"),
    "LHE": ("Lahore", "PK", "lahore"),
    "ISB": ("Islamabad", "PK", "islamabad"),
    "KBL": ("Kabul", "AF", "kabul"),
    "MLE": ("Male", "MV", "male", "maldives"),

    # Asia — Central
    "TAS": ("Tashkent", "UZ", "tashkent", "uzbekistan"),
    "SKD": ("Samarkand", "UZ", "samarkand"),

    # Oceania
    "SYD": ("Sydney", "AU", "sydney"),
    "MEL": ("Melbourne", "AU", "melbourne"),
    "BNE": ("Brisbane", "AU", "brisbane"),
    "PER": ("Perth", "AU", "perth"),
    "ADL": ("Adelaide", "AU", "adelaide"),
    "CBR": ("Canberra", "AU", "canberra"),
    "OOL": ("Gold Coast", "AU", "gold coast"),
    "CNS": ("Cairns", "AU", "cairns"),
    "DRW": ("Darwin", "AU", "darwin"),
    "AKL": ("Auckland", "NZ", "auckland", "new zealand"),
    "CHC": ("Christchurch", "NZ", "christchurch"),
    "WLG": ("Wellington", "NZ", "wellington"),
    "ZQN": ("Queenstown", "NZ", "queenstown"),
    "NAN": ("Nadi", "FJ", "fiji", "nadi", "nadi fiji"),
    "APW": ("Apia", "WS", "samoa", "apia"),
    "NOU": ("Noumea", "NC", "new caledonia"),
    "PPT": ("Papeete", "PF", "tahiti", "papeete", "french polynesia", "bora bora"),
    "RAR": ("Rarotonga", "CK", "cook islands", "rarotonga"),
    "GUM": ("Guam", "GU", "guam"),
    "SPN": ("Saipan", "MP", "saipan"),
    "INU": ("Nauru", "NR", "nauru"),
}

# Build lookup indexes
_CODE_INDEX: dict[str, str] = {}   # alias -> IATA code
_CITY_INDEX: dict[str, str] = {}   # lowercase city name -> IATA code

for _code, _data in _AIRPORTS.items():
    _city = _data[0].lower()
    _country = _data[1]
    _CODE_INDEX[_code.upper()] = _code
    _CITY_INDEX[_city] = _code
    for _alias in _data[2:]:
        _CITY_INDEX[_alias.lower()] = _code


def lookup(text: str) -> str | None:
    """
    Return the IATA code for a given text, or None if not found.

    Handles:
    - Exact IATA codes: "JFK", "lhr"
    - City names: "New York", "london", "Tokyo"
    - Common aliases: "NYC", "Bay Area", "Heathrow"
    """
    if not text:
        return None

    cleaned = text.strip()

    # 1. Direct IATA code match (2-4 uppercase letters)
    upper = cleaned.upper()
    if re.match(r"^[A-Z]{3}$", upper) and upper in _AIRPORTS:
        return upper

    # 2. Alias index match
    lower = cleaned.lower()
    if lower in _CITY_INDEX:
        return _CITY_INDEX[lower]

    # 3. Partial match — check if any known alias starts with or contains the query
    # Only for strings >= 3 chars to avoid false positives
    if len(lower) >= 3:
        for alias, code in _CITY_INDEX.items():
            if alias.startswith(lower) or lower in alias:
                return code

    return None


def validate(code: str) -> bool:
    """Return True if `code` is a known IATA airport code."""
    return code.upper() in _AIRPORTS


def city_name(code: str) -> str:
    """Return the city name for an IATA code, or the code itself if unknown."""
    code = code.upper()
    if code in _AIRPORTS:
        return _AIRPORTS[code][0]
    return code


def all_codes() -> list[str]:
    """Return all known IATA codes."""
    return list(_AIRPORTS.keys())
