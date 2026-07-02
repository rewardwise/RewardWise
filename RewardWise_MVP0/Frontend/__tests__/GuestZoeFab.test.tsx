/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackMock, pushMock } = vi.hoisted(() => ({ trackMock: vi.fn(), pushMock: vi.fn() }));
vi.mock("../utils/analytics/client", () => ({ trackAnalyticsEvent: trackMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import GuestZoeFab from "../components/GuestZoeFab";
import { zoeWelcomeGuest } from "../utils/zoeNarration";

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

function render() {
	act(() => {
		root.render(<GuestZoeFab />);
	});
}
function q(t: string) {
	return container.querySelector(`[data-testid="${t}"]`);
}

describe("GuestZoeFab — 8c guest FAB", () => {
	it("renders only the FAB button before it's opened", () => {
		render();
		expect(q("guest-zoe-fab")).not.toBeNull();
		expect(q("guest-zoe-panel")).toBeNull();
	});

	it("opens the deterministic welcome panel (lead + 2 chips + sign-in) and fires open analytics", () => {
		render();
		act(() => {
			(q("guest-zoe-fab") as HTMLButtonElement).click();
		});
		const panel = q("guest-zoe-panel");
		expect(panel).not.toBeNull();
		// zoeWelcomeGuest lead is the deterministic (no-LLM) welcome copy.
		expect(panel?.textContent).toContain(zoeWelcomeGuest().lead);
		expect(q("guest-zoe-chip-welcome_how")).not.toBeNull();
		expect(q("guest-zoe-chip-welcome_ask")).not.toBeNull();
		expect(q("guest-zoe-signin")).not.toBeNull();
		expect(trackMock).toHaveBeenCalledWith(
			"guest_zoe_opened",
			expect.objectContaining({ metadata: expect.objectContaining({ surface: "landing" }) }),
		);
	});

	it("a chip appends its deterministic templated reply (no backend call)", () => {
		render();
		act(() => {
			(q("guest-zoe-fab") as HTMLButtonElement).click();
		});
		act(() => {
			(q("guest-zoe-chip-welcome_how") as HTMLButtonElement).click();
		});
		const reply = zoeWelcomeGuest().chips.find((c) => c.id === "welcome_how")!.reply;
		expect(q("guest-zoe-panel")?.textContent).toContain(reply);
		expect(trackMock).toHaveBeenCalledWith(
			"guest_zoe_chip",
			expect.objectContaining({ metadata: expect.objectContaining({ chip: "welcome_how" }) }),
		);
	});

	it("sign-in routes to /signup?returnTo= and fires the CTA analytics", () => {
		render();
		act(() => {
			(q("guest-zoe-fab") as HTMLButtonElement).click();
		});
		act(() => {
			(q("guest-zoe-signin") as HTMLButtonElement).click();
		});
		expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/signup?returnTo="));
		expect(trackMock).toHaveBeenCalledWith(
			"guest_zoe_signin_cta",
			expect.objectContaining({ metadata: expect.objectContaining({ surface: "landing" }) }),
		);
	});
});
