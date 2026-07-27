/** @format */
// Live click-through: pay_cash card must link to the CANONICAL Google Flights
// URL (tfs=), land on a prefilled round-trip search with both dates, never a
// carrier homepage. 1 engine search spend.
import { test, expect } from "@playwright/test";

test("pay_cash link lands on prefilled Google Flights", async ({ page, context }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	const a = page.locator('input[placeholder="City or airport"]');
	const d = page.locator('input[type="date"]');
	await a.nth(0).fill("SEA"); await a.nth(0).press("Enter");
	await a.nth(1).fill("Tokyo"); await a.nth(1).press("Enter");
	await d.nth(0).fill("2027-03-15");
	await d.nth(1).fill("2027-03-30");
	await page.getByTestId("more-options-toggle").click();
	await page.locator('input[type="number"], select').first().selectOption?.("2").catch(() => {});
	// travelers selector: find by label fallback
	const travSelect = page.locator("select").first();
	await travSelect.selectOption("2").catch(() => {});
	const rp = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await page.getByRole("button", { name: /Search Flights/ }).click();
	const body = await (await rp).json();
	console.log("REC", body?.verdict?.recommendation, "| cash", body?.cash_price, "| gf_url present:", Boolean(body?.cash_google_flights_url));
	await page.waitForTimeout(6000);

	const link = page.locator('a:has-text("Google Flights")').first();
	await expect(link, "GF-labeled link renders").toBeVisible({ timeout: 15_000 });
	const label = (await link.textContent())?.trim() ?? "";
	const href = (await link.getAttribute("href")) ?? "";
	console.log("LABEL >>>", label.slice(0, 80), "<<<");
	console.log("HREF >>>", href.slice(0, 140), "<<<");
	expect(href).toContain("google.com/travel/flights");
	expect(href).not.toContain("chinaairlines");
	expect(label).toContain("See this fare on Google Flights");
	expect(href).toContain("tfs=");

	// Click through — target=_blank opens a popup
	const [dest] = await Promise.all([context.waitForEvent("page", { timeout: 30_000 }), link.click()]);
	await dest.waitForLoadState("domcontentloaded");
	await dest.waitForTimeout(6000);
	console.log("DEST_URL", dest.url().slice(0, 120));
	const destText = (await dest.locator("body").textContent()) ?? "";
	const hasSEA = /Seattle|SEA/i.test(destText);
	const hasTokyo = /Tokyo|Narita|NRT/i.test(destText);
	// GF renders the range as "Mar 15 – 30, 2027" in body text and the full
	// dates inside input values/aria — accept either evidence.
	const inputVals = await dest.locator("input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).join(" | "));
	const hasDates =
		(/Mar(ch)? 15/i.test(destText) && (/Mar(ch)? 30/i.test(destText) || /15\s*[–-]\s*30/.test(destText))) ||
		(/Mar 15/i.test(inputVals) && /Mar 30/i.test(inputVals));
	const fare = destText.match(/\$[\d,]{3,}/g)?.slice(0, 5);
	console.log("DEST hasSEA:", hasSEA, "hasTokyo:", hasTokyo, "hasBothDates:", hasDates, "fares:", JSON.stringify(fare));
	await dest.screenshot({ path: "playwright/.artifacts/gf-destination.png", fullPage: false });
	expect(hasSEA && hasTokyo, "route prefilled on destination").toBe(true);
	expect(hasDates, "BOTH dates prefilled on destination").toBe(true);
	console.log("ASSERTIONS_RAN: label, canonical href, route+both-dates on destination");
});
