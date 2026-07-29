/** @format */
import { describe, expect, it } from "vitest";
import { buildZoeVerdictContext } from "../utils/zoeVerdictContext";

const base = {
	origin: "SFO",
	destination: "SEA",
	date: "2026-08-15",
	return_date: "2026-08-18",
	is_roundtrip: true,
	travelers: 1,
	cabin: "economy",
	cash_price: 217,
	award_options: [
		{ program: "alaska", points: 5000, taxes: 5.6 },
		{ program: "qantas", points: 16100, taxes: 5.6 },
	],
	verdict: {
		recommendation: "pay_cash" as const,
		pay_cash: true,
		confidence: "high",
		winner: { program: "qantas" },
		metrics: { cash_price: 217, points_cost: 32200, taxes: 11.2, cpp: 0.64, estimated_savings: 206 },
	},
};

describe("buildZoeVerdictContext — basis-consistent, no fabrication fuel", () => {
	it("uses matched-scope TOTALS for the headline figures", () => {
		const s = buildZoeVerdictContext(base);
		expect(s).toContain("TOTAL cash fare for the whole trip: $217");
		expect(s).toContain("Best award TOTAL for the whole trip: 32,200 points");
		expect(s).toContain("via qantas");
	});

	it("labels per-program options as outbound-leg-only", () => {
		const s = buildZoeVerdictContext(base);
		expect(s).toContain("OUTBOUND LEG ONLY");
		expect(s).toContain("alaska: 5,000 points");
	});

	it("never includes a savings framing on pay_cash", () => {
		const s = buildZoeVerdictContext(base);
		expect(s.toLowerCase()).not.toContain("save");
		expect(s.toLowerCase()).not.toContain("saving");
	});

	it("includes the honest cash-avoided line only on use_points", () => {
		const s = buildZoeVerdictContext({
			...base,
			verdict: { ...base.verdict, recommendation: "use_points", pay_cash: false },
		});
		expect(s).toContain("avoid about $206");
	});
});

// ── Partial-data stance (2026-07-29): no cash baseline -> the context must
// forbid a points recommendation outright, so a context-consuming agent can
// never nudge toward points in the cash-unavailable state.

describe("cash-unavailable stance", () => {
	it("no cash price -> explicit do-not-recommend-points line", () => {
		const ctx = buildZoeVerdictContext({
			origin: "SEA",
			destination: "NRT,HND",
			date: "2027-03-15",
			return_date: "2027-03-31",
			is_roundtrip: true,
			travelers: 1,
			cabin: "economy",
			cash_price: null,
			verdict: { recommendation: "wait", metrics: { cash_price: null, points_cost: 135000 } },
		});
		expect(ctx).toContain("Live cash price UNAVAILABLE");
		expect(ctx).toContain("Do NOT recommend booking points");
		expect(ctx).toContain("never invent or estimate a cash price");
	});

	it("cash present -> stance line absent", () => {
		const ctx = buildZoeVerdictContext({
			origin: "SEA",
			destination: "NRT,HND",
			date: "2027-03-15",
			is_roundtrip: false,
			verdict: { recommendation: "pay_cash", metrics: { cash_price: 2010 } },
		});
		expect(ctx).toContain("Live TOTAL cash fare for the whole trip: $2,010.");
		expect(ctx).not.toContain("Do NOT recommend booking points");
	});
});
