
#Deterministic string keys for cache lookups format: search:ORIGIN|DEST|DEPART|RETURN|PASSENGERS|CABIN



from app.cache.normalize import normalize, normalize_search_params
from app.cache.types import SearchParams


def build_search_cache_key(params: SearchParams) -> str:
    o, d, dep, dep_end, ret, ret_end, pax, cab = normalize_search_params(params)
    dep_seg = f"{dep}-{dep_end}" if dep_end and dep_end != dep else dep
    ret_seg = f"{ret}-{ret_end}" if ret and ret_end and ret_end != ret else ret
    return f"search:{o}|{d}|{dep_seg}|{ret_seg}|{pax}|{cab}"


def build_user_verdict_cache_key(params: SearchParams, user_id: str) -> str:
    """Verdict-reuse key (L1). MUST include the user: since wallet-fit
    selection (#2 step c), verdicts are wallet-dependent — a cross-user
    verdict reuse can serve user B a winner picked for user A's wallet.
    (The payload cache is the shared, user-agnostic layer instead.)"""
    return f"user:{user_id}|{build_search_cache_key(params)}"


def build_flight_cache_key(flight_id: str, airline: str) -> str:
    return f"flight:{str(flight_id).strip()}|{normalize(airline)}"
