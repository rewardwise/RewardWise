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

	// Order: grant FIRST, then ledger. Reversed in commit 7/B2 fix.
	//
	// Previous order (ledger → grant) had a silent-lockout failure mode: if
	// the ledger row committed but grantDayPassFor24Hours silently failed
	// (it returns void today; errors from the underlying update/insert are
	// not surfaced), any retry of the same session_id would hit the 23505
	// dedup branch and short-circuit with alreadyProcessed=true, never
	// re-attempting the grant. Net effect: Stripe charged, ledger says
	// "fulfilled", but profiles.day_pass_expires_at is unset — the user
	// has a paid receipt and no access, and the system has no way to
	// recover without manual SQL.
	//
	// With grant first: if grant fails silently, the ledger row is never
	// written, so a webhook retry (or confirm-day-pass POST retry) will
	// re-enter this function and re-attempt the grant. The dedup window
	// shrinks from "forever" to "the gap between grant and ledger insert
	// for a single attempt", which is acceptable given that grant is
	// idempotent (writing the same expiry twice is a no-op effect-wise,
	// even if it triggers two SQL statements).
	//
	// Followup (commit 8 / M5): grantDayPassFor24Hours will return
	// {ok, error} and propagate failures here, at which point we can
	// short-circuit before the ledger insert on grant failure. For now,
	// the order reversal alone removes the "permanently stuck" state.
	await grantDayPassFor24Hours(supabase, params.userId);

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
