/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "../app/profile/page";
import DayPassUpgradeReminder from "../components/DayPassUpgradeReminder";
import {
  DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS,
  formatDayPassTimeLeft,
  getDayPassMsLeft,
  getNextDayPassUpgradeReminderAt,
  shouldShowDayPassUpgradeReminder,
} from "../utils/entitlements/day-pass-reminders";

type MockUser = {
  id: string;
  email: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
};

type BillingRow = {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
};

type ProfileRow = {
  day_pass_expires_at: string | null;
};

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  pathname: "/profile",
  authState: {
    user: null as null | MockUser,
    subscription: null as null | string,
    signOut: vi.fn(async () => undefined),
  },
  supabaseState: {
    profileRow: { day_pass_expires_at: null } as ProfileRow | null,
    profileError: null as unknown,
    billingRow: null as BillingRow | null,
    billingError: null as unknown,
  },
  supabaseUpdateUser: vi.fn(async () => ({ error: null })),
  supabaseGetUser: vi.fn(async () => ({
    data: { user: { user_metadata: {} } },
    error: null,
  })),
  supabaseGetSession: vi.fn(async () => ({
    data: { session: { access_token: "test-access-token" } },
  })),
  fetchState: {
    canViewAnalytics: false,
    portalUrl: "https://billing.example.test/session",
    syncStatus: 200,
    syncedBilling: null as BillingRow | null,
    cancelStatus: 200,
    cancelBody: { ok: true, accessEndsAt: null as string | null },
    deleteStatus: 200,
    deleteBody: { ok: true },
  },
  fetchMock: vi.fn(),
  confirmMock: vi.fn(),
  alertMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
  }),
  usePathname: () => mocks.pathname,
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/components/TropicalBackground", () => ({
  default: () => <div data-testid="tropical-background" />,
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser: mocks.supabaseUpdateUser,
      getUser: mocks.supabaseGetUser,
      getSession: mocks.supabaseGetSession,
    },
    from: (table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            return {
              data: mocks.supabaseState.profileRow,
              error: mocks.supabaseState.profileError,
            };
          }

          if (table === "subscriptions") {
            return {
              data: mocks.supabaseState.billingRow,
              error: mocks.supabaseState.billingError,
            };
          }

          return { data: null, error: null };
        }),
      };

      return query;
    },
  }),
}));

const NOW_MS = Date.UTC(2026, 4, 14, 16, 0, 0);
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user_settings_test",
    email: "jayveera0315@gmail.com",
    created_at: new Date(Date.UTC(2026, 2, 6, 12, 0, 0)).toISOString(),
    user_metadata: { full_name: "Jay Patel" },
    ...overrides,
  };
}

function makeBillingRow(overrides: Partial<BillingRow> = {}): BillingRow {
  return {
    status: "active",
    current_period_end: new Date(NOW_MS + 30 * ONE_DAY_MS).toISOString(),
    cancel_at_period_end: false,
    stripe_subscription_id: "sub_settings_test",
    ...overrides,
  };
}

function setAuthState(options: {
  user?: MockUser | null;
  subscription?: string | null;
} = {}) {
  mocks.authState.user = options.user === undefined ? makeUser() : options.user;
  mocks.authState.subscription = options.subscription === undefined ? "pro" : options.subscription;
}

function setProfileRow(row: ProfileRow | null) {
  mocks.supabaseState.profileRow = row;
}

function setBillingRow(row: BillingRow | null) {
  mocks.supabaseState.billingRow = row;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock() {
  mocks.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl.split("?")[0];

    if (url === "/api/admin/analytics/access") {
      return jsonResponse({ canViewAnalytics: mocks.fetchState.canViewAnalytics });
    }

    if (url === "/api/payments/sync-subscription") {
      return jsonResponse(
        mocks.fetchState.syncedBilling ? { billing: mocks.fetchState.syncedBilling } : {},
        mocks.fetchState.syncStatus,
      );
    }

    if (url === "/api/payments/portal") {
      return jsonResponse({ url: mocks.fetchState.portalUrl });
    }

    if (url === "/api/payments/cancel-subscription") {
      return jsonResponse(mocks.fetchState.cancelBody, mocks.fetchState.cancelStatus);
    }

    if (url === "/api/delete-account" && init?.method === "DELETE") {
      return jsonResponse(mocks.fetchState.deleteBody, mocks.fetchState.deleteStatus);
    }

    return jsonResponse({ ok: true });
  });

  vi.stubGlobal("fetch", mocks.fetchMock);
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderUi(ui: React.ReactElement) {
  mountedContainer = document.createElement("div");
  document.body.appendChild(mountedContainer);
  mountedRoot = createRoot(mountedContainer);

  await act(async () => {
    mountedRoot?.render(ui);
  });
  await flushEffects();

  return mountedContainer;
}

