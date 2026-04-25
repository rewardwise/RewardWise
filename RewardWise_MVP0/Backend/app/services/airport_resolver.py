from __future__ import annotations

from dataclasses import dataclass
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable

from app.validators.airport_codes import is_valid_airport_code


# Words that should never be interpreted as airport codes or location answers.
YES_NO_WORDS = {
    "yes", "yeah", "yep", "yup", "sure", "correct", "right", "ok", "okay",
    "no", "nope", "nah", "wrong", "not", "dont", "don't", "use", "it",
}

FILLER_WORDS = {
    "bro", "bruh", "lol", "lmao", "lmfao", "yo", "hey", "hi", "hello",
    "umm", "um", "uh", "uhh", "hmm", "pls", "please", "thanks", "thank", "you",
    "tf", "wtf", "nvm", "nevermind", "whatever", "actually", "like", "kinda", "sorta",
}

# Only aliases for broad places. Airport/city/region/country data itself must come
# from app/data/airport_metadata.json, generated from OurAirports.
BROAD_LOCATION_ALIASES = {
    # Continents / macro-regions
    "africa": "africa",
    "asia": "asia",
    "europe": "europe",
    "north america": "north america",
    "south america": "south america",
    "oceania": "oceania",
    "antarctica": "antarctica",
    "middle east": "asia",
    "central america": "north america",
    "caribbean": "north america",
    "latin america": "south america",
    "southeast asia": "asia",
    "east asia": "asia",
    "south asia": "asia",
    "central asia": "asia",
    "western europe": "europe",
    "eastern europe": "europe",
    "northern europe": "europe",
    "southern europe": "europe",
    # Country aliases users commonly type instead of formal country names
    "usa": "united states",
    "us": "united states",
    "u s": "united states",
    "america": "united states",
    "united states of america": "united states",
    "uk": "united kingdom",
    "u k": "united kingdom",
    "great britain": "united kingdom",
    "britain": "united kingdom",
    "uae": "united arab emirates",
    "u a e": "united arab emirates",
    "russian federation": "russia",
    "viet nam": "vietnam",
    "turkiye": "turkey",
    "türkiye": "turkey",
}


