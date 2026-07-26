/** @format */
// THROWAWAY gap-fill audit spec — Zoe checks. Tries History→Review first to
// restore a verdict without a live search; falls back to ONE live search
// (the 4th and final of the audit budget). NO popup opens (they crash chromium).
import { test, type Page } from "@playwright/test";

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

test("gap3: verdict via history review (or 1 search) + tabs + Zoe", async ({ page }) => {
	test.setTimeout(480_000);
	let searchPosts = 0;
	page.on("request", (r) => {
		if (/\/api\/search(\?|$)/.test(r.url()) && r.method() === "POST") searchPosts++;
	});

	// ── Attempt: History → Review ──
	await page.goto("/history");
	await killAnim(page);
	await page.waitForTimeout(4000);
	const review = page.getByRole("button", { name: /^Review$/i }).or(page.getByRole("link", { name: /^Review$/i })).first();
	let restored = false;
	if (await review.isVisible().catch(() => false)) {
		await review.click().catch(() => {});
		await page.waitForTimeout(12_000);
		const headline = await page
			.locator("h1, h2")
			.filter({ hasText: /Pay cash|Use points|Wait/i })
			.first()
			.isVisible()
			.catch(() => false);
		console.log("REVIEW_RESTORED_VERDICT", headline, "URL", page.url(), "SEARCH_POSTS_SO_FAR", searchPosts);
		restored = headline;
		await shot(page, "audit-gap3-01-review-restore", true);
	} else {
		console.log("REVIEW_BUTTON_NOT_FOUND");
	}

	// ── Fallback: one live search ──
	if (!restored) {
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(3000);
		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).fill("SEA");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("SFO");
		await airports.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill("2026-11-25");
		await dates.nth(1).fill("2026-11-29");
		const respPromise = page.waitForResponse(
			(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 300_000 }
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		const resp = await respPromise;
		console.log("FALLBACK_SEARCH_STATUS", resp.status());
		await page.waitForTimeout(8000);
	}
	console.log("TOTAL_SEARCH_POSTS", searchPosts);

	// ── From/To tabs (no popups) ──
	try {
		const outCard = await page.locator('[data-testid="flight-card-outbound"]').textContent().catch(() => null);
		console.log("FROM_TAB_CONTENT", JSON.stringify(outCard?.replace(/\s+/g, " ").slice(0, 400)));
		const toTab = page.locator('[data-testid="flight-tab-to"]');
		await toTab.scrollIntoViewIfNeeded();
		await toTab.click({ timeout: 10_000 });
		await page.waitForTimeout(9000);
		const testids = await page.evaluate(() =>
			Array.from(new Set(Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"))))
		);
		console.log("TESTIDS_AFTER_TO_TAB", JSON.stringify(testids));
		const toCard = await page
			.locator('[data-testid="flight-card-return"], [data-testid="flight-card-to"], [data-testid="flight-card-outbound"]')
			.first()
			.textContent()
			.catch(() => null);
		const unavailable = await page.locator('[data-testid="return-leg-unavailable"]').count();
		console.log("TO_TAB_CONTENT", JSON.stringify({ toCard: toCard?.replace(/\s+/g, " ").slice(0, 400), unavailable }));
		await shot(page, "audit-gap3-02-tab-to");
	} catch (e) {
		console.log("TABS_FAIL", String(e).slice(0, 200));
	}

	// overflow on verdict page
	const o = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth })).catch(() => null);
	console.log("OVERFLOW verdict@1440", JSON.stringify(o));

	// ── ZOE ──
	const zoePane = page.locator('[data-testid="zoe-docked"]');
	console.log("ZOE_PANE_COUNT", await zoePane.count());
	const chips = page.locator('[data-testid^="zoe-chip-"]');
	const chipTexts = await chips.allTextContents().catch(() => []);
	console.log("ZOE_CHIPS", JSON.stringify(chipTexts));
	let zoeApiCalls = 0;
	page.on("request", (r) => {
		if (r.url().includes("/api/zoe") && r.method() === "POST") zoeApiCalls++;
	});
	// chip click (1 potential Zoe message)
	if (chipTexts.length) {
		await chips.first().click().catch(() => {});
		await page.waitForTimeout(10_000);
		console.log("ZOE_API_CALLS_AFTER_CHIP", zoeApiCalls);
		const paneText = ((await zoePane.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("ZOE_PANE_AFTER_CHIP", JSON.stringify(paneText.slice(-700)));
		await shot(page, "audit-gap3-03-chip-reply");
	}
	// ONE typed message
	try {
		const input = page.getByPlaceholder(/Tell Zoe about your trip/i);
		await input.scrollIntoViewIfNeeded();
		await input.fill("What would this exact trip cost me in cash vs points, and which do you recommend?");
		const zoeResp = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", {
			timeout: 120_000,
		});
		await page.locator('button[aria-label*="send" i]').first().click().catch(async () => {
			await input.press("Enter");
		});
		const zr = await zoeResp;
		console.log("ZOE_STATUS", zr.status());
		const zbody = await zr.text().catch(() => "");
		console.log("ZOE_REPLY_RAW", JSON.stringify(zbody.slice(0, 1400)));
		await page.waitForTimeout(6000);
		await shot(page, "audit-gap3-04-zoe-reply");
		const linkInfo = await page.evaluate(() => {
			const pane = document.querySelector('[data-testid="zoe-docked"]') || document.body;
			return Array.from(pane.querySelectorAll("a")).slice(0, 6).map((a) => ({
				text: (a.textContent || "").slice(0, 60),
				href: (a.getAttribute("href") || "").slice(0, 100),
				color: getComputedStyle(a).color,
				underline: getComputedStyle(a).textDecorationLine,
			}));
		});
		console.log("ZOE_REPLY_LINKS", JSON.stringify(linkInfo));
		const thumbsInfo = await page.evaluate(() => {
			const pane = document.querySelector('[data-testid="zoe-docked"]') || document.body;
			const btns = Array.from(pane.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") || b.textContent?.trim() || "");
			return btns.filter(Boolean).slice(0, 20);
		});
		console.log("ZOE_PANE_BUTTONS", JSON.stringify(thumbsInfo));
		const pageThumbs = await page.locator('button:has(svg.lucide-thumbs-up), button:has(svg.lucide-thumbs-down), button[aria-label*="thumb" i]').count();
		console.log("THUMBS_BUTTON_COUNT", pageThumbs);
	} catch (e) {
		console.log("ZOE_TYPED_FAIL", String(e).slice(0, 250));
		await shot(page, "audit-gap3-09-zoe-fail");
	}
	// mic — click once, observe, report
	try {
		const mic = page.locator('button[aria-label*="voice" i], button[aria-label*="mic" i]').first();
		const micVisible = await mic.isVisible().catch(() => false);
		console.log("MIC_PRESENT", micVisible, JSON.stringify(await mic.getAttribute("aria-label").catch(() => null)));
		if (micVisible) {
			await mic.click().catch(() => {});
			await page.waitForTimeout(6000);
			await shot(page, "audit-gap3-05-after-mic");
			const bodyTail = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
			const errHint = bodyTail.match(/(microphone|voice|permission|denied|error|unavailable|listening|connecting)[^.]{0,100}/i);
			console.log("MIC_STATE_HINT", JSON.stringify(errHint?.[0] ?? null));
			const exitVoice = page.locator('button[aria-label*="exit" i], button[aria-label*="stop" i]').first();
			if (await exitVoice.isVisible().catch(() => false)) await exitVoice.click().catch(() => {});
		}
	} catch (e) {
		console.log("MIC_FAIL", String(e).slice(0, 200));
	}
	console.log("FINAL_ZOE_API_CALLS", zoeApiCalls, "FINAL_SEARCH_POSTS", searchPosts);
	console.log("DONE_GAP3");
});