function pageText() {
  return document.body.textContent ?? "";
}

function expectPageToContain(value: string) {
  expect(pageText()).toContain(value);
}

function expectPageNotToContain(value: string) {
  expect(pageText()).not.toContain(value);
}

function findButtonByText(text: string | RegExp): HTMLButtonElement {
  const matcher = typeof text === "string" ? new RegExp(text, "i") : text;
  const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
    matcher.test(candidate.textContent ?? ""),
  ) as HTMLButtonElement | undefined;

  if (!button) {
    throw new Error(`Could not find button matching ${String(text)}. Page text: ${pageText()}`);
  }

  return button;
}

function findButtonByLabel(label: string): HTMLButtonElement {
  const button = document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  if (!button) {
    throw new Error(`Could not find button with aria-label ${label}. Page text: ${pageText()}`);
  }
  return button;
}

// 8b-profile: sections switch via the sidebar nav (data-testid="profile-nav-<key>").
async function clickNav(key: "account" | "billing" | "wallet" | "preferences") {
  const btn = document.querySelector(`[data-testid="profile-nav-${key}"]`);
  if (!btn) throw new Error(`Could not find profile nav ${key}. Page text: ${pageText()}`);
  await clickElement(btn);
}

async function clickElement(element: Element) {
  await act(async () => {
    if (element instanceof HTMLElement) {
      element.click();
      return;
    }

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushEffects();
}

async function typeIntoInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flushEffects();
}

function formatExpectedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
  mocks.pathname = "/profile";
  mocks.routerPush.mockReset();
  mocks.routerReplace.mockReset();
  mocks.authState.signOut.mockReset();
  mocks.supabaseUpdateUser.mockReset();
  mocks.supabaseGetUser.mockReset();
  mocks.supabaseGetUser.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });
  mocks.supabaseGetSession.mockReset();
  mocks.supabaseGetSession.mockResolvedValue({ data: { session: { access_token: "test-access-token" } } });
  mocks.fetchMock.mockReset();
  mocks.confirmMock.mockReset();
  mocks.alertMock.mockReset();
  mocks.fetchState.canViewAnalytics = false;
  mocks.fetchState.portalUrl = "https://billing.example.test/session";
  mocks.fetchState.syncStatus = 200;
  mocks.fetchState.syncedBilling = null;
  mocks.fetchState.cancelStatus = 200;
  mocks.fetchState.cancelBody = { ok: true, accessEndsAt: new Date(NOW_MS + 12 * ONE_DAY_MS).toISOString() };
  mocks.fetchState.deleteStatus = 200;
  mocks.fetchState.deleteBody = { ok: true };
  mocks.supabaseState.profileError = null;
  mocks.supabaseState.billingError = null;
  setAuthState({ subscription: "pro" });
  setProfileRow({ day_pass_expires_at: null });
  setBillingRow(makeBillingRow());
  installFetchMock();
  vi.stubGlobal("confirm", mocks.confirmMock);
  vi.stubGlobal("alert", mocks.alertMock);
  window.localStorage.clear();
});

