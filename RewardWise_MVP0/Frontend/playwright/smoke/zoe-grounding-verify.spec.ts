/** @format */
// PR-A acceptance (LIVE PROD): on a typed turn with a verdict on screen, Zoe's
// cash + miles numbers must MATCH the engine's, not invented ones.

import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";

test("acceptance: Zoe's numbers match the verdict card", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});
	const d = page.locator('input[type="date"]');
	await d.nth(0).fill("2026-08-15");
	await d.nth(1).fill("2026-08-18");
	const a = page.locator('input[placeholder="City or airport"]');
	await a.nth(0).fill("SFO");
	await a.nth(0).press("Enter");
	await a.nth(1).fill("SEA");
	await a.nth(1).press("Enter");
	const searchResp = page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.request().method() === "POST",
		{ timeout: 180_000 }
	);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const engine = await (await searchResp).json();
	const cash = Math.round(engine.verdict?.metrics?.cash_price ?? engine.cash_price);
	const totalPts = engine.verdict?.metrics?.points_cost;
	console.log("ENGINE_CASH", cash, "ENGINE_TOTAL_PTS", totalPts);
	await page.waitForTimeout(6000);

	// The natural flow: TYPE the question (no Ask-Zoe click).
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("What would this trip cost me in points vs cash?");
	const zoeRespP = page.waitForResponse(
		(r) => r.url().includes("/api/zoe") && r.request().method() === "POST",
		{ timeout: 120_000 }
	);
	// Also capture what we SENT (context must be attached now).
	let sentContext: string | null = null;
	page.on("request", (req) => {
		if (req.url().includes("/api/zoe") && req.method() === "POST") {
			try {
				sentContext = JSON.parse(req.postData() || "{}").verdict_context ?? null;
			} catch {}
		}
	});
	await page.getByRole("button", { name: "Send message" }).click();
	const reply = (await (await zoeRespP).json()).message ?? "";

	mkdirSync("playwright/.artifacts", { recursive: true });
	writeFileSync("playwright/.artifacts/zoe-grounding-reply.txt", `SENT CONTEXT:\n${sentContext}\n\nREPLY:\n${reply}`);
	console.log("CONTEXT_ATTACHED", sentContext != null);
	console.log("REPLY_VERBATIM_START");
	console.log(reply.slice(0, 900));
	console.log("REPLY_VERBATIM_END");

	// Acceptance: the reply references the ENGINE's cash figure (with or
	// without $ / comma formatting) and does not claim pricing is unavailable.
	const cashPattern = new RegExp(`\\$?\\s?${cash.toLocaleString()}|\\$?\\s?${cash}`);
	expect(reply, `reply must cite the engine cash figure ${cash}`).toMatch(cashPattern);
	expect(reply.toLowerCase()).not.toContain("not available");
	expect(reply.toLowerCase()).not.toContain("aren't available");

	await page.waitForTimeout(2500);
	await page.screenshot({ path: "playwright/.artifacts/zoe-grounding-verified.png", fullPage: false });
});
