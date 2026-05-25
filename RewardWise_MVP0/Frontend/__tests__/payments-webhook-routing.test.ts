/** @format */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createClient: vi.fn(),
	getStripe: vi.fn(),
	getStripeEnv: vi.fn(),
	headers: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: mocks.createClient,
}));

vi.mock("@/utils/stripe/client", () => ({
	getStripe: mocks.getStripe,
}));

vi.mock("@/utils/stripe/env", () => ({
	getStripeEnv: mocks.getStripeEnv,
}));

vi.mock("next/headers", () => ({
	headers: mocks.headers,
}));

import { POST as webhookPost } from "../app/api/payments/webhook/route";

// Recording Supabase stub: every from(table).<method>(...) chain returns
// an awaitable that resolves to {data, error: null}, and every call lands
// in the `calls` array so tests can assert which tables got hit. The
// chain shape covers the verbs the webhook actually uses on the completion
// branch: delete().eq(), update().eq(), select().eq().single(), insert().
type RecordedCall = {
	table: string;
	verb: string;
	args: unknown[];
};

function makeRecordingSupabase(opts: {
	travelRequestRow?: { status: string; constraints: unknown } | null;
} = {}) {
	const calls: RecordedCall[] = [];

	function chain(table: string, verb: string) {
		const node: Record<string, unknown> = {};
		const wrap = (next: string, nextArgs: unknown[]) => {
			calls.push({ table, verb: `${verb}.${next}`, args: nextArgs });
			return chain(table, `${verb}.${next}`);
		};
		node.eq = (...a: unknown[]) => wrap("eq", a);
		node.lt = (...a: unknown[]) => wrap("lt", a);
		node.gt = (...a: unknown[]) => wrap("gt", a);
		node.select = (...a: unknown[]) => wrap("select", a);
		node.single = () => {
			calls.push({ table, verb: `${verb}.single`, args: [] });
			if (table === "travel_requests" && verb.startsWith("select")) {
				return Promise.resolve({
					data: opts.travelRequestRow ?? null,
					error: null,
				});
			}
			return Promise.resolve({ data: null, error: null });
		};
		// Thenable: makes the chain itself awaitable for verbs that don't
		// terminate in .single() (e.g. .delete().eq() and .update().eq()).
		node.then = (resolve: (value: { data: null; error: null }) => unknown) =>
			Promise.resolve({ data: null, error: null }).then(resolve);
		return node;
	}

	return {
		client: {
			from: (table: string) => {
				return {
					delete: (...a: unknown[]) => {
						calls.push({ table, verb: "delete", args: a });
						return chain(table, "delete");
					},
					update: (...a: unknown[]) => {
						calls.push({ table, verb: "update", args: a });
						return chain(table, "update");
					},
					select: (...a: unknown[]) => {
						calls.push({ table, verb: "select", args: a });
						return chain(table, "select");
					},
					insert: (...a: unknown[]) => {
						calls.push({ table, verb: "insert", args: a });
						return Promise.resolve({ data: null, error: null });
					},
					upsert: (...a: unknown[]) => {
						calls.push({ table, verb: "upsert", args: a });
						return Promise.resolve({ data: null, error: null });
					},
				};
			},
		},
		calls,
	};
}

function makeWebhookRequest(rawBody: string) {
	return new Request("https://app.test/api/payments/webhook", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"stripe-signature": "t=1,v1=signed",
		},
		body: rawBody,
	});
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	vi.clearAllMocks();
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

	mocks.getStripeEnv.mockReturnValue({ webhookSecret: "whsec_test" });
	mocks.headers.mockResolvedValue({
		get: (k: string) =>
			k === "stripe-signature" ? "t=1,v1=signed" : null,
	});
});

afterAll(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in ORIGINAL_ENV)) delete process.env[key];
	}
	Object.assign(process.env, ORIGINAL_ENV);
});

