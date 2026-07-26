/** @format */
// THROWAWAY gap-fill audit spec — ONE live search (SEA→SFO points path),
// ownership-state check, how-to-book links (open ONE), From/To tabs, Zoe
// (ONE typed message + one chip + thumbs + mic). Run ONLY chromium-1440-auth.
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

test("gap1: points search + ownership + links + Zoe", async ({ page }) => {
	test.setTimeout(480_000);
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
	await page.waitForTimeout(1200);
	await shot(page, "audit-gap1-00-loading");
	const resp = await respPromise;
	console.log("SEARCH_STATUS", resp.status());
	const body = await resp.json().catch(() => ({}));
	console.log("VERDICT_JSON", JSON.stringify(body?.verdict ?? {}).slice(0, 2500));
	console.log(
		"OWNERSHIP_JSON",
		JSON.stringify({
			ownership: body?.verdict?.ownership ?? body?.ownership ?? null,
			wallet: body?.wallet ?? null,
		}).slice(0, 800)
	);
	await page.waitForTimeout(7000);
	await shot(page, "audit-gap1-01-verdict-viewport");
	await shot(page, "audit-gap1-02-verdict-full", true);

	// Headline / pill / why / trade lines
	const headline = await page
		.locator("h2, h1")
		.filter({ hasText: /Pay cash|Use points|Wait/i })
		.first()
		.textContent()
		.catch(() => null);
	console.log("HEADLINE", JSON.stringify(headline));
	const pill = page
		.locator("span, div")
		.filter({ hasText: /^(.{0,3})(High|Medium|Low) Confidence$/i })
		.last();
	const pillInfo = await pill
		.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { text: el.textContent, color: cs.color, bg: cs.backgroundColor, fontSize: cs.fontSize };
		})
		.catch(() => null);
	console.log("CONFIDENCE_PILL", JSON.stringify(pillInfo));
	const mainText = ((await page.locator("main").textContent().catch(() => "")) || "")
		.replace(/\s+/g, " ");
	console.log("CARD_TEXT", JSON.stringify(mainText.slice(0, 3000)));

	// ── OWNERSHIP b2/b3 hunt (checklist 5) ──
	const forkCount = await page.locator('[data-testid="ownership-fork"]').count();
	const testids = await page.evaluate(() =>
		Array.from(document.querySelectorAll("[data-testid]")).map((e) => e.getAttribute("data-testid"))
	);
	console.log("OWNERSHIP_FORK_COUNT", forkCount);
	console.log("ALL_TESTIDS", JSON.stringify(Array.from(new Set(testids))));
	const b2b3 = mainText.match(
		/(you have enough[^.]{0,80}|from your [\d,.]+k?[^.]{0,60}|you'?re short[^.]{0,80}|not enough points[^.]{0,80}|covers it[^.]{0,60})/i
	);
	console.log("B2B3_COPY_HUNT", JSON.stringify(b2b3?.[0] ?? null));

	// how-to-book: transfer notes + book links
	const bodyText = mainText;
	const transferMatches = bodyText.match(/TRANSFER TO/gi);
	console.log("TRANSFER_NOTE_OCCURRENCES", transferMatches?.length ?? 0);
	const bookOut = page.getByRole("link", { name: /book outbound/i }).or(page.getByRole("button", { name: /book outbound/i }));
	const bookRet = page.getByRole("link", { name: /book return/i }).or(page.getByRole("button", { name: /book return/i }));
	const outHref = await bookOut.first().getAttribute("href").catch(() => null);
	const retHref = await bookRet.first().getAttribute("href").catch(() => null);
	console.log("BOOK_LINKS", JSON.stringify({ outCount: await bookOut.count(), retCount: await bookRet.count(), outHref, retHref }));

	// Open ONE points booking link — retry the blank-popup finding
	try {
		await bookOut.first().scrollIntoViewIfNeeded();
		const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 20_000 }), bookOut.first().click()]);
		await popup.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
		await popup.waitForTimeout(15_000);
		console.log("BOOK_POPUP_URL", popup.url());
		const popTitle = await popup.title().catch(() => null);
		const popText = ((await popup.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("BOOK_POPUP_TITLE", JSON.stringify(popTitle), "TEXT_LEN", popText.length, "SNIP", JSON.stringify(popText.slice(0, 200)));
		await popup.screenshot({ path: `${ART}/audit-gap1-03-book-popup.png` }).catch(() => {});
		await popup.close();
	} catch (e) {
		console.log("BOOK_POPUP_FAIL", String(e).slice(0, 200));
	}

	// From/To tabs content
	try {
		const fromCard = await page.locator('[data-testid="flight-card-from"]').textContent().catch(() => null);
		console.log("FROM_TAB_CONTENT", JSON.stringify(fromCard?.replace(/\s+/g, " ").slice(0, 400)));
		const toTab = page.locator('[data-testid="flight-tab-to"]');
		await toTab.scrollIntoViewIfNeeded();
		await toTab.click({ timeout: 10_000 });
		await page.waitForTimeout(9000);
		const toCard = await page.locator('[data-testid="flight-card-to"]').textContent().catch(() => null);
		const unavailable = await page.locator('[data-testid="return-leg-unavailable"]').count();
		console.log("TO_TAB_CONTENT", JSON.stringify({ toCard: toCard?.replace(/\s+/g, " ").slice(0, 400), unavailable }));
		await shot(page, "audit-gap1-04-tab-to");
	} catch (e) {
		console.log("TABS_FAIL", String(e).slice(0, 200));
	}

	// overflow check on verdict page
	const o = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
	console.log("OVERFLOW verdict@1440", JSON.stringify(o), o.scrollW > o.innerW ? "HORIZ_OVERFLOW" : "ok");

	// ── ZOE ──
	try {
		const input = page.getByPlaceholder(/Tell Zoe about your trip/i);
		await input.scrollIntoViewIfNeeded();
		await shot(page, "audit-gap1-05-zoe-before");
		// suggestion chips
		const zoePane = page.locator('[data-testid="zoe-docked"]');
		const paneCount = await zoePane.count();
		const chipScope = paneCount ? zoePane : page;
		const chips = chipScope.locator("button").filter({ hasText: /\?$/ });
		const chipTexts = await chips.allTextContents().catch(() => []);
		console.log("ZOE_CHIPS", JSON.stringify(chipTexts.slice(0, 8)));
		let zoeApiCalls = 0;
		page.on("request", (r) => {
			if (r.url().includes("/api/zoe") && r.method() === "POST") zoeApiCalls++;
		});
		if (chipTexts.length) {
			await chips.first().click().catch(() => {});
			await page.waitForTimeout(9000);
			await shot(page, "audit-gap1-06-chip-reply");
			console.log("ZOE_API_CALLS_AFTER_CHIP", zoeApiCalls);
		}
		// ONE typed message
		await input.fill("What would this exact trip cost me in cash vs points, and which do you recommend?");
		const zoeResp = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", {
			timeout: 120_000,
		});
		await page.getByRole("button", { name: /send/i }).first().click().catch(async () => {
			await input.press("Enter");
		});
		const zr = await zoeResp;
		console.log("ZOE_STATUS", zr.status());
		const zbody = await zr.json().catch(() => ({}));
		console.log("ZOE_REPLY", JSON.stringify(JSON.stringify(zbody).slice(0, 1200)));
		await page.waitForTimeout(6000);
		await shot(page, "audit-gap1-07-zoe-reply");
		// links styled/clickable in pane
		const linkInfo = await page.evaluate(() => {
			const pane = document.querySelector('[data-testid="zoe-docked"]') || document.body;
			return Array.from(pane.querySelectorAll("a")).slice(0, 6).map((a) => ({
				text: (a.textContent || "").slice(0, 60),
				href: a.getAttribute("href"),
				color: getComputedStyle(a).color,
				underline: getComputedStyle(a).textDecorationLine,
			}));
		});
		console.log("ZOE_REPLY_LINKS", JSON.stringify(linkInfo));
		// thumbs
		const thumbs = await page
			.locator('button[aria-label*="helpful" i], button[aria-label*="thumb" i], svg.lucide-thumbs-up, svg.lucide-thumbs-down')
			.count()
			.catch(() => 0);
		console.log("THUMBS_COUNT_PAGEWIDE", thumbs);
		// mic — click once, observe
		const mic = page.locator('button[aria-label*="voice" i], button[aria-label*="mic" i]').first();
		const micVisible = await mic.isVisible().catch(() => false);
		console.log("MIC_PRESENT", micVisible);
		if (micVisible) {
			await mic.click().catch(() => {});
			await page.waitForTimeout(5000);
			await shot(page, "audit-gap1-08-after-mic");
			const bodyTail = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
			const errHint = bodyTail.match(/(microphone|voice|permission|denied|error|not available|listening|connecting)[^.]{0,100}/i);
			console.log("MIC_STATE_HINT", JSON.stringify(errHint?.[0] ?? null));
			const exitVoice = page.locator('button[aria-label*="exit voice" i], button[aria-label*="stop" i]').first();
			if (await exitVoice.isVisible().catch(() => false)) await exitVoice.click().catch(() => {});
		}
	} catch (e) {
		console.log("ZOE_FAIL", String(e).slice(0, 300));
		await shot(page, "audit-gap1-09-zoe-fail");
	}
	console.log("DONE_GAP1");
});
