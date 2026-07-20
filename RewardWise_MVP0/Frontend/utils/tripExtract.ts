/** @format */
/**
 * Deterministic trip-parameter extraction from a free-text Zoe message.
 *
 * NO LLM CALLS. Resolution uses the exact same local datasets as the search
 * autocomplete (AIRPORTS + METRO_GROUPS). Design rule: partial fill is fine,
 * wrong fill is not — a field is returned ONLY when it resolves exactly and
 * unambiguously; anything else stays undefined and the form is left alone.
 * Non-trip messages ("how do transfers work?") must return null.
 */

import { AIRPORTS } from "@/components/airports";
import { METRO_GROUPS } from "@/components/metro-groups";

export interface ExtractedTrip {
	origin?: string;
	destination?: string;
	date?: string;
	return_date?: string;
	travelers?: number;
	tripType?: "roundtrip" | "oneway";
}

const MONTHS: Record<string, number> = {
	jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
	jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// ── Place resolution (exact-only) ───────────────────────────────────────────

function resolvePlace(raw: string): string | null {
	const q = raw.trim().toLowerCase().replace(/\s+/g, " ");
	if (!q) return null;

	// Exact IATA code ("SEA", "sfo").
	if (/^[a-z]{3}$/.test(q)) {
		const hit = AIRPORTS.find((a) => a.code.toLowerCase() === q);
		if (hit) return hit.code;
	}

	// Exact metro name ("tokyo", "new york city") or metro code ("NYC").
	const metro = METRO_GROUPS.find(
		(m) => m.name.toLowerCase() === q || m.code.toLowerCase() === q
	);
	if (metro) return metro.airports.join(",");

	// Exact city match — unique only ("denver" -> DEN; ambiguous cities skip).
	const cityHits = AIRPORTS.filter((a) => a.city.toLowerCase() === q);
	if (cityHits.length === 1) return cityHits[0].code;

	// "city airport-name" style exact ("seattle tacoma") — skip: too fuzzy.
	return null;
}

// ── Date parsing ────────────────────────────────────────────────────────────

function toISO(y: number, m: number, d: number): string {
	return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function futureYearFor(m: number, d: number, today: Date): number {
	const y = today.getFullYear();
	const candidate = new Date(y, m - 1, d);
	const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	return candidate >= startOfToday ? y : y + 1;
}

interface ExtractedDates {
	date?: string;
	return_date?: string;
}

function extractDates(msg: string, today: Date): ExtractedDates {
	// ISO pair: 2026-11-25 ... 2026-11-29
	const iso = msg.match(/(\d{4}-\d{2}-\d{2})(?:\s*(?:-|–|to|through|until|and)\s*(\d{4}-\d{2}-\d{2}))?/);
	if (iso) {
		return { date: iso[1], return_date: iso[2] || undefined };
	}

	// Month-name forms:
	//   "September 10 to 14" / "Sep 10-14" / "Nov 25 - Nov 29" / "aug 15th"
	const m = msg.match(
		/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:-|–|to|through|until|and)\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s*(\d{4}))?/i
	);
	if (!m) return {};
	const m1 = MONTHS[m[1].toLowerCase()];
	const d1 = parseInt(m[2], 10);
	if (!m1 || d1 < 1 || d1 > 31) return {};
	const explicitYear = m[5] ? parseInt(m[5], 10) : null;
	const y1 = explicitYear ?? futureYearFor(m1, d1, today);
	const out: ExtractedDates = { date: toISO(y1, m1, d1) };

	if (m[4]) {
		const m2 = m[3] ? MONTHS[m[3].toLowerCase()] : m1;
		const d2 = parseInt(m[4], 10);
		if (m2 && d2 >= 1 && d2 <= 31) {
			let y2 = explicitYear ?? y1;
			// Dec 28 - Jan 2 style wraparound.
			if (m2 < m1 || (m2 === m1 && d2 < d1)) y2 = y1 + (m2 < m1 ? 1 : 0);
			if (m2 < m1 || (m2 === m1 && d2 < d1 && m2 < m1)) y2 = y1 + 1;
			const ret = toISO(m2 < m1 ? y1 + 1 : y2, m2, d2);
			if (ret > out.date!) out.return_date = ret;
		}
	}
	return out;
}

// ── Main extractor ──────────────────────────────────────────────────────────

export function extractTripParams(message: string, today: Date = new Date()): ExtractedTrip | null {
	const msg = message.toLowerCase();
	const out: ExtractedTrip = {};

	// Route resolution is FALL-THROUGH BY RESOLUTION, not by regex match: a
	// pattern that matches textually but doesn't resolve to real places yields
	// to the next pattern ("fly to tokyo" must not be eaten by the 3-letter
	// alternative matching the word "fly").
	const stop =
		"(?=\\s+(?:on|in|for|from|between|leaving|departing|around|next|this|with)\\b|\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b|\\s*(?:,|\\.|!|\\?|$)|\\s+\\d)";

	const tryFromTo = (): Partial<ExtractedTrip> | null => {
		const m = msg.match(new RegExp(`\\bfrom\\s+([a-z][a-z .'-]{1,28}?)\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`));
		if (!m) return null;
		const o = resolvePlace(m[1]);
		const d = resolvePlace(m[2]);
		if (!o && !d) return null;
		return { ...(o ? { origin: o } : {}), ...(d ? { destination: d } : {}) };
	};
	const tryBareTo = (): Partial<ExtractedTrip> | null => {
		const patterns = [
			new RegExp(`\\b(?:fly|flying|flight|trip|go|going|travel(?:ing)?)\\s+([a-z][a-z .'-]{1,28}?)\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`),
			new RegExp(`\\b([a-z]{3})\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`),
		];
		for (const re of patterns) {
			const m = msg.match(re);
			if (!m) continue;
			const o = resolvePlace(m[1]);
			const d = resolvePlace(m[2]);
			// Bare "X to Y" is riskier — require BOTH to resolve before filling.
			if (o && d) return { origin: o, destination: d };
		}
		return null;
	};
	const tryDestOnly = (): Partial<ExtractedTrip> | null => {
		const m = msg.match(new RegExp(`\\b(?:fly|flying|flight|trip|go|going|travel(?:ing)?)\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`));
		if (!m) return null;
		const d = resolvePlace(m[1]);
		return d ? { destination: d } : null;
	};

	Object.assign(out, tryFromTo() ?? tryBareTo() ?? tryDestOnly() ?? {});

	Object.assign(out, extractDates(msg, today));

	const trav = msg.match(/\b(\d{1,2})\s*(?:travelers?|adults?|passengers?|people|pax)\b/);
	if (trav) {
		const n = parseInt(trav[1], 10);
		if (n >= 1 && n <= 9) out.travelers = n;
	}

	if (/\bone[\s-]?way\b/.test(msg)) out.tripType = "oneway";
	else if (out.return_date) out.tripType = "roundtrip";

	// Non-trip guard: nothing confidently extracted -> null (form untouched).
	const hasRoute = Boolean(out.origin || out.destination);
	const hasDate = Boolean(out.date);
	if (!hasRoute && !hasDate) return null;
	return out;
}
