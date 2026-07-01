/**
 * Production smoke: 8b-history — light History restructure + Trips fold.
 *
 *  - /trips permanently redirects (308) to /history?tab=booked (no 404).
 *  - History renders 3 URL-driven sub-tabs (Searches / What you booked / Alerts).
 *  - Switching tabs fires `tab_switched` {surface, from, to}; opening Booked
 *    fires `trips_viewed` {count}. Prints the actual analytics JSON.
 */

import { test, expect, type Request } from "@playwright/test";

test.describe("8b History (prod)", () => {
	test("/trips → /history?tab=booked (permanent redirect)", async ({ page }) => {
		test.setTimeout(60_000);
		await page.goto("/trips");
		await page.waitForURL(/\/history\?tab=booked/, { timeout: 30_000 });
		expect(page.url()).toContain("/history?tab=booked");
		await expect(page.locator('[data-testid="tab-booked"]')).toHaveAttribute("aria-selected", "true");
	});

	test("3 sub-tabs render; tab_switched + trips_viewed fire with real payloads", async ({ page }) => {
		test.setTimeout(120_000);
		const captured: Record<string, unknown>[] = [];
		page.on("request", (r: Request) => {
			if (r.url().includes("/api/analytics") && r.method() === "POST") {
				try {
					const b = r.postDataJSON();
					if (b?.event_name === "tab_switched" || b?.event_name === "trips_viewed") captured.push(b);
				} catch {
					/* ignore */
				}
			}
		});

		await page.goto("/history");
		await page.locator('[role="tablist"]').waitFor({ timeout: 30_000 });
		// Default tab is Searches.
		await expect(page.locator('[data-testid="tab-searches"]')).toHaveAttribute("aria-selected", "true");

		await page.locator('[data-testid="tab-booked"]').click();
		await expect(page.locator('[data-testid="tab-booked"]')).toHaveAttribute("aria-selected", "true");
		await page.waitForTimeout(2500);

		await page.locator('[data-testid="tab-alerts"]').click();
		await expect(page.getByText(/Alerts are coming soon/i)).toBeVisible();
		await page.waitForTimeout(1500);

		for (const ev of captured) {
			const { event_name, event_type, metadata } = ev as Record<string, unknown>;
			console.log("[smoke-8b] " + JSON.stringify({ event_name, event_type, metadata }));
		}

		const switches = captured.filter((e) => e.event_name === "tab_switched");
		expect(switches.length).toBeGreaterThanOrEqual(2);
		expect(switches[0]).toMatchObject({ metadata: { surface: "history", from: "searches", to: "booked" } });
		expect(captured.some((e) => e.event_name === "trips_viewed")).toBe(true);
	});
});
