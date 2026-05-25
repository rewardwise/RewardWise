/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";

export const PENDING_CHECKOUT_LOCK_TTL_SECONDS = 5 * 60;

/**
 * Identifies which lock table + which row to act on. We carry the key
 * column name (not just the value) so the same helper can serve all
 * three Stripe checkout surfaces:
 *
 *   pending_day_pass_sessions   keyed on user_id
 *   pending_subscribe_sessions  keyed on user_id
 *   pending_concierge_sessions  keyed on travel_request_id
 *
 * The narrow string-literal union catches typos at compile time; if a
 * future caller picks the wrong table, tsc fails rather than letting
 * the lock silently target the wrong column.
 */
export type PendingLockTarget = {
	table:
		| "pending_day_pass_sessions"
		| "pending_subscribe_sessions"
		| "pending_concierge_sessions";
	keyColumn: "user_id" | "travel_request_id";
	keyValue: string;
};

export type AcquirePendingLockResult =
	| { ok: true; reusedAfterStale?: boolean }
	| { ok: false; reason: "in_flight"; retryAfterSeconds: number }
	| { ok: false; reason: "lock_failed" };

/**
 * Acquire a per-row parallel-checkout lock.
 *
 * Strategy:
 *   1. Try INSERT into the target table.
 *   2. On unique violation (PG code 23505), read the existing row's
 *      expires_at:
 *        - If expires_at > now(): a checkout is genuinely in flight.
 *          Return reason="in_flight" with the seconds the caller should
 *          surface as Retry-After.
 *        - Else: the row is a stale carcass from an abandoned tab.
 *          DELETE it and retry the INSERT once.
 *
 * Two-attempt cap: if the second INSERT also fails (race against another
 * cleanup or a brand-new request for the same key), we return
 * "lock_failed" rather than looping. The caller surfaces a generic
 * "please try again" rather than a contradictory "in flight" message —
 * the user's next click will hit either an empty table or a fresh
 * in-flight row, both of which are correctly handled on the next call.
 *
 * The 5-minute TTL is intentional. Stripe Checkout sessions live 24h,
 * but a tab abandoned for 5+ minutes is effectively dead. If the user
 * does return and pay on the old session, the per-surface fulfillment
 * ledger (processed_stripe_sessions, travel_requests.status='paid', etc.)
 * catches it as a fulfillment-side dedup.
 */
export async function acquirePendingCheckoutLock(
	supabase: SupabaseClient,
	target: PendingLockTarget,
): Promise<AcquirePendingLockResult> {
	const firstInsert = await supabase
		.from(target.table)
		// supabase-js v2 narrows the insert type per from() table, which
// doesn't compose with a dynamic key. The runtime contract is sound:
// table comes from a string-literal union, keyColumn from a string-
// literal union — both validated at compile time at every call site
// via the PendingLockTarget type. Cast suppresses only the typegen
// inference, not real type-safety.
.insert({ [target.keyColumn]: target.keyValue } as never);

	if (!firstInsert.error) {
		return { ok: true };
	}

	const code = (firstInsert.error as { code?: string }).code;
	if (code !== "23505") {
		return { ok: false, reason: "lock_failed" };
	}

	const { data: existing, error: readError } = await supabase
		.from(target.table)
		.select("expires_at")
		.eq(target.keyColumn, target.keyValue)
		.maybeSingle();

	if (readError) {
		return { ok: false, reason: "lock_failed" };
	}

	const nowMs = Date.now();
	const expiresAtMs = existing?.expires_at
		? new Date(existing.expires_at as string).getTime()
		: 0;

	if (expiresAtMs > nowMs) {
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((expiresAtMs - nowMs) / 1000),
		);
		return { ok: false, reason: "in_flight", retryAfterSeconds };
	}

	const { error: deleteError } = await supabase
		.from(target.table)
		.delete()
		.eq(target.keyColumn, target.keyValue);

	if (deleteError) {
		return { ok: false, reason: "lock_failed" };
	}

	const retryInsert = await supabase
		.from(target.table)
		// supabase-js v2 narrows the insert type per from() table, which
// doesn't compose with a dynamic key. The runtime contract is sound:
// table comes from a string-literal union, keyColumn from a string-
// literal union — both validated at compile time at every call site
// via the PendingLockTarget type. Cast suppresses only the typegen
// inference, not real type-safety.
.insert({ [target.keyColumn]: target.keyValue } as never);

	if (retryInsert.error) {
		return { ok: false, reason: "lock_failed" };
	}

	return { ok: true, reusedAfterStale: true };
}

/**
 * Release a lock. Idempotent — safe to call when no row exists.
 *
 * Called from:
 *   - confirm-day-pass on successful fulfillment
 *   - day-pass / subscribe / concierge routes on Stripe API failure
 *   - Stripe webhook handler on checkout.session.expired
 *   - Stripe webhook handler on checkout.session.completed for the
 *     subscribe + concierge surfaces (no client-side confirm endpoint)
 */
export async function releasePendingCheckoutLock(
	supabase: SupabaseClient,
	target: PendingLockTarget,
): Promise<void> {
	await supabase
		.from(target.table)
		.delete()
		.eq(target.keyColumn, target.keyValue);
}
