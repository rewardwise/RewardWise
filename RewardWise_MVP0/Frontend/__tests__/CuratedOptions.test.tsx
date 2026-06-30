/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import CuratedOptions from "../components/verdict/CuratedOptions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const AWARDS = [
	{ program: "united", points: 60000, taxes: 50, direct: true },
	{ program: "aeroplan", points: 55000, taxes: 30, direct: true },
	{ program: "delta", points: 70000, taxes: 20, direct: false },
	{ program: "jetblue", points: 80000, taxes: 0, direct: true },
];

function cards(): HTMLElement[] {
	return Array.from(container.querySelectorAll('[data-testid="option-card"]'));
}
function highlighted(): HTMLElement[] {
	return cards().filter((c) => c.getAttribute("data-best") === "true");
}

describe("CuratedOptions", () => {
	it("caps to 3 cards and highlights exactly one", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="use_points"
					awardOptions={AWARDS}
					winnerProgram="aeroplan"
					cashPrice={740}
					matchedCpp={2.1}
					savings={620}
				/>,
			);
		});
		expect(cards()).toHaveLength(3); // 4 in -> capped at 3
		expect(highlighted()).toHaveLength(1);
	});

	it("floats the winner to the top and highlights it", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="use_points"
					awardOptions={AWARDS}
					winnerProgram="aeroplan"
					cashPrice={740}
					matchedCpp={2.1}
					savings={620}
				/>,
			);
		});
		// first card is the winner, and it's the highlighted one
		expect(cards()[0].getAttribute("data-best")).toBe("true");
		expect(highlighted()[0]).toBe(cards()[0]);
	});

	it("highlight tag matches a use_points recommendation", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="use_points"
					awardOptions={AWARDS}
					winnerProgram="aeroplan"
					cashPrice={740}
					matchedCpp={2.1}
					savings={620}
				/>,
			);
		});
		const tag = container.querySelector('[data-testid="best-tag"]')?.textContent ?? "";
		expect(tag).toContain("USE POINTS");
		expect(tag).not.toContain("PAY CASH");
	});

	it("highlight tag matches a pay_cash recommendation", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="pay_cash"
					awardOptions={AWARDS}
					winnerProgram={null}
					cashPrice={352}
					matchedCpp={null}
					savings={null}
				/>,
			);
		});
		expect(highlighted()).toHaveLength(1);
		const tag = container.querySelector('[data-testid="best-tag"]')?.textContent ?? "";
		expect(tag).toContain("PAY CASH");
	});

	it("shows the matched cpp only on the highlighted card, never on alternatives", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="use_points"
					awardOptions={AWARDS}
					winnerProgram="aeroplan"
					cashPrice={740}
					matchedCpp={2.1}
					savings={620}
				/>,
			);
		});
		// exactly one cpp line (on the best card) — alternatives get no fabricated cpp
		expect(container.querySelectorAll('[data-testid="option-cpp"]')).toHaveLength(1);
	});

	it("renders a savings-led headline for use_points", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="use_points"
					awardOptions={AWARDS}
					winnerProgram="aeroplan"
					cashPrice={740}
					matchedCpp={2.1}
					savings={620}
				/>,
			);
		});
		expect(container.querySelector('[data-testid="curated-headline"]')?.textContent).toBe(
			"Use points — save $620",
		);
	});

	it("renders nothing when there are no award options", () => {
		act(() => {
			root.render(
				<CuratedOptions
					recommendation="pay_cash"
					awardOptions={[]}
					cashPrice={352}
					matchedCpp={null}
					savings={null}
				/>,
			);
		});
		expect(container.querySelector('[data-testid="curated-options"]')).toBeNull();
	});
});
