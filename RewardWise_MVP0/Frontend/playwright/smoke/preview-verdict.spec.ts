/** @format */
// Visual verify of Build A on the Vercel preview: verdict below the search pill
// + tabbed flight legs. Run with PLAYWRIGHT_BASE_URL=<preview-url>.

import { test } from "@playwright/test";

test("preview: verdict renders below search pill (SEA->TYO)", async ({ page }) => {
	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	// Detect logged-out (auth cookies are prod-domain scoped; preview may redirect).
	const loggedOut = await page
		.getByRole("button", { name: /sign in|log in/i })
		.isVisible()
		.catch(() => false);
	console.log("APPEARS_LOGGED_OUT", loggedOut, "URL", page.url());

	const airportInputs = page.locator('input[placeholder="City or airport"]');
	if ((await airportInputs.count()) === 0) {
		console.log("NO_SEARCH_FORM — likely logged out on preview domain");
		await page.screenshot({ path: "playwright/.artifacts/preview-state.png", fullPage: true });
		return;
	}
	await airportInputs.nth(0).fill("SEA");
	await airportInputs.nth(0).press("Enter");
	await airportInputs.nth(1).fill("TYO");
	await airportInputs.nth(1).press("Enter");
	const dateInputs = page.locator('input[type="date"]');
	await dateInputs.nth(0).fill("2026-07-23");
	await dateInputs.nth(1).fill("2026-07-30");

	const respPromise = page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.request().method() === "POST",
		{ timeout: 120_000 }
	);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	await respPromise.catch(() => console.log("no /api/search response captured"));
	await page.waitForTimeout(6000);

	const tabsPresent = await page.getByTestId("flight-tab-from").isVisible().catch(() => false);
	console.log("FLIGHT_TABS_PRESENT", tabsPresent);
	await page.screenshot({ path: "playwright/.artifacts/preview-verdict-1440.png", fullPage: true });
});
