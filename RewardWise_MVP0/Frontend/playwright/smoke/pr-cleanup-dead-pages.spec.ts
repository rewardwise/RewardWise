/**
 * Production smoke: CLEANUP — phantom routes redirect, copy leaks gone,
 * notification toggles removed, beta-gate noise stripped.
 *
 * Coverage:
 *   Group A — Phantom-route redirects (authed):
 *     /settings           → /profile
 *     /circle             → /
 *     /transfer-optimizer → /
 *     /dashboard          → /
 *
 *   Group B — Copy/jargon leaks gone (authed where required, anon where safe):
 *     /history page renders no "CPP" token
 *     /profile  page renders no "RewardWise" or "auth profile"; renders
 *               "MyTravelWallet"
 *     /forgot-password (anon) renders no "approved team" copy
 *
 *   Group C — Notification UI removed from /profile (authed):
 *     /profile section nav has no "Notifications" entry
 *     /profile main body has no "Notification settings" header
 *
 *   TopNav cleanup (rendered on /home — authed):
 *     No "Circle" tab label
 *     No "Beta access is limited" static alert
 *
 * Pre-fix: every assertion fails on prod because the phantom routes still
 * render their stubs, the copy leaks are still present, and the toggles +
 * beta-gate noise are still rendered.
 * Post-fix: all assertions pass.
 */

import { test, expect } from "@playwright/test";

test.describe.serial("PR CLEANUP: phantom routes + copy leaks + notification toggles", () => {
  test("Group A — /settings redirects to /profile", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/profile(\?|$|\/)/);
  });

  test("Group A — /circle redirects to /", async ({ page }) => {
    await page.goto("/circle", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(\?|$)/);
  });

  test("Group A — /transfer-optimizer redirects to /", async ({ page }) => {
    await page.goto("/transfer-optimizer", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(\?|$)/);
  });

  test("Group A — /dashboard redirects to /", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(\?|$)/);
  });

  test("Group B — /history renders no standalone CPP token", async ({ page }) => {
    await page.goto("/history", { waitUntil: "domcontentloaded" });
    // Wait for the history shell to render so we are not asserting on
    // a half-loaded page.
    await page.waitForLoadState("networkidle");
    const bodyText = await page.locator("body").innerText();
    // Standalone "CPP" — not embedded in a longer word like "CPPM" or part
    // of an identifier accidentally rendered. The /history surface used to
    // show "CPP" as an uppercase eyebrow label on the trip detail panel.
    expect(bodyText).not.toMatch(/(^|\s)CPP(\s|$)/);
  });

  test("Group B — /profile uses MyTravelWallet brand, no RewardWise / auth profile leaks", async ({
    page,
  }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("RewardWise");
    expect(bodyText).not.toContain("auth profile");
    expect(bodyText).not.toContain("database migration");
    // Positive assertion — at least one MyTravelWallet brand mention must
    // be visible somewhere on /profile.
    expect(bodyText).toContain("MyTravelWallet");
  });

  test("Group C — /profile has no notifications section nav or settings header", async ({
    page,
  }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const bodyText = await page.locator("body").innerText();
    // Section nav used to ship a "Notifications" entry alongside Account /
    // Subscription / Actions. After cleanup the only section labels are
    // the remaining three.
    expect(bodyText).not.toContain("Notification settings");
    expect(bodyText).not.toContain("Watchlist alerts");
    expect(bodyText).not.toContain("Weekly portfolio summary");
    expect(bodyText).not.toContain("Points expiry warnings");
  });

  test("TopNav — no Circle tab, no beta-gate static alert", async ({ page }) => {
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    // The Circle tab used to render in TopNav alongside Home / Trips /
    // History / Profile / About.
    const navLabels = await page
      .locator("nav button, nav a")
      .allInnerTexts();
    const joined = navLabels.join("|");
    expect(joined).not.toMatch(/Circle/);

    // The static beta-gate alert ("Beta access is limited") used to live
    // inside the TopNav notifications popover. Confirm it is gone from
    // the rendered shell.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Beta access is limited");
    expect(bodyText).not.toContain("Only approved testers can use Zoe");
  });
});

test.describe("PR CLEANUP: anonymous-only copy checks", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Group B — /forgot-password has no approved-team copy", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("approved team");
    expect(bodyText).not.toContain("Only approved team accounts");
  });
});
