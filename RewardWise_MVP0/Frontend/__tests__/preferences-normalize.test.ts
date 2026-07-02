/** @format */
/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { normalizeSearchDefaults, HARDCODED_SEARCH_DEFAULTS } from "../hooks/usePreferences";

describe("normalizeSearchDefaults — defensive coercion (never throws)", () => {
	it("falls back to hardcoded defaults on null/undefined/garbage", () => {
		expect(normalizeSearchDefaults(null)).toEqual(HARDCODED_SEARCH_DEFAULTS);
		expect(normalizeSearchDefaults(undefined)).toEqual(HARDCODED_SEARCH_DEFAULTS);
		expect(normalizeSearchDefaults("nonsense")).toEqual(HARDCODED_SEARCH_DEFAULTS);
		expect(normalizeSearchDefaults(42)).toEqual(HARDCODED_SEARCH_DEFAULTS);
	});

	it("passes through valid values", () => {
		expect(normalizeSearchDefaults({ cabin: "business", travelers: 3, trip_type: "oneway" })).toEqual({
			cabin: "business",
			travelers: 3,
			trip_type: "oneway",
		});
	});

	it("replaces invalid cabin / trip_type with defaults", () => {
		const r = normalizeSearchDefaults({ cabin: "first_class", travelers: 2, trip_type: "wander" });
		expect(r.cabin).toBe("economy");
		expect(r.trip_type).toBe("roundtrip");
		expect(r.travelers).toBe(2);
	});

	it("clamps travelers to the backend's 1-9 bound", () => {
		expect(normalizeSearchDefaults({ travelers: 0 }).travelers).toBe(1);
		expect(normalizeSearchDefaults({ travelers: -5 }).travelers).toBe(1);
		expect(normalizeSearchDefaults({ travelers: 99 }).travelers).toBe(9);
		expect(normalizeSearchDefaults({ travelers: 9 }).travelers).toBe(9);
	});

	it("coerces string / float travelers to a valid int", () => {
		expect(normalizeSearchDefaults({ travelers: "3" }).travelers).toBe(3);
		expect(normalizeSearchDefaults({ travelers: 2.9 }).travelers).toBe(2);
		expect(normalizeSearchDefaults({ travelers: "abc" }).travelers).toBe(HARDCODED_SEARCH_DEFAULTS.travelers);
	});
});
