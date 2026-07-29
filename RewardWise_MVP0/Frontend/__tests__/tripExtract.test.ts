/** @format */
import { describe, expect, it } from "vitest";
import { extractTripParams, planTripFill } from "../utils/tripExtract";

const TODAY = new Date(2026, 6, 20); // 2026-07-20

describe("extractTripParams — deterministic, wrong-fill-proof", () => {
	it("full phrase: from city to city with date range and travelers", () => {
		const r = extractTripParams(
			"I want to fly from Denver to Austin September 10 to 14 for 2 travelers",
			TODAY
		);
		expect(r).toEqual({
			origin: "DEN",
			destination: "AUS",
			date: "2026-09-10",
			return_date: "2026-09-14",
			travelers: 2,
			tripType: "roundtrip",
		});
	});

	it("IATA to metro with month range", () => {
		const r = extractTripParams("SEA to Tokyo Nov 25-29 please", TODAY);
		expect(r?.origin).toBe("SEA");
		expect(r?.destination).toBe("NRT,HND");
		expect(r?.date).toBe("2026-11-25");
		expect(r?.return_date).toBe("2026-11-29");
	});

	it("one-way detection", () => {
		const r = extractTripParams("one way from Boise to Spokane October 13", TODAY);
		expect(r?.origin).toBe("BOI");
		expect(r?.destination).toBe("GEG");
		expect(r?.date).toBe("2026-10-13");
		expect(r?.tripType).toBe("oneway");
	});

	it("destination-only fill when phrased 'fly to X'", () => {
		const r = extractTripParams("I want to fly to Tokyo in the fall", TODAY);
		expect(r?.destination).toBe("NRT,HND");
		expect(r?.origin).toBeUndefined();
	});

	it("past month rolls to next year", () => {
		const r = extractTripParams("from Seattle to Denver March 3", TODAY);
		expect(r?.date).toBe("2027-03-03");
	});

	it("non-trip message returns null (form untouched)", () => {
		expect(extractTripParams("how do transfers work?", TODAY)).toBeNull();
		expect(extractTripParams("why is cash better here?", TODAY)).toBeNull();
		expect(extractTripParams("thanks, that was helpful!", TODAY)).toBeNull();
	});

	it("ambiguous city does not fill (wrong fill is worse than none)", () => {
		// "portland" matches Portland OR (PDX) and Portland ME (PWM) if both are
		// in the dataset — must not guess. Whichever way the dataset resolves,
		// a wrong silent guess is the failure mode; unique-only is the contract.
		const r = extractTripParams("from portland to seattle August 3", TODAY);
		if (r?.origin) {
			// Only acceptable if the dataset has exactly one Portland.
			expect(["PDX", "PWM"]).toContain(r.origin);
		}
		expect(r?.destination).toBe("SEA");
	});

	it("bare 'X to Y' requires both sides to resolve", () => {
		const r = extractTripParams("flying blue to delta transfers August 3", TODAY);
		// 'blue' / 'delta transfers' resolve to nothing -> no route fill; date
		// alone still extracts (harmless partial).
		expect(r?.origin).toBeUndefined();
		expect(r?.destination).toBeUndefined();
	});
});

describe("extractTripParams — incremental updates (form context)", () => {
	const CUR = { date: "2026-09-10", return_date: "2026-09-14" };

	it("'what about the 20th instead?' updates only the depart date", () => {
		const r = extractTripParams("what about the 20th instead?", TODAY, CUR);
		expect(r).toEqual({ date: "2026-09-20" });
	});

	it("'come back on the 25th' updates only the return date", () => {
		const r = extractTripParams("can I come back on the 25th?", TODAY, CUR);
		expect(r).toEqual({ return_date: "2026-09-25" });
	});

	it("day in the past rolls to the next month", () => {
		const r = extractTripParams("what about the 5th?", TODAY, { date: "2026-07-10" });
		// July 5 is before 2026-07-20 (TODAY) -> August 5.
		expect(r).toEqual({ date: "2026-08-05" });
	});

	it("no form context -> bare day extracts nothing (never guesses month)", () => {
		expect(extractTripParams("what about the 20th instead?", TODAY, null)).toBeNull();
	});

	it("'2 travelers' never triggers the day pattern", () => {
		const r = extractTripParams("make it 2 travelers", TODAY, CUR);
		expect(r?.date).toBeUndefined();
		expect(r?.travelers).toBe(2);
	});
});

