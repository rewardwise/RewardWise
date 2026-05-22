/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSearchQueryParams } from "../lib/searchQuery";

// ---------------------------------------------------------------------------
// 3 tests: query-string construction for the new return_date_end param.
// ---------------------------------------------------------------------------

describe("buildSearchQueryParams — both-flexible round-trip", () => {
	it("flex roundtrip sends both date_end and return_date_end (±7)", () => {
		const params = buildSearchQueryParams({
			origin: "JFK",
			destination: "LAX",
			departDate: "2099-06-15",
			dateMode: "flexible",
			returnDate: "2099-06-29",
			tripType: "roundtrip",
			cabin: "economy",
			travelers: 1,
		});
		expect(params.get("date_end")).toBe("2099-06-22");
		expect(params.get("return_date")).toBe("2099-06-29");
		expect(params.get("return_date_end")).toBe("2099-07-06");
	});

	it("flex one-way sends only date_end (no return params at all)", () => {
		const params = buildSearchQueryParams({
			origin: "JFK",
			destination: "LAX",
			departDate: "2099-06-15",
			dateMode: "flexible",
			returnDate: "",
			tripType: "oneway",
			cabin: "economy",
			travelers: 1,
		});
		expect(params.get("date_end")).toBe("2099-06-22");
		expect(params.get("return_date")).toBeNull();
		expect(params.get("return_date_end")).toBeNull();
	});

	it("rigid roundtrip sends neither date_end nor return_date_end", () => {
		const params = buildSearchQueryParams({
			origin: "JFK",
			destination: "LAX",
			departDate: "2099-06-15",
			dateMode: "exact",
			returnDate: "2099-06-22",
			tripType: "roundtrip",
			cabin: "economy",
			travelers: 1,
		});
		expect(params.get("date_end")).toBeNull();
		expect(params.get("return_date")).toBe("2099-06-22");
		expect(params.get("return_date_end")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 3 tests: VerdictCard searchedRangeCopy rendering for both-leg sentence.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
	alertState: {
		watchlist: [] as unknown[],
		notifications: [] as unknown[],
		unreadCount: 0,
		loading: false,
		addToWatchlist: vi.fn(),
		removeFromWatchlist: vi.fn(async () => undefined),
		isWatching: vi.fn(() => false),
		markNotificationRead: vi.fn(),
		markAllRead: vi.fn(),
		clearNotification: vi.fn(),
	},
}));

vi.mock("@/context/AlertContext", () => ({
	useAlerts: () => mocks.alertState,
}));

vi.mock("@/components/verdict/VerdictTopRow", () => ({
	default: ({ recommendationHeadline }: { recommendationHeadline: string }) => (
		<div data-testid="verdict-top-row">{recommendationHeadline}</div>
	),
}));

vi.mock("@/components/verdict/FlightSection", () => ({
	__esModule: true,
	default: () => <div data-testid="flight-section-stub" />,
}));

vi.mock("@/components/verdict/AwardDetailsSection", () => ({
	__esModule: true,
	default: () => <div data-testid="award-details-stub" />,
}));

vi.mock("@/components/verdict/MultiHandoffGrid", () => ({
	__esModule: true,
	default: () => <div data-testid="multi-handoff-stub" />,
}));

vi.mock("@/components/verdict/ErrorStateCard", () => ({
	__esModule: true,
	default: () => <div data-testid="error-state-stub" />,
}));

import VerdictCard from "../components/VerdictCard";

const baseVerdict = {
	verdict: "Use points",
	recommendation: "use_points" as "use_points" | "pay_cash" | "wait",
	winner: {
		program: "United",
		points: 35000,
		taxes: 5.6,
		cpp: 1.8,
		direct: true,
	},
	pay_cash: false,
	confidence: "high" as const,
	confidence_reason: "reason",
	explanation: "explanation",
	booking_note: "Confirm taxes at booking.",
	booking_link: {
		seats_aero_link: null,
		airline_link: null,
		preferred: "none" as const,
	},
	metrics: {
		cash_price: 800,
		points_cost: 35000,
		taxes: 5.6,
		estimated_savings: 200,
	},
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe("VerdictCard — searchedRangeCopy for both-flexible round-trip", () => {
	it("renders BOTH 'Outbound' and 'Return' sentences when both legs flex", () => {
		act(() => {
			root.render(
				<VerdictCard
					verdict={baseVerdict}
					cashPrice={800}
					origin="JFK"
					destination="LAX"
					departDate="2099-06-15"
					departDateEnd="2099-06-18"
					winningDate="2099-06-16"
					returnDate="2099-06-22"
					returnDateEnd="2099-06-25"
					winningReturnDate="2099-06-23"
					travelers={1}
					isRoundtrip
				/>,
			);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("Outbound: searched");
		expect(text).toContain("Return: searched");
		expect(text).toMatch(/best is/);
	});

	it("renders ONLY the one-leg sentence when outbound flexes but return does not", () => {
		act(() => {
			root.render(
				<VerdictCard
					verdict={baseVerdict}
					cashPrice={800}
					origin="JFK"
					destination="LAX"
					departDate="2099-06-15"
					departDateEnd="2099-06-18"
					winningDate="2099-06-16"
					returnDate="2099-06-22"
					returnDateEnd={null}
					winningReturnDate={null}
					travelers={1}
					isRoundtrip
				/>,
			);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("Searched");
		expect(text).not.toContain("Outbound: searched");
		expect(text).not.toContain("Return: searched");
	});

	it("omits the sentence entirely when neither leg flexes", () => {
		act(() => {
			root.render(
				<VerdictCard
					verdict={baseVerdict}
					cashPrice={800}
					origin="JFK"
					destination="LAX"
					departDate="2099-06-15"
					departDateEnd={null}
					winningDate={null}
					returnDate="2099-06-22"
					returnDateEnd={null}
					winningReturnDate={null}
					travelers={1}
					isRoundtrip
				/>,
			);
		});
		const text = container.textContent ?? "";
		expect(text).not.toContain("Searched");
		expect(text).not.toContain("Outbound:");
		expect(text).not.toContain("Return:");
	});
});
