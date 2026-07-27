/** @format */
// Isolated grandfather proof: an EXISTING account that is NOT on any
// allowlist (control test account) must pass the private gate untouched.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { mintSessionViaServiceRole } from "../auth/mint-session";

test("existing non-internal account is grandfathered through", async ({ browser }) => {
	test.setTimeout(180_000);
	const secrets = Object.fromEntries(
		readFileSync(`${homedir()}/.config/secrets/mytravelwallet.env`, "utf8")
			.split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
			.map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
	);
	const email = secrets.MTW_CONTROL_TEST_EMAIL;
	expect(email, "control account configured").toBeTruthy();

	const context = await browser.newContext();
	await mintSessionViaServiceRole(context, {
		email,
		baseUrl: "https://www.mytravelwallet.ai",
	} as any);
	const page = await context.newPage();

	// Confirm it is NOT internal: /subscribe should NOT show the internal card.
	await page.goto("https://www.mytravelwallet.ai/subscribe");
	await page.waitForTimeout(2500);
	const isInternal = await page.getByText("Internal account").isVisible().catch(() => false);
	console.log("CONTROL_IS_INTERNAL:", isInternal);

	// The gate check: /home must load; no private redirect; session survives.
	await page.goto("https://www.mytravelwallet.ai/home");
	await expect(page.getByPlaceholder("Tell Zoe about your trip…")).toBeVisible({ timeout: 30_000 });
	expect(page.url()).not.toContain("error=private");
	console.log("GRANDFATHER_OK: existing non-internal account passed untouched");
	await page.screenshot({ path: "playwright/.artifacts/pm-4-grandfather.png" });
	expect(isInternal, "proof only isolates grandfather if account is non-internal").toBe(false);
	await context.close();
});
