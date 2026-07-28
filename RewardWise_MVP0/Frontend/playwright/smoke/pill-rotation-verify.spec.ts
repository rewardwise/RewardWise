/** @format */
// Pill rotation live verify on the OWNER account (4 seeded programs):
// cycles every 5s, pauses on hover, static under reduced motion.
import { test, expect } from "@playwright/test";
import { mintSessionViaServiceRole } from "../auth/mint-session";

const BASE = "https://www.mytravelwallet.ai";

test("rotates all four programs, pauses on hover", async ({ browser }) => {
	test.setTimeout(240_000);
	const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
	await mintSessionViaServiceRole(context, { email: "mytravelwalletai@gmail.com", baseUrl: BASE } as any);
	const page = await context.newPage();
	await page.goto(`${BASE}/home`);
	const chip = page.getByTestId("nav-wallet-chip");
	await expect(chip).toBeVisible({ timeout: 30_000 });
	const who = await page.evaluate(() => {
		const k = Object.keys(localStorage).find((x) => x.endsWith("-auth-token"));
		return k ? JSON.parse(localStorage.getItem(k)!)?.user?.email : "(none)";
	});
	console.log("SESSION_EMAIL:", who);

	const seen = new Set<string>();
	for (let i = 0; i < 4; i++) {
		const label = (await chip.textContent())?.trim() ?? "";
		seen.add(label);
		console.log(`CHIP t+${i * 5}s:`, label);
		await page.screenshot({ path: `playwright/.artifacts/pill-rot-${i}.png`, clip: { x: 900, y: 0, width: 540, height: 60 } });
		if (i < 3) await page.waitForTimeout(5200);
	}
	console.log("DISTINCT_PROGRAMS_SEEN:", seen.size, [...seen].join(" | "));
	expect(seen.size, "all four programs cycle").toBe(4);

	// hover pause
	await page.getByTestId("nav-wallet-pill").hover();
	const frozen = (await chip.textContent())?.trim();
	await page.waitForTimeout(7000);
	expect((await chip.textContent())?.trim(), "frozen while hovered").toBe(frozen);
	console.log("HOVER_PAUSE ok (", frozen, "held 7s )");
	await context.close();
});

test("reduced motion: static top program", async ({ browser }) => {
	test.setTimeout(120_000);
	const context = await browser.newContext({ reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
	await mintSessionViaServiceRole(context, { email: "mytravelwalletai@gmail.com", baseUrl: BASE } as any);
	const page = await context.newPage();
	await page.goto(`${BASE}/home`);
	const chip = page.getByTestId("nav-wallet-chip");
	await expect(chip).toBeVisible({ timeout: 30_000 });
	const first = (await chip.textContent())?.trim();
	await page.waitForTimeout(11000);
	expect((await chip.textContent())?.trim(), "no rotation under reduced motion").toBe(first);
	console.log("REDUCED_MOTION_STATIC ok:", first);
	await page.screenshot({ path: "playwright/.artifacts/pill-rot-reduced.png" });
	await context.close();
});
