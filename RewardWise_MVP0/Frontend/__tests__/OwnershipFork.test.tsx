/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackMock, pushMock } = vi.hoisted(() => ({ trackMock: vi.fn(), pushMock: vi.fn() }));
vi.mock("../utils/analytics/client", () => ({ trackAnalyticsEvent: trackMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import OwnershipFork from "../components/verdict/OwnershipFork";
import type { Ownership } from "../types/verdict";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	trackMock.mockClear();
	pushMock.mockClear();
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function render(o: Ownership) {
	act(() => {
		root.render(<OwnershipFork ownership={o} searchId="s1" verdictId="v1" />);
	});
}
function q(t: string) {
	return container.querySelector(`[data-testid="${t}"]`);
}

const BASE: Ownership = {
	applicable: true,
	program: "singapore",
	program_label: "Singapore KrisFlyer",
	points_needed: 237000,
	owned_balance: 300000,
	shortfall: 0,
	can_afford: true,
	reachable_partners: [
		{ sourceCard: "Amex Membership Rewards", short: "Amex MR", ratio: "1:1", converted: 300000, native: false },
	],
	buyable: true,
	buy_rate_cpp: 3.0,
	redemption_cpp: 3.8,
	buy_gap_cost: null,
	buy_gap_worth_it: false,
	fork_recommendation: "use_points",
	fork_reason: "owned_sufficient",
	transfers_as_of: "2026-05-14",
};

describe("OwnershipFork — b2 owned_sufficient", () => {
	it("renders green confirm + a book-with-points CTA", () => {
		render(BASE);
		const fork = q("ownership-fork");
		expect(fork?.getAttribute("data-fork")).toBe("owned_sufficient");
		expect(fork?.textContent).toContain("You can book this");
		expect(fork?.textContent).toContain("Amex MR");
		expect(q("fork-cta")).not.toBeNull(); // book points
	});

	it("fires ownership_fork_shown with the fork payload", () => {
		render(BASE);
		expect(trackMock).toHaveBeenCalledWith(
			"ownership_fork_shown",
			expect.objectContaining({
				event_type: "ownership",
				metadata: expect.objectContaining({
					fork_reason: "owned_sufficient",
					program: "singapore",
					points_needed: 237000,
					owned_balance: 300000,
					shortfall: 0,
					can_afford: true,
					search_id: "s1",
					verdict_id: "v1",
				}),
			}),
		);
	});
});

describe("OwnershipFork — b3 short", () => {
	const short = (reason: Ownership["fork_reason"], extra: Partial<Ownership> = {}): Ownership => ({
		...BASE,
		owned_balance: 50000,
		shortfall: 187000,
		can_afford: false,
		fork_recommendation: "pay_cash",
		fork_reason: reason,
		...extra,
	});

	it("not_worth_it → amber 'short → pay cash', no buy/book CTA", () => {
		render(short("short_buy_not_worth_it", { buy_gap_cost: 7000 }));
		const fork = q("ownership-fork");
		expect(fork?.getAttribute("data-fork")).toBe("short_buy_not_worth_it");
		expect(fork?.textContent).toContain("short");
		expect(fork?.textContent?.toLowerCase()).toContain("pay cash");
		expect(fork?.textContent).toContain("more than you'd save");
		expect(q("fork-cta")).toBeNull(); // no buy/book CTA in a short state
	});

	it("worth_it → caveated buy note (NOT a CTA), still pay cash", () => {
		render(short("short_buy_worth_it", { buy_gap_cost: 300 }));
		const fork = q("ownership-fork");
		expect(fork?.getAttribute("data-fork")).toBe("short_buy_worth_it");
		expect(fork?.textContent).toContain("swing");
		expect(fork?.textContent?.toLowerCase()).toContain("pay cash");
		expect(q("fork-cta")).toBeNull(); // buying is never a CTA in PR 5
	});

	it("renders the reachable partners + a freshness disclaimer for the May-2026 data", () => {
		render(short("short_buy_not_worth_it", { buy_gap_cost: 7000 }));
		expect(q("ownership-fork")?.textContent).toContain("Amex MR");
		// 2026-05-14 is well past 30 days → a disclaimer renders (stale or warn).
		expect(q("freshness")).not.toBeNull();
	});
});

