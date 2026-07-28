/** @format */
// Live verify: on the SEA->Tokyo economy verdict, "search business" sets the
// form cabin and RE-RUNS the engine verdict (business result on the card,
// deterministic ack in chat, agent never prices). Spends up to 2 searches.
import { test, expect } from "@playwright/test";

test("search business re-runs the engine verdict", async ({ page }) => {
	test.setTimeout(420_000);
	await page.goto("/home");
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	const send = page.getByRole("button", { name: "Send message" });

	// Step 1: economy Tokyo verdict via Zoe (auto-run)
	const sp1 = page.waitForResponse((r) => r.url().includes("/api/search") && r.request().method() === "POST", { timeout: 180_000 });
	await input.fill("Seattle to Tokyo March 15 to 31 next year, one traveler");
	await send.click();
	const econ = await (await sp1).json();
	console.log("ECONOMY rec:", econ?.verdict?.recommendation, "cash:", econ?.cash_price, "cabin:", econ?.cabin);
	await page.waitForTimeout(6000);

	// Step 2: "search business" — must set cabin + re-run the ENGINE
	const sp2 = page.waitForResponse((r) => r.url().includes("/api/search") && r.url().includes("cabin=business"), { timeout: 180_000 });
	const zp = page.waitForResponse((r) => r.url().endsWith("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
	await input.fill("search business");
	await send.click();
	const ack = String((await (await zp).json())?.message ?? "");
	console.log("ACK >>>", ack, "<<<");
	expect(ack).toContain("running it now"); // deterministic ack — not agent prices
	expect(ack.match(/\$\s?\d|\d[\d,]{2,}\s*(points|pts|miles)/i), "ack price-free").toBeNull();

	const biz = await (await sp2).json();
	console.log("BUSINESS rec:", biz?.verdict?.recommendation, "cash:", biz?.cash_price);
	await page.waitForTimeout(8000);
	// The card's meta line carries the cabin (select lives behind More options)
	await expect(page.getByText("1 traveler, business").first()).toBeVisible({ timeout: 20_000 });
	expect(biz?.cash_price, "business cash differs from economy").not.toBe(econ?.cash_price);
	console.log("ASSERTIONS_RAN: ack deterministic+price-free, engine re-ran with cabin=business, card updated");
	await page.screenshot({ path: "playwright/.artifacts/cabin-rerun.png", fullPage: false });
});
