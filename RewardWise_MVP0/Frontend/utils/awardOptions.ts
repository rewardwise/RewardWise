/** @format */

// Metro-area + flexible date searches can return multiple award entries for the
// same program (different airport pairs, different dates, different trip_ids).
// The verdict surface presents a single recommendation per program — render the
// best representative and drop the rest.
//
// Dedupe rule: lowest points wins. Ties break on fewest stops (nonstop > 1 stop > 2 stops).
// Stops resolution: trips[0].stops when hydrated by seats.aero fan-out, else
// 0 for direct=true awards, else 999 sentinel so unknowns sort last.

export interface DedupeAwardOption {
	program: string;
	points: number;
	direct?: boolean;
	trips?: Array<{ stops?: number }>;
	taxes?: number | null;
	cpp?: number;
	airlines?: string;
	remaining_seats?: number;
}

function stopsFor<T extends DedupeAwardOption>(opt: T): number {
	const hydrated = opt.trips?.[0]?.stops;
	if (typeof hydrated === "number") return hydrated;
	if (opt.direct === true) return 0;
	return 999;
}

// On flex round-trip searches, /api/search returns award_options spanning
// every date in the ±7 window. The verdict surface should render trips on
// the chosen winning_date — not whichever date happens to be cheapest. Pin
// the option list to options matching winning_date before any downstream
// dedupe / selection. Defensive fallback: if no option matches the date,
// pass the original list through so the leg still renders something rather
// than collapsing to empty (ticket 86ba4t6f1).
export function filterByDate<T extends DedupeAwardOption & { date?: string }>(
	opts: T[],
	date: string | null | undefined,
): T[] {
	if (!date) return opts;
	const matched = opts.filter((o) => o.date === date);
	return matched.length > 0 ? matched : opts;
}

export function dedupeByProgram<T extends DedupeAwardOption>(opts: T[]): T[] {
	const byProgram = new Map<string, T>();
	for (const opt of opts) {
		const key = opt.program.toLowerCase().trim();
		const existing = byProgram.get(key);
		if (!existing) {
			byProgram.set(key, opt);
			continue;
		}
		if (opt.points < existing.points) {
			byProgram.set(key, opt);
			continue;
		}
		if (opt.points === existing.points && stopsFor(opt) < stopsFor(existing)) {
			byProgram.set(key, opt);
		}
	}
	return Array.from(byProgram.values());
}
