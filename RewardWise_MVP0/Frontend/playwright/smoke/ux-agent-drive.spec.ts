/** @format */
// THROWAWAY UX-agent drive spec. Not a regression test — drives prod like a
// real user and captures screenshots for human-style UX judgment. Delete freely.
// Budget guard: exactly ONE /api/search per viewport project, ONE Zoe message
// total (desktop only).

import { test, expect } from "@playwright/test";

const ART = "playwright/.artifacts";
const killAnim = (page: import("@playwright/test").Page) =>
	page.addStyleTag({
		content: "*,*::before,*::after{animation:none!important;transition:none!important}",
	});

async function shot(page: import("@playwright/test").Page, name: string, fullPage = false) {
	try {
		await page.screenshot({ path: `${ART}/${name}.png`, fullPage });
		console.log("SHOT", name);
	} catch (e) {
		console.log("SHOT_FAIL", name, String(e).slice(0, 120));
	}
}

async function overflowCheck(page: import("@playwright/test").Page, label: string) {
	const o = await page.evaluate(() => ({
		scrollW: document.documentElement.scrollWidth,
		innerW: window.innerWidth,
	}));
	console.log("OVERFLOW_CHECK", label, JSON.stringify(o), o.scrollW > o.innerW ? "HORIZ_OVERFLOW" : "ok");
}

// ───────────────────────────── Desktop logged-in ─────────────────────────────
test.describe("ux desktop logged-in", () => {
	test.skip(({ viewport }) => !viewport || viewport.width < 1024, "desktop only");

	test("home → search → verdict → tabs → deeplink → zoe", async ({ page }) => {
		test.setTimeout(480_000);
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(2500);
		await shot(page, "ux-1440-01-home-initial");

		// Fill the search pill
		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).fill("DEN");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("AUS");
		await airports.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill("2026-09-10");
		await dates.nth(1).fill("2026-09-14");
		await shot(page, "ux-1440-02-form-filled");

		const respPromise = page.waitForResponse(
			(r) => r.url().includes("/api/search") && r.request().method() === "POST",
			{ timeout: 240_000 },
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		await page.waitForTimeout(1500);
		await shot(page, "ux-1440-03-loading-early");
		// A mid-wait shot in case the loading experience has stages.
		const midShot = page
			.waitForTimeout(12_000)
			.then(() => shot(page, "ux-1440-04-loading-mid"))
			.catch(() => {});
		const resp = await respPromise;
		console.log("SEARCH_STATUS", resp.status());
		await midShot;
		await page.waitForTimeout(6000); // render + settle
		await shot(page, "ux-1440-05-verdict-viewport");
		await shot(page, "ux-1440-06-verdict-full", true);

		// Headline + confidence text for the report
		const headline = await page
			.locator("h2")
			.filter({ hasText: /Pay cash|Use points|Wait/i })
			.first()
			.textContent()
			.catch(() => null);
		console.log("VERDICT_HEADLINE", JSON.stringify(headline));

		// From/To flight tabs
		try {
			const toTab = page.locator('[data-testid="flight-tab-to"]');
			await toTab.scrollIntoViewIfNeeded();
			await toTab.click({ timeout: 10_000 });
			await page.waitForTimeout(800);
			await shot(page, "ux-1440-07-tab-to-flight");
			await page.locator('[data-testid="flight-tab-from"]').click({ timeout: 10_000 });
			await page.waitForTimeout(800);
			await shot(page, "ux-1440-08-tab-from-flight");
		} catch (e) {
			console.log("TABS_FAIL", String(e).slice(0, 200));
			await shot(page, "ux-1440-07-tabs-fail-state", true);
		}

		// One deep link
		try {
			const link = page.getByRole("link", { name: /^Open / }).first();
			await link.scrollIntoViewIfNeeded();
			const linkText = await link.textContent();
			console.log("DEEPLINK_TEXT", JSON.stringify(linkText));
			const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 20_000 }), link.click()]);
			await popup.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
			await popup.waitForTimeout(6000);
			console.log("DEEPLINK_URL", popup.url());
			await popup.screenshot({ path: `${ART}/ux-1440-09-deeplink-popup.png` }).catch(() => {});
			await popup.close();
		} catch (e) {
			console.log("DEEPLINK_FAIL", String(e).slice(0, 200));
		}

		// One Zoe message (the only one in the whole run)
		try {
			const input = page.getByPlaceholder("Tell Zoe about your trip…");
			await input.scrollIntoViewIfNeeded();
			await shot(page, "ux-1440-10-zoe-before");
			await input.fill("Is mid-September a good time to fly Denver to Austin? Anything I should know?");
			const zoeResp = page.waitForResponse(
				(r) => r.url().includes("/api/zoe") && r.request().method() === "POST",
				{ timeout: 120_000 },
			);
			await page.getByRole("button", { name: "Send message" }).click();
			const zr = await zoeResp;
			console.log("ZOE_STATUS", zr.status());
			await page.waitForTimeout(5000);
			await shot(page, "ux-1440-11-zoe-reply");
			// Raw rendering of the last Zoe bubble for markup judgment
			const html = await page.evaluate(() => {
				const pane = document.querySelector('[data-testid="zoe-docked"]');
				if (!pane) return null;
				const bubbles = pane.querySelectorAll("div,p");
				return pane.innerHTML.slice(-3000);
			});
			console.log("ZOE_PANE_HTML_TAIL", JSON.stringify(html).slice(0, 3000));
		} catch (e) {
			console.log("ZOE_FAIL", String(e).slice(0, 200));
			await shot(page, "ux-1440-11-zoe-fail-state");
		}
		expect(resp.status(), "search should 2xx").toBeLessThan(400);
	});
});

