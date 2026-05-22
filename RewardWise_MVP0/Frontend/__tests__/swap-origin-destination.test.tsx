/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function getAirportInput(label: "FROM" | "TO"): HTMLInputElement {
	const labels = Array.from(container.querySelectorAll("label"));
	const match = labels.find((l) => l.textContent?.trim().startsWith(label));
	if (!match) throw new Error(`label ${label} not found`);
	const wrapper = match.parentElement;
	if (!wrapper) throw new Error(`no parent for ${label}`);
	const input = wrapper.querySelector("input") as HTMLInputElement | null;
	if (!input) throw new Error(`no input under ${label}`);
	return input;
}

function clickSwap() {
	const button = container.querySelector(
		'button[aria-label="Swap origin and destination"]',
	) as HTMLButtonElement | null;
	if (!button) throw new Error("swap button not found");
	act(() => {
		button.click();
	});
}

function seedFill(origin: string, destination: string) {
	mocks.searchFillState.searchFill = { origin, destination };
}

describe("Swap origin/destination button", () => {
	it("renders the swap button with the correct aria-label and type", () => {
		render();
		const button = container.querySelector(
			'button[aria-label="Swap origin and destination"]',
		) as HTMLButtonElement | null;
		expect(button).not.toBeNull();
		expect(button?.getAttribute("type")).toBe("button");
	});

	it("swaps LAX -> JFK and JFK -> LAX on click", () => {
		seedFill("LAX", "JFK");
		render();
		expect(getAirportInput("FROM").value).toBe("LAX");
		expect(getAirportInput("TO").value).toBe("JFK");
		clickSwap();
		expect(getAirportInput("FROM").value).toBe("JFK");
		expect(getAirportInput("TO").value).toBe("LAX");
	});

	it("leaves both empty when both are empty (no crash)", () => {
		render();
		expect(getAirportInput("FROM").value).toBe("");
		expect(getAirportInput("TO").value).toBe("");
		clickSwap();
		expect(getAirportInput("FROM").value).toBe("");
		expect(getAirportInput("TO").value).toBe("");
	});

	it("moves FROM value into TO when only FROM is filled", () => {
		seedFill("LAX", "");
		render();
		expect(getAirportInput("FROM").value).toBe("LAX");
		expect(getAirportInput("TO").value).toBe("");
		clickSwap();
		expect(getAirportInput("FROM").value).toBe("");
		expect(getAirportInput("TO").value).toBe("LAX");
	});

	it("moves TO value into FROM when only TO is filled", () => {
		seedFill("", "JFK");
		render();
		expect(getAirportInput("FROM").value).toBe("");
		expect(getAirportInput("TO").value).toBe("JFK");
		clickSwap();
		expect(getAirportInput("FROM").value).toBe("JFK");
		expect(getAirportInput("TO").value).toBe("");
	});

	it("is idempotent over two clicks (A,B -> B,A -> A,B)", () => {
		seedFill("LAX", "JFK");
		render();
		clickSwap();
		clickSwap();
		expect(getAirportInput("FROM").value).toBe("LAX");
		expect(getAirportInput("TO").value).toBe("JFK");
	});
});
