/** @format */
// PR #224 post-merge verify (LIVE PROD): small-viewport auto-scroll brings the
// verdict headline + price into view after search; desktop viewport unmoved.

import { test, expect } from "@playwright/test";

test("autoscroll: headline+price in view (375) / desktop unmoved (1440)", async ({ page }) => {
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
	await respPromise;
	// Let the verdict render + smooth scroll settle.
	await page.waitForTimeout(9000);

	const vp = page.viewportSize()!;
	const scrollY = await page.evaluate(() => window.scrollY);
	// Viewport-relative rect straight from the DOM — unambiguous vs boundingBox.
	const rect = await page.evaluate(() => {
		const els = Array.from(document.querySelectorAll("h2"));
		const h = els.find((e) => /Pay cash|Use points|Wait/.test(e.textContent || ""));
		if (!h) return null;
		const r = h.getBoundingClientRect();
		return { top: r.top, bottom: r.bottom, text: (h.textContent || "").slice(0, 40) };
	});
	console.log("VIEWPORT", vp.width, "SCROLL_Y", scrollY, "HEADLINE_RECT", JSON.stringify(rect));

	if (vp.width < 1024) {
		// Mobile: headline (which contains the price) must be fully inside the
		// visible viewport after the auto-scroll.
		expect(rect, "headline must render").not.toBeNull();
		expect(rect!.top, "headline top must be inside the viewport").toBeGreaterThanOrEqual(0);
		expect(rect!.bottom, "headline bottom must be inside the viewport").toBeLessThan(vp.height);
		expect(scrollY, "auto-scroll must have moved the page").toBeGreaterThan(0);
	} else {
		// Desktop: viewport must NOT move.
		expect(scrollY, "desktop viewport must stay at top").toBe(0);
	}

	await page.screenshot({ path: `playwright/.artifacts/pr224-fold-${vp.width}.png`, fullPage: false });
});
