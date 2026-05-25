import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { POST as cancelSubscription } from "../app/api/payments/cancel-subscription/route";
import { fulfillDayPassCheckout } from "../utils/entitlements/day-pass-checkout";
import { grantDayPassFor24Hours } from "../utils/entitlements/profile-passes-server";
import { USD_CENTS } from "../utils/stripe/amounts";
import { isSubscriptionActive } from "../utils/subscription/check";

const mocks = vi.hoisted(() => ({
  createRouteHandlerClient: vi.fn(),
  getStripe: vi.fn(),
  getStripeEnv: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/utils/supabase/route-handler", () => ({
  createRouteHandlerClient: mocks.createRouteHandlerClient,
}));

vi.mock("@/utils/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));

vi.mock("@/utils/stripe/env", () => ({
  getStripeEnv: mocks.getStripeEnv,
}));

vi.mock("@/utils/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

const MS_PER_SECOND = 1_000;
const SECONDS_PER_DAY = 24 * 60 * 60;
const DAY_PASS_HOURS = 24;
const TEST_USER_ID = "test-user";
const TEST_USER_EMAIL = "test-user@example.com";
const TEST_SUBSCRIPTION_ID = "sub_test";
function makeCancelRequest(body?: unknown) {
  return new Request("https://app.test/api/payments/cancel-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const VALID_REASON_PAYLOAD = {
  reason_code: "too_expensive",
  free_text: null,
};

function freshTestRequest() {
  return makeCancelRequest(VALID_REASON_PAYLOAD);
}

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
} | null;

function makeSubscriptionLookupSupabase(row: SubscriptionRow): SupabaseClient {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({ data: row });

  return {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient;
}

type ProfileRow = {
  user_id?: string;
  onboarding_state?: string;
  day_pass_expires_at?: string | null;
} | null;

function makeProfileSupabase(
  row: ProfileRow,
  opts: { ledgerInsertError?: { code?: string; message?: string } | null } = {},
) {
  let updatePayload: Record<string, unknown> | null = null;
  let insertPayload: Record<string, unknown> | null = null;
  let ledgerInsertPayload: Record<string, unknown> | null = null;

  const profilesTable = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  profilesTable.select.mockReturnValue(profilesTable);
  profilesTable.eq.mockReturnValue(profilesTable);
  profilesTable.maybeSingle.mockResolvedValue({ data: row });
  profilesTable.update.mockImplementation((payload: Record<string, unknown>) => {
    updatePayload = payload;
    return profilesTable;
  });
  profilesTable.insert.mockImplementation((payload: Record<string, unknown>) => {
    insertPayload = payload;
    return Promise.resolve({ error: null });
  });

  const ledgerTable = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      ledgerInsertPayload = payload;
      return Promise.resolve({ error: opts.ledgerInsertError ?? null });
    }),
  };

  return {
    supabase: {
      from: vi.fn((name: string) => {
        if (name === "processed_stripe_sessions") return ledgerTable;
        return profilesTable;
      }),
    } as unknown as SupabaseClient,
    table: profilesTable,
    ledgerTable,
    get updatePayload() {
      return updatePayload;
    },
    get insertPayload() {
      return insertPayload;
    },
    get ledgerInsertPayload() {
      return ledgerInsertPayload;
    },
  };
}

