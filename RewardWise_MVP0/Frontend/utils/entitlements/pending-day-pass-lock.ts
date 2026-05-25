/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";

export const PENDING_DAY_PASS_LOCK_TTL_SECONDS = 5 * 60;

export type AcquirePendingLockResult =
	| { ok: true; reusedAfterStale?: boolean }
	| { ok: false; reason: "in_flight"; retryAfterSeconds: number }
	| { ok: false; reason: "lock_failed" };

/**
 * Acquire the per-user parallel-checkout lock for Day Pass purchases.
 *
 * Strategy:
 *   1. Try INSERT into pending_day_pass_sessions(user_id, …).
 *   2. On unique violation (PG code 23505), read the existing row's
 *      expires_at:
 *        - If expires_at > now(): a checkout is genuinely in flight.
 *          Return reason="in_flight" with the seconds the caller should
 *          surface as Retry-After.
 *        - Else: the row is a stale carcass from an abandoned tab.
 *          DELETE it and retry the INSERT once.
 *
 * Two-attempt cap: if the second INSERT also fails (race against another
 * cleanup or a brand-new request from the same user), we return
 * "lock_failed" rather than looping. The caller surfaces a generic
 * "please try again" rather than a contradictory "in flight" message —
 * the user's next click will hit either an empty table or a fresh
 * in-flight row, both of which are correctly handled on the next call.
 *
 * The 5-minute TTL is intentional: Stripe Checkout sessions live 24h,
 * but a tab abandoned for 5+ minutes is effectively dead. If the user
 * does return and pay on the old session, processed_stripe_sessions
 * catches it as a fulfillment-side dedup.
 */
export async function acquirePendingDayPassLock(
	supabase: SupabaseClient,
	userId: string,
): Promise<AcquirePendingLockResult> {
	const firstInsert = await supabase
		.from("pending_day_pass_sessions")
		.insert({ user_id: userId });

	if (!firstInsert.error) {
		return { ok: true };
	}

	const code = (firstInsert.error as { code?: string }).code;
	if (code !== "23505") {
		return { ok: false, reason: "lock_failed" };
	}

	const { data: existing, error: readError } = await supabase
		.from("pending_day_pass_sessions")
		.select("expires_at")
		.eq("user_id", userId)
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
		.from("pending_day_pass_sessions")
		.delete()
		.eq("user_id", userId);

	if (deleteError) {
		return { ok: false, reason: "lock_failed" };
	}

	const retryInsert = await supabase
		.from("pending_day_pass_sessions")
		.insert({ user_id: userId });

	if (retryInsert.error) {
		return { ok: false, reason: "lock_failed" };
	}

	return { ok: true, reusedAfterStale: true };
}

/**
 * Release the lock. Idempotent — safe to call when no row exists.
 * Called from:
 *   - confirm-day-pass on successful fulfillment
 *   - webhook handler on checkout.session.expired
 *   - day-pass route on Stripe API failure (so a transient Stripe error
 *     doesn't leave the user locked out for 5 minutes)
 */
export async function releasePendingDayPassLock(
	supabase: SupabaseClient,
	userId: string,
): Promise<void> {
	await supabase
		.from("pending_day_pass_sessions")
		.delete()
		.eq("user_id", userId);
}
