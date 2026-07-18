/** @format */
// Phase-3 closeout: rendered proof of MEDIUM and LOW confidence pills on the
// light card, live prod. Medium comes from a real search (SEA->TYO Feb 2027
// reliably yields medium). Low has no reliable live trigger, so we clone the
// real pill in the live DOM and apply the shipped confidenceTone("low") class
// string — same stylesheet, same card background; labeled as simulated.

import { test, expect } from "@playwright/test";

test("pill states: real medium + simulated low on live light card", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	await page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

	const dateInputs = page.locator('input[type="date"]');
	await dateInputs.nth(0).fill("2027-02-12");
	await dateInputs.nth(1).fill("2027-02-15");
	const airportInputs = page.locator('input[placeholder="City or airport"]');
	await airportInputs.nth(0).fill("SEA");
	await airportInputs.nth(0).press("Enter");
	await airportInputs.nth(1).fill("TYO");
	await airportInputs.nth(1).press("Enter");

	const respPromise = page.waitForResponse(
		(r) => r.url().includes("/api/search") && r.request().method() === "POST",
		{ timeout: 180_000 }
	);
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await respPromise).json();
	console.log("CONFIDENCE_FROM_ENGINE", body?.verdict?.confidence);
	await page.waitForTimeout(6000);

	const pill = page.locator("span", { hasText: /confidence/i }).first();
	await expect(pill).toBeVisible();
	console.log("PILL_TEXT", (await pill.textContent())?.trim());
	console.log("PILL_CLASSES", await pill.getAttribute("class"));
	await pill.scrollIntoViewIfNeeded();
	await pill.screenshot({ path: "playwright/.artifacts/pill-state-live.png" });

	// Simulated LOW: clone the live pill, swap in the shipped low tones
	// (confidenceTone("low") = border-slate-300 bg-slate-200 text-slate-700,
	// dot bg-slate-500), render beside it on the same card, screenshot both.
	await page.evaluate(() => {
		const pills = Array.from(document.querySelectorAll("span")).filter((s) =>
			/confidence/i.test(s.textContent || "")
		);
		const real = pills[0];
		if (!real) return;
		const low = real.cloneNode(true) as HTMLElement;
		low.className = low.className
			.replace(/border-(emerald|amber)-300/, "border-slate-300")
			.replace(/bg-(emerald|amber)-100/, "bg-slate-200")
			.replace(/text-(emerald|amber)-800/, "text-slate-700");
		const dot = low.querySelector("span");
		if (dot) dot.className = dot.className.replace(/bg-(emerald|amber)-500/, "bg-slate-500");
		low.childNodes.forEach((n) => {
			if (n.nodeType === 3 && /confidence/i.test(n.textContent || ""))
				n.textContent = (n.textContent || "").replace(/high|medium/i, "low");
		});
		// also handle text inside nested spans/text
		if (!/low/i.test(low.textContent || "")) low.append(" (low)");
		low.setAttribute("data-testid", "pill-low-sim");
		real.parentElement?.appendChild(low);
	});
	const lowPill = page.getByTestId("pill-low-sim");
	await expect(lowPill).toBeVisible();
	console.log("LOW_SIM_CLASSES", await lowPill.getAttribute("class"));
	const container = page.locator("span", { hasText: /confidence/i }).first().locator("..");
	await container.screenshot({ path: "playwright/.artifacts/pill-states-pair.png" });
});