function makeCancelRouteSupabase(params: {
  user: { id: string; email?: string } | null;
  subscription?: { stripe_subscription_id?: string | null; status?: string } | null;
  feedbackInsertError?: { message: string } | null;
}) {
  let updatePayload: Record<string, unknown> | null = null;
  let feedbackInsertPayload: Record<string, unknown> | null = null;

  const lookupQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  lookupQuery.select.mockReturnValue(lookupQuery);
  lookupQuery.eq.mockReturnValue(lookupQuery);
  lookupQuery.maybeSingle.mockResolvedValue({
    data: params.subscription ?? null,
    error: null,
  });

  const updateQuery = {
    eq: vi.fn(() => Promise.resolve({ error: null })),
  };

  const subscriptionsTable = {
    select: lookupQuery.select,
    eq: lookupQuery.eq,
    maybeSingle: lookupQuery.maybeSingle,
    update: vi.fn((payload: Record<string, unknown>) => {
      updatePayload = payload;
      return updateQuery;
    }),
  };

  const feedbackTable = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      feedbackInsertPayload = payload;
      return Promise.resolve({
        error: params.feedbackInsertError ?? null,
      });
    }),
  };

  const client = {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: params.user },
        }),
      ),
    },
    from: vi.fn((name: string) => {
      if (name === "cancellation_feedback") return feedbackTable;
      return subscriptionsTable;
    }),
  };

  return {
    client,
    table: subscriptionsTable,
    feedbackTable,
    lookupQuery,
    updateQuery,
    get updatePayload() {
      return updatePayload;
    },
    get feedbackInsertPayload() {
      return feedbackInsertPayload;
    },
  };
}

function roundToWholeSecond(date: Date) {
  return new Date(Math.floor(date.getTime() / MS_PER_SECOND) * MS_PER_SECOND);
}

function freezeClock(date = new Date()) {
  const now = roundToWholeSecond(date);
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return now;
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * MS_PER_SECOND);
}

function addHours(date: Date, hours: number) {
  return addSeconds(date, hours * 60 * 60);
}

function addDays(date: Date, days: number) {
  return addSeconds(date, days * SECONDS_PER_DAY);
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / MS_PER_SECOND);
}

function isoFromUnixSeconds(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * MS_PER_SECOND).toISOString() : null;
}

function expectIsoToEqualDate(actual: unknown, expected: Date) {
  expect(actual).toBe(expected.toISOString());
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.getClientIp.mockReturnValue("127.0.0.1");
  mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
  mocks.getStripeEnv.mockReturnValue({ webhookSecret: "whsec_test" });
});

describe("subscription pricing constants", () => {
  it("exposes positive whole-cent amounts for every checkout path", () => {
    const checkoutAmounts = [
      USD_CENTS.DAY_PASS_USD_CENTS,
      USD_CENTS.UNLIMITED_ZOE_MONTHLY,
      USD_CENTS.CONCIERGE_STANDARD,
      USD_CENTS.CONCIERGE_PREMIUM,
    ];

    for (const amount of checkoutAmounts) {
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
    }
  });

  it("keeps one-time and higher-touch tiers ordered above the day pass", () => {
    expect(USD_CENTS.UNLIMITED_ZOE_MONTHLY).toBeGreaterThan(
      USD_CENTS.DAY_PASS_USD_CENTS,
    );
    expect(USD_CENTS.CONCIERGE_STANDARD).toBeGreaterThan(
      USD_CENTS.UNLIMITED_ZOE_MONTHLY,
    );
    expect(USD_CENTS.CONCIERGE_PREMIUM).toBeGreaterThan(
      USD_CENTS.CONCIERGE_STANDARD,
    );
  });
});

describe("isSubscriptionActive", () => {
  it("allows an active subscription with a future period end", async () => {
    const now = freezeClock();
    const futurePeriodEnd = addDays(now, 1).toISOString();
    const supabase = makeSubscriptionLookupSupabase({
      status: "active",
      current_period_end: futurePeriodEnd,
    });

    await expect(isSubscriptionActive(supabase, TEST_USER_ID)).resolves.toBe(
      true,
    );
  });

  it("allows legacy active subscriptions that do not have current_period_end yet", async () => {
    freezeClock();
    const supabase = makeSubscriptionLookupSupabase({
      status: "active",
      current_period_end: null,
    });

    await expect(isSubscriptionActive(supabase, TEST_USER_ID)).resolves.toBe(
      true,
    );
  });

  it("keeps access for a subscription scheduled to cancel at period end", async () => {
    const now = freezeClock();
    const cancellationAccessEnd = addDays(now, 1).toISOString();
    const supabase = makeSubscriptionLookupSupabase({
      status: "active",
      current_period_end: cancellationAccessEnd,
    });

    await expect(isSubscriptionActive(supabase, TEST_USER_ID)).resolves.toBe(
      true,
    );
  });

  it("blocks an active subscription after its period end has passed", async () => {
    const now = freezeClock();
    const expiredPeriodEnd = addDays(now, -1).toISOString();
    const supabase = makeSubscriptionLookupSupabase({
      status: "active",
      current_period_end: expiredPeriodEnd,
    });

    await expect(isSubscriptionActive(supabase, TEST_USER_ID)).resolves.toBe(
      false,
    );
  });

  it("blocks users with no active subscription row", async () => {
    freezeClock();
    const supabase = makeSubscriptionLookupSupabase(null);

    await expect(isSubscriptionActive(supabase, TEST_USER_ID)).resolves.toBe(
      false,
    );
  });
});

