/** @format */
// Audit #7 part C: repro of what the audit saw — mic click headless,
// no fake device, no mic permission.
import { test, expect } from "@playwright/test";

test.use({ permissions: [] });

test("what the audit saw: mic click without a device/permission", async ({ page }) => {
		await page.goto("/home");
		const mic = page.getByRole("button", { name: /voice|mic/i }).first();
		await expect(mic).toBeVisible();
		await mic.click();
		await page.waitForTimeout(4000);
		const bodyText = (await page.locator("body").textContent()) || "";
		const erroredVisible = /⚠️/.test(bodyText);
		console.log("HEADLESS_REPRO error message visible:", erroredVisible);
		await page.screenshot({ path: "playwright/.artifacts/mic-diag-headless.png" });
	});

