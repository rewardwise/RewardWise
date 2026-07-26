/** @format */
// THROWAWAY audit spec — anon surfaces. Report-only; heavy console logging.
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

test.use({ storageState: { cookies: [], origins: [] } });

test("anon landing: hero, sample verdict, how-it-works, CTA, zero backend calls", async ({ page, viewport }) => {
	test.setTimeout(180_000);
	const w = viewport?.width ?? 0;
	const backendHits: string[] = [];
	page.on("request", (r) => {
		const u = r.url();
		if (/\/api\/|onrender\.com|supabase\.co\/rest|supabase\.co\/functions/.test(u)) backendHits.push(`${r.method()} ${u}`);
	});
	await page.goto("/");
	await killAnim(page);
	await page.waitForTimeout(3000);
	await shot(page, `audit-anon-${w}-01-hero`);
	await overflowCheck(page, "landing");
	await shot(page, `audit-anon-${w}-02-full`, true);

	const hero = await page.locator("h1").first().textContent().catch(() => null);
	console.log("HERO_H1", JSON.stringify(hero));
	const sample = page.getByText(/A real verdict looks like this/i).first();
	const sampleVisible = await sample.isVisible().catch(() => false);
	console.log("SAMPLE_CARD_PRESENT", sampleVisible);
	if (sampleVisible) {
		await sample.scrollIntoViewIfNeeded();
		await page.waitForTimeout(400);
		await shot(page, `audit-anon-${w}-03-sample-verdict`);
	}
	const hiw = page.getByText(/How it works/i).first();
	const hiwVisible = await hiw.isVisible().catch(() => false);
	console.log("HOW_IT_WORKS_PRESENT", hiwVisible);
	if (hiwVisible) {
		await hiw.scrollIntoViewIfNeeded();
		await page.waitForTimeout(400);
		await shot(page, `audit-anon-${w}-04-how-it-works`);
	}

	console.log("BACKEND_HITS_COUNT", backendHits.length);
	backendHits.slice(0, 15).forEach((h) => console.log("BACKEND_HIT", h));

	// CTA → signup
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(300);
	const cta = page.locator('[data-testid="landing-search-cta"]');
	const ctaVisible = await cta.isVisible().catch(() => false);
	console.log("CTA_PRESENT", ctaVisible);
	if (ctaVisible) {
		await cta.click();
		await page.waitForTimeout(2500);
		console.log("CTA_DEST", page.url());
		await shot(page, `audit-anon-${w}-05-after-cta`);
	}
	expect(true).toBe(true);
});

test("anon login page renders (email + Google)", async ({ page, viewport }) => {
	const w = viewport?.width ?? 0;
	await page.goto("/login");
	await killAnim(page);
	await page.waitForTimeout(2000);
	await shot(page, `audit-anon-${w}-06-login`);
	const email = await page.locator('input[type="email"]').count();
	const pwd = await page.locator('input[type="password"]').count();
	const google = await page.getByRole("button", { name: /google/i }).or(page.getByText(/continue with google|sign in with google/i)).count();
	console.log("LOGIN_FIELDS", JSON.stringify({ email, pwd, google }));
	// invalid submit — validation, no crash
	const submit = page.getByRole("button", { name: /log in|sign in/i }).first();
	if (await submit.isVisible().catch(() => false)) {
		await submit.click().catch(() => {});
		await page.waitForTimeout(1500);
		await shot(page, `audit-anon-${w}-07-login-empty-submit`);
		console.log("LOGIN_EMPTY_SUBMIT_URL", page.url());
	}
	expect(true).toBe(true);
});

test("anon signup page renders + validates (NO submission of real data)", async ({ page, viewport }) => {
	const w = viewport?.width ?? 0;
	await page.goto("/signup");
	await killAnim(page);
	await page.waitForTimeout(2000);
	await shot(page, `audit-anon-${w}-08-signup`);
	const email = await page.locator('input[type="email"]').count();
	const pwd = await page.locator('input[type="password"]').count();
	const google = await page.getByRole("button", { name: /google/i }).or(page.getByText(/continue with google|sign up with google/i)).count();
	console.log("SIGNUP_FIELDS", JSON.stringify({ email, pwd, google }));
	// empty submit → expect client validation, no account creation
	const submit = page.getByRole("button", { name: /sign up|create account|get started/i }).first();
	if (await submit.isVisible().catch(() => false)) {
		await submit.click().catch(() => {});
		await page.waitForTimeout(1500);
		await shot(page, `audit-anon-${w}-09-signup-empty-submit`);
		const errText = await page.locator("form").first().textContent().catch(() => "");
		console.log("SIGNUP_EMPTY_SUBMIT_URL", page.url(), "FORM_TEXT_SNIP", JSON.stringify((errText || "").slice(0, 300)));
	}
	expect(true).toBe(true);
});

test("anon: protected route redirect (/home)", async ({ page, viewport }) => {
	const w = viewport?.width ?? 0;
	await page.goto("/home");
	await page.waitForTimeout(3000);
	console.log("ANON_HOME_DEST", page.url());
	await shot(page, `audit-anon-${w}-10-home-redirect`);
	expect(true).toBe(true);
});
