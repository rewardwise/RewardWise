/** @format */

/**
 * Cents-per-point for a booked/verdict option: how much cash value each point
 * redeemed for. Computed as (cash_price × 100) / points_cost.
 *
 * Per the 8b spec (Step 2): compute from cash + points when BOTH exist and are
 * positive; otherwise the field is NOT computable and callers must HIDE it — we
 * never render a "-" placeholder. Returns null when not computable.
 */
export function computeCpp(
	cashPrice?: number | null,
	pointsCost?: number | null,
): number | null {
	if (typeof cashPrice !== "number" || typeof pointsCost !== "number") return null;
	if (!Number.isFinite(cashPrice) || !Number.isFinite(pointsCost)) return null;
	if (cashPrice <= 0 || pointsCost <= 0) return null;
	return (cashPrice * 100) / pointsCost;
}

/**
 * Display string for a computed cents-per-point value, e.g. "1.41¢/pt". The
 * "/pt" is required so it never reads as a bare cash "cents" amount (units rule).
 * Only call with a non-null cpp.
 */
export function formatCpp(cpp: number): string {
	return `${cpp.toFixed(2)}¢/pt`;
}
