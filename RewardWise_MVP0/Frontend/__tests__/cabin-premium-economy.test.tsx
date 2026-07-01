/** Coverage for Premium Economy across all 8 frontend cabin surfaces (86ba25eq0 part 2). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CABIN_LABELS, cabinLabel, type Cabin } from "@/utils/cabin";

const FRONTEND_ROOT = join(__dirname, "..");

function readFE(relative: string): string {
	return readFileSync(join(FRONTEND_ROOT, relative), "utf8");
}

// ── utils/cabin.ts ───────────────────────────────────────────────────────────

describe("utils/cabin: CABIN_LABELS + cabinLabel()", () => {
	it("CABIN_LABELS covers exactly the 4 canonical cabin values", () => {
		expect(Object.keys(CABIN_LABELS).sort()).toEqual(
			["business", "economy", "first", "premium_economy"],
		);
	});

	it("premium_economy maps to 'Premium Economy'", () => {
		expect(CABIN_LABELS.premium_economy).toBe("Premium Economy");
	});

	it("cabinLabel('premium_economy') returns 'Premium Economy'", () => {
		expect(cabinLabel("premium_economy")).toBe("Premium Economy");
	});

	it("cabinLabel(null) and cabinLabel(undefined) both default to 'Economy'", () => {
		expect(cabinLabel(null)).toBe("Economy");
		expect(cabinLabel(undefined)).toBe("Economy");
	});

	it("stale pre-PR-#22 'premium' key is gone — falls through instead of mis-labeling", () => {
		// Pre-dedup, 3 surfaces hard-coded {premium: "Premium"} which would have
		// silently absorbed any stray "premium" cabin payload. Fall-through to the
		// raw string makes the data issue visible.
		expect(cabinLabel("premium")).toBe("premium");
	});

	it("Cabin type accepts premium_economy at compile-time", () => {
		const c: Cabin = "premium_economy";
		expect(c).toBe("premium_economy");
	});
});

// ── 4 search-select surfaces ─────────────────────────────────────────────────

describe("4 cabin <select> surfaces render Premium Economy", () => {
	it.each([
		["app/home/page.tsx", "post-login search form"],
		["app/page.tsx", "landing-page hero search"],
		["app/concierge/standard/page.tsx", "standard concierge intake"],
		["components/SearchForm.tsx", "legacy/embeddable search widget"],
	])("%s (%s) has <option value=\"premium_economy\">", (path) => {
		const src = readFE(path);
		expect(src).toContain('<option value="premium_economy">Premium Economy</option>');
	});

	it.each([
		["app/home/page.tsx", "post-login search form"],
		["app/page.tsx", "landing-page hero search"],
		["app/concierge/standard/page.tsx", "standard concierge intake"],
		["components/SearchForm.tsx", "legacy/embeddable search widget"],
	])("%s (%s) does not carry legacy value=\"premium\"", (path) => {
		// Catches the silent-revert failure mode where someone re-adds an
		// <option value="premium"> alongside premium_economy. Pre-PR-#22
		// `premium` is the stale key the dedup removed.
		const src = readFE(path);
		expect(src).not.toMatch(/<option\s+value=["']premium["']/);
	});
});

// ── 5 cabinLabel rendering surfaces ──────────────────────────────────────────

describe("4 cabinLabel surfaces import from shared @/utils/cabin", () => {
	it.each([
		// 8b: booked trips folded into /history; /trips is now a 308 redirect.
		["app/history/page.tsx", "history: searches + booked trips + filters"],
		["components/WatchlistSection.tsx", "watchlist card chip"],
		["app/concierge/history/[id]/page.tsx", "concierge request detail"],
		["components/SearchLoadingExperience.tsx", "search loading footer"],
	])("%s (%s) imports cabinLabel from @/utils/cabin", (path) => {
		const src = readFE(path);
		expect(src).toMatch(/import\s*\{\s*cabinLabel[^}]*\}\s*from\s*["']@\/utils\/cabin["']/);
		// And no longer carries a local cabinLabel function definition.
		expect(src).not.toMatch(/function\s+cabinLabel\s*\(/);
	});
});

// ── VerdictCard PE rendering (H3) ────────────────────────────────────────────

describe("VerdictCard routes cabin rendering through shared cabinLabel", () => {
	const src = readFE("components/VerdictCard.tsx");

	it("imports cabinLabel from @/utils/cabin", () => {
		expect(src).toMatch(/import\s*\{\s*cabinLabel\s*\}\s*from\s*["']@\/utils\/cabin["']/);
	});

	it("no longer uses the raw .replace(/_/g, ' ') pattern for cabin", () => {
		// Pre-fix the verdict card rendered `(cabin || "economy").replace(/_/g, " ")`
		// which produced lowercase "premium economy" inconsistent with the rest
		// of the app. cabinLabel() + .toLowerCase() is the canonical path.
		expect(src).not.toMatch(/cabin\s*\|\|\s*["']economy["']\s*\)\s*\.replace/);
	});

	it("uses cabinLabel(cabin || \"economy\").toLowerCase() at travelersLabel + readout", () => {
		const matches = src.match(/cabinLabel\(cabin\s*\|\|\s*["']economy["']\)\.toLowerCase\(\)/g);
		expect(matches?.length).toBe(2);
	});
});
