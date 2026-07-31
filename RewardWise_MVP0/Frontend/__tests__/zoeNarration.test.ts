/** @format */
import { describe, expect, it } from "vitest";
import { zoeNarration, assertNarrationConsistent } from "../utils/zoeNarration";
import type { Verdict, Ownership } from "../types/verdict";

function verdict(recommendation: Verdict["recommendation"], over: Partial<Verdict> = {}): Verdict {
	return {
		verdict: "",
		recommendation,
		pay_cash: recommendation === "pay_cash",
		winner: { program: "singapore", points: 237000, taxes: 30, cpp: 3.2, direct: true },
		confidence: "high",
		booking_note: "",
		metrics: { cash_price: 740, points_cost: 237000, estimated_savings: 700, cpp: 3.2, travelers: 3 },
		...over,
	};
}

function ownership(over: Partial<Ownership>): Ownership {
	return {
		applicable: true,
		program: "singapore",
		program_label: "Singapore KrisFlyer",
		points_needed: 237000,
		owned_balance: 300000,
		shortfall: 0,
		can_afford: true,
		reachable_partners: [],
		buyable: true,
		buy_rate_cpp: 3,
		redemption_cpp: 3.2,
		buy_gap_cost: null,
		buy_gap_worth_it: false,
		fork_recommendation: "use_points",
		fork_reason: "owned_sufficient",
		transfers_as_of: "2026-05-14",
		...over,
	};
}

describe("zoeNarration — consistency (Zoe never contradicts the verdict)", () => {
	it("b2 owned_sufficient → points-win lead that COMPLEMENTS the card: value word + balance-after, no cash echo", () => {
		const n = zoeNarration(verdict("use_points"), ownership({}));
		expect(n.recommendation).toBe("use_points");
		expect(n.lead.toLowerCase()).toContain("points win this one");
		// cpp 3.2 >= 1.8 → the "strong" claim is supported by the card's cpp
		expect(n.lead.toLowerCase()).toContain("strong redemption");
		// balance-after-booking: 300,000 − 237,000
		expect(n.lead).toContain("63,000");
		expect(n.lead.toLowerCase()).toContain("after booking");
		// Never echo the card's cash figure
		expect(n.lead).not.toContain("$740");
		expect(n.lead.toLowerCase()).not.toContain("cash would run");
	});

	it("b3 short → pay_cash lead, NEVER says use/book points", () => {
		const n = zoeNarration(
			verdict("use_points"), // engine said points, but fork flips to cash
			ownership({ can_afford: false, owned_balance: 50000, shortfall: 187000, fork_recommendation: "pay_cash", fork_reason: "short_buy_not_worth_it" }),
		);
		expect(n.recommendation).toBe("pay_cash"); // narrates the FORK call
		expect(n.lead.toLowerCase()).toContain("short");
		expect(n.lead.toLowerCase()).toContain("pay the");
		expect(n.lead.toLowerCase()).not.toContain("use your points");
		expect(n.lead.toLowerCase()).not.toMatch(/book .* points/);
	});

	it("base pay_cash → cash-wins lead with the WHY, never use/book points", () => {
		const n = zoeNarration(verdict("pay_cash", { metrics: { cash_price: 200, cpp: 0.9, estimated_savings: 0 } }));
		expect(n.recommendation).toBe("pay_cash");
		expect(n.lead.toLowerCase()).toContain("cash wins");
		// cpp 0.9 < 1.5 → the below-the-bar reason is the supported claim
		expect(n.lead.toLowerCase()).toContain("below the bar");
		expect(n.lead.toLowerCase()).not.toContain("use your points");
	});

	it("cheap-cash pay_cash with a DECENT cpp never claims 'below the bar' (unsupported)", () => {
		const n = zoeNarration(verdict("pay_cash", { metrics: { cash_price: 180, cpp: 2.0, estimated_savings: 0 } }));
		expect(n.recommendation).toBe("pay_cash");
		expect(n.lead.toLowerCase()).not.toContain("below the bar");
		expect(n.lead.toLowerCase()).toContain("low enough");
		expect(n.lead.toLowerCase()).not.toContain("use your points");
	});

	it("value claims track the engine's cpp bars: strong >=1.8, solid 1.5-1.8, NO claim below 1.5", () => {
		const strong = zoeNarration(verdict("use_points", { metrics: { cash_price: 740, cpp: 2.6, estimated_savings: 500 } }), ownership({ redemption_cpp: 2.6 }));
		expect(strong.lead.toLowerCase()).toContain("strong redemption");
		const solid = zoeNarration(verdict("use_points", { metrics: { cash_price: 740, cpp: 1.6, estimated_savings: 300 } }), ownership({ redemption_cpp: 1.6 }));
		expect(solid.lead.toLowerCase()).toContain("solid redemption");
		expect(solid.lead.toLowerCase()).not.toContain("strong redemption");
		const weak = zoeNarration(verdict("use_points", { metrics: { cash_price: 740, cpp: 1.3, estimated_savings: 100 } }), ownership({ redemption_cpp: 1.3 }));
		expect(weak.lead.toLowerCase()).not.toContain("redemption");
		expect(weak.lead.toLowerCase()).not.toContain("strong");
	});

	it("matches the OwnershipFork DISPLAYED call: only owned_sufficient → use points; every short → pay cash (incl. worth_it)", () => {
		for (const fr of ["owned_sufficient", "short_buy_worth_it", "short_buy_not_worth_it", "short_cant_buy"] as const) {
			const canAfford = fr === "owned_sufficient";
			// backend fork_recommendation for worth_it is use_points, but the fork UI shows pay-cash
			const backendRec = fr === "owned_sufficient" || fr === "short_buy_worth_it" ? "use_points" : "pay_cash";
			const displayed = canAfford ? "use_points" : "pay_cash";
			const n = zoeNarration(verdict("use_points"), ownership({ can_afford: canAfford, fork_recommendation: backendRec, fork_reason: fr, shortfall: canAfford ? 0 : 100000, owned_balance: canAfford ? 300000 : 137000 }));
			expect(n.recommendation).toBe(displayed); // Zoe matches the panel, not the raw backend field
			if (displayed === "pay_cash") {
				expect(n.lead.toLowerCase()).not.toContain("use your points");
			}
		}
	});

	it('chips adapt: "Why cash?" on pay_cash, "Why points?" on use_points', () => {
		expect(zoeNarration(verdict("pay_cash")).chips[0].label).toBe("Why cash?");
		expect(zoeNarration(verdict("use_points"), ownership({})).chips[0].label).toBe("Why points?");
	});

	it('"Use my points anyway?" on a short b3 says you can\'t (no false capability)', () => {
		const n = zoeNarration(verdict("use_points"), ownership({ can_afford: false, shortfall: 187000, fork_recommendation: "pay_cash", fork_reason: "short_buy_not_worth_it" }));
		const chip = n.chips.find((c) => c.id === "points_anyway")!;
		expect(chip.reply.toLowerCase()).toContain("short");
		expect(chip.reply.toLowerCase()).toContain("can't");
	});

	it("assertNarrationConsistent throws on a hand-crafted drift", () => {
		expect(() =>
			assertNarrationConsistent({ recommendation: "pay_cash", forkReason: null, lead: "Use your points on this one!", chips: [] }),
		).toThrow(/drift/);
	});
});
