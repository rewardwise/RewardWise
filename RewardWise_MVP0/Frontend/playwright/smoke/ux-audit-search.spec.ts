/** @format */
// THROWAWAY audit spec — desktop search form + 2 live searches + Zoe.
// BUDGET: exactly TWO /api/search POSTs and ONE typed /api/zoe message.
// Run ONLY with --project=chromium-1440-auth.
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

test.describe("desktop search + verdict audit", () => {
	test.skip(({ viewport }) => !viewport || viewport.width < 1024, "desktop only");

	test("form interactions + validation (NO live search)", async ({ page }) => {
		test.setTimeout(240_000);
		let searchFired = 0;
		page.on("request", (r) => {
			if (/\/api\/(public-)?search/.test(r.url()) && r.method() === "POST") searchFired++;
		});
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(3000);
		await shot(page, "audit-form-01-initial");

		// Empty submit → validation not crash, and NO api call
		const searchBtn = page.getByRole("button", { name: /Search Flights/i });
		await searchBtn.click().catch(() => {});
		await page.waitForTimeout(2000);
		await shot(page, "audit-form-02-empty-submit");
		const bodySnip = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		const errMsg = bodySnip.match(/(please|required|select|enter|choose)[^.!]{5,80}/i);
		console.log("EMPTY_SUBMIT", JSON.stringify({ searchFired, errHint: errMsg?.[0] ?? null }));

		// Autocomplete: type partial, expect dropdown, select an option
		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).click();
		await airports.nth(0).pressSequentially("Phoe", { delay: 80 });
		await page.waitForTimeout(2500);
		await shot(page, "audit-form-03-autocomplete-open");
		const options = page.locator('[role="option"], [role="listbox"] li, ul li button');
		const optCount = await options.count().catch(() => 0);
		const firstOpt = optCount ? await options.first().textContent().catch(() => null) : null;
		console.log("AUTOCOMPLETE", JSON.stringify({ optCount, firstOpt: firstOpt?.slice(0, 80) }));
		if (optCount > 0) {
			await options.first().click().catch(() => {});
		} else {
			await airports.nth(0).press("Enter");
		}
		await page.waitForTimeout(600);
		const fromVal = await airports.nth(0).inputValue().catch(() => "");
		console.log("FROM_VALUE_AFTER_SELECT", JSON.stringify(fromVal));

		await airports.nth(1).fill("SMF");
		await airports.nth(1).press("Enter");
		await page.waitForTimeout(600);

		// Swap button
		const swap = page.locator('button[aria-label*="swap" i], [data-testid*="swap"]').first();
		const swapVisible = await swap.isVisible().catch(() => false);
		console.log("SWAP_PRESENT", swapVisible);
		if (swapVisible) {
			const beforeFrom = await airports.nth(0).inputValue();
			const beforeTo = await airports.nth(1).inputValue();
			await swap.click();
			await page.waitForTimeout(600);
			const afterFrom = await airports.nth(0).inputValue();
			const afterTo = await airports.nth(1).inputValue();
			console.log("SWAP_RESULT", JSON.stringify({ beforeFrom, beforeTo, afterFrom, afterTo }));
			await swap.click(); // swap back
			await page.waitForTimeout(400);
		}

		// Dates
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill("2026-10-06");
		await dates.nth(1).fill("2026-10-09");
		const d0 = await dates.nth(0).inputValue();
		const d1 = await dates.nth(1).inputValue();
		console.log("DATES", JSON.stringify({ d0, d1 }));

		// One-way vs round-trip toggle
		const owToggle = page.getByText(/one.?way/i).first();
		const owVisible = await owToggle.isVisible().catch(() => false);
		console.log("ONEWAY_TOGGLE_PRESENT", owVisible);
		if (owVisible) {
			await owToggle.click().catch(() => {});
			await page.waitForTimeout(700);
			const dateCount = await page.locator('input[type="date"]:visible').count();
			await shot(page, "audit-form-04-oneway");
			console.log("ONEWAY_DATE_INPUTS_VISIBLE", dateCount);
			// back to round trip
			const rt = page.getByText(/round.?trip/i).first();
			await rt.click().catch(() => {});
			await page.waitForTimeout(700);
			await page.locator('input[type="date"]').nth(1).fill("2026-10-09").catch(() => {});
		}

		// More options: travelers / cabin
		const more = page.getByText(/more options|advanced|filters/i).first();
		const moreVisible = await more.isVisible().catch(() => false);
		console.log("MORE_OPTIONS_PRESENT", moreVisible);
		if (moreVisible) await more.click().catch(() => {});
		await page.waitForTimeout(800);
		const selects = page.getByRole("combobox");
		const selCount = await selects.count();
		const selInfo: string[] = [];
		for (let i = 0; i < Math.min(selCount, 5); i++) {
			const opts = await selects.nth(i).locator("option").allTextContents().catch(() => []);
			selInfo.push(opts.slice(0, 8).join("/"));
		}
		console.log("SELECTS", selCount, JSON.stringify(selInfo));
		await shot(page, "audit-form-05-more-options");
		// exercise them without searching
		if (selCount >= 3) {
			await selects.first().selectOption("2").catch(() => {});
			await selects.nth(2).selectOption({ index: 1 }).catch(() => {});
			await page.waitForTimeout(400);
			await selects.first().selectOption("1").catch(() => {});
		}

		// Same origin/destination validation
		await airports.nth(0).fill("PHX");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("PHX");
		await airports.nth(1).press("Enter");
		await page.waitForTimeout(500);
		await searchBtn.click().catch(() => {});
		await page.waitForTimeout(2500);
		const sameBody = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		const sameErr = sameBody.match(/(same|different|origin|destination)[^.!]{5,90}/i);
		console.log("SAME_OD_SUBMIT", JSON.stringify({ searchFired, errHint: sameErr?.[0] ?? null }));
		await shot(page, "audit-form-06-same-od");
		expect(searchFired, "form interaction test must not fire live searches").toBe(0);
	});

	test("SEARCH A: PHX→SMF Oct 6-9 (expect pay_cash) + tabs + cash deeplink + Zoe", async ({ page }) => {
		test.setTimeout(480_000);
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(3000);

		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).fill("PHX");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("SMF");
		await airports.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill("2026-10-06");
		await dates.nth(1).fill("2026-10-09");

		const respPromise = page.waitForResponse(
			(r) => /\/api\/search(\?|$)/.test(r.url()) && r.request().method() === "POST",
			{ timeout: 240_000 }
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		await page.waitForTimeout(1500);
		await shot(page, "audit-srchA-01-loading");
		const resp = await respPromise;
		console.log("SEARCH_A_STATUS", resp.status());
		const body = await resp.json().catch(() => ({}));
		console.log("SEARCH_A_VERDICT_JSON", JSON.stringify(body?.verdict ?? {}).slice(0, 1500));
		await page.waitForTimeout(7000);
		await shot(page, "audit-srchA-02-verdict-viewport");
		await shot(page, "audit-srchA-03-verdict-full", true);

		// Headline / confidence / why / trade / flight lines
		const headline = await page.locator("h2").filter({ hasText: /Pay cash|Use points|Wait/i }).first().textContent().catch(() => null);
		console.log("A_HEADLINE", JSON.stringify(headline));
		const pill = page.locator("span.rounded-full").filter({ hasText: /high|medium|low/i }).first();
		const pillInfo = await pill.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { text: el.textContent, color: cs.color, bg: cs.backgroundColor, fontSize: cs.fontSize };
		}).catch(() => null);
		console.log("A_CONFIDENCE_PILL", JSON.stringify(pillInfo));
		const cardText = ((await page.locator("main").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("A_CARD_TEXT", JSON.stringify(cardText.slice(0, 2200)));

		// Ownership fork should NOT be needed on cash path but log presence
		console.log("A_OWNERSHIP_FORK_COUNT", await page.locator('[data-testid="ownership-fork"]').count());
		console.log("A_HOW_TO_BOOK_COUNT", await page.locator('[data-testid="how-to-book"]').count());

		// From/To tabs — To lazy-fetches on cash path
		try {
			const toTab = page.locator('[data-testid="flight-tab-to"]');
			console.log("A_TO_TAB_COUNT", await toTab.count());
			await toTab.scrollIntoViewIfNeeded();
			await shot(page, "audit-srchA-04-tab-from");
			await toTab.click({ timeout: 10_000 });
			await page.waitForTimeout(9000); // lazy fetch
			await shot(page, "audit-srchA-05-tab-to");
			const toCard = await page.locator('[data-testid="flight-card-to"]').textContent().catch(() => null);
			const unavailable = await page.locator('[data-testid="return-leg-unavailable"]').count();
			console.log("A_TO_TAB_CONTENT", JSON.stringify({ toCard: toCard?.replace(/\s+/g, " ").slice(0, 400), unavailable }));
			await page.locator('[data-testid="flight-tab-from"]').click({ timeout: 10_000 }).catch(() => {});
			await page.waitForTimeout(1000);
		} catch (e) {
			console.log("A_TABS_FAIL", String(e).slice(0, 200));
			await shot(page, "audit-srchA-05-tabs-fail", true);
		}

		// Cash deep link
		try {
			const links = page.locator('[data-testid="option-href"], a').filter({ hasText: /^Open |Book|View deal/i });
			const n = await links.count();
			const texts: string[] = [];
			for (let i = 0; i < Math.min(n, 6); i++) {
				const t = await links.nth(i).textContent();
				const href = await links.nth(i).getAttribute("href");
				texts.push(`${t?.trim()} -> ${href}`.slice(0, 160));
			}
			console.log("A_DEEPLINKS", n, JSON.stringify(texts));
			const link = links.first();
			await link.scrollIntoViewIfNeeded();
			const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 20_000 }), link.click()]);
			await popup.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
			await popup.waitForTimeout(8000);
			console.log("A_DEEPLINK_URL", popup.url());
			await popup.screenshot({ path: `${ART}/audit-srchA-06-deeplink.png` }).catch(() => {});
			await popup.close();
		} catch (e) {
			console.log("A_DEEPLINK_FAIL", String(e).slice(0, 200));
		}

		// ── ZOE (the ONE typed message) ──
		try {
			const input = page.getByPlaceholder("Tell Zoe about your trip…");
			await input.scrollIntoViewIfNeeded();
			await shot(page, "audit-zoe-01-before");
			// chips before typed message
			const chips = page.locator('[data-testid="zoe-docked"] button').filter({ hasText: /.{6,}/ });
			const chipTexts = await chips.allTextContents().catch(() => []);
			console.log("ZOE_CHIPS", JSON.stringify(chipTexts.slice(0, 8)));
			// click one chip (client-side reply, no API)
			if (chipTexts.length) {
				await chips.first().click().catch(() => {});
				await page.waitForTimeout(1500);
				await shot(page, "audit-zoe-02-chip-reply");
			}
			await input.fill("What would this trip cost me in total if I pay cash, and how does that compare to using points?");
			const zoeResp = page.waitForResponse((r) => r.url().includes("/api/zoe") && r.request().method() === "POST", { timeout: 120_000 });
			await page.getByRole("button", { name: "Send message" }).click();
			const zr = await zoeResp;
			const zbody = await zr.json().catch(() => ({}));
			console.log("ZOE_STATUS", zr.status());
			console.log("ZOE_REPLY", JSON.stringify((zbody?.message ?? "").toString().slice(0, 800)));
			await page.waitForTimeout(5000);
			await shot(page, "audit-zoe-03-reply");
			// links in reply styled/clickable?
			const replyLinks = await page.locator('[data-testid="zoe-docked"] a').count().catch(() => 0);
			console.log("ZOE_REPLY_LINK_COUNT", replyLinks);
			// thumbs
			const thumbs = await page.locator('[data-testid="zoe-docked"] button[aria-label*="thumb" i], [data-testid="zoe-docked"] svg.lucide-thumbs-up, [data-testid="zoe-docked"] svg.lucide-thumbs-down').count().catch(() => 0);
			console.log("ZOE_THUMBS_COUNT", thumbs);
			await shot(page, "audit-zoe-04-thumbs-zone");
			// mic — click once, observe, report
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
					await exitVoice.click().catch(() => {});
					console.log("ZOE_VOICE_MODE_STARTED", true);
				}
			}
		} catch (e) {
			console.log("ZOE_FAIL", String(e).slice(0, 250));
			await shot(page, "audit-zoe-99-fail");
		}
		expect(resp.status()).toBeLessThan(500);
	});

	test("SEARCH B: SEA→SFO Nov 25-29 (expect use_points) + ownership + how-to-book", async ({ page }) => {
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
			{ timeout: 240_000 }
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		const resp = await respPromise;
		console.log("SEARCH_B_STATUS", resp.status());
		const body = await resp.json().catch(() => ({}));
		console.log("SEARCH_B_VERDICT_JSON", JSON.stringify(body?.verdict ?? {}).slice(0, 2000));
		await page.waitForTimeout(7000);
		await shot(page, "audit-srchB-01-verdict-viewport");
		await shot(page, "audit-srchB-02-verdict-full", true);

		const headline = await page.locator("h2").filter({ hasText: /Pay cash|Use points|Wait/i }).first().textContent().catch(() => null);
		console.log("B_HEADLINE", JSON.stringify(headline));
		const cardText = ((await page.locator("main").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("B_CARD_TEXT", JSON.stringify(cardText.slice(0, 2500)));

		// ── OWNERSHIP STATES (checklist item 5) ──
		const fork = page.locator('[data-testid="ownership-fork"]');
		const forkCount = await fork.count();
		console.log("B_OWNERSHIP_FORK_COUNT", forkCount);
		if (forkCount) {
			const forkText = await fork.first().textContent().catch(() => null);
			console.log("B_OWNERSHIP_FORK_TEXT", JSON.stringify(forkText?.replace(/\s+/g, " ").slice(0, 500)));
			await fork.first().scrollIntoViewIfNeeded().catch(() => {});
			await shot(page, "audit-srchB-03-ownership-fork");
		} else {
			// hunt for b2/b3 style copy anywhere
			const b2b3 = cardText.match(/(you have enough|from your|you're short|you are short|not enough points|covers? it)/i);
			console.log("B_OWNERSHIP_COPY_HUNT", JSON.stringify(b2b3?.[0] ?? null));
		}

		// How-to-book: transfer note + Book outbound/return
		const htb = page.locator('[data-testid="how-to-book"]');
		const htbCount = await htb.count();
		console.log("B_HOW_TO_BOOK_COUNT", htbCount);
		if (htbCount) {
			await htb.first().scrollIntoViewIfNeeded().catch(() => {});
			const transferNotes = await page.locator('[data-testid="transfer-note"]').allTextContents().catch(() => []);
			console.log("B_TRANSFER_NOTES", transferNotes.length, JSON.stringify(transferNotes.map((t) => t.replace(/\s+/g, " ").slice(0, 200))));
			const bookOut = page.locator('[data-testid="book-outbound"]');
			const bookRet = page.locator('[data-testid="book-return"]');
			const outHref = await bookOut.first().getAttribute("href").catch(() => null);
			const retHref = await bookRet.first().getAttribute("href").catch(() => null);
			console.log("B_BOOK_LINKS", JSON.stringify({ outCount: await bookOut.count(), retCount: await bookRet.count(), outHref, retHref }));
			await shot(page, "audit-srchB-04-how-to-book");
			// open one points link
			try {
				const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 20_000 }), bookOut.first().click()]);
				await popup.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
				await popup.waitForTimeout(8000);
				console.log("B_BOOK_OUT_URL", popup.url());
				await popup.screenshot({ path: `${ART}/audit-srchB-05-book-popup.png` }).catch(() => {});
				await popup.close();
			} catch (e) {
				console.log("B_BOOK_OPEN_FAIL", String(e).slice(0, 200));
			}
		}

		// From/To tabs on points path
		try {
			const toTab = page.locator('[data-testid="flight-tab-to"]');
			await toTab.scrollIntoViewIfNeeded();
			await toTab.click({ timeout: 10_000 });
			await page.waitForTimeout(8000);
			await shot(page, "audit-srchB-06-tab-to");
			const toCard = await page.locator('[data-testid="flight-card-to"]').textContent().catch(() => null);
			console.log("B_TO_TAB_CONTENT", JSON.stringify(toCard?.replace(/\s+/g, " ").slice(0, 400)));
		} catch (e) {
			console.log("B_TABS_FAIL", String(e).slice(0, 200));
		}
		expect(resp.status()).toBeLessThan(500);
	});
});
