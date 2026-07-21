/** @format */
/** @vitest-environment jsdom */
// Server-prefill override (one consumer, two sources): the /api/zoe response's
// structured prefill must be applied AFTER (and therefore over) the local
// extraction. Simulated server reply — the vendor's FIRST real [[TRIP_PARAMS]]
// delivery still gets a live verification (flagged), this covers the contract.

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
vi.mock("@/context/WalletContext", () => ({ useWallet: () => ({ cards: [] }) }));
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

describe("server TRIP_PARAMS prefill overrides local extraction", () => {
	it("applies local fill first, then the server prefill on response", async () => {
		const fills: Array<Record<string, unknown>> = [];
		global.fetch = vi.fn(async () => ({
			ok: true,
			json: async () => ({
				message: "ok",
				// Server disagrees with local extraction on the destination.
				prefill: { origin: "DEN", destination: "SFO", date: "2026-09-10" },
			}),
		})) as unknown as typeof fetch;

		act(() => {
			root.render(
				<ZoeChat
					isOpen={true}
					setIsOpen={() => undefined}
					variant="docked"
					onFillSearch={(d) => fills.push(d as Record<string, unknown>)}
				/>
			);
		});

		const input = container.querySelector("input[placeholder*='Zoe']") as HTMLInputElement;
		expect(input, "docked input renders").not.toBeNull();
		await act(async () => {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
			setter.call(input, "fly from Denver to Austin September 10");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		const form = input.closest("form");
		await act(async () => {
			if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
			else (container.querySelector("button[aria-label='Send message']") as HTMLButtonElement)?.click();
			await new Promise((r) => setTimeout(r, 50));
		});

		expect(fills.length, "both sources applied").toBeGreaterThanOrEqual(2);
		const local = fills[0];
		const server = fills[fills.length - 1];
		expect(local.destination).toBe("AUS"); // local extraction from the message
		expect(server.destination).toBe("SFO"); // server wins by ordering
		expect(server.origin).toBe("DEN");
	});
});
