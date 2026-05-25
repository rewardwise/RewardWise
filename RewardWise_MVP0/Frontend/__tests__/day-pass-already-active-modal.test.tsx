/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DayPassAlreadyActiveModal, {
	type DayPassAlreadyActiveDetails,
} from "@/components/DayPassAlreadyActiveModal";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	act(() => {
		root = createRoot(container);
	});
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});

type Overrides = {
	open?: boolean;
	details?: DayPassAlreadyActiveDetails | null;
	upgradeLoading?: boolean;
	onUpgradeToMonthly?: () => void;
	onDismiss?: () => void;
};

const ACTIVE_DAY_PASS: DayPassAlreadyActiveDetails = {
	hasActiveDayPass: true,
	dayPassRemainingHours: 5,
	dayPassExpiresAt: "2026-05-25T00:00:00.000Z",
	hasActiveSubscription: false,
	upsell: "monthly",
};

const ACTIVE_SUBSCRIPTION: DayPassAlreadyActiveDetails = {
	hasActiveDayPass: false,
	dayPassRemainingHours: 0,
	dayPassExpiresAt: null,
	hasActiveSubscription: true,
	upsell: null,
};

function render(overrides: Overrides = {}) {
	const details =
		"details" in overrides ? overrides.details! : ACTIVE_DAY_PASS;
	act(() => {
		root.render(
			<DayPassAlreadyActiveModal
				open={overrides.open ?? true}
				details={details}
				upgradeLoading={overrides.upgradeLoading ?? false}
				onUpgradeToMonthly={overrides.onUpgradeToMonthly ?? (() => {})}
				onDismiss={overrides.onDismiss ?? (() => {})}
			/>,
		);
	});
}

function modal() {
	return container.querySelector('[data-testid="day-pass-already-active-modal"]');
}

function upgradeButton() {
	return container.querySelector(
		'[data-testid="upgrade-to-monthly"]',
	) as HTMLButtonElement | null;
}

function dismissButton() {
	return container.querySelector(
		'[data-testid="dismiss-modal"]',
	) as HTMLButtonElement | null;
}

function closeXButton() {
	return container.querySelector(
		'button[aria-label="Close"]',
	) as HTMLButtonElement | null;
}

function bodyText() {
	return modal()?.textContent ?? "";
}

describe("DayPassAlreadyActiveModal", () => {
	it("renders nothing when open is false", () => {
		render({ open: false });
		expect(modal()).toBeNull();
	});

	it("renders nothing when details is null even with open=true", () => {
		render({ open: true, details: null });
		expect(modal()).toBeNull();
	});

	it("renders Day Pass story with Upgrade + Not now CTAs when upsell is monthly", () => {
		render({ details: ACTIVE_DAY_PASS });

		expect(modal()).not.toBeNull();
		expect(bodyText()).toContain("Your Day Pass is still active");
		expect(bodyText()).toContain("5 hours");
		expect(bodyText()).toContain("replace");

		const upgrade = upgradeButton();
		expect(upgrade).not.toBeNull();
		expect(upgrade!.textContent).toContain("Upgrade to Monthly");

		const dismiss = dismissButton();
		expect(dismiss).not.toBeNull();
		expect(dismiss!.textContent).toContain("Not now");
	});

	it("uses the singular 'hour' label when one hour remains", () => {
		render({
			details: { ...ACTIVE_DAY_PASS, dayPassRemainingHours: 1 },
		});
		expect(bodyText()).toContain("1 hour");
		expect(bodyText()).not.toContain("1 hours");
	});

	it("renders Subscription story with only Got it CTA when upsell is null", () => {
		render({ details: ACTIVE_SUBSCRIPTION });

		expect(modal()).not.toBeNull();
		expect(bodyText()).toContain("You already have Monthly access");
		expect(bodyText()).toContain("Monthly subscription already covers");

		expect(upgradeButton()).toBeNull();

		const dismiss = dismissButton();
		expect(dismiss).not.toBeNull();
		expect(dismiss!.textContent).toContain("Got it");
	});

	it("calls onUpgradeToMonthly when the Upgrade button is clicked", () => {
		const onUpgradeToMonthly = vi.fn();
		render({ details: ACTIVE_DAY_PASS, onUpgradeToMonthly });

		act(() => {
			upgradeButton()!.click();
		});

		expect(onUpgradeToMonthly).toHaveBeenCalledTimes(1);
	});

	it("calls onDismiss when the Not now button is clicked (Day Pass story)", () => {
		const onDismiss = vi.fn();
		render({ details: ACTIVE_DAY_PASS, onDismiss });

		act(() => {
			dismissButton()!.click();
		});

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("calls onDismiss when the Got it button is clicked (Subscription story)", () => {
		const onDismiss = vi.fn();
		render({ details: ACTIVE_SUBSCRIPTION, onDismiss });

		act(() => {
			dismissButton()!.click();
		});

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("calls onDismiss when the X close button is clicked", () => {
		const onDismiss = vi.fn();
		render({ details: ACTIVE_DAY_PASS, onDismiss });

		act(() => {
			closeXButton()!.click();
		});

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("disables the Upgrade button and shows the loading copy when upgradeLoading is true", () => {
		render({ details: ACTIVE_DAY_PASS, upgradeLoading: true });

		const upgrade = upgradeButton();
		expect(upgrade).not.toBeNull();
		expect(upgrade!.disabled).toBe(true);
		expect(upgrade!.textContent).toContain("Opening checkout");
	});

	it("clamps negative remaining hours to zero in the display copy", () => {
		render({
			details: { ...ACTIVE_DAY_PASS, dayPassRemainingHours: -3 },
		});
		expect(bodyText()).toContain("0 hours");
	});
});
