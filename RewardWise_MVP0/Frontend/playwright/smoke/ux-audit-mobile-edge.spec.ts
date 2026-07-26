/** @format */
// THROWAWAY audit spec — ONE mobile live search (SEA→SFO) for layout, and
// ONE edge-case search (BOI→GEG near-term) on whichever project runs it first.
// BUDGET: mobile project fires SEA→SFO; desktop project fires BOI→GEG.
import { test, expect, type Page } from "@playwright/test";

const ART = "playwright/.artifacts";
const killAnim = (page: Page) =>
	page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

async function shot(page: Page, name: string, fullPage = false) {
	try {
		await page.screenshot({ path: `${ART}/${name}.png`, fullPage });
		console.log("SHOT", name);
	} catch (e) {
		console.log("SHOT_FAIL", name, String(e).slice(0, 120));
	}
}

async function overflowCheck(page: Page, label: string) {
	const o = await page.evaluate(() => ({
		scrollW: document.documentElement.scrollWidth,
		innerW: window.innerWidth,
	}));
	console.log("OVERFLOW", label, JSON.stringify(o), o.scrollW > o.innerW ? "HORIZ_OVERFLOW" : "ok");
}

function isoDaysFromToday(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().split("T")[0];
}

test.describe("mobile verdict layout (375)", () => {
	test.skip(({ viewport }) => !viewport || viewport.width >= 1024, "mobile only");

	test("SEARCH C (mobile): SEA→SFO Nov 25-29 layout + overflow + ownership", async ({ page }) => {
		test.setTimeout(480_000);
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(3000);
		await shot(page, "audit-m-01-home");
		await overflowCheck(page, "m-home");

		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).fill("SEA");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("SFO");
		await airports.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill("2026-11-25");
		await dates.nth(1).fill("2026-11-29");
		await shot(page, "audit-m-02-form-filled");

		const respPromise = page.waitForResponse(
			(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 240_000 }
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		await page.waitForTimeout(1500);
		await shot(page, "audit-m-03-loading");
		const resp = await respPromise;
		console.log("SEARCH_C_STATUS", resp.status());
		const body = await resp.json().catch(() => ({}));
		console.log("SEARCH_C_VERDICT_JSON", JSON.stringify(body?.verdict ?? {}).slice(0, 1200));
		await page.waitForTimeout(9000);
		await shot(page, "audit-m-04-verdict-viewport");
		await shot(page, "audit-m-05-verdict-full", true);
		await overflowCheck(page, "m-verdict");

		const headline = await page.locator("h2").filter({ hasText: /Pay cash|Use points|Wait/i }).first().textContent().catch(() => null);
		console.log("C_HEADLINE", JSON.stringify(headline));
		console.log("C_OWNERSHIP_FORK_COUNT", await page.locator('[data-testid="ownership-fork"]').count());
		console.log("C_HOW_TO_BOOK_COUNT", await page.locator('[data-testid="how-to-book"]').count());

		// tabs on mobile
		try {
			const toTab = page.locator('[data-testid="flight-tab-to"]');
			await toTab.scrollIntoViewIfNeeded();
			await toTab.click({ timeout: 10_000 });
			await page.waitForTimeout(7000);
			await shot(page, "audit-m-06-tab-to");
			await overflowCheck(page, "m-tab-to");
		} catch (e) {
			console.log("C_TABS_FAIL", String(e).slice(0, 200));
		}

		// Zoe entry point on mobile (FAB) — do NOT send a message
		const fab = page.locator('button[aria-label="Open Zoe"]');
		const fabVisible = await fab.isVisible().catch(() => false);
		console.log("M_ZOE_FAB_PRESENT", fabVisible);
		if (fabVisible) {
			await fab.click({ force: true }).catch(() => {});
			await page.waitForTimeout(2000);
			await shot(page, "audit-m-07-zoe-open");
			await overflowCheck(page, "m-zoe");
		}
		expect(resp.status()).toBeLessThan(500);
	});
});

