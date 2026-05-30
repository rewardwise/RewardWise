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
	it("flex roundtrip sends symmetric ±7 window on BOTH legs", () => {
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
		// Outbound: 2099-06-15 ±7 = [2099-06-08, 2099-06-22]
		expect(params.get("date")).toBe("2099-06-08");
		expect(params.get("date_end")).toBe("2099-06-22");
		// Return: 2099-06-29 ±7 = [2099-06-22, 2099-07-06] (regression fix for 86ba4t25r)
		expect(params.get("return_date")).toBe("2099-06-22");
		expect(params.get("return_date_end")).toBe("2099-07-06");
	});

	it("flex roundtrip window span is identical on both legs (Anshu's repro)", () => {
		const params = buildSearchQueryParams({
			origin: "DEL",
			destination: "JFK",
			departDate: "2099-06-03",
			dateMode: "flexible",
			returnDate: "2099-07-11",
			tripType: "roundtrip",
			cabin: "economy",
			travelers: 1,
		});
		const dayMs = 86_400_000;
		const outboundSpan =
			(Date.parse(params.get("date_end")!) - Date.parse(params.get("date")!)) / dayMs;
		const returnSpan =
			(Date.parse(params.get("return_date_end")!) -
				Date.parse(params.get("return_date")!)) /
			dayMs;
		expect(outboundSpan).toBe(14);
		expect(returnSpan).toBe(14);
		expect(outboundSpan).toBe(returnSpan);
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

// Capture FlightSection props so the 86ba4t6f1 test can assert the segments
// passed in carry the winning_date (not whichever multi-date raw option was
// cheapest). Other tests in this file ignore the capture.
const flightSectionCapture: {
	outbound?: { segments?: Array<{ departs_at?: string }> } | null;
	inbound?: { segments?: Array<{ departs_at?: string }> } | null;
} = {};
vi.mock("@/components/verdict/FlightSection", () => ({
	__esModule: true,
	default: (props: {
		outbound?: { segments?: Array<{ departs_at?: string }> } | null;
		inbound?: { segments?: Array<{ departs_at?: string }> } | null;
	}) => {
		flightSectionCapture.outbound = props.outbound;
		flightSectionCapture.inbound = props.inbound;
		return <div data-testid="flight-section-stub" />;
	},
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
					userPrograms={["united"]}
				/>,
			);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("Outbound: searched");
		expect(text).toContain("Return: searched");
		expect(text).toMatch(/best is/);
		// 86ba4tc81: when winning dates differ from entered dates, the banner
		// renders in the PROMINENT variant (not the tiny inline pill) so the
		// user notices Zoe picked a different date.
		const prominent = container.querySelector(
			'[data-testid="best-date-callout-prominent"]',
		);
		const subtle = container.querySelector(
			'[data-testid="best-date-callout-subtle"]',
		);
		expect(prominent).not.toBeNull();
		expect(subtle).toBeNull();
		expect(prominent?.getAttribute("aria-live")).toBe("polite");
		expect(prominent?.getAttribute("role")).toBe("status");
		expect(prominent?.textContent ?? "").toContain("Better dates found");
	});

	it("renders SUBTLE variant when flex on but winning dates match entered dates", () => {
		act(() => {
			root.render(
				<VerdictCard
					verdict={baseVerdict}
					cashPrice={800}
					origin="JFK"
					destination="LAX"
					departDate="2099-06-15"
					departDateEnd="2099-06-18"
					winningDate="2099-06-15"
					returnDate="2099-06-22"
					returnDateEnd="2099-06-25"
					winningReturnDate="2099-06-22"
					travelers={1}
					isRoundtrip
					userPrograms={["united"]}
				/>,
			);
		});
		const prominent = container.querySelector(
			'[data-testid="best-date-callout-prominent"]',
		);
		const subtle = container.querySelector(
			'[data-testid="best-date-callout-subtle"]',
		);
		expect(prominent).toBeNull();
		expect(subtle).not.toBeNull();
		// Subtle variant must NOT carry the "Better dates found" heading —
		// nothing better was found.
		expect(subtle?.textContent ?? "").not.toContain("Better dates found");
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
					userPrograms={["united"]}
				/>,
			);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("Searched");
		expect(text).not.toContain("Outbound: searched");
		expect(text).not.toContain("Return: searched");
	});

	// -------------------------------------------------------------------
	// 86ba4t6f1 — Flight Details (the segments rendered by FlightSection
	// directly below the verdict banner) must thread the winning_date,
	// not whichever date happens to be cheapest in the raw award_options
	// list. Pre-fix: bestOutbound came from dedupeByProgram which collapses
	// multi-date entries to lowest-points. Flex round-trip with United
	// 28000 pts on 09-14 and United 32000 pts on 09-16 (winning_date)
	// would render trips on 09-14 while the banner above said
	// "Better dates found 2026-09-16".
	// -------------------------------------------------------------------
	it("threads winning_date into FlightSection segments, not the cheapest-other-date trip", () => {
		const cheapOtherDate = {
			program: "United",
			points: 28000,
			taxes: 5.6,
			cpp: 2.0,
			direct: true,
			remaining_seats: 4,
			date: "2026-09-14",
			airlines: "United",
			trips: [
				{
					segments: [
						{
							flight_number: "UA1",
							origin: "JFK",
							destination: "LAX",
							departs_at: "2026-09-14T08:00:00Z",
						},
					],
				},
			],
		};
		const winningDateOption = {
			program: "United",
			points: 32000,
			taxes: 5.6,
			cpp: 1.9,
			direct: true,
			remaining_seats: 4,
			date: "2026-09-16",
			airlines: "United",
			trips: [
				{
					segments: [
						{
							flight_number: "UA2",
							origin: "JFK",
							destination: "LAX",
							departs_at: "2026-09-16T08:00:00Z",
						},
					],
				},
			],
		};
		act(() => {
			root.render(
				<VerdictCard
					verdict={baseVerdict}
					cashPrice={800}
					origin="JFK"
					destination="LAX"
					departDate="2026-09-15"
					departDateEnd="2026-09-22"
					winningDate="2026-09-16"
					returnDate="2026-09-29"
					returnDateEnd="2026-10-06"
					winningReturnDate="2026-09-29"
					travelers={1}
					isRoundtrip
					userPrograms={["united"]}
					awardOptions={[cheapOtherDate, winningDateOption]}
				/>,
			);
		});
		expect(flightSectionCapture.outbound).toBeDefined();
		expect(flightSectionCapture.outbound?.segments?.[0]?.departs_at).toBe(
			"2026-09-16T08:00:00Z",
		);
		expect(flightSectionCapture.outbound?.segments?.[0]?.departs_at).not.toBe(
			"2026-09-14T08:00:00Z",
		);
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
					userPrograms={["united"]}
				/>,
			);
		});
		const text = container.textContent ?? "";
		expect(text).not.toContain("Searched");
		expect(text).not.toContain("Outbound:");
		expect(text).not.toContain("Return:");
	});
});
