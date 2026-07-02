/** @format */
/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { zoeWelcome, zoeWelcomeGuest, assertWelcomeConsistent, type ZoeWelcome } from "../utils/zoeNarration";

describe("zoeWelcome — deterministic empty-state welcome (no LLM)", () => {
	it("returns a stable lead + suggestion chips", () => {
		const a = zoeWelcome();
		const b = zoeWelcome();
		expect(a).toEqual(b); // pure template, deterministic
		expect(a.lead).toMatch(/i'm zoe/i);
		expect(a.chips).toHaveLength(2);
		expect(a.chips.map((c) => c.id).sort()).toEqual(["welcome_ask", "welcome_how"]);
		a.chips.forEach((c) => {
			expect(c.label.length).toBeGreaterThan(0);
			expect(c.reply.length).toBeGreaterThan(0);
		});
	});

	it("lead names what Zoe does and points to the next action, without asserting a verdict", () => {
		const { lead } = zoeWelcome();
		expect(lead.toLowerCase()).toContain("search"); // suggests the next action
		// It must NOT claim a concrete verdict.
		expect(lead).not.toMatch(/\buse your points\b/i);
		expect(lead).not.toMatch(/\bpay cash\b/i);
		expect(lead).not.toMatch(/\$\d/);
	});

	it("guardrail throws if the welcome lead drifts into a verdict claim", () => {
		const drifted: ZoeWelcome = { lead: "Use your points — $352 beats cash.", chips: [] };
		expect(() => assertWelcomeConsistent(drifted)).toThrow(/welcome drift/i);
		// The real welcome never trips it.
		expect(() => assertWelcomeConsistent(zoeWelcome())).not.toThrow();
	});
});

describe("zoeWelcomeGuest — 8c guest FAB welcome", () => {
	it("references guest sign-in, asserts no verdict, and passes the guardrail", () => {
		const w = zoeWelcomeGuest();
		expect(w).toEqual(zoeWelcomeGuest()); // deterministic
		expect(w.lead.toLowerCase()).toContain("i'm zoe");
		expect(w.lead.toLowerCase()).toContain("sign in"); // references guest state
		// No verdict claim, no wallet-feature promise, no em-dash (product-copy rule).
		expect(w.lead).not.toMatch(/\buse your points\b/i);
		expect(w.lead).not.toMatch(/\bpay cash\b/i);
		expect(w.lead).not.toMatch(/\$\d/);
		expect(w.lead).not.toContain("—");
		expect(() => assertWelcomeConsistent(w)).not.toThrow();
	});
	it("has two suggestion chips, no em-dashes in copy", () => {
		const w = zoeWelcomeGuest();
		expect(w.chips).toHaveLength(2);
		w.chips.forEach((c) => {
			expect(c.label.length).toBeGreaterThan(0);
			expect(c.reply).not.toContain("—");
		});
	});
});