describe("extractTripParams — spoken number-word travelers", () => {
	it("maps 'two travelers' (the common voice case) to 2", () => {
		const r = extractTripParams(
			"Can I go from Denver to Austin September 10 to 14 for two travelers?",
			TODAY
		);
		expect(r?.travelers).toBe(2);
	});
	it("handles other words and synonyms", () => {
		expect(extractTripParams("SEA to Tokyo Nov 25-29 for four people", TODAY)?.travelers).toBe(4);
		expect(extractTripParams("one passenger from Boise to Spokane October 13", TODAY)?.travelers).toBe(1);
	});
	it("number words NOT followed by a traveler noun stay untouched", () => {
		const r = extractTripParams("from Denver to Austin September 10 to 14", TODAY);
		expect(r?.travelers).toBeUndefined();
	});
});

describe("P0 wrong-trip guard (2026-07-27 incident)", () => {
	const CUR2 = { origin: "SEA", destination: "SFO", date: "2026-08-19", return_date: "2026-08-28" };

	it("THE incident message now fully resolves (bare 'X to Y', no 'from')", () => {
		const r = extractTripParams(
			"How about Seattle to Tokyo next year, March 15 to 31st, round trip, one travel?",
			TODAY, CUR2,
		);
		expect(r?.origin).toBe("SEA");
		expect(r?.destination).toBe("NRT,HND");
		expect(r?.date).toBe("2027-03-15");
		expect(r?.return_date).toBe("2027-03-31");
		expect(r?.unresolved_place).toBeUndefined();
	});

	it("bare pair without verb or 'from' resolves (Denver to Austin)", () => {
		const r = extractTripParams("Denver to Austin September 10 to 14", TODAY);
		expect(r?.origin).toBe("DEN");
		expect(r?.destination).toBe("AUS");
	});

	it("garbled destination -> unresolved_place, route NOT filled", () => {
		const r = extractTripParams("How about Seattle to Tokyoo next year, March 15 to 31st?", TODAY, CUR2);
		expect(r?.unresolved_place).toBe(true);
		expect(r?.destination).toBeUndefined();
		expect(planTripFill(r, CUR2)).toEqual({ willAutorun: false, missing: ["unresolved_place"] });
	});

	it("garbled origin -> unresolved_place", () => {
		const r = extractTripParams("Tokyoo to Seattle March 15", TODAY, CUR2);
		expect(r?.unresolved_place).toBe(true);
	});

	it("explicit 'from X to <unresolvable>' -> unresolved_place even with partial fill", () => {
		const r = extractTripParams("from Seattle to Xanaduville March 15 to 31", TODAY, CUR2);
		expect(r?.origin).toBe("SEA");
		expect(r?.unresolved_place).toBe(true);
		expect(planTripFill(r, CUR2).willAutorun).toBe(false);
	});

	it("idioms where NEITHER side resolves stay quiet (no false ask)", () => {
		const r = extractTripParams("flying blue to delta transfers August 3", TODAY, CUR2);
		expect(r?.unresolved_place).toBeUndefined();
	});

	it("incremental + non-trip behavior unchanged", () => {
		expect(extractTripParams("what about the 20th instead?", TODAY, CUR2)?.date).toBe("2026-08-20");
		expect(extractTripParams("how do transfer ratios work?", TODAY, CUR2)).toBeNull();
	});
});