test.describe("edge case (desktop)", () => {
	test.skip(({ viewport }) => !viewport || viewport.width < 1024, "desktop only");

	test("SEARCH D: BOI→GEG near-term — empty/error state quality", async ({ page }) => {
		test.setTimeout(480_000);
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(3000);

		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).fill("BOI");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("GEG");
		await airports.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill(isoDaysFromToday(8));
		await dates.nth(1).fill(isoDaysFromToday(11));

		const respPromise = page.waitForResponse(
			(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 240_000 }
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		const resp = await respPromise;
		console.log("SEARCH_D_STATUS", resp.status());
		const body = await resp.json().catch(() => ({}));
		console.log("SEARCH_D_BODY", JSON.stringify(body).slice(0, 1500));
		await page.waitForTimeout(8000);
		await shot(page, "audit-edge-01-result-viewport");
		await shot(page, "audit-edge-02-result-full", true);
		const mainText = ((await page.locator("main").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("D_MAIN_TEXT", JSON.stringify(mainText.slice(0, 1500)));
		console.log("D_PARTIAL_CARD", await page.locator('[data-testid="partial-data-card"]').count());

		// To-tab lazy fetch (retry of interrupted Search A check)
		try {
			const toTab = page.locator('[data-testid="flight-tab-to"]');
			if (await toTab.isVisible().catch(() => false)) {
				await toTab.scrollIntoViewIfNeeded();
				await toTab.click({ timeout: 10_000 });
				await page.waitForTimeout(10_000);
				const cards = await page.locator('[data-testid^="flight-card-"]').allTextContents().catch(() => []);
				const unavailable = await page.locator('[data-testid="return-leg-unavailable"]').count();
				console.log("D_TO_TAB", JSON.stringify({ cards: cards.map((c) => c.replace(/\s+/g, " ").slice(0, 250)), unavailable }));
				await shot(page, "audit-edge-03-tab-to");
			} else {
				console.log("D_TO_TAB_ABSENT");
			}
		} catch (e) {
			console.log("D_TABS_FAIL", String(e).slice(0, 200));
		}

		// Cash deep link (retry of interrupted Search A check)
		try {
			const link = page.locator("main a[target=_blank], main a[href^=http]").first();
			const href = await link.getAttribute("href").catch(() => null);
			const text = await link.textContent().catch(() => null);
			console.log("D_DEEPLINK", JSON.stringify({ text: text?.trim(), href }));
			if (href) {
				const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 15_000 }), link.click()]);
				await popup.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => {});
				await popup.waitForTimeout(7000);
				console.log("D_DEEPLINK_URL", popup.url());
				await popup.screenshot({ path: `${ART}/audit-edge-04-deeplink.png` }).catch(() => {});
				await popup.close().catch(() => {});
			}
		} catch (e) {
			console.log("D_DEEPLINK_FAIL", String(e).slice(0, 200));
		}

		// ── ZOE (the ONE typed message of the audit) ──
		try {
			const input = page.getByPlaceholder("Tell Zoe about your trip…");
			await input.scrollIntoViewIfNeeded();
			const chips = page.locator('[data-testid^="zoe-chip-"]');
			const chipTexts = await chips.allTextContents().catch(() => []);
			console.log("ZOE_CHIPS", JSON.stringify(chipTexts));
			await shot(page, "audit-zoe-01-before");
			if (chipTexts.length) {
				await chips.first().click().catch(() => {});
				await page.waitForTimeout(2000);
				await shot(page, "audit-zoe-02-chip-reply");
				const paneAfterChip = ((await page.locator('[data-testid="zoe-docked"]').textContent().catch(() => "")) || "").replace(/\s+/g, " ");
				console.log("ZOE_CHIP_REPLY_TAIL", JSON.stringify(paneAfterChip.slice(-400)));
			}
			await input.fill("What would this trip cost me in total if I pay cash, and how does that compare to using points?");
			const zoeResp = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
			await page.getByRole("button", { name: "Send message" }).click();
			const zr = await zoeResp;
			const zbody = await zr.json().catch(() => ({}));
			console.log("ZOE_STATUS", zr.status());
			console.log("ZOE_REPLY", JSON.stringify((zbody?.message ?? "").toString().slice(0, 900)));
			await page.waitForTimeout(6000);
			await shot(page, "audit-zoe-03-reply");
			console.log("ZOE_REPLY_LINK_COUNT", await page.locator('[data-testid="zoe-docked"] a').count().catch(() => 0));
			const thumbs = await page
				.locator('[data-testid="zoe-docked"] button:has(svg.lucide-thumbs-up), [data-testid="zoe-docked"] button:has(svg.lucide-thumbs-down)')
				.count()
				.catch(() => 0);
			console.log("ZOE_THUMBS_COUNT", thumbs);
			const mic = page.locator('button[aria-label="Start voice conversation"]').first();
			const micVisible = await mic.isVisible().catch(() => false);
			console.log("ZOE_MIC_PRESENT", micVisible);
			if (micVisible) {
				await mic.click().catch(() => {});
				await page.waitForTimeout(4000);
				await shot(page, "audit-zoe-05-after-mic");
				const paneText = ((await page.locator('[data-testid="zoe-docked"]').textContent().catch(() => "")) || "").replace(/\s+/g, " ");
				console.log("ZOE_AFTER_MIC_TEXT", JSON.stringify(paneText.slice(-500)));
				const exitVoice = page.locator('button[aria-label="Exit voice mode"]').first();
				if (await exitVoice.isVisible().catch(() => false)) {
					console.log("ZOE_VOICE_MODE_STARTED", true);
					await exitVoice.click().catch(() => {});
				}
			}
		} catch (e) {
			console.log("ZOE_FAIL", String(e).slice(0, 250));
			await shot(page, "audit-zoe-99-fail");
		}
		expect(true).toBe(true);
	});
});
