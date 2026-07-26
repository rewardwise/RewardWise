/** @format */
// THROWAWAY gap-fill audit spec — NO live searches, NO Zoe messages.
// Anon network capture, payments statuses, dark-theme scan, overflow, invalid
// route, autocomplete dropdown styling, wallet pill, logout-last.
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

async function overflowCheck(page: Page, label: string) {
	const o = await page.evaluate(() => ({
		scrollW: document.documentElement.scrollWidth,
		innerW: window.innerWidth,
	}));
	console.log("OVERFLOW", label, JSON.stringify(o), o.scrollW > o.innerW ? "HORIZ_OVERFLOW" : "ok");
}

async function darkScan(page: Page, label: string) {
	const res = await page.evaluate(() => {
		function lum(c: string): number | null {
			const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
			if (!m) return null;
			const a = m[4] === undefined ? 1 : parseFloat(m[4]);
			if (a < 0.4) return null;
			const [r, g, b] = [+m[1], +m[2], +m[3]].map((v) => v / 255);
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		}
		const offenders: any[] = [];
		for (const el of Array.from(document.querySelectorAll("*"))) {
			const r = el.getBoundingClientRect();
			if (r.width < 120 || r.height < 60) continue;
			const cs = getComputedStyle(el);
			const l = lum(cs.backgroundColor);
			if (l !== null && l < 0.2) {
				const cls = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "";
				offenders.push({ tag: el.tagName, cls: cls.slice(0, 110), bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || "").trim().slice(0, 50) });
			}
		}
		return offenders.slice(0, 10);
	});
	console.log("DARKSCAN", label, JSON.stringify(res));
}

test.describe("anon (no auth)", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("landing backend-request capture + overflow", async ({ page, viewport }) => {
		test.setTimeout(180_000);
		const w = viewport?.width ?? 0;
		const backendHits: string[] = [];
		page.on("request", (r) => {
			const u = r.url();
			if (/\/api\/|onrender\.com|supabase\.co\/(rest|functions|auth)/.test(u)) backendHits.push(`${r.method()} ${u.slice(0, 140)}`);
		});
		await page.goto("/");
		await killAnim(page);
		await page.waitForTimeout(6000);
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await page.waitForTimeout(2000);
		console.log("ANON_BACKEND_HITS", backendHits.length, JSON.stringify(backendHits.slice(0, 12)));
		await overflowCheck(page, `anon-landing@${w}`);
	});
});

test.describe("authed", () => {
	test("payments route statuses", async ({ page, viewport }) => {
		test.setTimeout(180_000);
		for (const route of ["/subscribe", "/subscription", "/checkout", "/pricing"]) {
			const resp = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => null);
			await page.waitForTimeout(2000);
			console.log("PAY_ROUTE", route, "status", resp?.status(), "landed", page.url());
		}
	});

	test("invalid route behavior", async ({ page, viewport }) => {
		test.setTimeout(120_000);
		const w = viewport?.width ?? 0;
		const resp = await page.goto("/this-route-does-not-exist-xyz", { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => null);
		await page.waitForTimeout(2500);
		const t = ((await page.locator("body").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
		console.log("INVALID_ROUTE", "status", resp?.status(), "landed", page.url(), "SNIP", JSON.stringify(t.slice(0, 200)));
		await shot(page, `audit-gap2-${w}-invalid-route`);
	});

	test("dark scan + overflow sweep", async ({ page, viewport }) => {
		test.setTimeout(300_000);
		const w = viewport?.width ?? 0;
		for (const route of ["/home", "/wallet-setup", "/profile", "/history", "/about"]) {
			await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => null);
			await killAnim(page).catch(() => {});
			await page.waitForTimeout(3500);
			await overflowCheck(page, `${route}@${w}`);
			await darkScan(page, `${route}@${w}`);
		}
	});

	test("autocomplete dropdown styling + wallet pill", async ({ page, viewport }) => {
		test.setTimeout(180_000);
		const w = viewport?.width ?? 0;
		await page.goto("/home");
		await killAnim(page);
		await page.waitForTimeout(3000);
		// wallet pill presence in header
		const pillVisible = await page
			.locator("header, nav")
			.getByText(/250k|pts|Amex/i)
			.first()
			.isVisible()
			.catch(() => false);
		console.log("WALLET_PILL_IN_HEADER", w, pillVisible);
		// autocomplete dropdown computed style
		const airports = page.locator('input[placeholder="City or airport"]');
		await airports.nth(0).click();
		await airports.nth(0).pressSequentially("Seat", { delay: 70 });
		await page.waitForTimeout(2500);
		const dd = await page.evaluate(() => {
			const opts = document.querySelectorAll('[role="option"], [role="listbox"] li, ul li button');
			if (!opts.length) return null;
			let el: Element | null = opts[0];
			// find the dropdown container (walk up 3 levels)
			let container = el.parentElement;
			for (let i = 0; i < 3 && container; i++) {
				const bg = getComputedStyle(container).backgroundColor;
				if (bg && bg !== "rgba(0, 0, 0, 0)") return { count: opts.length, containerBg: bg, optColor: getComputedStyle(opts[0] as Element).color, cls: (container.className || "").toString().slice(0, 140) };
				container = container.parentElement;
			}
			return { count: opts.length, containerBg: "transparent-chain", optColor: getComputedStyle(opts[0] as Element).color, cls: "" };
		});
		console.log("AUTOCOMPLETE_DROPDOWN_STYLE", w, JSON.stringify(dd));
		await shot(page, `audit-gap2-${w}-autocomplete`);
	});

	// LAST: logout via profile (revokes session for this context only)
	test("zz logout via profile + session bounce", async ({ page, viewport }) => {
		test.setTimeout(180_000);
		const w = viewport?.width ?? 0;
		await page.goto("/home");
		await page.waitForTimeout(3000);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.waitForTimeout(4000);
		console.log("SESSION_AFTER_RELOAD_URL", page.url());
		await page.goto("/profile");
		await killAnim(page);
		await page.waitForTimeout(3000);
		const logout = page.getByText(/^Log out$/).first();
		const visible = await logout.isVisible().catch(() => false);
		console.log("PROFILE_LOGOUT_VISIBLE", visible);
		if (visible) {
			await logout.click();
			await page.waitForTimeout(5000);
			console.log("LOGOUT_DEST", page.url());
			await shot(page, `audit-gap2-${w}-after-logout`);
			await page.goto("/home");
			await page.waitForTimeout(3500);
			console.log("POST_LOGOUT_HOME_DEST", page.url());
			await shot(page, `audit-gap2-${w}-home-bounce`);
		}
	});
});