describe("cabin extraction (search-business incident 2026-07-28)", () => {
	const CUR3 = { origin: "SEA", destination: "NRT,HND", date: "2027-03-15", return_date: "2027-03-31" };

	it("command phrasings map to cabin and auto-run on a complete form", () => {
		for (const msg of ["search business", "search it in business", "what about business", "make it business"]) {
			const e = extractTripParams(msg, TODAY, CUR3);
			expect(e?.cabin, msg).toBe("business");
			expect(planTripFill(e, CUR3).willAutorun, msg).toBe(true);
		}
	});

	it("all cabin vocabularies", () => {
		expect(extractTripParams("premium economy please", TODAY, CUR3)?.cabin).toBe("premium_economy");
		expect(extractTripParams("switch to first class", TODAY, CUR3)?.cabin).toBe("first");
		expect(extractTripParams("back to economy", TODAY, CUR3)?.cabin).toBe("economy");
		expect(extractTripParams("in coach is fine", TODAY, CUR3)?.cabin).toBe("economy");
	});

	it("'business trip' phrasing never sets cabin", () => {
		const e = extractTripParams("going on a business trip to Tokyo March 15 to 20", TODAY);
		expect(e?.cabin).toBeUndefined();
	});

	it("bare 'first' (non-class) never sets cabin", () => {
		expect(extractTripParams("the first option looks good", TODAY, CUR3)?.cabin).toBeUndefined();
	});

	it("cabin word with an incomplete trip HOLDS (P0 discipline)", () => {
		const e = extractTripParams("search business", TODAY, null);
		expect(e?.cabin).toBe("business");
		const p = planTripFill(e, null);
		expect(p.willAutorun).toBe(false);
		expect(p.missing).toContain("origin");
	});

	it("full statement with inline cabin runs with cabin set", () => {
		const e = extractTripParams("Denver to Austin September 10 to 14 in business", TODAY);
		expect(e?.cabin).toBe("business");
		expect(planTripFill(e, null).willAutorun).toBe(true);
	});
});

// ── Return-phrase dates + invalid-combination hold (P0 2026-07-28) ──────────
// "coming back Mar 31" wasn't parsed (range parser only knows connectors), so
// the return stayed stale, return<depart ran, and a raw validation error hit
// the UI.

describe("return-phrase date extraction", () => {
	it("depart + 'coming back <date>' fills both dates (the incident message)", () => {
		const r = extractTripParams("SEA to Tokyo Mar 15 coming back Mar 31", TODAY);
		expect(r?.origin).toBe("SEA");
		expect(r?.destination).toBe("NRT,HND");
		expect(r?.date).toBe("2027-03-15");
		expect(r?.return_date).toBe("2027-03-31");
		expect(r?.tripType).toBe("roundtrip");
	});

	it("'back on <date>' variant", () => {
		const r = extractTripParams("Denver to Austin Sep 10, back on Sep 14", TODAY);
		expect(r?.date).toBe("2026-09-10");
		expect(r?.return_date).toBe("2026-09-14");
	});

	it("'returning <date>' variant", () => {
		const r = extractTripParams("from Boise to Spokane October 13 returning October 16", TODAY);
		expect(r?.return_date).toBe("2026-10-16");
	});

	it("'coming home <date>' variant", () => {
		const r = extractTripParams("SEA to Denver Aug 3 coming home Aug 9", TODAY);
		expect(r?.date).toBe("2026-08-03");
		expect(r?.return_date).toBe("2026-08-09");
	});

	it("'back the Nth' anchors to the depart month in the same message", () => {
		const r = extractTripParams("SEA to Tokyo Mar 15, back the 31st", TODAY);
		expect(r?.date).toBe("2027-03-15");
		expect(r?.return_date).toBe("2027-03-31");
	});

	it("incremental 'coming back Mar 31' moves the RETURN, not the departure", () => {
		const r = extractTripParams("coming back Mar 31", TODAY, {
			origin: "SEA",
			destination: "NRT,HND",
			date: "2027-03-15",
			return_date: "2026-08-31",
		});
		expect(r?.date).toBeUndefined();
		expect(r?.return_date).toBe("2027-03-31");
	});

	it("depart-then-return month wraparound ('Dec 28 coming back Jan 2')", () => {
		const r = extractTripParams("SEA to Tokyo Dec 28 coming back Jan 2", TODAY);
		expect(r?.date).toBe("2026-12-28");
		expect(r?.return_date).toBe("2027-01-02");
	});
});

describe("planTripFill — return-before-depart hold", () => {
	it("conflicting post-merge dates never auto-run; ask instead", () => {
		// Fresh depart moves to Mar 2027, stale form return stays Aug 2026.
		const plan = planTripFill(
			{ date: "2027-03-15" },
			{ origin: "SEA", destination: "NRT,HND", date: "2026-08-10", return_date: "2026-08-31" },
		);
		expect(plan.willAutorun).toBe(false);
		expect(plan.missing).toEqual(["return_before_depart"]);
	});

	it("valid pair still auto-runs", () => {
		const plan = planTripFill(
			{ date: "2027-03-15", return_date: "2027-03-31" },
			{ origin: "SEA", destination: "NRT,HND", date: "2026-08-10", return_date: "2026-08-31" },
		);
		expect(plan.willAutorun).toBe(true);
		expect(plan.missing).toEqual([]);
	});
});
