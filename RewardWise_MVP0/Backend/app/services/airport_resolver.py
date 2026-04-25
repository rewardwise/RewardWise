from __future__ import annotations

from dataclasses import dataclass
import json
import re
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

# These broad aliases are not used to pick airports. They only tell Zoe to ask
# for a more specific city/airport. Most broad locations are loaded from
# airport_metadata.json at runtime.
BROAD_REGION_ALIASES = {
    "africa", "asia", "europe", "north america", "south america", "oceania",
    "antarctica", "middle east", "central america", "caribbean", "latin america",
    "southeast asia", "east asia", "south asia", "central asia", "western europe",
    "eastern europe", "northern europe", "southern europe", "sub saharan africa",
    "usa", "us", "u s", "america", "united states of america", "uk", "u k",
    "great britain", "britain", "uae", "u a e", "russian federation",
    "the bahamas", "the gambia", "the netherlands", "viet nam", "turkiye", "türkiye",
}

# Common broad subnational regions. Airport metadata can also add regions at runtime.
REGION_HINTS = {
    # US states + DC
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
    "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
    "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
    "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
    "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio",
    "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming", "district of columbia", "dc",
    # Canadian provinces/territories
    "alberta", "british columbia", "manitoba", "new brunswick", "newfoundland",
    "newfoundland and labrador", "nova scotia", "ontario", "prince edward island",
    "quebec", "saskatchewan", "northwest territories", "nunavut", "yukon",
}


def normalize_text(value: Any) -> str:
    text = str(value or "").lower().strip()
    text = text.replace("’", "'")
    text = re.sub(r"[^a-z0-9\s']+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _without_fillers(text: str) -> str:
    tokens = [token for token in normalize_text(text).split() if token not in FILLER_WORDS]
    return " ".join(tokens).strip()


@dataclass(frozen=True)
class AirportOption:
    iata: str
    name: str
    city: str = ""
    region: str = ""
    country: str = ""
    continent: str = ""
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

    def to_dict(self) -> dict[str, Any]:
        return {
            "iata": self.iata,
            "name": self.name,
            "city": self.city,
            "region": self.region,
            "country": self.country,
            "continent": self.continent,
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
    """Load airport metadata from app/data/airport_metadata.json.

    The JSON file is generated from the same codes used by airport_codes.py. It
    should have this shape:
        { "airports": [ {"iata": "JFK", ...}, ... ] }

    Fallback import keeps older dev environments from hard-crashing if the JSON
    file has not been copied yet, but production should use the JSON.
    """
    if _METADATA_JSON_PATH.exists():
        with _METADATA_JSON_PATH.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        rows = payload.get("airports") if isinstance(payload, dict) else payload
        return rows if isinstance(rows, list) else []

    # Backward-compatible fallback for older branches. Remove after JSON is
    # definitely committed everywhere.
    try:
        from app.data.airport_metadata import AIRPORTS  # type: ignore

        return list(AIRPORTS)
    except Exception:
        return []


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
            city=str(raw.get("city") or ""),
            region=str(raw.get("region") or ""),
            country=str(raw.get("country") or ""),
            continent=str(raw.get("continent") or ""),
            metadata_quality=str(raw.get("metadata_quality") or "unknown"),
            aliases=aliases,
        )
    )

_BY_IATA = {a.iata: a for a in _AIRPORTS if a.iata}

# Derived broad terms from metadata. Countries and continents are always broad;
# regions are broad only if they are not also used as a city. This avoids the
# Singapore bug: Singapore can be a country, but metadata also knows it as a city.
_COUNTRY_TERMS = {normalize_text(a.country) for a in _AIRPORTS if normalize_text(a.country)}
_CONTINENT_TERMS = {normalize_text(a.continent) for a in _AIRPORTS if normalize_text(a.continent)}
_CITY_TERMS = {normalize_text(a.city) for a in _AIRPORTS if normalize_text(a.city)}
_REGION_TERMS = {normalize_text(a.region) for a in _AIRPORTS if normalize_text(a.region)}
_BROAD_LOCATION_TERMS = (_COUNTRY_TERMS | _CONTINENT_TERMS | BROAD_REGION_ALIASES | REGION_HINTS | (_REGION_TERMS - _CITY_TERMS))