def _strip_accents(value: str) -> str:
    """Normalize accented user/data text so accented and plain spellings match."""
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_text(value: Any) -> str:
    text = str(value or "").lower().strip()
    text = text.replace("\u2019", "'")
    text = _strip_accents(text)
    text = re.sub(r"[^a-z0-9\s']+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _without_fillers(text: str) -> str:
    tokens = [token for token in normalize_text(text).split() if token not in FILLER_WORDS]
    return " ".join(tokens).strip()


def _display_label(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return "that place"
    return " ".join(part[:1].upper() + part[1:] for part in text.split())


@dataclass(frozen=True)
class AirportOption:
    iata: str
    name: str
    city: str = ""
    region: str = ""
    region_code: str = ""
    country: str = ""
    country_code: str = ""
    continent: str = ""
    latitude: float | None = None
    longitude: float | None = None
    airport_type: str = ""
    scheduled_service: bool = False
    metadata_quality: str = "unknown"
    aliases: tuple[str, ...] = ()

    @property
    def label(self) -> str:
        if self.name and self.name != f"{self.iata} Airport":
            return f"{self.name} ({self.iata})"
        return self.iata

    @property
    def is_fallback_only(self) -> bool:
        return self.metadata_quality == "fallback_code_only"

    @property
    def priority_rank(self) -> tuple[int, str]:
        type_rank = {
            "large_airport": 0,
            "medium_airport": 1,
            "small_airport": 2,
            "seaplane_base": 3,
            "heliport": 4,
            "balloonport": 5,
            "closed": 9,
        }.get(self.airport_type, 6)
        service_rank = 0 if self.scheduled_service else 1
        fallback_rank = 1 if self.is_fallback_only else 0
        return (fallback_rank, service_rank, type_rank, self.iata)

    def to_dict(self) -> dict[str, Any]:
        return {
            "iata": self.iata,
            "name": self.name,
            "city": self.city,
            "region": self.region,
            "region_code": self.region_code,
            "country": self.country,
            "country_code": self.country_code,
            "continent": self.continent,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "airport_type": self.airport_type,
            "scheduled_service": self.scheduled_service,
            "metadata_quality": self.metadata_quality,
            "label": self.label,
            "aliases": list(self.aliases),
        }


@dataclass(frozen=True)
class AirportResolution:
    status: str  # resolved | options | broad | unknown
    airport: AirportOption | None = None
    options: tuple[AirportOption, ...] = ()
    hint: str | None = None


_METADATA_JSON_PATH = Path(__file__).resolve().parents[1] / "data" / "airport_metadata.json"


def _load_airport_rows() -> list[dict[str, Any]]:
    """Load airport metadata generated by scripts/build_airport_metadata.py.

    This resolver intentionally does not import app.data.airport_metadata.py.
    That Python file should be removed so there is only one airport metadata
    source of truth: app/data/airport_metadata.json.
    """
    if not _METADATA_JSON_PATH.exists():
        raise FileNotFoundError(
            "Missing app/data/airport_metadata.json. "
            "Run `python scripts/build_airport_metadata.py` from RewardWise_MVP0/Backend."
        )

    with _METADATA_JSON_PATH.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)

    rows = payload.get("airports") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("airport_metadata.json must contain either a list or an object with an 'airports' list.")
    return rows


def _as_float(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"yes", "true", "1", "y"}


_AIRPORTS: list[AirportOption] = []
for raw in _load_airport_rows():
    iata = str(raw.get("iata", "")).upper().strip()
    if not iata:
        continue

    raw_aliases = raw.get("aliases") or []
    aliases = tuple(dict.fromkeys(normalize_text(a) for a in raw_aliases if normalize_text(a)))

    _AIRPORTS.append(
        AirportOption(
            iata=iata,
            name=str(raw.get("name") or f"{iata} Airport"),
            city=str(raw.get("city") or raw.get("municipality") or ""),
            region=str(raw.get("region") or ""),
            region_code=str(raw.get("region_code") or ""),
            country=str(raw.get("country") or ""),
            country_code=str(raw.get("country_code") or ""),
            continent=str(raw.get("continent") or ""),
            latitude=_as_float(raw.get("latitude")),
            longitude=_as_float(raw.get("longitude")),
            airport_type=str(raw.get("airport_type") or raw.get("type") or ""),
            scheduled_service=_as_bool(raw.get("scheduled_service")),
            metadata_quality=str(raw.get("metadata_quality") or "unknown"),
            aliases=aliases,
        )
    )

_BY_IATA = {a.iata: a for a in _AIRPORTS if a.iata}


def _terms(values: Iterable[Any]) -> set[str]:
    return {normalize_text(v) for v in values if normalize_text(v)}


def _airport_name_terms(option: AirportOption) -> set[str]:
    return _terms([option.iata, option.name, *option.aliases])


def _city_terms(option: AirportOption) -> set[str]:
    return _terms([option.city])


def _region_terms(option: AirportOption) -> set[str]:
    return _terms([option.region, option.region_code])


def _country_terms(option: AirportOption) -> set[str]:
    return _terms([option.country, option.country_code])


def _continent_terms(option: AirportOption) -> set[str]:
    return _terms([option.continent])


_COUNTRY_TERMS = {term for airport in _AIRPORTS for term in _country_terms(airport)}
_CONTINENT_TERMS = {term for airport in _AIRPORTS for term in _continent_terms(airport)}
_CITY_TERMS = {term for airport in _AIRPORTS for term in _city_terms(airport)}
_REGION_TERMS = {term for airport in _AIRPORTS for term in _region_terms(airport)}

# Countries and continents are always broad. Regions are broad only when they are
# not also cities, so city/country overlaps like Singapore resolve through city
# metadata before broad-location handling.
_BROAD_LOCATION_TERMS = (
    _COUNTRY_TERMS
    | _CONTINENT_TERMS
    | set(BROAD_LOCATION_ALIASES.keys())
    | set(BROAD_LOCATION_ALIASES.values())
    | (_REGION_TERMS - _CITY_TERMS)
)


def _unique(options: Iterable[AirportOption]) -> list[AirportOption]:
    seen: set[str] = set()
    out: list[AirportOption] = []
    for option in options:
        if option.iata and option.iata not in seen:
            seen.add(option.iata)
            out.append(option)
    return out


def _sort_options(options: Iterable[AirportOption]) -> list[AirportOption]:
    return sorted(_unique(options), key=lambda o: o.priority_rank)


def _canonical_broad_location(text: str) -> str:
    norm = normalize_text(text)
    return BROAD_LOCATION_ALIASES.get(norm, norm)


def _is_broad_location(text: str | None) -> bool:
    norm = _canonical_broad_location(str(text or ""))
    return bool(norm and norm in _BROAD_LOCATION_TERMS)


def _token_code(text: str) -> str | None:
    raw = str(text or "").strip()
    norm = normalize_text(raw)
    if not norm or norm in YES_NO_WORDS or norm in FILLER_WORDS:
        return None

    upper = norm.upper()
    if re.fullmatch(r"[A-Z]{3}", upper) and is_valid_airport_code(upper):
        return upper

    # Accept codes when intentionally marked, but do not mine random 3-letter
    # words from casual phrases like "switzerland bro".
    paren = re.search(r"\(([A-Za-z]{3})\)", raw)
    if paren:
        code = paren.group(1).upper()
        if is_valid_airport_code(code):
            return code

    explicit = re.search(r"\b(?:use|airport|code)\s+([A-Za-z]{3})\b", raw, re.IGNORECASE)
    if explicit:
        code = explicit.group(1).upper()
        if explicit.group(1).lower() not in YES_NO_WORDS | FILLER_WORDS and is_valid_airport_code(code):
            return code

    return None


def get_airport(code: str | None) -> AirportOption | None:
    if not code:
        return None
    return _BY_IATA.get(str(code).upper().strip())


def _match_context_options(norm: str, raw: str, context_options: list[dict[str, Any]]) -> AirportResolution | None:
    options: list[AirportOption] = []
    for item in context_options:
        code = str(item.get("iata") or item.get("value") or "").upper()
        option = get_airport(code)
        if option:
            options.append(option)

    if not options:
        return None

    code = _token_code(raw)
    if code:
        for option in options:
            if option.iata == code:
                return AirportResolution(status="resolved", airport=option, hint=raw)

    cleaned = _without_fillers(norm) or norm
    for option in options:
        terms = _airport_name_terms(option) | _city_terms(option)
        if cleaned in terms:
            return AirportResolution(status="resolved", airport=option, hint=raw)
        # Partial matching is safe only inside the already-presented option list.
        if len(cleaned) >= 4 and any(cleaned in term or term in cleaned for term in terms if len(term) >= 4):
            return AirportResolution(status="resolved", airport=option, hint=raw)

    return None


def _find_airport_name_matches(cleaned: str) -> list[AirportOption]:
    exact: list[AirportOption] = []
    contains: list[AirportOption] = []

    for option in _AIRPORTS:
        terms = _airport_name_terms(option)
        if cleaned in terms:
            exact.append(option)
            continue

        if len(cleaned) >= 5:
            name = normalize_text(option.name)
            if cleaned in name or any(cleaned in alias or alias in cleaned for alias in option.aliases if len(alias) >= 5):
                contains.append(option)

    return _sort_options(exact or contains)


def _find_city_matches(cleaned: str) -> list[AirportOption]:
    return _sort_options(option for option in _AIRPORTS if cleaned in _city_terms(option))


def _find_region_matches(cleaned: str) -> list[AirportOption]:
    return _sort_options(option for option in _AIRPORTS if cleaned in _region_terms(option))


def _find_country_matches(cleaned: str) -> list[AirportOption]:
    canonical = _canonical_broad_location(cleaned)
    return _sort_options(option for option in _AIRPORTS if canonical in _country_terms(option))


def _find_continent_matches(cleaned: str) -> list[AirportOption]:
    canonical = _canonical_broad_location(cleaned)
    return _sort_options(option for option in _AIRPORTS if canonical in _continent_terms(option))


def resolve_airport_text(text: str, *, context_options: list[dict[str, Any]] | None = None) -> AirportResolution:
    raw = str(text or "").strip()
    norm = normalize_text(raw)
    cleaned = _without_fillers(norm) or norm

    if not cleaned or cleaned in YES_NO_WORDS:
        return AirportResolution(status="unknown", hint=raw or None)

    # 1. If Zoe presented airport choices, match those first.
    if context_options:
        context_match = _match_context_options(cleaned, raw, context_options)
        if context_match:
            return context_match

    # 2. Exact/explicit IATA code.
    code = _token_code(raw)
    if code:
        option = get_airport(code)
        if option:
            return AirportResolution(status="resolved", airport=option, hint=raw)

    # 3. Specific airport name or alias.
    airport_matches = _find_airport_name_matches(cleaned)
    if airport_matches:
        if len(airport_matches) == 1:
            return AirportResolution(status="resolved", airport=airport_matches[0], hint=raw)
        return AirportResolution(status="options", options=tuple(airport_matches[:8]), hint=raw)

    # 4. City/metro match. This must come before country/continent broad handling.
    city_matches = _find_city_matches(cleaned)
    if city_matches:
        if len(city_matches) == 1:
            return AirportResolution(status="resolved", airport=city_matches[0], hint=raw)
        return AirportResolution(status="options", options=tuple(city_matches[:8]), hint=raw)

    # 5. Region/state/province match. Treat as broad for direct slot filling so
    # Zoe asks for city/airport, but allow options_for_hint() to list airports
    # when the user asks "what airports are there?"
    region_matches = _find_region_matches(cleaned)
    if region_matches:
        return AirportResolution(status="broad", options=tuple(region_matches[:8]), hint=raw)

    # 6. Country/continent/macro-region. These are broad by default.
    if _is_broad_location(cleaned) or _find_country_matches(cleaned) or _find_continent_matches(cleaned):
        return AirportResolution(status="broad", hint=raw)

    return AirportResolution(status="unknown", hint=raw)


def options_for_hint(hint: str | None) -> list[AirportOption]:
    if not hint:
        return []

    raw = str(hint or "").strip()
    cleaned = _without_fillers(normalize_text(raw)) or normalize_text(raw)

    result = resolve_airport_text(raw)
    if result.status == "resolved" and result.airport:
        return [result.airport]
    if result.status == "options":
        return list(result.options)
    if result.status == "broad" and result.options:
        return list(result.options)

    # For broad countries/continents, intentionally return no country-wide list.
    # Zoe should ask for a city or airport because country-wide airport lists are
    # usually too broad and misleading.
    if _is_broad_location(cleaned) or _find_country_matches(cleaned) or _find_continent_matches(cleaned):
        return []

    # If the broad guard did not trigger, try city/region lookup directly.
    city_options = _find_city_matches(cleaned)
    if city_options:
        return city_options[:8]

    region_options = _find_region_matches(cleaned)
    if region_options:
        return region_options[:8]

    return []


def is_airport_options_request(text: str) -> bool:
    t = normalize_text(text)
    if not t:
        return False
    option_words = [
        "which airports", "what airports", "airport options", "what are the airports",
        "which ones", "what ones", "which one", "what do they have", "do they have",
        "what are my options", "what options", "show options", "list airports",
    ]
    return any(word in t for word in option_words)


def format_airport_options(options: list[AirportOption], *, hint: str | None = None) -> str:
    if not options:
        if hint:
            place = _display_label(hint)
            return f"Which city or airport in {place} should I use?"
        return "Which city or airport should I use?"

    labels = [option.label for option in options[:6]]
    if len(labels) == 1:
        return f"I found {labels[0]}. Should I use that airport?"

    place = f" for {_display_label(hint)}" if hint else ""
    if len(labels) == 2:
        joined = " or ".join(labels)
    else:
        joined = ", ".join(labels[:-1]) + f", or {labels[-1]}"
    return f"The airport options I know{place} are {joined}. Which one should I use?"
