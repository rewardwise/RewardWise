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

	await grantDayPassFor24Hours(supabase, params.userId);
	return { ok: true, alreadyProcessed: false };
}