def _unique(options: Iterable[AirportOption]) -> list[AirportOption]:
    seen: set[str] = set()
    out: list[AirportOption] = []
    for option in options:
        if option.iata and option.iata not in seen:
            seen.add(option.iata)
            out.append(option)
    return out


def _sort_options(options: Iterable[AirportOption]) -> list[AirportOption]:
    """Stable-ish ordering: curated metadata first, then code fallback rows."""
    unique = _unique(options)
    return sorted(unique, key=lambda o: (1 if o.is_fallback_only else 0, o.iata))


def _token_code(text: str) -> str | None:
    raw = str(text or "").strip()
    norm = normalize_text(raw)
    if not norm or norm in YES_NO_WORDS or norm in FILLER_WORDS:
        return None

    upper = norm.upper()
    if re.fullmatch(r"[A-Z]{3}", upper) and is_valid_airport_code(upper):
        return upper

    # Accept a code when the user makes it explicit, but do not mine random
    # 3-letter words from casual phrases like "switzerland bro".
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


def _airport_name_terms(option: AirportOption) -> set[str]:
    terms = {normalize_text(option.iata), normalize_text(option.name)}
    terms.update(option.aliases)
    return {t for t in terms if t}


def _city_terms(option: AirportOption) -> set[str]:
    terms = {normalize_text(option.city)}
    return {t for t in terms if t and t != normalize_text(option.iata)}


def _region_terms(option: AirportOption) -> set[str]:
    terms = {normalize_text(option.region)}
    return {t for t in terms if t}


def _country_terms(option: AirportOption) -> set[str]:
    terms = {normalize_text(option.country)}
    return {t for t in terms if t}


def _continent_terms(option: AirportOption) -> set[str]:
    terms = {normalize_text(option.continent)}
    return {t for t in terms if t}


def _is_broad_location(text: str | None) -> bool:
    norm = normalize_text(text)
    if not norm:
        return False
    return norm in _BROAD_LOCATION_TERMS


def _broad_location_label(text: str | None) -> str:
    raw = str(text or "").strip()
    return raw[:1].upper() + raw[1:] if raw else "that place"


def _match_context_options(norm: str, raw: str, context_options: list[dict[str, Any]]) -> AirportResolution | None:
    options: list[AirportOption] = []
    for item in context_options:
        code = str(item.get("iata") or item.get("value") or "").upper()
        opt = get_airport(code)
        if opt:
            options.append(opt)

    if not options:
        return None

    code = _token_code(raw)
    if code:
        for opt in options:
            if opt.iata == code:
                return AirportResolution(status="resolved", airport=opt, hint=raw)

    cleaned = _without_fillers(norm) or norm
    for opt in options:
        terms = _airport_name_terms(opt) | _city_terms(opt)
        if cleaned in terms:
            return AirportResolution(status="resolved", airport=opt, hint=raw)
        # Allow partial matching only inside the already-presented option list.
        if len(cleaned) >= 4 and any(cleaned in term or term in cleaned for term in terms if len(term) >= 4):
            return AirportResolution(status="resolved", airport=opt, hint=raw)
    return None


