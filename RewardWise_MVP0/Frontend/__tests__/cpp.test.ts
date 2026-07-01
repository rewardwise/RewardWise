/** @format */
/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { computeCpp, formatCpp } from "../utils/cpp";

describe("computeCpp — compute from cash+points, else null (never '-')", () => {
	it("computes cents-per-point when both are positive", () => {
		// $352 cash / 25,000 points = 1.408 cpp
		expect(computeCpp(352, 25000)).toBeCloseTo(1.408, 3);
	});

	it("returns null when points is missing/zero (not computable → hide)", () => {
		expect(computeCpp(352, null)).toBeNull();
		expect(computeCpp(352, 0)).toBeNull();
		expect(computeCpp(352, undefined)).toBeNull();
	});

	it("returns null when cash is missing/zero", () => {
		expect(computeCpp(null, 25000)).toBeNull();
		expect(computeCpp(0, 25000)).toBeNull();
	});

	it("returns null for non-finite inputs", () => {
		expect(computeCpp(NaN, 25000)).toBeNull();
		expect(computeCpp(352, Infinity)).toBeNull();
	});

	it("never yields a '-' — callers hide the field on null", () => {
		const cpp = computeCpp(undefined, undefined);
		expect(cpp).toBeNull();
		// formatCpp is only called with a real number
		expect(formatCpp(1.408)).toBe("1.41¢/pt");
	});
});
