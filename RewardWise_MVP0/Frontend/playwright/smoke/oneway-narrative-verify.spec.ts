/** @format */
// Live verify of the one-way narrative scope fix (e42bdb5) on the exact
// demo card: Tokyo→SEA Mar 23 2027 one-way business. Runs as the SMOKE user
// so the verdict REGENERATES with the new copy (the owner's L2-cached verdict
// still carries the old text for up to 24h). Also logs the winner's seat
// count for the backup-shortlist report.
import { test, expect } from "@playwright/test";

test("Mar 23 one-way narrative says one way, never round trip", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("Tokyo"); await a.nth(0).press("Enter");
	await a.nth(1).fill("SEA"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-23");
	await page.getByTestId("more-options-toggle").click();
	await page.getByRole("button", { name: /One Way/i }).click();
	await page.locator("select").nth(2).selectOption("business");
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	const v = body?.verdict ?? {};
	const exp = String(v.explanation ?? "");
	const opt = (body?.award_options ?? [])[0] ?? {};
	console.log("REC:", v.recommendation, "| explanation:", exp.slice(0, 160));
	console.log("WINNER seats:", opt.remaining_seats, "| program:", opt.program, "| points:", opt.points);
	expect(v.recommendation).toBe("use_points");
	expect(exp.toLowerCase()).not.toContain("round trip");
	expect(exp.toLowerCase()).not.toContain("outbound leg");
	expect(exp.toLowerCase()).toContain("one way");
	await page.waitForTimeout(6000);
	const text = (await page.locator("body").textContent()) ?? "";
	expect(text).not.toContain("for the round trip");
	await page.screenshot({ path: "playwright/.artifacts/oneway-narrative-1440.png", fullPage: true });
});
