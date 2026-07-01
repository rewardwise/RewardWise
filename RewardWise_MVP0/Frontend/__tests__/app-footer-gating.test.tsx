/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	routerPush: vi.fn(),
	pathname: "/home",
	authState: { user: { id: "u1", email: "test@example.com" } as unknown },
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.routerPush }),
	usePathname: () => mocks.pathname,
}));

vi.mock("@/context/AuthProvider", () => ({
	useAuth: () => mocks.authState,
}));

import AppFooter from "../components/AppFooter";

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

describe("AppFooter — gated to the logged-in app (H1 regression guard)", () => {
	it("renders the light footer on a logged-in app route", () => {
		mocks.pathname = "/home";
		mocks.authState = { user: { id: "u1", email: "test@example.com" } };
		act(() => root.render(<AppFooter />));
		const footer = container.querySelector("footer");
		expect(footer, "footer renders on /home").not.toBeNull();
		expect(footer?.textContent).toContain("About");
		expect(footer?.textContent).toContain("MyTravelWallet");
	});

	it("renders nothing on the logged-out landing (/) — must not bleed onto the dark hero", () => {
		mocks.pathname = "/";
		mocks.authState = { user: { id: "u1", email: "test@example.com" } };
		act(() => root.render(<AppFooter />));
		expect(container.querySelector("footer"), "no footer on /").toBeNull();
	});

	it("renders nothing on /login", () => {
		mocks.pathname = "/login";
		mocks.authState = { user: { id: "u1", email: "test@example.com" } };
		act(() => root.render(<AppFooter />));
		expect(container.querySelector("footer"), "no footer on /login").toBeNull();
	});

	it("renders nothing when logged out (no user)", () => {
		mocks.pathname = "/home";
		mocks.authState = { user: null };
		act(() => root.render(<AppFooter />));
		expect(container.querySelector("footer"), "no footer when signed out").toBeNull();
	});
});
