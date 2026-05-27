/** @format */

/**
 * Stops-filter URL contract (86ba2ze4g).
 *
 * The select is wired through buildSearchQueryParams. Backend default is
 * "any", so we omit max_stops on "any" — this keeps existing search URLs
 * and analytics byte-identical (regression guard). The other three enum
 * values pass through verbatim.
 */

import { describe, expect, it } from "vitest";

import { buildSearchQueryParams } from "../lib/searchQuery";

const baseInputs = {
	origin: "JFK",
	destination: "LAX",
	departDate: "2099-06-15",
	dateMode: "exact" as const,
	returnDate: "",
	tripType: "oneway",
	cabin: "economy",
	travelers: 1,
};

describe("buildSearchQueryParams — stops filter URL contract", () => {
	it("regression guard: 'any' produces a URL byte-identical to the no-maxStops baseline", () => {
		const baseline = buildSearchQueryParams(baseInputs).toString();
		const withAny = buildSearchQueryParams({
			...baseInputs,
			maxStops: "any",
		}).toString();
		expect(withAny).toBe(baseline);
		expect(withAny.includes("max_stops")).toBe(false);
	});

	it("'nonstop' appends max_stops=nonstop", () => {
		const params = buildSearchQueryParams({
			...baseInputs,
			maxStops: "nonstop",
		});
		expect(params.get("max_stops")).toBe("nonstop");
	});

	it("'one_or_fewer' appends max_stops=one_or_fewer", () => {
		const params = buildSearchQueryParams({
			...baseInputs,
			maxStops: "one_or_fewer",
		});
		expect(params.get("max_stops")).toBe("one_or_fewer");
	});

	it("'two_or_fewer' appends max_stops=two_or_fewer", () => {
		const params = buildSearchQueryParams({
			...baseInputs,
			maxStops: "two_or_fewer",
		});
		expect(params.get("max_stops")).toBe("two_or_fewer");
	});

	it("maxStops survives alongside round-trip + flexible-date params", () => {
		const params = buildSearchQueryParams({
			origin: "JFK",
			destination: "LAX",
			departDate: "2099-06-15",
			dateMode: "flexible",
			returnDate: "2099-06-29",
			tripType: "roundtrip",
			cabin: "economy",
			travelers: 2,
			maxStops: "one_or_fewer",
		});
		expect(params.get("max_stops")).toBe("one_or_fewer");
		expect(params.get("date_end")).toBe("2099-06-22");
		// Flex roundtrip shifts return_date back by 7 (symmetric ±7 contract, 86ba4t25r).
		expect(params.get("return_date")).toBe("2099-06-22");
		expect(params.get("return_date_end")).toBe("2099-07-06");
	});
});
