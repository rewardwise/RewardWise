/** @format */
// Audit #6 LIVE VERIFY: wallet pill visible in the 375 header, prefix hidden.
import { test, expect } from "@playwright/test";

test("375 header shows the wallet chip, no horizontal overflow", async ({ page }) => {
	await page.goto("/home");
	await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
	const pill = page.getByTestId("nav-wallet-pill");
	await expect(pill, "pill visible at 375").toBeVisible();
	await expect(pill).toContainText(/\d+(k|M) /); // chip like "250k Amex"
	// textContent includes display:none nodes — assert computed visibility.
	await expect(pill.getByText("Your wallet"), "prefix hidden below sm").toBeHidden();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow, "no horizontal page overflow").toBeLessThanOrEqual(0);
	const box = await pill.boundingBox();
	console.log("PILL_BOX", JSON.stringify(box));
	expect(box && box.width, "pill actually laid out").toBeGreaterThan(40);
	console.log("ASSERTIONS_RAN: visibility, chip text, prefix hidden, overflow, box");
	await page.screenshot({ path: "playwright/.artifacts/pill-375-live.png" });
});
