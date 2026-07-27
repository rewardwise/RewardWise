/** @format */
import { test, expect } from "@playwright/test";
test("capture pay_cash booking href for SEA->NRT", async ({ page }) => {
	test.setTimeout(240_000);
	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("Tokyo"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-15");
	await d.nth(1).fill("2027-03-30");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	console.log("REC", body?.verdict?.recommendation, "| cash", body?.cash_price, "| airline", body?.flights?.[0]?.legs?.[0]?.airline);
	await page.waitForTimeout(6000);
	const link = page.locator('a:has-text("Visit ")').first();
	const visible = await link.isVisible().catch(() => false);
	if (visible) {
		console.log("LINK_TEXT >>>", (await link.textContent())?.trim(), "<<<");
		console.log("HREF >>>", await link.getAttribute("href"), "<<<");
	} else {
		console.log("NO 'Visit' link — dumping all booking-section anchors:");
		for (const el of await page.locator("a[target=_blank]").all()) {
			const t = ((await el.textContent()) || "").trim().slice(0, 50);
			if (t) console.log("  A:", t, "->", await el.getAttribute("href"));
		}
	}
	await page.screenshot({ path: "playwright/.artifacts/paycash-link.png", fullPage: false });
	expect(body?.verdict?.recommendation).toBe("pay_cash");
});
