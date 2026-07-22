/** @format */
/** @vitest-environment jsdom */
// Regression guard (prod incident 2026-07-21): a TYPED Zoe turn must carry
// BOTH verdict_context and wallet in the /api/zoe body. The verdict-delivery
// bubble is client-composed (zoeNarration) and proves nothing about grounding;
// only this body keeps typed follow-ups anchored to the engine's numbers.

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/client", () => ({
	createClient: () => ({
		auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
		from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "conv1" }, error: null }) }) }) }),
	}),
}));
vi.mock("@/context/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/context/WalletContext", () => ({
	useWallet: () => ({ cards: [{ program_name: "Amex Membership Rewards", points_balance: 250000 }] }),
}));
vi.mock("@/hooks/useZoeVoice", () => ({
	useZoeVoice: () => ({ voiceMode: false, voiceState: "idle", liveTranscript: "", toggleVoiceMode: vi.fn(), interrupt: vi.fn() }),
}));
vi.mock("@/utils/analytics/client", () => ({ trackAnalyticsEvent: vi.fn() }));

import ZoeChat from "../components/zoe/ZoeChat";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});

describe("typed turn carries grounding payload", () => {
	it("sends verdict_context AND wallet on a typed /api/zoe call", async () => {
		let zoeBody: any = null;
		global.fetch = vi.fn(async (url: any, init?: any) => {
			if (String(url).includes("/api/zoe")) zoeBody = JSON.parse(init?.body ?? "{}");
			return { ok: true, json: async () => ({ message: "ok" }) } as any;
		}) as unknown as typeof fetch;

		const CTX = "Trip: SEA round trip to LAX... Verdict: pay_cash $157; best award 15,200 pts + $11.";
		act(() => {
			root.render(
				<ZoeChat isOpen={true} setIsOpen={() => undefined} variant="docked" verdictContext={CTX} />
			);
		});

		const input = container.querySelector("input[placeholder*='Zoe']") as HTMLInputElement;
		await act(async () => {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
			setter.call(input, "is there a cheaper award?");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		const form = input.closest("form");
		await act(async () => {
			if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
			else (container.querySelector("button[aria-label='Send message']") as HTMLButtonElement)?.click();
			await new Promise((r) => setTimeout(r, 30));
		});

		expect(zoeBody, "typed turn must hit /api/zoe").toBeTruthy();
		expect(zoeBody.verdict_context, "verdict_context attached verbatim").toBe(CTX);
		expect(Array.isArray(zoeBody.wallet) && zoeBody.wallet.length, "wallet attached").toBeTruthy();
		expect(zoeBody.wallet[0]).toEqual({ program: "Amex Membership Rewards", points: 250000 });
		// A question ABOUT the verdict is not a new trip — flag must be off so
		// the agent keeps grounding on the attached context.
		expect(zoeBody.is_new_trip, "non-trip question is not flagged").toBe(false);
	});

	it("flags is_new_trip on a typed NEW-trip message (dual-source guard)", async () => {
		let zoeBody: any = null;
		global.fetch = vi.fn(async (url: any, init?: any) => {
			if (String(url).includes("/api/zoe")) zoeBody = JSON.parse(init?.body ?? "{}");
			return { ok: true, json: async () => ({ message: "ok" }) } as any;
		}) as unknown as typeof fetch;

		act(() => {
			root.render(
				<ZoeChat isOpen={true} setIsOpen={() => undefined} variant="docked" verdictContext={"stale ctx"} />
			);
		});
		const input = container.querySelector("input[placeholder*='Zoe']") as HTMLInputElement;
		await act(async () => {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
			// The incident message shape: a fresh trip statement typed to Zoe.
			setter.call(input, "Can I go from Denver to Austin September 10 to 14, one traveler?");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		const form = input.closest("form");
		await act(async () => {
			if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
			else (container.querySelector("button[aria-label='Send message']") as HTMLButtonElement)?.click();
			await new Promise((r) => setTimeout(r, 30));
		});

		expect(zoeBody, "typed turn must hit /api/zoe").toBeTruthy();
		// The flag is what makes the backend compose the no-pricing preamble
		// (NEW_TRIP_INSTRUCTION) and drop the stale context — asserted on the
		// backend in test_new_trip_grounding.py. Frontend contract: flag on.
		expect(zoeBody.is_new_trip, "new-trip message must be flagged").toBe(true);
	});
});
