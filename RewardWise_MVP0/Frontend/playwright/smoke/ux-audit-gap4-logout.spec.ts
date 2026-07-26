/** @format */
// THROWAWAY — logout retest with looser selector. No searches, no Zoe.
import { test, type Page } from "@playwright/test";
const ART = "playwright/.artifacts";

test("logout via profile row", async ({ page, viewport }) => {
	test.setTimeout(180_000);
	const w = viewport?.width ?? 0;
	await page.goto("/profile");
	await page.waitForTimeout(4000);
	const rows = await page.locator("button, a, [role='button']").filter({ hasText: /log ?out|sign ?out/i }).all();
	console.log("LOGOUT_CANDIDATES", rows.length);
	for (const r of rows.slice(0, 3)) console.log("CAND", JSON.stringify((await r.textContent())?.trim().slice(0, 60)));
	const target = page.locator("button, a, [role='button']").filter({ hasText: /log ?out|sign ?out/i }).first();
	if (await target.isVisible().catch(() => false)) {
		await target.click();
		await page.waitForTimeout(5000);
		console.log("LOGOUT_DEST", page.url());
		await page.screenshot({ path: `${ART}/audit-gap4-${w}-after-logout.png` });
		await page.goto("/home");
		await page.waitForTimeout(4000);
		console.log("POST_LOGOUT_HOME_DEST", page.url());
		await page.screenshot({ path: `${ART}/audit-gap4-${w}-home-bounce.png` });
	} else {
		console.log("LOGOUT_ROW_NOT_VISIBLE");
		await page.screenshot({ path: `${ART}/audit-gap4-${w}-profile.png`, fullPage: true });
	}
});
