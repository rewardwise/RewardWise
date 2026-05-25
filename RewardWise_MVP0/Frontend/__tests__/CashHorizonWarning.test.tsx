/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CashHorizonWarning from "../components/CashHorizonWarning";

// Pin "today" so isPastCashHorizon (which calls new Date() internally
// when the component invokes it) sees the same UTC midnight reference
// used by the PR series tests. Cash horizon = today + 329d = 2027-04-19.
const FIXED_TODAY = new Date("2026-05-25T00:00:00.000Z");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	// Only fake `Date` (not setTimeout / setInterval) so React 19's
	// scheduler keeps working under createRoot + act.
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(FIXED_TODAY);
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.useRealTimers();
});

function render(node: React.ReactElement) {
	act(() => {
		root.render(node);
	});
}

describe("CashHorizonWarning", () => {
	it("renders nothing when date is undefined", () => {
		render(<CashHorizonWarning date={undefined} />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
		expect(container.textContent).toBe("");
	});

	it("renders nothing when date is empty string", () => {
		render(<CashHorizonWarning date="" />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
	});

	it("renders nothing at the cash horizon (boundary date is allowed)", () => {
		// 2027-04-19 = FIXED_TODAY + 329d = cash horizon itself
		render(<CashHorizonWarning date="2027-04-19" />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
	});

	it("renders nothing for a date well within the cash horizon", () => {
		render(<CashHorizonWarning date="2026-08-15" />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
	});

	it("renders the warning one day past the cash horizon (SEA→TYO repro)", () => {
		// 2027-04-20 = first date past cash horizon. This is the bug-repro
		// date that surfaced the whole series.
		render(<CashHorizonWarning date="2027-04-20" />);
		const el = container.querySelector('[data-testid="cash-horizon-warning"]');
		expect(el).not.toBeNull();
		expect(el?.textContent).toContain(
			"Cash pricing isn't typically available",
		);
		expect(el?.textContent).toContain("award options only");
	});

	it("hosts the warning inside an aria-live='polite' status region", () => {
		// The aria-live wrapper is always mounted (even when no warning
		// is shown) so screen readers register the polite region before
		// content toggles in. Inconsistent NVDA/VoiceOver behavior with
		// late-mounted live regions is the reason.
		render(<CashHorizonWarning date="2027-04-20" />);
		const liveRegion = container.querySelector('[aria-live="polite"]');
		expect(liveRegion).not.toBeNull();
		expect(liveRegion?.getAttribute("role")).toBe("status");
		expect(
			liveRegion?.querySelector('[data-testid="cash-horizon-warning"]'),
		).not.toBeNull();
	});

	it("keeps the aria-live wrapper mounted even when no warning shows", () => {
		render(<CashHorizonWarning date="2026-08-15" />);
		const liveRegion = container.querySelector('[aria-live="polite"]');
		expect(liveRegion).not.toBeNull();
		expect(
			liveRegion?.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
	});

	it("toggles when the date prop crosses the horizon on re-render", () => {
		render(<CashHorizonWarning date="2026-08-15" />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
		render(<CashHorizonWarning date="2027-04-20" />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).not.toBeNull();
	});

	it("renders nothing for malformed input (defensive — matches helper)", () => {
		render(<CashHorizonWarning date="not-a-date" />);
		expect(
			container.querySelector('[data-testid="cash-horizon-warning"]'),
		).toBeNull();
	});
});