// ───────────────────────────── Mobile logged-in ──────────────────────────────
test.describe("ux mobile logged-in", () => {
	test.skip(({ viewport }) => !viewport || viewport.width >= 1024, "mobile only");

	test("mobile home → search → verdict readability", async ({ page }) => {
		test.setTimeout(480_000);
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(2500);
		await shot(page, "ux-375-01-home-initial");
		await overflowCheck(page, "home");

		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).fill("DEN");
		await airports.nth(0).press("Enter");
		await airports.nth(1).fill("AUS");
		await airports.nth(1).press("Enter");
		const dates = page.locator('input[type="date"]');
		await dates.nth(0).fill("2026-09-10");
		await dates.nth(1).fill("2026-09-14");
		await shot(page, "ux-375-02-form-filled");

		const respPromise = page.waitForResponse(
			(r) => r.url().includes("/api/search") && r.request().method() === "POST",
			{ timeout: 240_000 },
		);
		await page.getByRole("button", { name: /Search Flights/i }).click();
		await page.waitForTimeout(1500);
		await shot(page, "ux-375-03-loading");
		const resp = await respPromise;
		console.log("SEARCH_STATUS", resp.status());
		await page.waitForTimeout(9000); // render + autoscroll settle

		const scrollY = await page.evaluate(() => window.scrollY);
		const rect = await page.evaluate(() => {
			const els = Array.from(document.querySelectorAll("h2"));
			const h = els.find((e) => /Pay cash|Use points|Wait/i.test(e.textContent || ""));
			if (!h) return null;
			const r = h.getBoundingClientRect();
			return { top: r.top, bottom: r.bottom, text: (h.textContent || "").slice(0, 60) };
		});
		console.log("AUTOSCROLL", "scrollY", scrollY, "headlineRect", JSON.stringify(rect));
		await shot(page, "ux-375-04-after-search-viewport");
		await shot(page, "ux-375-05-verdict-full", true);
		await overflowCheck(page, "verdict");

		// Tap the To Flight tab on mobile
		try {
			const toTab = page.locator('[data-testid="flight-tab-to"]');
			await toTab.scrollIntoViewIfNeeded();
			await toTab.click({ timeout: 10_000 });
			await page.waitForTimeout(800);
			await shot(page, "ux-375-06-tab-to-flight");
		} catch (e) {
			console.log("TABS_FAIL", String(e).slice(0, 200));
		}
		expect(resp.status(), "search should 2xx").toBeLessThan(400);
	});
});

// ───────────────────────────── Anonymous landing ─────────────────────────────
test.describe("ux anonymous landing", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("landing → hero, verdict sample, how-it-works, CTA → signup", async ({ page, viewport }) => {
		test.setTimeout(180_000);
		const w = viewport?.width ?? 0;
		await page.goto("/");
		await killAnim(page);
		await page.waitForTimeout(2500);
		await shot(page, `ux-anon-${w}-01-hero`);
		await overflowCheck(page, "landing-hero");
		await shot(page, `ux-anon-${w}-02-full`, true);

		// Static verdict sample
		try {
			const sample = page.getByText("A real verdict looks like this").first();
			await sample.scrollIntoViewIfNeeded();
			await page.waitForTimeout(600);
			await shot(page, `ux-anon-${w}-03-verdict-sample`);
		} catch (e) {
			console.log("SAMPLE_FAIL", String(e).slice(0, 150));
		}

		// How it works
		try {
			const hiw = page.getByText("How it works").first();
			await hiw.scrollIntoViewIfNeeded();
			await page.waitForTimeout(600);
			await shot(page, `ux-anon-${w}-04-how-it-works`);
		} catch (e) {
			console.log("HIW_FAIL", String(e).slice(0, 150));
		}

		// CTA → signup (no search fires for anon)
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(400);
		const cta = page.locator('[data-testid="landing-search-cta"]');
		await cta.scrollIntoViewIfNeeded();
		await cta.click();
		await page.waitForTimeout(2500);
		console.log("CTA_DEST_URL", page.url());
		await shot(page, `ux-anon-${w}-05-after-cta`);
		expect(page.url(), "search CTA should land on signup/login").toMatch(/signup|login/);
	});
});
