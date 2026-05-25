import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
	acquirePendingDayPassLock,
	releasePendingDayPassLock,
} from "../utils/entitlements/pending-day-pass-lock";

const USER_ID = "user-abc";
const NOW = new Date("2026-05-24T20:00:00.000Z");

type InsertResult = { error: { code?: string } | null };
type SelectResult = { data: { expires_at: string } | null; error: unknown };
type DeleteResult = { error: unknown };

function makeLockSupabase(opts: {
	insertResults: InsertResult[];
	selectResult?: SelectResult;
	deleteResult?: DeleteResult;
}): {
	supabase: SupabaseClient;
	insertCalls: number;
	deleteCalls: number;
	selectCalls: number;
} {
	let insertCalls = 0;
	let deleteCalls = 0;
	let selectCalls = 0;

	const insert = vi.fn(async () => {
		const r = opts.insertResults[insertCalls] ?? { error: null };
		insertCalls++;
		return r;
	});

	const selectChain = {
		select: vi.fn(),
		eq: vi.fn(),
		maybeSingle: vi.fn(async () => {
			selectCalls++;
			return opts.selectResult ?? { data: null, error: null };
		}),
	};
	selectChain.select.mockReturnValue(selectChain);
	selectChain.eq.mockReturnValue(selectChain);

	const deleteChain = {
		delete: vi.fn(),
		eq: vi.fn(async () => {
			deleteCalls++;
			return opts.deleteResult ?? { error: null };
		}),
	};
	deleteChain.delete.mockReturnValue(deleteChain);

	const supabase = {
		from: vi.fn(() => ({
			insert,
			select: selectChain.select,
			eq: selectChain.eq,
			maybeSingle: selectChain.maybeSingle,
			delete: deleteChain.delete,
		})),
	} as unknown as SupabaseClient;

	return {
		supabase,
		get insertCalls() {
			return insertCalls;
		},
		get deleteCalls() {
			return deleteCalls;
		},
		get selectCalls() {
			return selectCalls;
		},
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("acquirePendingDayPassLock", () => {
	it("returns ok when the insert succeeds (no existing lock)", async () => {
		const ctx = makeLockSupabase({
			insertResults: [{ error: null }],
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result).toEqual({ ok: true });
		expect(ctx.insertCalls).toBe(1);
		expect(ctx.deleteCalls).toBe(0);
	});

	it("returns in_flight with retry-after seconds when an active lock exists", async () => {
		const expiresAt = new Date(NOW.getTime() + 90 * 1000).toISOString();
		const ctx = makeLockSupabase({
			insertResults: [{ error: { code: "23505" } }],
			selectResult: { data: { expires_at: expiresAt }, error: null },
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result.ok).toBe(false);
		if (result.ok === false && result.reason === "in_flight") {
			expect(result.retryAfterSeconds).toBe(90);
		} else {
			throw new Error("expected in_flight result");
		}
		expect(ctx.deleteCalls).toBe(0);
	});

	it("DELETEs a stale row and retries the insert", async () => {
		const expiresAt = new Date(NOW.getTime() - 60 * 1000).toISOString();
		const ctx = makeLockSupabase({
			insertResults: [{ error: { code: "23505" } }, { error: null }],
			selectResult: { data: { expires_at: expiresAt }, error: null },
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result).toEqual({ ok: true, reusedAfterStale: true });
		expect(ctx.insertCalls).toBe(2);
		expect(ctx.deleteCalls).toBe(1);
	});

	it("returns lock_failed when the retry insert also fails (no infinite loop)", async () => {
		const expiresAt = new Date(NOW.getTime() - 60 * 1000).toISOString();
		const ctx = makeLockSupabase({
			insertResults: [
				{ error: { code: "23505" } },
				{ error: { code: "23505" } },
			],
			selectResult: { data: { expires_at: expiresAt }, error: null },
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result).toEqual({ ok: false, reason: "lock_failed" });
		expect(ctx.insertCalls).toBe(2);
	});

	it("returns lock_failed on a non-unique-violation insert error", async () => {
		const ctx = makeLockSupabase({
			insertResults: [{ error: { code: "42P01" } }],
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result).toEqual({ ok: false, reason: "lock_failed" });
		expect(ctx.insertCalls).toBe(1);
	});

	it("treats an existing-row with null expires_at as stale and retries", async () => {
		const ctx = makeLockSupabase({
			insertResults: [{ error: { code: "23505" } }, { error: null }],
			selectResult: { data: null, error: null },
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result.ok).toBe(true);
		expect(ctx.deleteCalls).toBe(1);
	});

	it("returns lock_failed when the select after 23505 errors out", async () => {
		const ctx = makeLockSupabase({
			insertResults: [{ error: { code: "23505" } }],
			selectResult: { data: null, error: { code: "boom" } },
		});

		const result = await acquirePendingDayPassLock(ctx.supabase, USER_ID);

		expect(result).toEqual({ ok: false, reason: "lock_failed" });
	});
});

describe("releasePendingDayPassLock", () => {
	it("issues a DELETE scoped to the user_id", async () => {
		const ctx = makeLockSupabase({
			insertResults: [],
		});

		await releasePendingDayPassLock(ctx.supabase, USER_ID);

		expect(ctx.deleteCalls).toBe(1);
	});

	it("does not throw when DELETE returns an error (idempotent best-effort)", async () => {
		const ctx = makeLockSupabase({
			insertResults: [],
			deleteResult: { error: { code: "boom" } },
		});

		await expect(
			releasePendingDayPassLock(ctx.supabase, USER_ID),
		).resolves.toBeUndefined();
	});
});
