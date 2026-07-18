/** @format */
// Phase 3 (LIVE PROD, logged in): interaction-level proof, not element presence.
// 1. Date picker: a CLICK on the WHEN/RETURN field must invoke showPicker()
//    (the native calendar opener) — spied via prototype wrap — and the field
//    must accept a selected value.
// 2. Verdict above the fold: after a search, the top of home-results must sit
//    inside the viewport (bounding box y < viewport height).
// 3. Confidence pill: the rendered pill must carry the light-legible tone
//    classes (-800 text on -100 fill), not the old melting -200 tints.

import { test, expect } from "@playwright/test";

test("phase3: picker opens on click, verdict above fold, pill legible", async ({ page }) => {
	test.setTimeout(300_000);

	// Spy on the native picker opener BEFORE any page script runs.
	await page.addInitScript(() => {
		(window as any).__pickerCalls = 0;
		const orig = HTMLInputElement.prototype.showPicker;
		HTMLInputElement.prototype.showPicker = function (...args: unknown[]) {
			(window as any).__pickerCalls += 1;
			try {
				return orig?.apply(this, args as []);
			} catch {
				/* headless may refuse to paint the native picker — the call is the property */
			}
		};
	});

	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	// ── 1. Search → verdict above the fold ─────────────────────────────────
	// (Picker-click spy runs LAST: a genuinely-opened native picker overlay
	// swallows subsequent keystrokes and breaks the airport selects.)
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
	await page.waitForTimeout(7000);

	const vp = page.viewportSize()!;
	const box = await page.getByTestId("home-results").boundingBox();
	console.log("VERDICT_TOP_Y", box?.y, "VIEWPORT_H", vp.height);
	expect(box, "home-results must render").not.toBeNull();
	// Scroll position is still at top after search — the verdict's top edge
	// must be INSIDE the first viewport to count as above the fold.
	const scrollY = await page.evaluate(() => window.scrollY);
	console.log("SCROLL_Y", scrollY);
	expect(
		box!.y - scrollY,
		`verdict top (${box!.y}) must be within the first viewport (${vp.height})`
	).toBeLessThan(vp.height);

	// ── 3. Confidence pill tones ───────────────────────────────────────────
	const pill = page.locator("span", { hasText: /confidence/i }).first();
	await expect(pill).toBeVisible();
	const cls = (await pill.getAttribute("class")) ?? "";
	console.log("PILL_CLASSES", cls);
	console.log("PILL_TEXT", await pill.textContent());
	expect(cls, "pill must use light-legible -800/-100 tones").toMatch(/-800/);
	expect(cls, "old melting -200 tints must be gone").not.toMatch(/text-(emerald|amber|slate)-200/);
	await pill.screenshot({ path: `playwright/.artifacts/phase3-pill-${vp.width}.png` });

	// Viewport-only screenshot = exactly what the user sees without scrolling.
	await page.screenshot({ path: `playwright/.artifacts/phase3-fold-${vp.width}.png`, fullPage: false });

	// ── 3. Date picker interaction (last — the opened picker eats keystrokes) ──
	await dateInputs.nth(0).scrollIntoViewIfNeeded();
	await dateInputs.nth(0).click(); // real user click on WHEN
	const callsAfterWhen = await page.evaluate(() => (window as any).__pickerCalls);
	await page.keyboard.press("Escape");
	await dateInputs.nth(1).click(); // RETURN
	const callsAfterReturn = await page.evaluate(() => (window as any).__pickerCalls);
	await page.keyboard.press("Escape");
	console.log("PICKER_CALLS when=", callsAfterWhen, "return=", callsAfterReturn);
	expect(callsAfterWhen, "clicking WHEN must invoke showPicker()").toBeGreaterThan(0);
	expect(callsAfterReturn, "clicking RETURN must invoke showPicker()").toBeGreaterThan(callsAfterWhen);
});
