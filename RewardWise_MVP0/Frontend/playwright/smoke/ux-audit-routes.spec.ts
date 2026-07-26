/** @format */
// THROWAWAY audit spec — authed routes, wallet, payments, session, dark-theme scan.
// Report-only. No live searches, no Zoe messages.
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

// Scan rendered DOM for dark-theme leftovers: elements whose computed background
// is dark (relative luminance < 0.25) and occupy meaningful area, on pages whose
// body background is light. Also greps class lists for bg-slate-7/8/900 variants.
async function darkScan(page: Page, label: string) {
	const res = await page.evaluate(() => {
		function lum(c: string): number | null {
			const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
			if (!m) return null;
			const a = m[4] === undefined ? 1 : parseFloat(m[4]);
			if (a < 0.4) return null; // mostly transparent
			const [r, g, b] = [+m[1], +m[2], +m[3]].map((v) => v / 255);
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		}
		const bodyBg = getComputedStyle(document.body).backgroundColor;
		const bodyLum = lum(bodyBg);
		const offenders: any[] = [];
		const slateClasses: any[] = [];
		const els = Array.from(document.querySelectorAll("*"));
		for (const el of els) {
			const cls = (el as HTMLElement).className;
			if (typeof cls === "string" && /bg-slate-[789]00|bg-gray-[89]00|bg-zinc-[89]00|bg-neutral-[89]00|bg-black/.test(cls)) {
				const r = el.getBoundingClientRect();
				if (r.width > 40 && r.height > 20)
					slateClasses.push({ tag: el.tagName, cls: cls.slice(0, 140), w: Math.round(r.width), h: Math.round(r.height) });
			}
			const r = el.getBoundingClientRect();
			if (r.width < 100 || r.height < 40) continue;
			const cs = getComputedStyle(el);
			const l = lum(cs.backgroundColor);
			if (l !== null && l < 0.22) {
				offenders.push({
					tag: el.tagName,
					cls: typeof cls === "string" ? cls.slice(0, 120) : "",
					bg: cs.backgroundColor,
					w: Math.round(r.width),
					h: Math.round(r.height),
					text: (el.textContent || "").trim().slice(0, 60),
				});
			}
		}
		return { bodyBg, bodyLum, offenders: offenders.slice(0, 12), slateClasses: slateClasses.slice(0, 12) };
	});
	console.log("DARKSCAN", label, JSON.stringify(res));
}

const ROUTES = ["/home", "/about", "/history", "/profile", "/wallet-setup", "/settings", "/dashboard", "/trips"];

test("authed route sweep + wallet + overflow + dark scan", async ({ page, viewport }) => {
	test.setTimeout(300_000);
	const w = viewport?.width ?? 0;
	for (const route of ROUTES) {
		const errors: string[] = [];
		page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
		const resp = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => {
			console.log("ROUTE_GOTO_FAIL", route, String(e).slice(0, 150));
			return null;
		});
		await killAnim(page).catch(() => {});
		await page.waitForTimeout(3000);
		console.log("ROUTE", route, "status", resp?.status(), "landed", page.url());
		const bodyText = await page.locator("body").textContent().catch(() => "");
		const looksError = /application error|something went wrong|500|not found/i.test((bodyText || "").slice(0, 2000));
		console.log("ROUTE_ERRORTEXT", route, looksError, "pageerrors", errors.length, errors.slice(0, 3).join(" | "));
		await overflowCheck(page, `${route}@${w}`);
		await darkScan(page, `${route}@${w}`);
		await shot(page, `audit-routes-${w}-${route.replace(/\//g, "_")}`, true);
	}
	expect(true).toBe(true);
});

