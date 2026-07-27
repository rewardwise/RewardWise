/** @format */
/** @vitest-environment jsdom */
// Pill rotation contract: 5s cycle through ALL programs, pause on hover AND
// focus (WCAG 2.2.2), static under prefers-reduced-motion, static when only
// one program.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	walletState: { hasWallet: true, cards: [] as any[] },
	authState: { user: { email: "o@x.com" }, signOut: vi.fn() },
}));
vi.mock("@/context/WalletContext", () => ({ useWallet: () => mocks.walletState }));
vi.mock("@/context/AuthProvider", () => ({ useAuth: () => mocks.authState }));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
	usePathname: () => "/home",
}));

import TopNav from "../components/TopNav";

let container: HTMLDivElement;
let root: Root;
const FOUR = [
	{ program_name: "Chase Ultimate Rewards", points_balance: 1_000_000 },
	{ program_name: "Alaska Mileage Plan", points_balance: 900_000 },
	{ program_name: "Delta SkyMiles", points_balance: 800_000 },
	{ program_name: "Amex Membership Rewards", points_balance: 700_000 },
];

const setMotion = (reduced: boolean) => {
	window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as any;
};
const chip = () => container.querySelector('[data-testid="nav-wallet-chip"]')?.textContent;

beforeEach(() => {
	vi.useFakeTimers();
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.useRealTimers();
});

describe("wallet pill rotation", () => {
	it("cycles through all four programs every 5s and loops", () => {
		setMotion(false);
		mocks.walletState.cards = FOUR;
		act(() => root.render(<TopNav />));
		expect(chip()).toBe("1M Chase");
		act(() => { vi.advanceTimersByTime(5000); });
		expect(chip()).toBe("900k Alaska");
		act(() => { vi.advanceTimersByTime(5000); });
		expect(chip()).toBe("800k Delta");
		act(() => { vi.advanceTimersByTime(5000); });
		expect(chip()).toBe("700k Amex");
		act(() => { vi.advanceTimersByTime(5000); });
		expect(chip()).toBe("1M Chase"); // loop
	});

	it("pauses on hover and resumes on leave (WCAG 2.2.2)", () => {
		setMotion(false);
		mocks.walletState.cards = FOUR;
		act(() => root.render(<TopNav />));
		const pill = container.querySelector('[data-testid="nav-wallet-pill"]')!;
		act(() => { pill.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
		act(() => { vi.advanceTimersByTime(15000); });
		expect(chip()).toBe("1M Chase"); // frozen while hovered
		act(() => { pill.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); });
		act(() => { vi.advanceTimersByTime(5000); });
		expect(chip()).toBe("900k Alaska");
	});

	it("pauses on keyboard focus", () => {
		setMotion(false);
		mocks.walletState.cards = FOUR;
		act(() => root.render(<TopNav />));
		const pill = container.querySelector('[data-testid="nav-wallet-pill"]') as HTMLElement;
		act(() => { pill.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); });
		act(() => { vi.advanceTimersByTime(15000); });
		expect(chip()).toBe("1M Chase");
	});

	it("prefers-reduced-motion: static top program, no rotation", () => {
		setMotion(true);
		mocks.walletState.cards = FOUR;
		act(() => root.render(<TopNav />));
		act(() => { vi.advanceTimersByTime(20000); });
		expect(chip()).toBe("1M Chase");
	});

	it("single program never rotates", () => {
		setMotion(false);
		mocks.walletState.cards = [FOUR[3]];
		act(() => root.render(<TopNav />));
		act(() => { vi.advanceTimersByTime(20000); });
		expect(chip()).toBe("700k Amex");
	});
});
