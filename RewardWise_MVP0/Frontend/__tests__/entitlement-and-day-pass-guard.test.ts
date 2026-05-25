import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
	createRouteHandlerClient: vi.fn(),
	createAdminClient: vi.fn(),
	getStripe: vi.fn(),
	getStripeEnv: vi.fn(),
	checkRateLimit: vi.fn(),
	getClientIp: vi.fn(),
}));

vi.mock("@/utils/supabase/route-handler", () => ({
	createRouteHandlerClient: mocks.createRouteHandlerClient,
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: mocks.createAdminClient,
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

import { GET as entitlementGet } from "../app/api/me/entitlement/route";
import { POST as dayPassPost } from "../app/api/payments/day-pass/route";
import { checkEntitlement } from "../utils/entitlements/check-entitlement";

const TEST_USER_ID = "test-user-id";
const TEST_USER_EMAIL = "user@example.com";
const NOW = new Date("2026-05-24T18:00:00.000Z");

function makeEntitlementSupabase(params: {
	user: { id: string; email?: string } | null;
	subscription?: { status: string; current_period_end: string | null } | null;
	profile?: { day_pass_expires_at: string | null } | null;
}): SupabaseClient {
	const subscriptionsQuery = {
		select: vi.fn(),
		eq: vi.fn(),
		maybeSingle: vi.fn(),
	};
	subscriptionsQuery.select.mockReturnValue(subscriptionsQuery);
	subscriptionsQuery.eq.mockReturnValue(subscriptionsQuery);
	subscriptionsQuery.maybeSingle.mockResolvedValue({
		data: params.subscription ?? null,
	});

	const profilesQuery = {
		select: vi.fn(),
		eq: vi.fn(),
		maybeSingle: vi.fn(),
	};
	profilesQuery.select.mockReturnValue(profilesQuery);
	profilesQuery.eq.mockReturnValue(profilesQuery);
	profilesQuery.maybeSingle.mockResolvedValue({
		data: params.profile ?? null,
	});

	return {
		auth: {
			getUser: vi.fn(() => Promise.resolve({ data: { user: params.user } })),
		},
		from: vi.fn((table: string) => {
			if (table === "subscriptions") return subscriptionsQuery;
			if (table === "profiles") return profilesQuery;
			return { select: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn() };
		}),
	} as unknown as SupabaseClient;
}

function makeLockAdminClient(opts?: { insertError?: { code?: string } | null }) {
	const insert = vi.fn(async () => ({ error: opts?.insertError ?? null }));
	const eqDelete = vi.fn(async () => ({ error: null }));
	const deleteFn = vi.fn(() => ({ eq: eqDelete }));
	const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
	const eqSelect = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq: eqSelect }));
	return {
		from: vi.fn(() => ({
			insert,
			select,
			delete: deleteFn,
		})),
		_internals: { insert, deleteFn, eqDelete, maybeSingle },
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	vi.clearAllMocks();
	mocks.getClientIp.mockReturnValue("127.0.0.1");
	mocks.checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
	mocks.getStripeEnv.mockReturnValue({ webhookSecret: "whsec_test" });
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
	mocks.createAdminClient.mockReturnValue(makeLockAdminClient());
});

describe("checkEntitlement helper", () => {
	it("returns no entitlements for a user with no subscription row and no profile", async () => {
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID },
		});

		const e = await checkEntitlement(supabase, TEST_USER_ID);

		expect(e.hasActiveDayPass).toBe(false);
		expect(e.hasActiveSubscription).toBe(false);
		expect(e.subStatus).toBe("none");
		expect(e.dayPassRemainingMs).toBe(0);
		expect(e.dayPassRemainingHours).toBe(0);
		expect(e.currentPeriodEnd).toBeNull();
		expect(e.daysLeftInPeriod).toBeNull();
	});

	it("reports an active day pass with remaining hours when expiry is in the future", async () => {
		const expires = new Date(NOW.getTime() + 6 * 60 * 60 * 1000).toISOString();
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID },
			profile: { day_pass_expires_at: expires },
		});

		const e = await checkEntitlement(supabase, TEST_USER_ID);

		expect(e.hasActiveDayPass).toBe(true);
		expect(e.dayPassRemainingHours).toBe(6);
		expect(e.dayPassExpiresAt).toBe(expires);
		expect(e.hasActiveSubscription).toBe(false);
	});

	it("treats an expired day pass as inactive even when the row still exists", async () => {
		const expires = new Date(NOW.getTime() - 60 * 1000).toISOString();
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID },
			profile: { day_pass_expires_at: expires },
		});

		const e = await checkEntitlement(supabase, TEST_USER_ID);

		expect(e.hasActiveDayPass).toBe(false);
		expect(e.dayPassRemainingMs).toBe(0);
	});

	it("reports an active subscription with future period end", async () => {
		const periodEnd = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID },
			subscription: { status: "active", current_period_end: periodEnd },
		});

		const e = await checkEntitlement(supabase, TEST_USER_ID);

		expect(e.hasActiveSubscription).toBe(true);
		expect(e.subStatus).toBe("active");
		expect(e.daysLeftInPeriod).toBe(14);
	});

	it("preserves past_due status without granting active access", async () => {
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID },
			subscription: { status: "past_due", current_period_end: null },
		});

		const e = await checkEntitlement(supabase, TEST_USER_ID);

		expect(e.subStatus).toBe("past_due");
		expect(e.hasActiveSubscription).toBe(false);
	});

	it("allows a legacy active subscription with no current_period_end", async () => {
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID },
			subscription: { status: "active", current_period_end: null },
		});

		const e = await checkEntitlement(supabase, TEST_USER_ID);

		expect(e.hasActiveSubscription).toBe(true);
		expect(e.subStatus).toBe("active");
	});
});