describe("POST /api/payments/webhook — checkout.session.completed routing", () => {
	it("day-pass completion: releases pending_day_pass_sessions lock and does NOT touch travel_requests / pending_concierge_sessions", async () => {
		const { client, calls } = makeRecordingSupabase();
		mocks.createClient.mockReturnValue(client);
		mocks.getStripe.mockReturnValue({
			webhooks: {
				constructEvent: () => ({
					type: "checkout.session.completed",
					data: {
						object: {
							id: "cs_dp_test",
							mode: "payment",
							client_reference_id: "search_abc",
							metadata: {
								purchase_type: "day_pass",
								user_id: "user_dp_1",
							},
						},
					},
				}),
			},
		});

		const res = await webhookPost(makeWebhookRequest("{}"));
		expect(res.status).toBe(200);

		const dayPassDelete = calls.find(
			(c) =>
				c.table === "pending_day_pass_sessions" &&
				c.verb === "delete.eq",
		);
		expect(dayPassDelete).toBeDefined();
		expect(dayPassDelete!.args).toEqual(["user_id", "user_dp_1"]);

		// Latent-footgun assertion: prior version would have fallen through
		// to the concierge branch via client_reference_id=search_abc, running
		// an UPDATE against travel_requests + a DELETE against
		// pending_concierge_sessions. New routing must not touch either.
		expect(
			calls.find((c) => c.table === "travel_requests"),
		).toBeUndefined();
		expect(
			calls.find((c) => c.table === "pending_concierge_sessions"),
		).toBeUndefined();
	});

	it("concierge completion: updates travel_requests to paid + releases pending_concierge_sessions, with no day-pass-lock side effect", async () => {
		const { client, calls } = makeRecordingSupabase({
			travelRequestRow: { status: "payment_pending", constraints: null },
		});
		mocks.createClient.mockReturnValue(client);
		mocks.getStripe.mockReturnValue({
			webhooks: {
				constructEvent: () => ({
					type: "checkout.session.completed",
					data: {
						object: {
							id: "cs_concierge_test",
							mode: "payment",
							client_reference_id:
								"11111111-2222-3333-4444-555555555555",
							metadata: {
								travel_request_id:
									"11111111-2222-3333-4444-555555555555",
							},
						},
					},
				}),
			},
		});

		const res = await webhookPost(makeWebhookRequest("{}"));
		expect(res.status).toBe(200);

		// Marks request paid
		const tr_select = calls.find(
			(c) => c.table === "travel_requests" && c.verb === "select",
		);
		expect(tr_select).toBeDefined();
		const tr_update = calls.find(
			(c) => c.table === "travel_requests" && c.verb === "update",
		);
		expect(tr_update).toBeDefined();
		const updatePatch = tr_update!.args[0] as Record<string, unknown>;
		expect(updatePatch.status).toBe("paid");

		// Releases concierge lock by travel_request_id
		const concDelete = calls.find(
			(c) =>
				c.table === "pending_concierge_sessions" &&
				c.verb === "delete.eq",
		);
		expect(concDelete).toBeDefined();
		expect(concDelete!.args).toEqual([
			"travel_request_id",
			"11111111-2222-3333-4444-555555555555",
		]);

		// Symmetry guard: must NOT touch the day-pass lock table.
		expect(
			calls.find((c) => c.table === "pending_day_pass_sessions"),
		).toBeUndefined();
	});

	it("unmatched payment session: warns + 200s + zero DB mutations", async () => {
		const { client, calls } = makeRecordingSupabase();
		mocks.createClient.mockReturnValue(client);
		mocks.getStripe.mockReturnValue({
			webhooks: {
				constructEvent: () => ({
					type: "checkout.session.completed",
					data: {
						object: {
							id: "cs_orphan",
							mode: "payment",
							// no metadata.purchase_type, no metadata.travel_request_id
							metadata: {},
						},
					},
				}),
			},
		});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const res = await webhookPost(makeWebhookRequest("{}"));
		expect(res.status).toBe(200);

		expect(warnSpy).toHaveBeenCalled();
		const warnMsg = warnSpy.mock.calls[0]?.[0] as string;
		expect(warnMsg).toMatch(/unmatched payment session/i);
		expect(warnMsg).toContain("cs_orphan");

		// Zero DB mutations: warn-and-ack only, no DELETEs, no UPDATEs.
		expect(
			calls.filter(
				(c) => c.verb === "delete" || c.verb.startsWith("update"),
			),
		).toEqual([]);

		warnSpy.mockRestore();
	});
});
