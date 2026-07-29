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
	cabin?: "economy" | "premium_economy" | "business" | "first";
	/** A route-shaped phrase ("X to Y", "from X", "fly to X") matched
	 *  textually but a named place FAILED to resolve. The auto-run must
	 *  never fire on this — the user explicitly changed a field we could
	 *  not apply; searching the stale value would produce a confident
	 *  verdict for the WRONG TRIP (P0 incident 2026-07-27). */
	unresolved_place?: boolean;
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

export interface CurrentTrip {
	origin?: string | null;
	destination?: string | null;
	date?: string | null;
	return_date?: string | null;
}

export function extractTripParams(
	message: string,
	today: Date = new Date(),
	current: CurrentTrip | null = null,
): ExtractedTrip | null {
	const msg = message.toLowerCase();
	const out: ExtractedTrip = {};

	// Route resolution is FALL-THROUGH BY RESOLUTION, not by regex match: a
	// pattern that matches textually but doesn't resolve to real places yields
	// to the next pattern ("fly to tokyo" must not be eaten by the 3-letter
	// alternative matching the word "fly").
	const stop =
		"(?=\\s+(?:on|in|for|from|between|leaving|departing|around|next|this|with)\\b|\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b|\\s*(?:,|\\.|!|\\?|$)|\\s+\\d)";

	// P0 guard state (2026-07-27 wrong-trip incident): remember when a
	// route-shaped phrase matched but a place failed to resolve.
	let routeShapeSeen = false;
	let routeResolved = false;

	const tryFromTo = (): Partial<ExtractedTrip> | null => {
		const m = msg.match(new RegExp(`\\bfrom\\s+([a-z][a-z .'-]{1,28}?)\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`));
		if (!m) return null;
		routeShapeSeen = true;
		const o = resolvePlace(m[1]);
		const d = resolvePlace(m[2]);
		if (!o && !d) return null;
		if (o && d) routeResolved = true;
		return { ...(o ? { origin: o } : {}), ...(d ? { destination: d } : {}) };
	};
	const tryBareTo = (): Partial<ExtractedTrip> | null => {
		// Generalized bare pair: "Seattle to Tokyo", "How about Seattle to
		// Tokyo…", "SEA to Tokyo". The left phrase may start mid-sentence, so
		// scan progressively shorter word-suffixes of the left capture until
		// one resolves ("how about seattle" -> "about seattle" -> "seattle").
		// BOTH sides must resolve — resolution-based fallthrough keeps date
		// ranges ("March 15 to 31") and idioms ("flying blue to delta") from
		// filling anything.
		const re = new RegExp(`\\b([a-z][a-z .'-]{1,40}?)\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`, "g");
		for (const m of msg.matchAll(re)) {
			const d = resolvePlace(m[2]);
			const leftWords = m[1].trim().split(/\s+/);
			let o: string | null = null;
			for (let i = 0; i < leftWords.length && !o; i++) {
				o = resolvePlace(leftWords.slice(i).join(" "));
			}
			if (o && d) {
				routeShapeSeen = true;
				routeResolved = true;
				return { origin: o, destination: d };
			}
			// Exactly ONE side resolving = a route attempt with a place we
			// couldn't apply ("Seattle to Tokyoo") — flag it. NEITHER side
			// resolving is an idiom ("points to cash", "flying blue to
			// delta") — stay quiet.
			if (Boolean(o) !== Boolean(d)) routeShapeSeen = true;
		}
		return null;
	};
	const tryDestOnly = (): Partial<ExtractedTrip> | null => {
		const m = msg.match(new RegExp(`\\b(?:fly|flying|flight|trip|go|going|travel(?:ing)?)\\s+to\\s+([a-z][a-z .'-]{1,28}?)${stop}`));
		if (!m) return null;
		routeShapeSeen = true;
		const d = resolvePlace(m[1]);
		if (d) routeResolved = true;
		return d ? { destination: d } : null;
	};

	Object.assign(out, tryFromTo() ?? tryBareTo() ?? tryDestOnly() ?? {});

	Object.assign(out, extractDates(msg, today));

	// Return-phrase dates ("coming back Mar 31", "back on April 2", "returning
	// the 31st"). The range parser above only understands connector ranges
	// ("Mar 15 to 31") — a P0 (2026-07-28): "…Mar 15 coming back Mar 31" left
	// the return stale, ran return<depart, and dumped a raw validation error.
	const RET_PHRASE =
		/\b(?:coming\s+back|come\s+back|coming\s+home|come\s+home|heading\s+back|going\s+back|returning|return|back)\s+(?:on\s+|home\s+on\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|the\s+\d{1,2}(?:st|nd|rd|th)?\b)/i;
	const rp = msg.match(RET_PHRASE);
	if (rp) {
		const frag = rp[1];
		let retIso: string | undefined;
		const isoFrag = frag.match(/^\d{4}-\d{2}-\d{2}$/);
		const monthFrag = frag.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/i);
		const dayFrag = frag.match(/^the\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
		if (isoFrag) {
			retIso = frag;
		} else if (monthFrag) {
			const rm = MONTHS[monthFrag[1].toLowerCase()];
			const rd = parseInt(monthFrag[2], 10);
			if (rm && rd >= 1 && rd <= 31) {
				const ry = monthFrag[3] ? parseInt(monthFrag[3], 10) : futureYearFor(rm, rd, today);
				retIso = toISO(ry, rm, rd);
			}
		} else if (dayFrag) {
			// "back the 31st" — anchor month/year from the depart date in this
			// same message, else the form's current dates.
			const day = parseInt(dayFrag[1], 10);
			const anchorIso = out.date || current?.date || current?.return_date || undefined;
			if (day >= 1 && day <= 31 && anchorIso && /^\d{4}-\d{2}-\d{2}$/.test(anchorIso)) {
				const [ay, am, ad] = anchorIso.split("-").map(Number);
				retIso = toISO(ay, am, day);
				// Return day before the depart day in the anchor month = next month.
				if (out.date && day < ad) {
					retIso = am === 12 ? toISO(ay + 1, 1, day) : toISO(ay, am + 1, day);
				}
			}
		}
		if (retIso) {
			// If the ONLY date the range parser saw was this return-phrased one,
			// it landed in out.date — "coming back Mar 31" alone must move the
			// RETURN, not the departure (the stale-depart half of the P0).
			if (out.date === retIso && !out.return_date) delete out.date;
			// Depart-then-return wraparound ("Dec 28 coming back Jan 2").
			const departIso = out.date || current?.date || undefined;
			if (departIso && retIso <= departIso) {
				const [ry, rm2, rd2] = retIso.split("-").map(Number);
				const [, dm2] = departIso.split("-").map(Number);
				if (rm2 < dm2) retIso = toISO(ry + 1, rm2, rd2);
			}
			out.return_date = retIso;
		}
	}

	// Incremental day-only update ("what about the 20th instead?", "come back
	// on the 25th"): only when a month-anchored date was NOT already extracted
	// and the FORM already has a date to borrow month/year context from.
	// Requires an ordinal or "the N" so bare counts ("2 travelers") never match.
	if (!out.date && !out.return_date && current) {
		const dm = msg.match(/\b(?:on\s+|about\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?\b|\b(\d{1,2})(?:st|nd|rd|th)\b/);
		if (dm) {
			const day = parseInt(dm[1] ?? dm[2], 10);
			const isReturn = /\b(?:return|back|home|returning)\b/.test(msg);
			const anchorIso = isReturn ? (current.return_date || current.date) : (current.date || current.return_date);
			if (day >= 1 && day <= 31 && anchorIso && /^\d{4}-\d{2}-\d{2}$/.test(anchorIso)) {
				const [ay, am] = anchorIso.split("-").map(Number);
				let iso = toISO(ay, am, day);
				// Same month as the anchor; roll forward a month if it lands in the past.
				const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
				if (new Date(ay, am - 1, day) < startOfToday) {
					iso = am === 12 ? toISO(ay + 1, 1, day) : toISO(ay, am + 1, day);
				}
				if (isReturn) out.return_date = iso;
				else out.date = iso;
			}
		}
	}

	// Voice turns arrive with number WORDS ("for two travelers") — STT keeps
	// small counts as words, so the digit-only pattern missed the common
	// spoken case. Normalize one–nine before matching.
	const WORD_NUMS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
	const travMsg = msg.replace(
		/\b(one|two|three|four|five|six|seven|eight|nine)(?=\s*(?:travelers?|adults?|passengers?|people|pax)\b)/g,
		(w) => WORD_NUMS[w],
	);
	const trav = travMsg.match(/\b(\d{1,2})\s*(?:travelers?|adults?|passengers?|people|pax)\b/);
	if (trav) {
		const n = parseInt(trav[1], 10);
		if (n >= 1 && n <= 9) out.travelers = n;
	}

	if (/\bone[\s-]?way\b/.test(msg)) out.tripType = "oneway";
	else if (out.return_date && (out.origin || out.destination)) out.tripType = "roundtrip";
	// (incremental return-date updates don't touch tripType — the form already knows)

	// Non-trip guard: nothing confidently extracted -> null (form untouched).
	// return_date-only (incremental "come back on the 25th") and travelers-only
	// ("make it 2 travelers") are valid partial updates.
	// Cabin detection ("search business", "make it business", "in first
	// class", "premium economy"). Closed vocabulary — no resolution risk —
	// but conservative on ambiguous words: "business" is excluded when it
	// heads a phrase like "business trip", and bare "first" only counts as
	// "first class" / "in first" (never "the first of March", which the date
	// parser owns anyway).
	if (/\bpremium\s+econ(?:omy)?\b/.test(msg)) {
		out.cabin = "premium_economy";
	} else if (/\bbusiness\b(?!\s+(?:trip|meeting|travel|traveler))/.test(msg)) {
		out.cabin = "business";
	} else if (/\bfirst\s+class\b|\bin\s+first\b/.test(msg)) {
		out.cabin = "first";
	} else if (/\b(?:economy|coach)\b/.test(msg)) {
		out.cabin = "economy";
	}

	// The user named a route we could not fully apply — mark it so the
	// consumer HOLDS the auto-run and asks, instead of searching stale
	// origin/destination with fresh dates (the P0 wrong-trip disaster).
	if (routeShapeSeen && !routeResolved && !(out.origin && out.destination)) {
		out.unresolved_place = true;
	}

	const hasSignal = Boolean(
		out.unresolved_place ||
		out.origin || out.destination || out.date || out.return_date || out.travelers || out.cabin
	);
	if (!hasSignal) return null;
	return out;
}

/** Post-merge completeness plan for a Zoe fill: what the home form will look
 *  like after this fill lands, whether the auto-run will fire, and which
 *  required fields are still missing (drives the backend ack copy). */
export function planTripFill(
	extracted: ExtractedTrip | null,
	current: CurrentTrip | null,
): { willAutorun: boolean; missing: string[] } {
	if (!extracted) return { willAutorun: false, missing: [] };
	if (extracted.unresolved_place) {
		// Never auto-run when the user's stated place didn't apply.
		return { willAutorun: false, missing: ["unresolved_place"] };
	}
	const merged = {
		origin: extracted.origin || current?.origin || null,
		destination: extracted.destination || current?.destination || null,
		date: extracted.date || current?.date || null,
		return_date: extracted.return_date || current?.return_date || null,
	};
	// Invalid-combination hold (P0 2026-07-28, same discipline as
	// unresolved_place): a post-merge return before departure must never run —
	// it 422s in the engine and the user sees a raw validation error. Hold and
	// let the backend ack ask a friendly question instead.
	if (merged.date && merged.return_date && merged.return_date < merged.date) {
		return { willAutorun: false, missing: ["return_before_depart"] };
	}
	const missing: string[] = [];
	if (!merged.origin) missing.push("origin");
	if (!merged.destination) missing.push("destination");
	if (!merged.date) missing.push("date");
	if (extracted.tripType === "roundtrip" && !merged.return_date) missing.push("return_date");
	return { willAutorun: missing.length === 0, missing };
}
