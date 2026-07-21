/** @format */
// One-off read-only dump of the smoke user's live wallet (for README reconcile).
import { test } from "@playwright/test";

test("dump smoke wallet cards", async ({ page }) => {
	await page.goto("/wallet-setup");
	await page.waitForLoadState("networkidle").catch(() => {});
	const inputs = page.locator('[data-testid^="wallet-balance-input-"]');
	const n = await inputs.count();
	for (let i = 0; i < n; i++) {
		const val = await inputs.nth(i).inputValue();
		const card = inputs.nth(i).locator("xpath=ancestor::*[self::li or self::div][3]");
		const label = ((await card.textContent().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 120);
		console.log(`WALLET_CARD_${i}: value=${val} | ${label}`);
	}
	console.log("WALLET_CARD_COUNT", n);
	await page.screenshot({ path: "playwright/.artifacts/wallet-state.png", fullPage: true });
});