afterEach(async () => {
  if (mountedRoot) {
    await act(async () => {
      mountedRoot?.unmount();
    });
  }
  mountedRoot = null;
  mountedContainer = null;
  document.body.innerHTML = "";
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("settings page account tab", () => {
  it("renders the account shell with useful account details and no redundant search CTA", async () => {
    await renderUi(<ProfilePage />);

    expectPageToContain("Profile");
    expectPageToContain("Jay Patel");
    expectPageToContain("jayveera0315@gmail.com");
    expectPageToContain("Member since");
    expectPageToContain("March 2026");
    expectPageToContain("Log out");
    expectPageToContain("Delete account");
    // 8b-profile dedup: Pro-access status is canonical in Billing, not Account.
    expectPageNotToContain("Pro access");
    expectPageNotToContain("Monthly Plan");
    expectPageNotToContain("Start a search");
  });

  it("lets users save their display name through Supabase auth metadata", async () => {
    await renderUi(<ProfilePage />);

    await clickElement(findButtonByLabel("Edit name"));
    const input = document.querySelector('input[placeholder="Your name"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await typeIntoInput(input as HTMLInputElement, "Jay RewardWise");
    await clickElement(findButtonByText(/^\s*save\s*$/i));

    expect(mocks.supabaseUpdateUser).toHaveBeenCalledWith({
      data: {
        full_name: "Jay RewardWise",
        name: "Jay RewardWise",
      },
    });
    expectPageToContain("Jay RewardWise");
    expectPageToContain("Profile updated.");
  });

  it("logs out from the account controls and returns users to the landing page", async () => {
    await renderUi(<ProfilePage />);

    await clickElement(findButtonByText(/log out/i));

    expect(mocks.authState.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.routerReplace).toHaveBeenCalledWith("/");
  });

  it("does not delete the account when the browser confirmation is declined", async () => {
    mocks.confirmMock.mockReturnValue(false);
    await renderUi(<ProfilePage />);

    await clickElement(findButtonByText(/delete account/i));

    expect(mocks.confirmMock).toHaveBeenCalledTimes(1);
    expect(mocks.fetchMock).not.toHaveBeenCalledWith(
      "/api/delete-account",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(mocks.authState.signOut).not.toHaveBeenCalled();
  });

  it("deletes the account with the current session token after confirmation", async () => {
    mocks.confirmMock.mockReturnValue(true);
    await renderUi(<ProfilePage />);

    await clickElement(findButtonByText(/delete account/i));

    expect(mocks.supabaseGetSession).toHaveBeenCalledTimes(1);
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      "/api/delete-account",
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer test-access-token" },
      }),
    );
    expect(mocks.authState.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.routerReplace).toHaveBeenCalledWith("/");
  });
});

describe("settings page subscription tab", () => {
  it("shows the recurring billing date from the subscription row", async () => {
    const nextBillingDate = new Date(NOW_MS + 18 * ONE_DAY_MS).toISOString();
    setBillingRow(makeBillingRow({ current_period_end: nextBillingDate }));

    await renderUi(<ProfilePage />);
    await clickNav("billing");

    expectPageToContain("Pro access"); // canonical status lives in Billing
    expectPageToContain("Monthly Plan");
    expectPageToContain("Next billing date");
    expectPageToContain(formatExpectedDate(nextBillingDate));
    expectPageToContain("Manage billing");
    expectPageToContain("Cancel at period end");
  });

  it("syncs the billing date from Stripe when an active subscription row is missing period data", async () => {
    const syncedBillingDate = new Date(NOW_MS + 27 * ONE_DAY_MS).toISOString();
    const syncedBilling = makeBillingRow({ current_period_end: syncedBillingDate });

    setBillingRow(
      makeBillingRow({
        current_period_end: null,
        stripe_subscription_id: "sub_needs_sync",
      }),
    );
    mocks.fetchState.syncedBilling = syncedBilling;

    await renderUi(<ProfilePage />);
    await clickNav("billing");

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      "/api/payments/sync-subscription",
      expect.objectContaining({ method: "POST" }),
    );
    expectPageToContain(formatExpectedDate(syncedBillingDate));
    expectPageNotToContain("No monthly billing date yet");
  });

  it("keeps access visible when cancellation is already scheduled at period end", async () => {
    const accessEndsAt = new Date(NOW_MS + 9 * ONE_DAY_MS).toISOString();
    setBillingRow(
      makeBillingRow({
        cancel_at_period_end: true,
        current_period_end: accessEndsAt,
      }),
    );

    await renderUi(<ProfilePage />);
    await clickNav("billing");

    expectPageToContain("Access ends");
    expectPageToContain(formatExpectedDate(accessEndsAt));
    expectPageToContain("Cancellation scheduled");
    expectPageNotToContain("Cancel at period end");
  });

  it("schedules cancellation at period end and updates the subscription tab without removing access immediately", async () => {
    const accessEndsAt = new Date(NOW_MS + 14 * ONE_DAY_MS).toISOString();
    mocks.fetchState.cancelBody = { ok: true, accessEndsAt };

    await renderUi(<ProfilePage />);
    await clickNav("billing");
    await clickElement(findButtonByText(/cancel at period end/i));

    // The cancel button opens the reason modal; pick a reason then confirm.
    expect(document.querySelector('[data-testid="cancel-reason-modal"]')).not.toBeNull();
    const reasonRadio = document.querySelector(
      'input[type="radio"][value="too_expensive"]',
    ) as HTMLInputElement;
    await clickElement(reasonRadio);
    await clickElement(findButtonByText(/confirm cancellation/i));

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      "/api/payments/cancel-subscription",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason_code: "too_expensive", free_text: null }),
      }),
    );
    expectPageToContain("Cancellation scheduled");
    expectPageToContain(formatExpectedDate(accessEndsAt));
    expectPageToContain("Pro access");
  });

  it("shows the plan picker CTA instead of subscription controls for free users", async () => {
    setAuthState({ subscription: null });
    setBillingRow(null);

    await renderUi(<ProfilePage />);
    await clickNav("billing");

    expectPageToContain("Free Plan");
    expectPageToContain("No recurring billing");
    expectPageToContain("View plan options");
    expectPageNotToContain("Manage billing");

    await clickElement(findButtonByText(/view plan options/i));
    expect(mocks.routerPush).toHaveBeenCalledWith("/subscribe");
  });

  it("shows day pass time remaining in subscription details for non-Pro day pass users", async () => {
    const dayPassExpiresAt = new Date(NOW_MS + 5 * ONE_HOUR_MS + 30 * 60 * 1000).toISOString();
    setAuthState({ subscription: null });
    setProfileRow({ day_pass_expires_at: dayPassExpiresAt });
    setBillingRow(null);

    await renderUi(<ProfilePage />);
    await clickNav("billing");

    expectPageToContain("Day Pass");
    expectPageToContain("5h 30m left");
    expectPageToContain("No recurring billing");
  });
});