test("wallet pill in nav + balances visible on /home", async ({ page, viewport }) => {
	test.setTimeout(120_000);
	const w = viewport?.width ?? 0;
	await page.goto("/home");
	await killAnim(page);
	await page.waitForTimeout(4000);
	// wallet pill: look in header/nav for points-ish pill
	const navText = await page.locator("header, nav").allTextContents().catch(() => []);
	console.log("NAV_TEXT", JSON.stringify(navText).slice(0, 600));
	const pill = page.locator("header, nav").getByText(/pts|points|[0-9]{1,3}[,.]?[0-9]{3}/i).first();
	console.log("WALLET_PILL_VISIBLE", await pill.isVisible().catch(() => false));
	await shot(page, `audit-wallet-${w}-01-nav`);
	// try clicking pill / wallet entry
	if (await pill.isVisible().catch(() => false)) {
		await pill.click().catch(() => {});
		await page.waitForTimeout(2500);
		console.log("WALLET_PILL_DEST", page.url());
		await shot(page, `audit-wallet-${w}-02-after-pill-click`, true);
	}
	expect(true).toBe(true);
});

test("payments: /subscribe and /subscription post-wind-down behavior", async ({ page, viewport }) => {
	test.setTimeout(120_000);
	const w = viewport?.width ?? 0;
	for (const route of ["/subscribe", "/subscription"]) {
		const resp = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => null);
		await page.waitForTimeout(2500);
		console.log("PAY_ROUTE", route, "status", resp?.status(), "landed", page.url());
		const stripe = await page.locator('iframe[src*="stripe"], [class*="stripe"]').count().catch(() => 0);
		const priceBtn = await page.getByRole("button", { name: /subscribe|checkout|pay|upgrade/i }).count().catch(() => 0);
		const bodySnip = (await page.locator("body").textContent().catch(() => "")) || "";
		console.log("PAY_SURFACE", route, JSON.stringify({ stripe, priceBtn }), "SNIP", JSON.stringify(bodySnip.replace(/\s+/g, " ").slice(0, 300)));
		await shot(page, `audit-pay-${w}-${route.replace(/\//g, "_")}`, true);
	}
	expect(true).toBe(true);
});

test("session persists across reload, then logout works", async ({ page, viewport }) => {
	test.setTimeout(180_000);
	const w = viewport?.width ?? 0;
	await page.goto("/home");
	await killAnim(page);
	await page.waitForTimeout(3000);
	const loggedInBefore = !/login|signup/.test(page.url());
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.waitForTimeout(4000);
	const afterReloadUrl = page.url();
	console.log("SESSION_PERSIST", JSON.stringify({ loggedInBefore, afterReloadUrl }));
	await shot(page, `audit-session-${w}-01-after-reload`);

	// Logout — find a sign out control (may be under an avatar/menu; mobile: drawer)
	let found = false;
	const direct = page.getByRole("button", { name: /sign out|log out/i }).or(page.getByRole("link", { name: /sign out|log out/i })).first();
	if (await direct.isVisible().catch(() => false)) {
		found = true;
		await direct.click();
	} else {
		// try opening avatar/profile menu or mobile drawer
		const triggers = [
			page.locator('header button[aria-label*="menu" i]'),
			page.locator('header [aria-haspopup]'),
			page.locator("header button").last(),
		];
		for (const t of triggers) {
			if (await t.isVisible().catch(() => false)) {
				await t.click().catch(() => {});
				await page.waitForTimeout(1000);
				const so = page.getByText(/sign out|log out/i).first();
				if (await so.isVisible().catch(() => false)) {
					found = true;
					await shot(page, `audit-session-${w}-02-menu-open`);
					await so.click();
					break;
				}
				await page.keyboard.press("Escape").catch(() => {});
			}
		}
	}
	await page.waitForTimeout(4000);
	console.log("LOGOUT_CONTROL_FOUND", found, "LOGOUT_DEST", page.url());
	await shot(page, `audit-session-${w}-03-after-logout`);
	// confirm protected route now bounces
	if (found) {
		await page.goto("/home");
		await page.waitForTimeout(3500);
		console.log("POST_LOGOUT_HOME_DEST", page.url());
	}
	expect(true).toBe(true);
});
