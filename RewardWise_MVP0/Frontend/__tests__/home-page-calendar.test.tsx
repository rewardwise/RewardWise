/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMaxSearchDate } from "../utils/dateInput";

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
	authState: {
		searchCount: 0,
		setSearchCount: vi.fn(),
		session: null,
	},
	walletState: {
		userPrograms: [],
		hasWallet: false,
	},
	searchFillState: {
		searchFill: null as unknown,
		setSearchFill: vi.fn(),
		pendingSearch: null,
		setPendingSearch: vi.fn(),
	},
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("@/context/AuthProvider", () => ({
	useAuth: () => mocks.authState,
}));

vi.mock("@/context/WalletContext", () => ({
	useWallet: () => mocks.walletState,
}));

vi.mock("@/context/SearchFillContext", () => ({
	useSearchFill: () => mocks.searchFillState,
}));

vi.mock("@/context/ABTestContext", () => ({
	useABTest: () => ({}),
}));

vi.mock("@/components/TropicalBackground", () => ({
	default: () => null,
}));

vi.mock("@/components/VerdictCard", () => ({
	default: () => null,
}));

vi.mock("@/components/SearchLoadingExperience", () => ({
	default: () => null,
}));

vi.mock("@/components/zoe/ZoeChat", () => ({
	default: () => null,
}));

vi.mock("@/utils/analytics/client", () => ({
	trackAnalyticsEvent: vi.fn(),
}));

import HomePage from "../app/home/page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	mocks.searchFillState.searchFill = null;
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.clearAllMocks();
});

function render() {
	act(() => {
		root.render(<HomePage />);
	});
}

function getDateInputByLabelPrefix(prefix: string): HTMLInputElement {
	const labels = Array.from(container.querySelectorAll("label"));
	const match = labels.find((l) => l.textContent?.trim().startsWith(prefix));
	if (!match) throw new Error(`label starting with "${prefix}" not found`);
	const wrapper = match.parentElement;
	if (!wrapper) throw new Error(`no parent for label "${prefix}"`);
	const input = wrapper.querySelector(
		'input[type="date"]',
	) as HTMLInputElement | null;
	if (!input) throw new Error(`no date input under label "${prefix}"`);
	return input;
}

describe("home calendar pickers — horizon-aware max attribute", () => {
	// The slim-pill (PR 7) renames the depart label "DEPART" → "WHEN"; the
	// horizon-aware max attribute it asserts is unchanged.
	it("WHEN (depart) input's max attribute equals getMaxSearchDate()", () => {
		render();
		const departInput = getDateInputByLabelPrefix("WHEN");
		expect(departInput.getAttribute("max")).toBe(getMaxSearchDate());
	});

	it("RETURN input's max attribute equals getMaxSearchDate() (round-trip default)", () => {
		render();
		const returnInput = getDateInputByLabelPrefix("RETURN");
		expect(returnInput.getAttribute("max")).toBe(getMaxSearchDate());
	});

	it("WHEN (depart) and RETURN share the same max (one source of truth)", () => {
		render();
		const departMax = getDateInputByLabelPrefix("WHEN").getAttribute("max");
		const returnMax = getDateInputByLabelPrefix("RETURN").getAttribute("max");
		expect(departMax).toBe(returnMax);
	});

	it("max is no longer the year-2099 sentinel", () => {
		render();
		const departMax = getDateInputByLabelPrefix("WHEN").getAttribute("max");
		expect(departMax).not.toBe("2099-12-31");
	});
});

describe("slim search pill (PR 7) — 3 visible, 5 behind 'More options'", () => {
	const q = (t: string) => container.querySelector(`[data-testid="${t}"]`);

	it("renders the pill with From/To/When visible and More collapsed by default", () => {
		render();
		expect(q("search-pill")).not.toBeNull();
		// From + To airport inputs + the When date input are visible
		expect(container.querySelectorAll('input[placeholder="City or airport"]').length).toBe(2);
		expect(container.querySelector('input[type="date"]')).not.toBeNull();
		// secondary fields are collapsed
		expect(q("more-options")).toBeNull();
		expect(container.querySelector("select")).toBeNull(); // no travelers/stops/cabin selects yet
	});

	it("clicking 'More options' reveals the 5 secondary fields", () => {
		render();
		act(() => {
			(q("more-options-toggle") as HTMLButtonElement).dispatchEvent(
				new MouseEvent("click", { bubbles: true }),
			);
		});
		expect(q("more-options")).not.toBeNull();
		// travelers / stops / cabin selects now present
		expect(container.querySelectorAll("select").length).toBe(3);
	});

	it("hidden-field defaults are unchanged (economy / 1 traveler) — no silent change", () => {
		render();
		act(() => {
			(q("more-options-toggle") as HTMLButtonElement).dispatchEvent(
				new MouseEvent("click", { bubbles: true }),
			);
		});
		const selects = Array.from(container.querySelectorAll("select")) as HTMLSelectElement[];
		// order in More: travelers, stops, cabin
		expect(selects[0].value).toBe("1"); // travelers default
		expect(selects[2].value).toBe("economy"); // cabin default — matches today
	});
});