describe("GET /api/me/entitlement", () => {
	it("returns 401 when no user is signed in", async () => {
		const supabase = makeEntitlementSupabase({ user: null });
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);

		const res = await entitlementGet(
			new Request("https://app.test/api/me/entitlement"),
		);

		expect(res.status).toBe(401);
	});

	it("returns the user's full entitlement payload with no-store cache control", async () => {
		const expires = new Date(NOW.getTime() + 3 * 60 * 60 * 1000).toISOString();
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
			profile: { day_pass_expires_at: expires },
		});
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);

		const res = await entitlementGet(
			new Request("https://app.test/api/me/entitlement"),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		const body = await res.json();
		expect(body).toMatchObject({
			hasActiveDayPass: true,
			dayPassRemainingHours: 3,
			hasActiveSubscription: false,
		});
	});

	it("returns 429 when the IP is rate-limited", async () => {
		mocks.checkRateLimit.mockReturnValue({
			allowed: false,
			retryAfterMs: 30_000,
		});

		const res = await entitlementGet(
			new Request("https://app.test/api/me/entitlement"),
		);

		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBe("30");
	});
});

describe("POST /api/payments/day-pass entitlement guard", () => {
	function makeDayPassRequest() {
		return new Request("https://app.test/api/payments/day-pass", {
			method: "POST",
			headers: { "Content-Type": "application/json", origin: "https://app.test" },
			body: JSON.stringify({}),
		});
	}

	it("returns 409 with upsell:monthly when the user already has an active Day Pass", async () => {
		const expires = new Date(NOW.getTime() + 5 * 60 * 60 * 1000).toISOString();
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
			profile: { day_pass_expires_at: expires },
		});
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);
		const stripeCreate = vi.fn();
		mocks.getStripe.mockReturnValue({
			checkout: { sessions: { create: stripeCreate } },
		});

		const res = await dayPassPost(makeDayPassRequest());

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body).toMatchObject({
			error: "active_day_pass",
			hasActiveDayPass: true,
			hasActiveSubscription: false,
			upsell: "monthly",
		});
		expect(stripeCreate).not.toHaveBeenCalled();
	});

	it("returns 409 with upsell:null when the user already has an active Monthly subscription", async () => {
		const periodEnd = new Date(NOW.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
			subscription: { status: "active", current_period_end: periodEnd },
		});
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);
		const stripeCreate = vi.fn();
		mocks.getStripe.mockReturnValue({
			checkout: { sessions: { create: stripeCreate } },
		});

		const res = await dayPassPost(makeDayPassRequest());

		expect(res.status).toBe(409);
		const body = await res.json();
		expect(body).toMatchObject({
			error: "active_subscription",
			hasActiveSubscription: true,
			upsell: null,
		});
		expect(stripeCreate).not.toHaveBeenCalled();
	});

	it("creates a Stripe checkout session when no active pass or subscription exists", async () => {
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
		});
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);
		const stripeCreate = vi
			.fn()
			.mockResolvedValue({ url: "https://checkout.stripe.com/c/test" });
		mocks.getStripe.mockReturnValue({
			checkout: { sessions: { create: stripeCreate } },
		});

		const res = await dayPassPost(makeDayPassRequest());

		expect(res.status).toBe(200);
		expect(stripeCreate).toHaveBeenCalledTimes(1);
		const body = await res.json();
		expect(body).toEqual({ url: "https://checkout.stripe.com/c/test" });
	});

	it("returns 409 with Retry-After header when a parallel checkout is already in flight", async () => {
		const supabase = makeEntitlementSupabase({
			user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
		});
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);
		const stripeCreate = vi.fn();
		mocks.getStripe.mockReturnValue({
			checkout: { sessions: { create: stripeCreate } },
		});

		// Mock the lock as already held with 90s remaining.
		const expiresAt = new Date(NOW.getTime() + 90 * 1000).toISOString();
		const adminInsert = vi.fn(async () => ({ error: { code: "23505" } }));
		const maybeSingle = vi.fn(async () => ({
			data: { expires_at: expiresAt },
			error: null,
		}));
		const eqSelect = vi.fn(() => ({ maybeSingle }));
		const select = vi.fn(() => ({ eq: eqSelect }));
		mocks.createAdminClient.mockReturnValue({
			from: vi.fn(() => ({
				insert: adminInsert,
				select,
				delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
			})),
		});

		const res = await dayPassPost(makeDayPassRequest());

		expect(res.status).toBe(409);
		expect(res.headers.get("Retry-After")).toBe("90");
		const body = await res.json();
		expect(body).toMatchObject({ retryAfterSeconds: 90 });
		expect(stripeCreate).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated calls with 401 before touching entitlement state", async () => {
		const supabase = makeEntitlementSupabase({ user: null });
		mocks.createRouteHandlerClient.mockResolvedValue(supabase);
		const stripeCreate = vi.fn();
		mocks.getStripe.mockReturnValue({
			checkout: { sessions: { create: stripeCreate } },
		});

		const res = await dayPassPost(makeDayPassRequest());

		expect(res.status).toBe(401);
		expect(stripeCreate).not.toHaveBeenCalled();
	});
});
