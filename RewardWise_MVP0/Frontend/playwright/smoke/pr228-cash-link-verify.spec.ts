/** @format */
// PR #228 post-merge verify (LIVE PROD): on a pay_cash verdict the single
// handoff link must resolve to a CASH source (carrier site or Google Flights),
// never an award program. Also re-measure the simplified card heights.

import { test, expect } from "@playwright/test";

const AWARD_DOMAINS = /qantas|aeroplan|aircanada|flyingblue|velocity|virginatlantic|aadvantage|lifemiles|alaskaair\.com\/mileageplan/i;

test("prod: pay_cash handoff is a cash source + height report", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});
	const dateInputs = page.locator('input[type="date"]');
	await dateInputs.nth(0).fill("2026-08-15");
	await dateInputs.nth(1).fill("2026-08-18");
	const airportInputs = page.locator('input[placeholder="City or airport"]');
	await airportInputs.nth(0).fill("SFO");
	await airportInputs.nth(0).press("Enter");
	await airportInputs.nth(1).fill("SEA");
	await airportInputs.nth(1).press("Enter");
	const respPromise = page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.request().method() === "POST",
		{ timeout: 180_000 }
	);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await respPromise).json();
	console.log("RECOMMENDATION", body?.verdict?.recommendation);
	await page.waitForTimeout(7000);

	// The single handoff link ("Visit <domain>")
	const handoff = page.locator('a:has-text("Visit ")').first();
	await handoff.scrollIntoViewIfNeeded();
	const href = await handoff.getAttribute("href");
	const text = (await handoff.textContent())?.trim().slice(0, 60);
	console.log("HANDOFF_TEXT", JSON.stringify(text));
	console.log("HANDOFF_HREF", href);
	if (body?.verdict?.recommendation === "pay_cash") {
		expect(href, "pay_cash handoff must not be an award-program site").not.toMatch(AWARD_DOMAINS);
	}

	// Heights post-tightening
	const m = await page.evaluate(() => {
		const pill = document.querySelector('[data-testid="search-pill"]')?.getBoundingClientRect();
		const res = document.querySelector('[data-testid="home-results"]')?.getBoundingClientRect();
		const zoe = Array.from(document.querySelectorAll("div"))
			.find((d) => d.className.includes("lg:sticky") && d.className.includes("lg:h-[calc(100vh-3rem)]"))
			?.getBoundingClientRect();
		return {
			leftCol: pill && res ? Math.round(res.bottom - pill.top) : null,
			zoe: zoe ? Math.round(zoe.height) : null,
		};
	});
	console.log("HEIGHTS_POST_TIGHTEN", JSON.stringify(m));
	await page.screenshot({ path: "playwright/.artifacts/pr228-verified.png", fullPage: true });
});
