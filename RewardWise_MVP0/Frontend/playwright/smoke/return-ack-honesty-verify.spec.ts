/** @format */
// Live verify of the ack-lie fix (#300), replaying the 2026-07-29 recording
// incident verbatim: a trip statement on the DEFAULT round-trip form must
// ASK for the return date (not claim "running it now"), fire no search, and
// a "one way" reply must convert the trip and auto-run it.
import { test, expect } from "@playwright/test";

test("RT-form fill asks for return date; 'one way' completes and runs", async ({ page }) => {
	test.setTimeout(420_000);
	const searches: string[] = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/search") && req.method() === "POST") searches.push(req.url());
	});

	await page.goto("/home");
	const zoe = page.getByPlaceholder("Tell Zoe about your trip…");
	await expect(zoe).toBeVisible({ timeout: 30_000 });

	// ── The incident message ─────────────────────────────────────────────────
	await zoe.fill("Tokyo to Sea, Mar 23, 1 traveler");
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	const ack = String((await (await zp).json())?.message ?? "");
	console.log("ACK:", ack);
	expect(ack.toLowerCase()).toContain("return date");
	expect(ack).not.toContain("running it now");
	await page.waitForTimeout(2500);
	expect(searches.length, "no search may fire on the incomplete fill").toBe(0);
	await page.screenshot({ path: "playwright/.artifacts/ack-1-asks-return.png" });

	// ── The natural reply ────────────────────────────────────────────────────
	const sp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 240_000 });
	await zoe.fill("one way");
	await page.getByRole("button", { name: "Send message" }).click();
	const body = await (await sp).json();
	console.log("SEARCH fired | rec:", body?.verdict?.recommendation, "| cash:", body?.cash_price);
	expect(searches.length, "'one way' converts the trip and runs").toBe(1);
	await page.waitForTimeout(6000);
	await page.screenshot({ path: "playwright/.artifacts/ack-2-oneway-runs.png", fullPage: false });
});
