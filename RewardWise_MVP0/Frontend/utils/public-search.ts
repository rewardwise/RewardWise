/** @format */

// PUBLIC_SEARCH_FREE_LIMIT is DISPLAY-ONLY copy.
// Enforcement lives in Backend/app/api/search.py via the env var
// PUBLIC_SEARCH_FREE_LIMIT. The two values MUST be set in lockstep —
// if you change the backend, change the NEXT_PUBLIC_* env on Vercel too.
// Default 3 on both. If display/enforcement drift becomes a real problem,
// promote this to a /api/public-search/config endpoint.
const RAW = process.env.NEXT_PUBLIC_PUBLIC_SEARCH_FREE_LIMIT;
const PARSED = RAW ? Number(RAW) : NaN;
export const PUBLIC_SEARCH_FREE_LIMIT =
	Number.isFinite(PARSED) && PARSED >= 1 ? Math.floor(PARSED) : 3;

export function pluralizeSearch(limit: number = PUBLIC_SEARCH_FREE_LIMIT): string {
	return limit === 1 ? "search" : "searches";
}

export function pluralizeUse(limit: number = PUBLIC_SEARCH_FREE_LIMIT): string {
	return limit === 1 ? "use" : "uses";
}

export function pluralizeTime(limit: number = PUBLIC_SEARCH_FREE_LIMIT): string {
	return limit === 1 ? "time" : "times";
}
