/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PartialDataCard, {
	type PartialDataVerdict,
} from "../components/verdict/PartialDataCard";

// Pin "today" matching the CashHorizonWarning test harness so any
// future copy that depends on `new Date()` (e.g., "as of <month>")
// remains deterministic. Only `Date` is faked so React 19's scheduler
// keeps working under createRoot + act.
const FIXED_TODAY = new Date("2026-05-25T00:00:00.000Z");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function buildVerdict(
	overrides: Partial<PartialDataVerdict> = {},
): PartialDataVerdict {
	return {
		verdict: "partial",
		recommendation: "wait",
		explanation:
			"Cash pricing isn't available for this date, but award seats look open via Aeroplan.",
		winner: {
			program: "aeroplan",
			points: 75000,
			taxes: 120,
			cpp: null,
			direct: true,
		},
		pay_cash: false,
		confidence: "medium",
		booking_link: {
			seats_aero_link: "https://seats.aero/search?route=SEA-NRT",
			airline_link: "https://aircanada.com/aeroplan/redeem",
			preferred: "airline",
		},
		...overrides,
	};
}

describe("PartialDataCard", () => {
	it("renders verdict.explanation", () => {
		render(<PartialDataCard verdict={buildVerdict()} />);
		const card = container.querySelector(
			'[data-testid="partial-data-card"]',
		);
		expect(card).not.toBeNull();
		expect(card?.textContent).toContain(
			"Cash pricing isn't available for this date",
		);
	});

	it("renders winner program, points, and taxes", () => {
		render(<PartialDataCard verdict={buildVerdict()} />);
		const winner = container.querySelector(
			'[data-testid="partial-data-winner"]',
		);
		expect(winner).not.toBeNull();
		expect(winner?.textContent).toContain("Aeroplan");
		expect(winner?.textContent).toContain("75,000 points");
		expect(winner?.textContent).toContain("$120");
	});

	it("renders 'Points TBD' when winner.points is null and omits taxes line when taxes is 0", () => {
		render(
			<PartialDataCard
				verdict={buildVerdict({
					winner: {
						program: "aeroplan",
						points: null,
						taxes: 0,
						cpp: null,
						direct: null,
					},
				})}
			/>,
		);
		const winner = container.querySelector(
			'[data-testid="partial-data-winner"]',
		);
		expect(winner?.textContent).toContain("Points TBD");
		expect(winner?.textContent).not.toContain("$0");
		expect(winner?.textContent).not.toContain("taxes");
	});

	it("'Verify on' CTA href prefers airline_link from booking_link", () => {
		render(<PartialDataCard verdict={buildVerdict()} />);
		const cta = container.querySelector(
			'[data-testid="partial-data-verify-cta"]',
		) as HTMLAnchorElement | null;
		expect(cta).not.toBeNull();
		expect(cta?.getAttribute("href")).toBe(
			"https://aircanada.com/aeroplan/redeem",
		);
		expect(cta?.getAttribute("target")).toBe("_blank");
		expect(cta?.getAttribute("rel")).toContain("noopener");
		expect(cta?.textContent).toContain("Verify on Aeroplan");
	});

	it("falls back to seats_aero_link when airline_link is null", () => {
		render(
			<PartialDataCard
				verdict={buildVerdict({
					booking_link: {
						seats_aero_link: "https://seats.aero/search?route=SEA-NRT",
						airline_link: null,
						preferred: "seats_aero",
					},
				})}
			/>,
		);
		const cta = container.querySelector(
			'[data-testid="partial-data-verify-cta"]',
		) as HTMLAnchorElement | null;
		expect(cta?.getAttribute("href")).toBe(
			"https://seats.aero/search?route=SEA-NRT",
		);
	});

	it("'Try a different date' callback fires on click", () => {
		const onTryDifferentDate = vi.fn();
		render(
			<PartialDataCard
				verdict={buildVerdict()}
				onTryDifferentDate={onTryDifferentDate}
			/>,
		);
		const cta = container.querySelector(
			'[data-testid="partial-data-retry-date-cta"]',
		) as HTMLButtonElement | null;
		expect(cta).not.toBeNull();
		act(() => {
			cta?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
		expect(onTryDifferentDate).toHaveBeenCalledTimes(1);
	});

	it("omits 'Try a different date' button when callback not provided", () => {
		render(<PartialDataCard verdict={buildVerdict()} />);
		expect(
			container.querySelector('[data-testid="partial-data-retry-date-cta"]'),
		).toBeNull();
	});

	it("variant='defensive' omits the '~10 months out' subtext", () => {
		render(<PartialDataCard verdict={buildVerdict()} variant="defensive" />);
		expect(
			container.querySelector('[data-testid="partial-data-cash-subtext"]'),
		).toBeNull();
		const card = container.querySelector(
			'[data-testid="partial-data-card"]',
		);
		expect(card?.textContent).not.toContain("~10 months out");
		expect(card?.textContent).toContain("Limited data for this comparison");
	});

	it("variant='missing_cash' (default) includes the cash subtext", () => {
		render(<PartialDataCard verdict={buildVerdict()} />);
		const sub = container.querySelector(
			'[data-testid="partial-data-cash-subtext"]',
		);
		expect(sub).not.toBeNull();
		expect(sub?.textContent).toContain("~10 months out");
	});

	it("missing winner doesn't crash (defensive case)", () => {
		render(
			<PartialDataCard
				verdict={buildVerdict({ winner: null })}
				variant="defensive"
			/>,
		);
		expect(
			container.querySelector('[data-testid="partial-data-card"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="partial-data-winner"]'),
		).toBeNull();
		expect(
			container.querySelector('[data-testid="partial-data-verify-cta"]'),
		).toBeNull();
	});

	it("missing booking links don't render verify CTA", () => {
		render(
			<PartialDataCard
				verdict={buildVerdict({
					booking_link: {
						seats_aero_link: null,
						airline_link: null,
						preferred: "none",
					},
				})}
			/>,
		);
		expect(
			container.querySelector('[data-testid="partial-data-verify-cta"]'),
		).toBeNull();
	});

	it("missing booking_link object entirely doesn't crash (defensive)", () => {
		render(
			<PartialDataCard
				verdict={buildVerdict({ booking_link: undefined })}
			/>,
		);
		expect(
			container.querySelector('[data-testid="partial-data-card"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[data-testid="partial-data-verify-cta"]'),
		).toBeNull();
	});

	it("exposes role='region' with aria-label matching the headline", () => {
		render(<PartialDataCard verdict={buildVerdict()} />);
		const region = container.querySelector('[role="region"]');
		expect(region).not.toBeNull();
		expect(region?.getAttribute("aria-label")).toBe(
			"Award seats available · Cash data unavailable",
		);
	});

	it("stacks CTAs at mobile width (flex-col base, sm:flex-row at breakpoint)", () => {
		render(
			<PartialDataCard
				verdict={buildVerdict()}
				onTryDifferentDate={() => {}}
			/>,
		);
		const verify = container.querySelector(
			'[data-testid="partial-data-verify-cta"]',
		);
		const retry = container.querySelector(
			'[data-testid="partial-data-retry-date-cta"]',
		);
		// Both CTAs share a flex parent that stacks on mobile (default
		// flex-col) and goes side-by-side from sm: (640px) — satisfies
		// the spec's 375px stacked + 1440px side-by-side reference
		// widths.
		const ctaRow = verify?.parentElement;
		expect(ctaRow).not.toBeNull();
		expect(ctaRow).toBe(retry?.parentElement);
		expect(ctaRow?.className).toContain("flex-col");
		expect(ctaRow?.className).toContain("sm:flex-row");
	});
});
