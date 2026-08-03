/** @format */
// Throwaway measurement: what drives the empty-state dead space at 1440.
import { test, expect } from "@playwright/test";

test("measure empty-state boxes", async ({ page }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/home");
	await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
	await page.waitForTimeout(2000);
	const m = await page.evaluate(() => {
		const h = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().height) : null);
		const section = document.querySelector("section.relative.isolate");
		const main = section?.querySelector("main");
		const cols = main ? Array.from(main.children) : [];
		const zoePanel = document.querySelector(".zoe-light");
		const zoeMessages = zoePanel?.querySelector("[class*=overflow-y]");
		const form = document.querySelector('[data-testid="more-options"]')?.closest("div.mtw-light") ?? null;
		return {
			body: h(document.body),
			docScroll: Math.round(document.documentElement.scrollHeight),
			section: h(section),
			main: h(main),
			leftCol: h(cols[0] ?? null),
			rightColWrapper: h(cols[1] ?? null),
			zoePanel: h(zoePanel),
			zoeMessagesArea: h(zoeMessages ?? null),
			searchFormPill: h(form),
			footer: h(document.querySelector("footer")),
		};
	});
	console.log("MEASURE:", JSON.stringify(m, null, 1));
});
