/** @format */
// PR #223 post-merge verify (LIVE PROD, ANONYMOUS): the guest verdict flow is
// gone. Asserts: (1) static example card renders, (2) the search CTA routes to
// /signup, (3) ZERO requests leave the page toward the backend (no upstream
// spend possible). Runs with an EMPTY storageState — truly logged out.

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("anon landing: static card + signup routing + zero backend calls", async ({ page }) => {
	const backendCalls: string[] = [];
	page.on("request", (req) => {
		if (req.url().includes("onrender.com")) backendCalls.push(req.url());
	});

	await page.goto("/");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	// (1) Static example card renders.
	await expect(page.getByText("A real verdict looks like this")).toBeVisible();
	await expect(page.getByText("Pay cash — SFO → NYC, $352 round trip.")).toBeVisible();

	// No guest-flow remnants.
	await expect(page.getByTestId("free-search-counter")).toHaveCount(0);
	await expect(page.getByTestId("landing-results")).toHaveCount(0);
	await expect(page.getByTestId("guest-zoe-fab")).toHaveCount(0);

	// Screenshot the landing (viewport = what an anonymous visitor sees).
	const vp = page.viewportSize();
	await page.screenshot({
		path: `playwright/.artifacts/pr223-anon-landing-${vp?.width}.png`,
		fullPage: true,
	});

	// (2) Fill the form and hit the CTA — must route to /signup, not search.
	const airportInputs = page.locator('input[placeholder="City or airport"]');
	await airportInputs.nth(0).fill("SEA");
	await airportInputs.nth(0).press("Enter");
	await airportInputs.nth(1).fill("TYO");
	await airportInputs.nth(1).press("Enter");
	await page.getByTestId("landing-search-cta").click();
	await page.waitForURL(/\/signup/, { timeout: 15_000 });
	console.log("ROUTED_TO", page.url());

	// (3) Zero backend calls for the entire anonymous session.
	console.log("BACKEND_CALLS", JSON.stringify(backendCalls));
	expect(backendCalls, "anonymous session must make ZERO backend requests").toEqual([]);
});
