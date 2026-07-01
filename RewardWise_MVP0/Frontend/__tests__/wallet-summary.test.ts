/** @format */
/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { formatBalance, walletChips } from "../utils/walletSummary";

describe("formatBalance — magnitude-scaled, no double-k", () => {
	it("thousands render as k", () => {
		expect(formatBalance(300000)).toBe("300k");
		expect(formatBalance(80000)).toBe("80k");
		expect(formatBalance(1000)).toBe("1k");
	});
	it("millions render as M with one decimal (the 1902000k bug)", () => {
		expect(formatBalance(1902000)).toBe("1.9M");
		expect(formatBalance(2000000)).toBe("2M"); // trailing .0 stripped
		expect(formatBalance(150000000)).toBe("150M"); // >=100 rounds, no decimal
	});
	it("billions render as B (an inflated/large balance stays readable)", () => {
		expect(formatBalance(1902000000)).toBe("1.9B");
		expect(formatBalance(1901005000)).toBe("1.9B");
	});
	it("sub-thousand and empty are raw / zero", () => {
		expect(formatBalance(999)).toBe("999");
		expect(formatBalance(0)).toBe("0");
		expect(formatBalance(null)).toBe("0");
		expect(formatBalance(undefined)).toBe("0");
	});
});

describe("walletChips — top-1 program by balance, deduped", () => {
	const cards = [
		{ program_name: "Chase Ultimate Rewards", points_balance: 1902000 },
		{ program_name: "Delta SkyMiles", points_balance: 500000 },
		{ program_name: "Amex Membership Rewards", points_balance: 300000 },
	];
	it("returns only the single highest-balance program by default", () => {
		const chips = walletChips(cards);
		expect(chips).toHaveLength(1);
		expect(chips[0]).toEqual({ key: "Chase", label: "1.9M Chase" });
	});
	it("sums cards within the same program before ranking", () => {
		const chips = walletChips([
			{ program_name: "Amex Membership Rewards", points_balance: 80000 },
			{ program_name: "Amex Membership Rewards", points_balance: 50000 },
		]);
		expect(chips).toEqual([{ key: "Amex", label: "130k Amex" }]);
	});
});
