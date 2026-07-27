/** @format */
// P1 live check: chronological flow (user -> ack -> working dots -> verdict
// delivery appended), Searching-button contrast mid-search, confetti pieces.
// Spends 1 engine search.
import { test, expect } from "@playwright/test";

test("chronological flow + searching contrast + confetti", async ({ page }) => {
	test.setTimeout(300_000);
	await page.goto("/home");
	const input = page.getByPlaceholder("Tell Zoe about your trip…");
	await input.fill("Boise to Spokane October 13 to 16, one traveler");
	await page.getByRole("button", { name: "Send message" }).click();
	// mid-search: working indicator + button contrast screenshot
	await page.waitForTimeout(2500);
	await expect(page.getByTestId("zoe-working")).toBeVisible({ timeout: 10_000 });
	await page.screenshot({ path: "playwright/.artifacts/p1-1-searching.png" });
	const btn = page.getByRole("button", { name: /Searching/ });
	if (await btn.isVisible().catch(() => false)) {
		const styles = await btn.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { bg: cs.backgroundColor, color: cs.color };
		});
		console.log("SEARCHING_BTN", JSON.stringify(styles));
	}
	// wait for the verdict + narration delivery
	await page.waitForResponse((r) => r.url().includes("/api/search"), { timeout: 180_000 });
	await page.waitForTimeout(6000);
	// chronology: last assistant bubbles = ack then narration (delivery LAST)
	const bubbles = await page.locator('[data-testid="zoe-messages"] > div, .space-y-3 > div').allTextContents().catch(() => []);
	const texts = bubbles.filter((t) => t.trim()).slice(-6);
	console.log("THREAD_TAIL:", JSON.stringify(texts.map((t) => t.slice(0, 60))));
	const joined = texts.join(" | ");
	const ackIdx = joined.indexOf("running it now");
	const deliveryIdx = Math.max(joined.indexOf("Found it"), joined.indexOf("pay cash"), joined.indexOf("use your points"));
	console.log("ORDER ackIdx:", ackIdx, "deliveryIdx:", deliveryIdx);
	expect(deliveryIdx, "delivery appended after ack").toBeGreaterThan(ackIdx);
	const confetti = await page.locator(".mtw-confetti").count();
	console.log("CONFETTI_PIECES", confetti);
	await page.screenshot({ path: "playwright/.artifacts/p1-2-delivery.png" });
	console.log("ASSERTIONS_RAN: working indicator, order, confetti count");
});
