/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type Mock,
} from "vitest";

import NewsletterSignup from "@/components/NewsletterSignup";

// ---- Fetch mock ---------------------------------------------------------

beforeEach(() => {
	(global as unknown as { fetch: Mock }).fetch = vi.fn();
});
afterEach(() => {
	vi.restoreAllMocks();
});

function mockJson(status: number, body: unknown) {
	(global.fetch as unknown as Mock).mockResolvedValueOnce({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	});
}

function mockNetworkError() {
	(global.fetch as unknown as Mock).mockRejectedValueOnce(
		new TypeError("network down"),
	);
}

// ---- DOM harness --------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	act(() => {
		root = createRoot(container);
		root.render(<NewsletterSignup />);
	});
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

async function typeEmail(value: string) {
	const input = container.querySelector(
		'input[type="email"]',
	) as HTMLInputElement;
	// React tracks the native value setter; bypass it to fire a synthetic event React detects.
	const nativeSetter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		"value",
	)!.set!;
	await act(async () => {
		nativeSetter.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function submitForm() {
	const form = container.querySelector("form") as HTMLFormElement;
	await act(async () => {
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	});
	// drain microtask queue so async fetch handler updates state
	await act(async () => {
		await Promise.resolve();
	});
}

// ---- Tests --------------------------------------------------------------

describe("NewsletterSignup", () => {
	it("renders form and submits successfully", async () => {
		mockJson(200, { status: "subscribed" });

		await typeEmail("hello@example.com");
		await submitForm();

		expect(global.fetch).toHaveBeenCalledWith(
			"/api/newsletter",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ email: "hello@example.com" }),
			}),
		);
		expect(container.textContent).toContain("Thanks, we'll keep you posted.");
		expect(container.querySelector("form")).toBeNull();
	});

	it("shows duplicate state on already_subscribed", async () => {
		mockJson(200, { status: "already_subscribed" });

		await typeEmail("dupe@example.com");
		await submitForm();

		expect(container.textContent).toContain(
			"You're already subscribed. Thanks for sticking with us.",
		);
		expect(container.querySelector("form")).toBeNull();
	});

	it("shows invalid email message on 422 and keeps form visible", async () => {
		mockJson(422, { detail: [{ loc: ["body", "email"], msg: "invalid" }] });

		await typeEmail("not-an-email");
		await submitForm();

		expect(container.textContent).toContain(
			"That email doesn't look right. Mind double-checking?",
		);
		expect(container.querySelector("form")).not.toBeNull();
	});

	it("shows generic error on network failure and keeps form visible", async () => {
		mockNetworkError();

		await typeEmail("hello@example.com");
		await submitForm();

		expect(container.textContent).toContain(
			"Something went wrong. Please try again in a moment.",
		);
		expect(container.querySelector("form")).not.toBeNull();
	});
});
