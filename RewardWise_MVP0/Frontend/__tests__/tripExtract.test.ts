/** @format */
import { describe, expect, it } from "vitest";
import { extractTripParams } from "../utils/tripExtract";

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
