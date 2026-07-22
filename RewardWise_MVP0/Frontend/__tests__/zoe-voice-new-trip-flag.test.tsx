/** @format */
/** @vitest-environment jsdom */
// Voice-path parity for the dual-source kill-switch: ZoeChat must hand
// useZoeVoice an isNewTrip classifier wired to the SAME deterministic
// extractor (+ form context) as the typed path, so spoken new-trip requests
// short-circuit before the agent too.

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ options: null as any }));

vi.mock("@/utils/supabase/client", () => ({
	createClient: () => ({
		auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
		from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }) }) }),
	}),
}));
vi.mock("@/context/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/context/WalletContext", () => ({ useWallet: () => ({ cards: [] }) }));
vi.mock("@/hooks/useZoeVoice", () => ({
	useZoeVoice: (opts: any) => {
		captured.options = opts;
		return { voiceMode: false, voiceState: "idle", liveTranscript: "", toggleVoiceMode: vi.fn(), interrupt: vi.fn() };
	},
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
});

describe("voice isNewTrip classifier", () => {
	it("classifies trip statements true and questions false, honoring form context", () => {
		act(() => {
			root.render(
				<ZoeChat
					isOpen={true}
					setIsOpen={() => undefined}
					variant="docked"
					currentSearch={{ date: "2026-09-10", return_date: "2026-09-14" }}
				/>
			);
		});
		const fn = captured.options?.isNewTrip;
		expect(fn, "classifier must be passed to useZoeVoice").toBeTypeOf("function");
		// Incident-shaped spoken request → flagged.
		expect(fn("Can I go from Denver to Austin September 10 to 14, one traveler?")).toBe(true);
		// Incremental day-only update leans on currentSearch context → flagged.
		expect(fn("what about the 20th instead?")).toBe(true);
		// Non-trip question → not flagged (agent stays reachable, grounded).
		expect(fn("how do transfer ratios work?")).toBe(false);
	});
});