describe("profile Tools fold (in Account)", () => {
  it("routes the kept tools (Concierge, Health) — nav-redundant launchers dropped", async () => {
    await renderUi(<ProfilePage />); // Account is the default section; Tools render here

    // The old nav-redundant quick actions are gone.
    expectPageNotToContain("My Wallet");
    expectPageNotToContain("Past Searches");

    await clickElement(findButtonByText(/concierge/i));
    expect(mocks.routerPush).toHaveBeenLastCalledWith("/concierge");
    await clickElement(findButtonByText(/health check-in/i));
    expect(mocks.routerPush).toHaveBeenLastCalledWith("/health-check");
  });

  it("shows the admin analytics tool only for PM testers (canViewAnalytics)", async () => {
    mocks.fetchState.canViewAnalytics = true;
    await renderUi(<ProfilePage />);

    expectPageToContain("Product analytics");
    await clickElement(findButtonByText(/product analytics/i));
    expect(mocks.routerPush).toHaveBeenCalledWith("/admin/analytics");
  });

  it("hides the admin tool for non-PM users", async () => {
    mocks.fetchState.canViewAnalytics = false;
    await renderUi(<ProfilePage />);
    expectPageNotToContain("Product analytics");
  });
});

describe("day pass upgrade reminders tied to settings/billing state", () => {
  it("shows a global upgrade reminder for active day pass users and routes them to monthly upgrade", async () => {
    const expiresAt = new Date(NOW_MS + 7 * ONE_HOUR_MS).toISOString();
    setAuthState({ subscription: null });
    setProfileRow({ day_pass_expires_at: expiresAt });
    mocks.pathname = "/home";

    await renderUi(<DayPassUpgradeReminder />);

    expectPageToContain("Your day pass has 7h left");
    expectPageToContain("Upgrade to Monthly now");

    await clickElement(findButtonByText(/^Upgrade$/i));
    expect(mocks.routerPush).toHaveBeenCalledWith("/subscribe?upgrade=monthly");
  });

  it("snoozes the day pass reminder for the configured reminder interval", async () => {
    const expiresAt = new Date(NOW_MS + 11 * ONE_HOUR_MS).toISOString();
    setAuthState({ subscription: null });
    setProfileRow({ day_pass_expires_at: expiresAt });
    mocks.pathname = "/home";

    await renderUi(<DayPassUpgradeReminder />);
    await clickElement(findButtonByLabel("Remind me later"));

    const storageKey = `rw:day-pass-upgrade-reminder:user_settings_test:${expiresAt}`;
    const snoozedUntil = Number(window.localStorage.getItem(storageKey));
    expect(snoozedUntil).toBe(getNextDayPassUpgradeReminderAt(NOW_MS));
    expect(snoozedUntil - NOW_MS).toBe(DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS);
    expectPageNotToContain("Your day pass has");
  });

  it("does not show day pass reminders to Pro users or on checkout/auth pages", async () => {
    const expiresAt = new Date(NOW_MS + 6 * ONE_HOUR_MS).toISOString();
    setProfileRow({ day_pass_expires_at: expiresAt });

    setAuthState({ subscription: "pro" });
    mocks.pathname = "/home";
    await renderUi(<DayPassUpgradeReminder />);
    expectPageNotToContain("Your day pass has");

    await act(async () => mountedRoot?.unmount());
    document.body.innerHTML = "";
    mountedRoot = null;

    setAuthState({ subscription: null });
    mocks.pathname = "/subscribe";
    await renderUi(<DayPassUpgradeReminder />);
    expectPageNotToContain("Your day pass has");
  });

  it("keeps the day pass reminder math behavior-driven instead of date-hardcoded", () => {
    const expiresAt = new Date(NOW_MS + 90 * 60 * 1000).toISOString();
    const msLeft = getDayPassMsLeft(expiresAt, NOW_MS);

    expect(msLeft).toBe(90 * 60 * 1000);
    expect(formatDayPassTimeLeft(msLeft)).toBe("1h 30m left");
    expect(
      shouldShowDayPassUpgradeReminder({
        expiresAt,
        isPro: false,
        nowMs: NOW_MS,
        snoozedUntilMs: null,
      }),
    ).toBe(true);
    expect(
      shouldShowDayPassUpgradeReminder({
        expiresAt,
        isPro: false,
        nowMs: NOW_MS,
        snoozedUntilMs: NOW_MS + DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS,
      }),
    ).toBe(false);
  });
});