def resolve_airport_text(text: str, *, context_options: list[dict[str, Any]] | None = None) -> AirportResolution:
    raw = str(text or "").strip()
    norm = normalize_text(raw)
    cleaned = _without_fillers(norm) or norm

    if not cleaned or cleaned in YES_NO_WORDS:
        return AirportResolution(status="unknown", hint=raw or None)

    # If Zoe just presented options, match against those first. This fixes loops like
    # London -> STN/stansted, and avoids re-running broad country logic.
    if context_options:
        context_match = _match_context_options(cleaned, raw, context_options)
        if context_match:
            return context_match

    # 1. Exact/explicit IATA code.
    code = _token_code(raw)
    if code:
        opt = get_airport(code)
        if opt:
            return AirportResolution(status="resolved", airport=opt, hint=raw)

    # 2. Specific airport name/alias. This comes before broad country/region guards so
    # phrases like "Singapore Changi" or "London Heathrow" can resolve naturally.
    airport_exact: list[AirportOption] = []
    airport_contains: list[AirportOption] = []
    for opt in _AIRPORTS:
        terms = _airport_name_terms(opt)
        if cleaned in terms:
            airport_exact.append(opt)
            continue
        if len(cleaned) >= 4 and any(cleaned == alias for alias in opt.aliases):
            airport_exact.append(opt)
            continue
        if len(cleaned) >= 5:
            name = normalize_text(opt.name)
            if cleaned in name or any(cleaned in alias or alias in cleaned for alias in opt.aliases if len(alias) >= 5):
                airport_contains.append(opt)

    airport_matches = _sort_options(airport_exact or airport_contains)
    if airport_matches:
        if len(airport_matches) == 1:
            return AirportResolution(status="resolved", airport=airport_matches[0], hint=raw)
        return AirportResolution(status="options", options=tuple(airport_matches[:8]), hint=raw)

    # 3. City/metro match from metadata. This must come before the broad country guard.
    # That keeps city-country overlaps like Singapore from breaking.
    city_matches: list[AirportOption] = []
    for opt in _AIRPORTS:
        if cleaned in _city_terms(opt):
            city_matches.append(opt)
    city_matches = _sort_options(city_matches)
    if city_matches:
        if len(city_matches) == 1:
            return AirportResolution(status="resolved", airport=city_matches[0], hint=raw)
        return AirportResolution(status="options", options=tuple(city_matches[:8]), hint=raw)

    # 4. Region/state/province match from metadata. We can list options if metadata has
    # them, but broad countries/continents still ask for a city/airport first.
    region_matches: list[AirportOption] = []
    for opt in _AIRPORTS:
        if cleaned in _region_terms(opt):
            region_matches.append(opt)
    region_matches = _sort_options(region_matches)
    if region_matches:
        if len(region_matches) == 1 and not _is_broad_location(cleaned):
            return AirportResolution(status="resolved", airport=region_matches[0], hint=raw)
        return AirportResolution(status="options", options=tuple(region_matches[:8]), hint=raw)

    # 5. Country/continent/broad-region guard. Only trigger after airport/city/region
    # matching fails, so city-country overlaps do not break.
    if _is_broad_location(cleaned):
        return AirportResolution(status="broad", hint=raw)

    # 6. Country/continent match from metadata, treated as broad unless the same text
    # already matched a city/airport above.
    for opt in _AIRPORTS:
        if cleaned in _country_terms(opt) or cleaned in _continent_terms(opt):
            return AirportResolution(status="broad", hint=raw)

    return AirportResolution(status="unknown", hint=raw)


def options_for_hint(hint: str | None) -> list[AirportOption]:
    if not hint:
        return []
    result = resolve_airport_text(hint)
    if result.status == "resolved" and result.airport:
        return [result.airport]
    if result.status == "options":
        return list(result.options)
    # For broad country/continent hints, intentionally return no partial list. Zoe should
    # ask for a city or airport instead of showing an incomplete country-wide list.
    if result.status == "broad" or _is_broad_location(hint):
        return []

    norm = normalize_text(hint)
    options: list[AirportOption] = []
    for opt in _AIRPORTS:
        if norm in _city_terms(opt) or norm in _region_terms(opt):
            options.append(opt)
    return _sort_options(options)[:8]


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
        if hint and (_is_broad_location(hint) or resolve_airport_text(hint).status == "broad"):
            place = _broad_location_label(hint)
            return f"{place} has a lot of possible airports. Which city or airport should I use?"
        place = f" for {hint}" if hint else ""
        return f"I don’t have airport options{place} yet. Send the airport name or code you want to use."

    labels = [o.label for o in options[:6]]
    if len(labels) == 1:
        return f"I found {labels[0]}. Should I use that airport?"

    place = f" for {hint}" if hint else ""
    if len(labels) == 2:
        joined = " or ".join(labels)
    else:
        joined = ", ".join(labels[:-1]) + f", or {labels[-1]}"
    return f"The airport options I know{place} are {joined}. Which one should I use?"