describe("day pass fulfillment", () => {
  it("grants exactly 24 hours for a first-time day pass user", async () => {
    const now = freezeClock();
    const expectedExpiry = addHours(now, DAY_PASS_HOURS);
    const ctx = makeProfileSupabase(null);

    await grantDayPassFor24Hours(ctx.supabase, TEST_USER_ID);

    expect(ctx.insertPayload).toMatchObject({
      user_id: TEST_USER_ID,
      onboarding_state: "pending",
      day_pass_expires_at: expectedExpiry.toISOString(),
    });
  });

  it("replaces an existing day pass with a fresh 24h window from now, does not stack", async () => {
    const now = freezeClock();
    const existingExpiry = addHours(now, DAY_PASS_HOURS + 6);
    const expectedExpiry = addHours(now, DAY_PASS_HOURS);
    const ctx = makeProfileSupabase({
      user_id: TEST_USER_ID,
      day_pass_expires_at: existingExpiry.toISOString(),
    });

    await grantDayPassFor24Hours(ctx.supabase, TEST_USER_ID);

    expect(ctx.updatePayload).toMatchObject({
      day_pass_expires_at: expectedExpiry.toISOString(),
    });
  });

  it("does not fulfill a day pass when Stripe amount_total does not match the configured price", async () => {
    const ctx = makeProfileSupabase(null);

    await expect(
      fulfillDayPassCheckout(ctx.supabase, {
        userId: TEST_USER_ID,
        amountTotalCents: USD_CENTS.DAY_PASS_USD_CENTS + 1,
        stripeSessionId: "cs_test_amount_mismatch",
      }),
    ).resolves.toEqual({ ok: false, error: "amount_mismatch" });

    expect(ctx.table.insert).not.toHaveBeenCalled();
    expect(ctx.table.update).not.toHaveBeenCalled();
    expect(ctx.ledgerTable.insert).not.toHaveBeenCalled();
  });

  it("fulfills a day pass when Stripe amount_total matches the configured price", async () => {
    const now = freezeClock();
    const expectedExpiry = addHours(now, DAY_PASS_HOURS);
    const ctx = makeProfileSupabase(null);

    await expect(
      fulfillDayPassCheckout(ctx.supabase, {
        userId: TEST_USER_ID,
        amountTotalCents: USD_CENTS.DAY_PASS_USD_CENTS,
        stripeSessionId: "cs_test_first_fulfill",
      }),
    ).resolves.toEqual({ ok: true, alreadyProcessed: false });

    expect(ctx.insertPayload).toMatchObject({
      user_id: TEST_USER_ID,
      day_pass_expires_at: expectedExpiry.toISOString(),
    });
    expect(ctx.ledgerInsertPayload).toMatchObject({
      session_id: "cs_test_first_fulfill",
      user_id: TEST_USER_ID,
    });
  });

  it("treats a duplicate session_id as already processed", async () => {
    freezeClock();
    const ctx = makeProfileSupabase(null, {
      ledgerInsertError: { code: "23505", message: "duplicate key" },
    });

    await expect(
      fulfillDayPassCheckout(ctx.supabase, {
        userId: TEST_USER_ID,
        amountTotalCents: USD_CENTS.DAY_PASS_USD_CENTS,
        stripeSessionId: "cs_test_duplicate",
      }),
    ).resolves.toEqual({ ok: true, alreadyProcessed: true });

    // Post-B2 ordering (commit 7): grant runs BEFORE the ledger insert, so
    // a webhook retry of the same session_id will invoke the grant a second
    // time before discovering the dedup. This is intentional and safe:
    // grantDayPassFor24Hours writes a fresh now+24h expiry, which on a
    // sub-second retry is effectively a no-op (the new expiry equals the
    // previous expiry within network-jitter precision). The contract the
    // caller depends on — `alreadyProcessed: true` so downstream confirm
    // flows don't double-acknowledge the user — is preserved.
    //
    // Previous-order assertion that profiles were untouched on the dedup
    // path was implementation-coupled; the new B2 order trades that
    // micro-property for closing a "ledger-says-paid but grant silently
    // failed" lockout. See day-pass-checkout.ts comment for the full why.
  });

  it("rejects a fulfillment call with a missing or malformed session id", async () => {
    const ctx = makeProfileSupabase(null);

    await expect(
      fulfillDayPassCheckout(ctx.supabase, {
        userId: TEST_USER_ID,
        amountTotalCents: USD_CENTS.DAY_PASS_USD_CENTS,
        stripeSessionId: "not_a_real_id",
      }),
    ).resolves.toEqual({ ok: false, error: "bad_session_id" });

    expect(ctx.ledgerTable.insert).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/cancel-subscription", () => {
  it("rate-limits repeated cancellation attempts before touching auth or Stripe", async () => {
    const retryAfterMs = 30 * MS_PER_SECOND;
    mocks.checkRateLimit.mockReturnValue({
      allowed: false,
      retryAfterMs,
    });

    const response = await cancelSubscription(freshTestRequest());

    expect(response.status).toBe(429);
    expect(mocks.createRouteHandlerClient).not.toHaveBeenCalled();
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    const { client } = makeCancelRouteSupabase({ user: null });
    mocks.createRouteHandlerClient.mockResolvedValue(client);

    const response = await cancelSubscription(freshTestRequest());

    expect(response.status).toBe(401);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("returns 404 when the user does not have an active monthly subscription", async () => {
    const { client } = makeCancelRouteSupabase({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      subscription: {
        stripe_subscription_id: TEST_SUBSCRIPTION_ID,
        status: "canceled",
      },
    });
    mocks.createRouteHandlerClient.mockResolvedValue(client);

    const response = await cancelSubscription(freshTestRequest());

    expect(response.status).toBe(404);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("sets cancel_at_period_end in Stripe and keeps the local subscription active until Stripe's period end", async () => {
    const now = freezeClock();
    const stripeCurrentPeriodStart = toUnixSeconds(addDays(now, -1));
    const stripeCurrentPeriodEnd = toUnixSeconds(addDays(now, 30));
    const stripeCanceledAt = toUnixSeconds(now);

    const ctx = makeCancelRouteSupabase({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      subscription: {
        stripe_subscription_id: TEST_SUBSCRIPTION_ID,
        status: "active",
      },
    });
    mocks.createRouteHandlerClient.mockResolvedValue(ctx.client);

    const stripeUpdate = vi.fn().mockResolvedValue({
      current_period_start: stripeCurrentPeriodStart,
      current_period_end: stripeCurrentPeriodEnd,
      canceled_at: stripeCanceledAt,
    });
    mocks.getStripe.mockReturnValue({
      subscriptions: {
        update: stripeUpdate,
      },
    });

    const response = await cancelSubscription(
      makeCancelRequest({
        reason_code: "missing_features",
        free_text: "  needs better award search  ",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      accessEndsAt: isoFromUnixSeconds(stripeCurrentPeriodEnd),
    });
    expect(stripeUpdate).toHaveBeenCalledWith(TEST_SUBSCRIPTION_ID, {
      cancel_at_period_end: true,
    });
    expect(ctx.updatePayload).toMatchObject({
      status: "active",
      cancel_at_period_end: true,
      current_period_start: isoFromUnixSeconds(stripeCurrentPeriodStart),
      current_period_end: isoFromUnixSeconds(stripeCurrentPeriodEnd),
      canceled_at: isoFromUnixSeconds(stripeCanceledAt),
    });
    expectIsoToEqualDate(ctx.updatePayload?.updated_at, now);
    expect(ctx.updateQuery.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(ctx.feedbackInsertPayload).toEqual({
      user_id: TEST_USER_ID,
      reason_code: "missing_features",
      free_text: "needs better award search",
      stripe_subscription_id: TEST_SUBSCRIPTION_ID,
    });
  });

  it("rejects a request with no JSON body before touching Stripe", async () => {
    const { client } = makeCancelRouteSupabase({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
    });
    mocks.createRouteHandlerClient.mockResolvedValue(client);

    const response = await cancelSubscription(
      new Request("https://app.test/api/payments/cancel-subscription", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("rejects an unknown reason_code", async () => {
    const { client } = makeCancelRouteSupabase({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
    });
    mocks.createRouteHandlerClient.mockResolvedValue(client);

    const response = await cancelSubscription(
      makeCancelRequest({ reason_code: "spite", free_text: null }),
    );

    expect(response.status).toBe(400);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request before reading the body — no enum leak", async () => {
    const { client } = makeCancelRouteSupabase({ user: null });
    mocks.createRouteHandlerClient.mockResolvedValue(client);

    // Even with a syntactically valid reason, an unauthenticated caller
    // must get 401, not 400 — otherwise the response code probes the enum.
    const responseValid = await cancelSubscription(
      makeCancelRequest({ reason_code: "too_expensive", free_text: null }),
    );
    expect(responseValid.status).toBe(401);

    mocks.createRouteHandlerClient.mockResolvedValue(client);
    const responseInvalid = await cancelSubscription(
      makeCancelRequest({ reason_code: "spite", free_text: null }),
    );
    expect(responseInvalid.status).toBe(401);
  });

  it("stores null free_text when omitted, and persists reason code on the feedback row", async () => {
    const now = freezeClock();
    const stripeCurrentPeriodEnd = toUnixSeconds(addDays(now, 14));

    const ctx = makeCancelRouteSupabase({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      subscription: {
        stripe_subscription_id: TEST_SUBSCRIPTION_ID,
        status: "active",
      },
    });
    mocks.createRouteHandlerClient.mockResolvedValue(ctx.client);
    mocks.getStripe.mockReturnValue({
      subscriptions: {
        update: vi.fn().mockResolvedValue({
          current_period_end: stripeCurrentPeriodEnd,
          canceled_at: toUnixSeconds(now),
        }),
      },
    });

    const response = await cancelSubscription(
      makeCancelRequest({ reason_code: "not_using" }),
    );

    expect(response.status).toBe(200);
    expect(ctx.feedbackInsertPayload).toEqual({
      user_id: TEST_USER_ID,
      reason_code: "not_using",
      free_text: null,
      stripe_subscription_id: TEST_SUBSCRIPTION_ID,
    });
  });

  it("still returns 200 if feedback insert fails — Stripe cancel already succeeded", async () => {
    const now = freezeClock();
    const stripeCurrentPeriodEnd = toUnixSeconds(addDays(now, 14));

    const ctx = makeCancelRouteSupabase({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      subscription: {
        stripe_subscription_id: TEST_SUBSCRIPTION_ID,
        status: "active",
      },
      feedbackInsertError: { message: "rls denied" },
    });
    mocks.createRouteHandlerClient.mockResolvedValue(ctx.client);
    mocks.getStripe.mockReturnValue({
      subscriptions: {
        update: vi.fn().mockResolvedValue({
          current_period_end: stripeCurrentPeriodEnd,
          canceled_at: toUnixSeconds(now),
        }),
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await cancelSubscription(
      makeCancelRequest(VALID_REASON_PAYLOAD),
    );

    expect(response.status).toBe(200);
    expect(ctx.feedbackInsertPayload).toMatchObject({
      reason_code: "too_expensive",
    });
    consoleSpy.mockRestore();
  });
});
