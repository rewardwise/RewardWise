/** @format */
// THROWAWAY audit spec — avatar menu, logout via profile, concierge probe.
// No live searches, no Zoe messages.
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

test("avatar menu opens with Profile/History/Sign out", async ({ page, viewport }) => {
	test.setTimeout(120_000);
	const w = viewport?.width ?? 0;
	await page.goto("/home");
	await killAnim(page);
	await page.waitForTimeout(3000);
	// the avatar is the round S button in the header
	const avatar = page.locator("header button, nav button").filter({ hasText: /^S$/ }).first();
	const avatarVisible = await avatar.isVisible().catch(() => false);
	console.log("AVATAR_VISIBLE", avatarVisible);
	if (avatarVisible) {
		await avatar.click();
		await page.waitForTimeout(1200);
		await shot(page, `audit-menu-${w}-01-avatar-open`);
		const menuText = await page.locator("body").textContent().catch(() => "");
		console.log("MENU_HAS_SIGNOUT", /sign out/i.test(menuText || ""));
	}
	expect(true).toBe(true);
});

test("concierge probe from profile (payment surface?)", async ({ page, viewport }) => {
	test.setTimeout(120_000);
	const w = viewport?.width ?? 0;
	await page.goto("/profile");
	await killAnim(page);
	await page.waitForTimeout(3000);
	const conc = page.getByText(/Concierge/i).first();
	if (await conc.isVisible().catch(() => false)) {
		await conc.click();
		await page.waitForTimeout(3500);
		console.log("CONCIERGE_DEST", page.url());
		const t = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("CONCIERGE_TEXT", JSON.stringify(t.slice(0, 500)));
		const stripe = await page.locator('iframe[src*="stripe"]').count();
		const payBtn = await page.getByRole("button", { name: /pay|checkout|buy|\$\d+/i }).count();
		console.log("CONCIERGE_PAY_SURFACE", JSON.stringify({ stripe, payBtn }));
		await shot(page, `audit-concierge-${w}-01`, true);
	} else {
		console.log("CONCIERGE_NOT_FOUND");
	}
	expect(true).toBe(true);
});

test("billing tab on profile", async ({ page, viewport }) => {
	test.setTimeout(120_000);
	const w = viewport?.width ?? 0;
	await page.goto("/profile");
	await killAnim(page);
	await page.waitForTimeout(3000);
	const billing = page.getByText(/^Billing$/).first();
	if (await billing.isVisible().catch(() => false)) {
		await billing.click();
		await page.waitForTimeout(2500);
		const t = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("BILLING_TEXT", JSON.stringify(t.slice(0, 600)));
		await shot(page, `audit-billing-${w}-01`, true);
	}
	expect(true).toBe(true);
});

test("logout via profile Log out row, then protected-route bounce", async ({ page, viewport }) => {
	test.setTimeout(180_000);
	const w = viewport?.width ?? 0;
	await page.goto("/profile");
	await killAnim(page);
	await page.waitForTimeout(3000);
	const logout = page.getByText(/^Log out$/).first();
	const visible = await logout.isVisible().catch(() => false);
	console.log("PROFILE_LOGOUT_VISIBLE", visible);
	if (visible) {
		await logout.click();
		await page.waitForTimeout(4500);
		console.log("LOGOUT_DEST", page.url());
		await shot(page, `audit-logout-${w}-01-after`);
		await page.goto("/home");
		await page.waitForTimeout(3500);
		console.log("POST_LOGOUT_HOME_DEST", page.url());
		await shot(page, `audit-logout-${w}-02-home-bounce`);
	}
	expect(true).toBe(true);
});
