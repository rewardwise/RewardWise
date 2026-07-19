/** @format */
// PR #227 height report (1440): left column (search pill + simplified verdict)
// vs Zoe panel, for a real NONSTOP and a real 1-STOP itinerary. Run against the
// PR preview via PLAYWRIGHT_BASE_URL.

import { test } from "@playwright/test";

const CASES = [
	{ name: "nonstop", from: "SFO", to: "SEA", depart: "2026-08-15", ret: "2026-08-18" },
	{ name: "1-stop", from: "TYO", to: "SEA", depart: "2027-02-12", ret: "2027-02-15" },
];

for (const c of CASES) {
	test(`height: ${c.name} (${c.from}->${c.to})`, async ({ page }) => {
		test.setTimeout(300_000);
		await page.goto("/home");
		await page.addStyleTag({
			content: "*,*::before,*::after{animation:none!important;transition:none!important}",
		});
		const dateInputs = page.locator('input[type="date"]');
		await dateInputs.nth(0).fill(c.depart);
		await dateInputs.nth(1).fill(c.ret);
		const airportInputs = page.locator('input[placeholder="City or airport"]');
		await airportInputs.nth(0).fill(c.from);
		await airportInputs.nth(0).press("Enter");
		await airportInputs.nth(1).fill(c.to);
		await airportInputs.nth(1).press("Enter");
		const respPromise = page.waitForResponse(
			(r) => r.url().includes("/api/search") && r.request().method() === "POST",
			{ timeout: 180_000 }
		);
		await page.getByRole("button", { name: /Search Flights/ }).click();
		await respPromise;
		await page.waitForTimeout(7000);

		const m = await page.evaluate(() => {
			const pill = document.querySelector('[data-testid="search-pill"]');
			const results = document.querySelector('[data-testid="home-results"]');
			// Zoe pane: the sticky right-column wrapper.
			const zoe = Array.from(document.querySelectorAll("div")).find((d) =>
				d.className.includes("lg:sticky") && d.className.includes("lg:h-[calc(100vh-3rem)]")
			);
			const r = (el: Element | null | undefined) => el?.getBoundingClientRect() ?? null;
			const p = r(pill), res = r(results), z = r(zoe);
			return {
				leftCol: p && res ? Math.round(res.bottom - p.top) : null,
				pill: p ? Math.round(p.height) : null,
				card: res ? Math.round(res.height) : null,
				zoe: z ? Math.round(z.height) : null,
			};
		});
		console.log(`HEIGHTS_${c.name}`, JSON.stringify(m));
		await page.screenshot({ path: `playwright/.artifacts/pr227-${c.name}.png`, fullPage: true });
	});
}
