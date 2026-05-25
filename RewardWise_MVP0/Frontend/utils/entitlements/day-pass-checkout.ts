/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";
import { USD_CENTS } from "@/utils/stripe/amounts";
import { grantDayPassFor24Hours } from "./profile-passes-server";

export const STRIPE_DAY_PASS_PURCHASE_TYPE = "day_pass" as const;

export function isDayPassStripePurchaseType(t: string | undefined): boolean {
	return t === STRIPE_DAY_PASS_PURCHASE_TYPE || t === "zoe_single";
}

export type FulfillDayPassResult = {
	ok: boolean;
	error?: string;
	alreadyProcessed?: boolean;
};

export async function fulfillDayPassCheckout(
	supabase: SupabaseClient,
	params: {
		userId: string;
		amountTotalCents: number;
		stripeSessionId: string;
	},
): Promise<FulfillDayPassResult> {
	if (params.amountTotalCents !== USD_CENTS.DAY_PASS_USD_CENTS) {
		return { ok: false, error: "amount_mismatch" };
	}

	if (!params.stripeSessionId || !params.stripeSessionId.startsWith("cs_")) {
		return { ok: false, error: "bad_session_id" };
	}

	// Order: grant FIRST, then ledger. Reversed in commit 7/B2 fix and
	// hardened in commit 8/M5 with explicit error propagation.
	//
	// Previous order (ledger → grant) had a silent-lockout failure mode: if
	// the ledger row committed but grantDayPassFor24Hours silently failed
	// (the void-returning version swallowed Supabase errors), any retry of
	// the same session_id would hit the 23505 dedup branch and short-circuit
	// with alreadyProcessed=true, never re-attempting the grant. Net effect:
	// Stripe charged, ledger says "fulfilled", but profiles.day_pass_expires_at
	// is unset — the user has a paid receipt and no access, and the system
	// has no way to recover without manual SQL.
	//
	// With grant first AND error propagation: if grant fails, we return the
	// error immediately and the ledger row is never written, so a webhook
	// retry (or confirm-day-pass POST retry) re-enters this function and
	// re-attempts the grant. The dedup window shrinks from "forever" to
	// "the gap between grant success and ledger insert for a single
	// attempt", which is acceptable given that grant is idempotent
	// (upsert with onConflict='user_id' rewrites the same expiry within
	// network-jitter precision on a retry).
	const grantResult = await grantDayPassFor24Hours(supabase, params.userId);
	if (!grantResult.ok) {
		return { ok: false, error: grantResult.error ?? "grant_failed" };
	}

	const { error: insertError } = await supabase
		.from("processed_stripe_sessions")
		.insert({
			session_id: params.stripeSessionId,
			user_id: params.userId,
			purchase_type: STRIPE_DAY_PASS_PURCHASE_TYPE,
			amount_cents: params.amountTotalCents,
		});

	if (insertError) {
		const code = (insertError as { code?: string }).code;
		if (code === "23505") {
			return { ok: true, alreadyProcessed: true };
		}
		return { ok: false, error: "ledger_insert_failed" };
	}

	return { ok: true, alreadyProcessed: false };
}
