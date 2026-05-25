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
	it("DEPART input's max attribute equals getMaxSearchDate()", () => {
		render();
		const departInput = getDateInputByLabelPrefix("DEPART");
		expect(departInput.getAttribute("max")).toBe(getMaxSearchDate());
	});

	it("RETURN input's max attribute equals getMaxSearchDate() (round-trip default)", () => {
		render();
		const returnInput = getDateInputByLabelPrefix("RETURN");
		expect(returnInput.getAttribute("max")).toBe(getMaxSearchDate());
	});

	it("DEPART and RETURN share the same max (one source of truth)", () => {
		render();
		const departMax = getDateInputByLabelPrefix("DEPART").getAttribute("max");
		const returnMax = getDateInputByLabelPrefix("RETURN").getAttribute("max");
		expect(departMax).toBe(returnMax);
	});

	it("max is no longer the year-2099 sentinel", () => {
		render();
		const departMax = getDateInputByLabelPrefix("DEPART").getAttribute("max");
		expect(departMax).not.toBe("2099-12-31");
	});
});
