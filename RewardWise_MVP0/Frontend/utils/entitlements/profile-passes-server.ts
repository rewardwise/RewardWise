/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";

export type GrantDayPassResult = {
	ok: boolean;
	/** Stable machine-readable code; English copy lives in user-messages.ts. */
	error?: "grant_failed";
};

/**
 * Set profiles.day_pass_expires_at to now + 24h, atomically.
 *
 * Prior implementation used a check-then-act pattern (SELECT profile row →
 * branch on existence → INSERT or UPDATE). Two concurrent grants for the
 * same user could both observe "no row" and both attempt INSERT; one would
 * win, the other would get a unique-violation that this code silently
 * swallowed (and surfaced as a successful grant return, even though
 * day_pass_expires_at may or may not have ended up set depending on which
 * write won the race). On a re-fulfillment retry, an UPDATE race had the
 * inverse problem: both updates would succeed but with identical values, so
 * no harm — but the check-then-act pattern was a latent footgun waiting
 * for a row-not-found race to flip behavior.
 *
 * Upsert with onConflict: "user_id" collapses both paths into a single
 * atomic statement that doesn't race. We omit `onboarding_state` from the
 * payload because the column has DEFAULT 'pending' at the schema level
 * (verified in supabase/snapshots/2026-05-19_post_reconciliation.sql) —
 * specifying it would re-pin existing users back to 'pending' on every
 * Day Pass grant, which is wrong.
 *
 * The previous implementation also returned `Promise<void>` and discarded
 * the Supabase error object, which let grant failures vanish silently and
 * was the root of the B2 "ledger commits before grant" lockout (see
 * day-pass-checkout.ts). Now returns {ok, error} so the caller can
 * short-circuit before writing the dedup ledger row.
 */
export async function grantDayPassFor24Hours(
	supabase: SupabaseClient,
	userId: string,
): Promise<GrantDayPassResult> {
	const nowIso = new Date().toISOString();
	const nextExpiryIso = new Date(
		Date.now() + 24 * 60 * 60 * 1000,
	).toISOString();

	const { error } = await supabase.from("profiles").upsert(
		{
			user_id: userId,
			day_pass_expires_at: nextExpiryIso,
			modified_at: nowIso,
		},
		{ onConflict: "user_id" },
	);

	if (error) {
		return { ok: false, error: "grant_failed" };
	}
	return { ok: true };
}
