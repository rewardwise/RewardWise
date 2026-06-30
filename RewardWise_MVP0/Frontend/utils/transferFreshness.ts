/** @format */

/**
 * Freshness TTL for the transfer-ratio data (flexible_transfers.json `as_of`).
 * A silently-stale JSON is the real failure mode — this surfaces a passive
 * in-product signal instead of a separate monitoring system.
 *
 *   < 30 days  → "fresh": no disclaimer
 *   30–90 days → "stale": gray "as of <date>, verify before transferring"
 *   > 90 days  → "warn":  orange "Likely out of date as of <date>, verify…"
 */
export type FreshnessBand = "fresh" | "stale" | "warn";

export interface Freshness {
	band: FreshnessBand;
	/** Disclaimer text, or null when fresh (omit the disclaimer). */
	label: string | null;
	/** Human date, e.g. "May 14, 2026" — null if as_of is missing/invalid. */
	dateLabel: string | null;
}

const DAY_MS = 86_400_000;
const STALE_AFTER_DAYS = 30;
const WARN_AFTER_DAYS = 90;

export function transferFreshness(asOf: string | null | undefined, now: Date = new Date()): Freshness {
	if (!asOf) return { band: "fresh", label: null, dateLabel: null };
	const asOfDate = new Date(asOf);
	if (Number.isNaN(asOfDate.getTime())) return { band: "fresh", label: null, dateLabel: null };

	const dateLabel = asOfDate.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
	const days = Math.floor((now.getTime() - asOfDate.getTime()) / DAY_MS);

	if (days < STALE_AFTER_DAYS) {
		return { band: "fresh", label: null, dateLabel };
	}
	if (days <= WARN_AFTER_DAYS) {
		return { band: "stale", label: `Transfer ratios as of ${dateLabel} — verify before transferring`, dateLabel };
	}
	return {
		band: "warn",
		label: `Transfer ratios likely out of date as of ${dateLabel} — verify before transferring`,
		dateLabel,
	};
}
