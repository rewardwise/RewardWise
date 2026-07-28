/** @format */
// #9 supersede-guard live verify: two rapid trip messages -> latest wins,
// exactly one settled verdict (second route), progress completes, no stuck
// 98% bar. Spends 2 engine searches (first is aborted client-side).
import { test, expect } from "@playwright/test";

test("two rapid messages: latest wins, no stuck progress", async ({ page }) => {
	test.setTimeout(360_000);
	let searchReqs = 0;
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searchReqs += 1;
	});
	await page.goto("/home");
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	const send = page.getByRole("button", { name: "Send message" });

	await input.fill("Boise to Sacramento November 3 to 6, one traveler");
	await send.click();
	await page.waitForTimeout(4000); // first auto-run in flight
	await input.fill("Boise to Spokane November 3 to 6, one traveler");
	await send.click();

	// wait for the SECOND search to settle
	await page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.url().includes("GEG") && r.request().method() === "POST",
		{ timeout: 180_000 },
	);
	await page.waitForTimeout(8000);
	console.log("SEARCH_REQUESTS_FIRED:", searchReqs);

	// One settled verdict, for the SECOND route
	await expect(page.getByText("THE VERDICT")).toBeVisible({ timeout: 20_000 });
	const bodyText = (await page.locator("body").textContent()) ?? "";
	expect(bodyText).toContain("GEG");
	expect(searchReqs, "both searches fired (first aborted client-side)").toBe(2);
	// The heading contains a non-breaking space — count via the whitespace-
	// normalizing locator, not a raw-text regex.
	const verdictCount = await page.getByText("THE VERDICT").count();
	console.log("VERDICT_BLOCKS:", verdictCount, "| route GEG present:", bodyText.includes("GEG"));
	expect(verdictCount).toBe(1);
	// No stuck progress bar
	expect(bodyText).not.toContain("98%");
	expect(bodyText).not.toContain("Preparing verdict");
	// Search button back to idle (not stuck "Searching...")
	await expect(page.getByRole("button", { name: /Search Flights/ })).toBeVisible();
	console.log("ASSERTIONS_RAN: latest-wins verdict, no stuck bar, button idle");
	await page.screenshot({ path: "playwright/.artifacts/supersede-settled.png", fullPage: false });
});
