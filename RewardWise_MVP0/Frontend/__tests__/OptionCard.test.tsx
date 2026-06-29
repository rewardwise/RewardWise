/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import OptionCard from "../components/verdict/OptionCard";

// Match repo convention so act() flushes effects instead of no-op'ing + warning.
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

function q(testid: string): HTMLElement | null {
	return container.querySelector(`[data-testid="${testid}"]`);
}

describe("OptionCard", () => {
	it("renders cash and points together on the row", () => {
		act(() => {
			root.render(
				<OptionCard program="united" cashPrice={352} points={25000} taxes={11.2} cpp={1.4} />,
			);
		});
		expect(q("option-cash")?.textContent).toBe("$352");
		expect(q("option-points")?.textContent).toContain("25,000 pts");
		expect(q("option-points")?.textContent).toContain("$11.20");
		expect(q("no-award")).toBeNull();
	});

	it('shows "No award space" when there are no points', () => {
		act(() => {
			root.render(<OptionCard program="jetblue" cashPrice={318} points={null} />);
		});
		expect(q("no-award")?.textContent).toBe("No award space");
		expect(q("option-points")).toBeNull();
		// cash still renders
		expect(q("option-cash")?.textContent).toBe("$318");
	});

	it("renders the best-highlight variant with its tag", () => {
		act(() => {
			root.render(
				<OptionCard
					program="alaska"
					cashPrice={352}
					points={25000}
					cpp={2.0}
					isBest
					bestTag="BEST VALUE · PAY CASH"
				/>,
			);
		});
		const card = q("option-card");
		expect(card?.getAttribute("data-best")).toBe("true");
		expect(card?.className).toContain("border-mtw-emerald");
		expect(q("best-tag")?.textContent).toBe("BEST VALUE · PAY CASH");
	});

	it("does not render a tag or emerald border when not best", () => {
		act(() => {
			root.render(<OptionCard program="united" cashPrice={352} points={25000} cpp={1.4} />);
		});
		expect(q("option-card")?.getAttribute("data-best")).toBe("false");
		expect(q("best-tag")).toBeNull();
	});

	it("reuses the program deep-link as a working href", () => {
		act(() => {
			root.render(<OptionCard program="united" cashPrice={352} points={25000} cpp={1.4} />);
		});
		const link = q("option-href") as HTMLAnchorElement | null;
		expect(link).not.toBeNull();
		expect(link?.getAttribute("href")).toMatch(/^https?:\/\//);
		expect(link?.getAttribute("href")).toMatch(/united/i);
		expect(link?.getAttribute("target")).toBe("_blank");
	});

	it("displays the engine's cpp verbatim and never recomputes it", () => {
		// cpp prop (1.87 -> "1.9") deliberately disagrees with what a naive
		// recompute from cash/points would yield: 740 / 22,500 * 100 ≈ 3.29 -> "3.3".
		// The card must show the engine's matched value, not the derived one.
		act(() => {
			root.render(<OptionCard program="singapore" cashPrice={740} points={22500} cpp={1.87} />);
		});
		const cpp = q("option-cpp")?.textContent ?? "";
		expect(cpp).toContain("1.9");
		expect(cpp).toContain("¢/pt");
		expect(cpp).not.toContain("3.3"); // would only appear if the card recomputed
	});

	it("omits the cpp line when cpp is null", () => {
		act(() => {
			root.render(<OptionCard program="united" cashPrice={352} points={25000} cpp={null} />);
		});
		expect(q("option-cpp")).toBeNull();
	});
});
