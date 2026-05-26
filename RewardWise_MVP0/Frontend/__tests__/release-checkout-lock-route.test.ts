/** @format */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
	createRouteHandlerClient: vi.fn(),
	createAdminClient: vi.fn(),
}));

vi.mock("@/utils/supabase/route-handler", () => ({
	createRouteHandlerClient: mocks.createRouteHandlerClient,
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: mocks.createAdminClient,
}));

import { POST as releasePost } from "../app/api/payments/release-checkout-lock/route";

const TEST_USER_ID = "user-xyz";
const TEST_TRAVEL_REQUEST_ID = "11111111-2222-3333-4444-555555555555";

type DeleteCall = { table: string; key: string; value: string };

function makeRecordingAdmin(): {
	admin: SupabaseClient;
	deletes: DeleteCall[];
} {
	const deletes: DeleteCall[] = [];
	const admin = {
		from: (table: string) => ({
			delete: () => ({
				eq: (key: string, value: string) => {
					deletes.push({ table, key, value });
					return Promise.resolve({ data: null, error: null });
				},
			}),
		}),
	} as unknown as SupabaseClient;
	return { admin, deletes };
}

function makeAuthedSupabase(
	userId: string | null,
	opts: {
		travelRequest?: { user_id: string } | null;
		travelRequestError?: unknown;
	} = {},
): SupabaseClient {
	const travelRequestsQuery = {
		select: vi.fn(),
		eq: vi.fn(),
		single: vi.fn(),
	};
	travelRequestsQuery.select.mockReturnValue(travelRequestsQuery);
	travelRequestsQuery.eq.mockReturnValue(travelRequestsQuery);
	travelRequestsQuery.single.mockResolvedValue({
		data: opts.travelRequest
			? { id: "x", user_id: opts.travelRequest.user_id }
			: null,
		error: opts.travelRequestError ?? null,
	});
	return {
		auth: {
			getUser: vi.fn(() =>
				Promise.resolve({
					data: { user: userId ? { id: userId } : null },
				}),
			),
		},
		from: vi.fn((table: string) => {
			if (table === "travel_requests") return travelRequestsQuery;
			return { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
		}),
	} as unknown as SupabaseClient;
}

function makeRequest(body: unknown): Request {
	return new Request("https://app.test/api/payments/release-checkout-lock", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	vi.clearAllMocks();
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

afterAll(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in ORIGINAL_ENV)) delete process.env[key];
	}
	Object.assign(process.env, ORIGINAL_ENV);
});

describe("POST /api/payments/release-checkout-lock", () => {
	it("subscribe surface releases pending_subscribe_sessions keyed by user_id", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest({ surface: "subscribe" }));
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.ok).toBe(true);

		expect(deletes).toEqual([
			{
				table: "pending_subscribe_sessions",
				key: "user_id",
				value: TEST_USER_ID,
			},
		]);
	});

	it("day-pass surface releases pending_day_pass_sessions keyed by user_id", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest({ surface: "day-pass" }));
		expect(res.status).toBe(200);

		expect(deletes).toEqual([
			{
				table: "pending_day_pass_sessions",
				key: "user_id",
				value: TEST_USER_ID,
			},
		]);
	});

	it("concierge surface releases pending_concierge_sessions keyed by travel_request_id when caller owns the request", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID, {
				travelRequest: { user_id: TEST_USER_ID },
			}),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(
			makeRequest({
				surface: "concierge",
				travel_request_id: TEST_TRAVEL_REQUEST_ID,
			}),
		);
		expect(res.status).toBe(200);

		expect(deletes).toEqual([
			{
				table: "pending_concierge_sessions",
				key: "travel_request_id",
				value: TEST_TRAVEL_REQUEST_ID,
			},
		]);
	});

	it("concierge surface returns 404 + does not release when travel_request belongs to a different user (IDOR guard)", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID, {
				travelRequest: { user_id: "some-other-user" },
			}),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(
			makeRequest({
				surface: "concierge",
				travel_request_id: TEST_TRAVEL_REQUEST_ID,
			}),
		);
		expect(res.status).toBe(404);
		expect(mocks.createAdminClient).not.toHaveBeenCalled();
		expect(deletes).toEqual([]);
	});

	it("concierge surface returns 404 when travel_request row does not exist", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID, { travelRequest: null }),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(
			makeRequest({
				surface: "concierge",
				travel_request_id: TEST_TRAVEL_REQUEST_ID,
			}),
		);
		expect(res.status).toBe(404);
		expect(deletes).toEqual([]);
	});

	it("concierge surface with malformed travel_request_id returns 400", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(
			makeRequest({
				surface: "concierge",
				travel_request_id: "not-a-uuid",
			}),
		);
		expect(res.status).toBe(400);
		expect(deletes).toEqual([]);
	});

	it("concierge surface without travel_request_id returns 400 and does not call admin", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest({ surface: "concierge" }));
		expect(res.status).toBe(400);
		expect(deletes).toEqual([]);
	});

	it("invalid surface returns 400", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest({ surface: "bogus" }));
		expect(res.status).toBe(400);
		expect(deletes).toEqual([]);
	});

	it("unauthenticated request returns 401 and does not call admin", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(makeAuthedSupabase(null));
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest({ surface: "subscribe" }));
		expect(res.status).toBe(401);
		expect(mocks.createAdminClient).not.toHaveBeenCalled();
		expect(deletes).toEqual([]);
	});

	it("invalid JSON body returns 400", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest("{not-json"));
		expect(res.status).toBe(400);
		expect(deletes).toEqual([]);
	});

	it("missing service-role env returns 500 and skips admin lock release", async () => {
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res = await releasePost(makeRequest({ surface: "subscribe" }));
		expect(res.status).toBe(500);
		expect(mocks.createAdminClient).not.toHaveBeenCalled();
		expect(deletes).toEqual([]);
	});

	it("is idempotent: two release calls in a row both 200", async () => {
		mocks.createRouteHandlerClient.mockResolvedValue(
			makeAuthedSupabase(TEST_USER_ID),
		);
		const { admin, deletes } = makeRecordingAdmin();
		mocks.createAdminClient.mockReturnValue(admin);

		const res1 = await releasePost(makeRequest({ surface: "day-pass" }));
		const res2 = await releasePost(makeRequest({ surface: "day-pass" }));
		expect(res1.status).toBe(200);
		expect(res2.status).toBe(200);
		expect(deletes).toHaveLength(2);
		expect(deletes[0].table).toBe("pending_day_pass_sessions");
		expect(deletes[1].table).toBe("pending_day_pass_sessions");
	});
});
