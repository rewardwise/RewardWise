/** @format */
// Investigation A (LIVE PROD): what does the frontend actually send Zoe after a
// search? Capture the /api/zoe POST body for (1) typing directly into the pane
// (natural flow) and (2) after clicking the card's "Ask Zoe" button.

import { test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";

test("investigation A: zoe payload with and without Ask-Zoe click", async ({ page }) => {
	test.setTimeout(300_000);
	const payloads: any[] = [];
	page.on("request", (req) => {
		if (req.url().includes("/api/zoe") && req.method() === "POST") {
			try {
				payloads.push(JSON.parse(req.postData() || "{}"));
			} catch {
				payloads.push({ raw: req.postData() });
			}
		}
	});

	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	// Real search so the engine has a live verdict.
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
	const search = await (await respPromise).json();
	console.log("ENGINE_CASH", search.cash_price, "AWARD0", JSON.stringify((search.award_options || [])[0] ? { program: search.award_options[0].program, points: search.award_options[0].points, taxes: search.award_options[0].taxes } : null));
	await page.waitForTimeout(6000);

	// (1) Natural flow: type directly, no Ask-Zoe click.
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.scrollIntoViewIfNeeded();
	await input.fill("What would this trip cost me in points vs cash?");
	const z1 = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await z1;

	// (2) Click the card's Ask Zoe button, then send another message.
	const askZoe = page.getByRole("button", { name: /Ask Zoe/ }).last();
	await askZoe.scrollIntoViewIfNeeded();
	await askZoe.click({ force: true });
	await page.waitForTimeout(1500);
	await input.fill("Same question with the verdict attached please");
	const z2 = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await page.getByRole("button", { name: "Send message" }).click();
	await z2;

	mkdirSync("playwright/.artifacts", { recursive: true });
	writeFileSync("playwright/.artifacts/investigation-a-payloads.json", JSON.stringify(payloads, null, 2));
	payloads.forEach((p, i) => {
		console.log(`PAYLOAD_${i}_MESSAGE`, JSON.stringify(p.message).slice(0, 80));
		console.log(`PAYLOAD_${i}_VERDICT_CONTEXT`, JSON.stringify(p.verdict_context).slice(0, 500));
		console.log(`PAYLOAD_${i}_WALLET`, JSON.stringify(p.wallet).slice(0, 200));
	});
});
