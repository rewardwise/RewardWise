"""Central place for all cache-related constants """

# L1 in-memory cache configuration
SEARCH_CACHE = {
    "TTL_MS": 60 * 60 * 1000,  # 1 hour
    "MAX_SIZE": 500,
}

# L2 DB cache configuration
SEARCH_DB_CACHE = {
    "MAX_AGE_MS": 24 * 60 * 60 * 1000,  # 24 hours
}

# Flight level cache configuration
FLIGHT_CACHE = {
    "MAX_SIZE": 2000,
    "MAX_TTL_MS": 24 * 60 * 60 * 1000,  # 24 hours
}
