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
	it("b2 owned_sufficient → use_points lead, tells you to use points", () => {
		const n = zoeNarration(verdict("use_points"), ownership({}));
		expect(n.recommendation).toBe("use_points");
		expect(n.lead.toLowerCase()).toContain("use your points");
		expect(n.lead).toContain("you've got them");
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

	it("base pay_cash → cash lead, never use/book points", () => {
		const n = zoeNarration(verdict("pay_cash", { metrics: { cash_price: 200, cpp: 0.9, estimated_savings: 0 } }));
		expect(n.recommendation).toBe("pay_cash");
		expect(n.lead.toLowerCase()).toContain("pay cash");
		expect(n.lead.toLowerCase()).not.toContain("use your points");
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
