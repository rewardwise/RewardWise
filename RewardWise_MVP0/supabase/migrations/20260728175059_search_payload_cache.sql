-- Shared, persistent provider-payload cache (operator-approved 2026-07-28).
-- Params-keyed and USER-AGNOSTIC: the raw provider results (seats.aero both
-- legs, SerpAPI main quote, per-date samplers) are the same for every user;
-- per-user work (wallet-fit selection, metrics, ownership) recomputes on top.
-- A repeat search by ANYONE within 30 minutes skips the provider fetch
-- entirely. Persistent by design: the free instance cold-starts inside the
-- 30-minute window, so in-memory would miss exactly when it matters (the L2
-- lesson). Freshness is enforced at READ time; writes prune expired rows.

CREATE TABLE IF NOT EXISTS public.search_payload_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_payload_cache_created_at_idx
  ON public.search_payload_cache (created_at);

-- Service-role only: not part of the public API surface.
ALTER TABLE public.search_payload_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_payload_cache FROM anon, authenticated;
