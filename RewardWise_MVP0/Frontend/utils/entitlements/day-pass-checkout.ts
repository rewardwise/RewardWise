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
};

export async function fulfillDayPassCheckout(
	supabase: SupabaseClient,
	params: {
		userId: string;
		amountTotalCents: number;
	},
): Promise<FulfillDayPassResult> {
	if (params.amountTotalCents !== USD_CENTS.DAY_PASS_USD_CENTS) {
		return { ok: false, error: "amount_mismatch" };
	}

	await grantDayPassFor24Hours(supabase, params.userId);
	return { ok: true };
}
