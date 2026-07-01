/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateEq = vi.fn(async () => ({ error: null }));
const updateSpy = vi.fn(() => ({ eq: updateEq }));

const mocks = vi.hoisted(() => ({
	authState: { user: { id: "u1" } as unknown },
	notifs: [
		{ id: "n1", type: "subscription_renewed", title: "Subscription renewed", message: "Thanks!", is_read: false, created_at: "2026-07-01T00:00:00Z" },
	],
}));

vi.mock("@/context/AuthProvider", () => ({ useAuth: () => mocks.authState }));

vi.mock("@/utils/supabase/client", () => ({
	createClient: () => ({
		from: () => {
			const q = {
				select: vi.fn(() => q),
				eq: vi.fn(() => q),
				order: vi.fn(() => q),
				limit: vi.fn(async () => ({ data: mocks.notifs, error: null })),
				update: updateSpy,
			};
			return q;
		},
	}),
}));

import PaymentNotificationBanner from "../components/PaymentNotificationBanner";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	vi.useFakeTimers();
	updateSpy.mockClear();
	updateEq.mockClear();
	mocks.notifs = [
		{ id: "n1", type: "subscription_renewed", title: "Subscription renewed", message: "Thanks!", is_read: false, created_at: "2026-07-01T00:00:00Z" },
	];
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.useRealTimers();
});

describe("PaymentNotificationBanner — auto-dismiss + mark seen", () => {
	it("renders the notification, then auto-dismisses after 8s and marks it is_read", async () => {
		await act(async () => {
			root.render(<PaymentNotificationBanner />);
		});
		// Flush the async fetch (microtasks) so the notification renders.
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(container.querySelector('[data-testid="payment-notification"]'), "toast visible after fetch").not.toBeNull();
		expect(container.textContent).toContain("Subscription renewed");

		// Advance to the 8s auto-dismiss.
		await act(async () => {
			vi.advanceTimersByTime(8000);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(container.querySelector('[data-testid="payment-notification"]'), "toast gone after 8s").toBeNull();
		// Marked seen in the backend (server-side filter excludes it next load).
		expect(updateSpy).toHaveBeenCalledWith({ is_read: true });
		expect(updateEq).toHaveBeenCalledWith("id", "n1");
	});

	it("does NOT auto-dismiss a payment_failed (critical) alert — it must persist until manual dismiss", async () => {
		mocks.notifs = [
			{ id: "f1", type: "payment_failed", title: "Payment failed", message: "Update your card.", is_read: false, created_at: "2026-07-01T00:00:00Z" },
		];
		await act(async () => {
			root.render(<PaymentNotificationBanner />);
		});
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(container.querySelector('[data-testid="payment-notification"]')).not.toBeNull();

		await act(async () => {
			vi.advanceTimersByTime(30000); // well past 8s
			await Promise.resolve();
		});
		// Still visible; never auto-marked read.
		expect(container.querySelector('[data-testid="payment-notification"]'), "critical alert persists").not.toBeNull();
		expect(updateSpy).not.toHaveBeenCalled();
	});
});
