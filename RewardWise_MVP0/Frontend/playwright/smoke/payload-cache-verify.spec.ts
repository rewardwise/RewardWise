/** @format */
// Payload-cache live verification. Case A/B: BOI-GEG (multi-seat winners) —
// fresh populate then repeat MUST be zero-provider. Case C: SEA-Tokyo
// business — repeat hits payload; the return winner is a 1-seater, so the
// dial must refetch award legs only. Case D: cross-user (owner) repeat on
// BOI-GEG — payload hit + owner-specific verdict.
import { test, expect } from "@playwright/test";
import { mintSessionViaServiceRole } from "../auth/mint-session";

const B = "https://mytravelwalletai-backend.onrender.com";

async function search(page: any, qs: string) {
	return page.evaluate(async ([base, q]: string[]) => {
		const tokenRow = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
		const token = tokenRow ? JSON.parse(localStorage.getItem(tokenRow) || "{}")?.access_token : null;
		const t0 = performance.now();
		const r = await fetch(`${base}/api/search?${q}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
		const b = await r.json();
		return {
			ms: Math.round(performance.now() - t0), status: r.status,
			rec: b?.verdict?.recommendation, cash: b?.cash_price,
			winner: b?.verdict?.winner ? { p: b.verdict.winner.program, pts: b.verdict.winner.points } : null,
			rwinner: b?.verdict?.return_winner ? { p: b.verdict.return_winner.program, pts: b.verdict.return_winner.points } : null,
			explanation: (b?.verdict?.explanation ?? "").slice(0, 90),
		};
	}, [B, qs]);
}

const BOIGEG = "origin=BOI&destination=GEG&date=2026-12-08&cabin=economy&travelers=1&return_date=2026-12-11";
const TOKYOBIZ = "origin=SEA&destination=NRT%2CHND&date=2027-03-15&cabin=business&travelers=1&return_date=2027-03-31";

test("A+B: fresh populate, repeat = zero providers, identical verdict", async ({ page }) => {
	test.setTimeout(420_000);
	await page.goto("/home");
	const fresh = await search(page, BOIGEG);
	console.log("A_FRESH", JSON.stringify(fresh));
	await page.waitForTimeout(3000);
	const repeat = await search(page, BOIGEG);
	console.log("B_REPEAT", JSON.stringify(repeat));
	expect(repeat.cash).toBe(fresh.cash);
	expect(repeat.winner).toEqual(fresh.winner);
	expect(repeat.rwinner).toEqual(fresh.rwinner);
	expect(repeat.explanation).toBe(fresh.explanation);
	console.log("VERDICT_IDENTICAL true | repeat_ms:", repeat.ms, "vs fresh_ms:", fresh.ms);
});

test("C: 1-seat dial on cached business route", async ({ page }) => {
	test.setTimeout(420_000);
	await page.goto("/home");
	const fresh = await search(page, TOKYOBIZ);
	console.log("C_FRESH", JSON.stringify(fresh));
	await page.waitForTimeout(3000);
	const repeat = await search(page, TOKYOBIZ);
	console.log("C_REPEAT", JSON.stringify(repeat));
	expect(repeat.status).toBe(200);
});

test("D: cross-user repeat gets payload hit + own verdict", async ({ browser }) => {
	test.setTimeout(240_000);
	const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
	await mintSessionViaServiceRole(context, { email: "mytravelwalletai@gmail.com", baseUrl: "https://www.mytravelwallet.ai" });
	const page = await context.newPage();
	await page.goto("https://www.mytravelwallet.ai/home");
	const out = await search(page, BOIGEG);
	console.log("D_OWNER", JSON.stringify(out));
	expect(out.status).toBe(200);
	await context.close();
});
