
#Deterministic string keys for cache lookups format: search:ORIGIN|DEST|DEPART|RETURN|PASSENGERS|CABIN



from app.cache.normalize import normalize, normalize_search_params
from app.cache.types import SearchParams


def build_search_cache_key(params: SearchParams) -> str:
    o, d, dep, ret, pax, cab = normalize_search_params(params)
    dep_end_raw = params.get("departure_date_end")
    dep_end = str(dep_end_raw).strip() if dep_end_raw else ""
    if dep_end and dep_end != dep:
        return f"search:{o}|{d}|{dep}-{dep_end}|{ret}|{pax}|{cab}"
    return f"search:{o}|{d}|{dep}|{ret}|{pax}|{cab}"


def build_flight_cache_key(flight_id: str, airline: str) -> str:
    return f"flight:{str(flight_id).strip()}|{normalize(airline)}"
