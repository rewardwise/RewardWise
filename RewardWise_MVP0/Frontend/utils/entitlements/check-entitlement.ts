/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Entitlement = {
	hasActiveDayPass: boolean;
	dayPassExpiresAt: string | null;
	dayPassRemainingMs: number;
	dayPassRemainingHours: number;
	hasActiveSubscription: boolean;
	subStatus: "active" | "past_due" | "canceled" | "none";
	currentPeriodEnd: string | null;
	daysLeftInPeriod: number | null;
};

export const NO_ENTITLEMENT: Entitlement = {
	hasActiveDayPass: false,
	dayPassExpiresAt: null,
	dayPassRemainingMs: 0,
	dayPassRemainingHours: 0,
	hasActiveSubscription: false,
	subStatus: "none",
	currentPeriodEnd: null,
	daysLeftInPeriod: null,
};

export async function checkEntitlement(
	supabase: SupabaseClient,
	userId: string,
	nowMs: number = Date.now(),
): Promise<Entitlement> {
	const [{ data: sub }, { data: profile }] = await Promise.all([
		supabase
			.from("subscriptions")
			.select("status, current_period_end")
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("profiles")
			.select("day_pass_expires_at")
			.eq("user_id", userId)
			.maybeSingle(),
	]);

	const dayPassExpiresAt = profile?.day_pass_expires_at ?? null;
	const dayPassExpiryMs = dayPassExpiresAt
		? new Date(dayPassExpiresAt).getTime()
		: 0;
	const dayPassRemainingMs = Math.max(0, dayPassExpiryMs - nowMs);
	const hasActiveDayPass = dayPassRemainingMs > 0;

	const rawStatus = (sub?.status as string | undefined) ?? "none";
	const subStatus: Entitlement["subStatus"] =
		rawStatus === "active" ||
		rawStatus === "past_due" ||
		rawStatus === "canceled"
			? rawStatus
			: "none";

	const currentPeriodEnd = sub?.current_period_end ?? null;
	const subEndMs = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : 0;
	const subRemainingMs = Math.max(0, subEndMs - nowMs);
	const hasActiveSubscription =
		subStatus === "active" && (!subEndMs || subEndMs > nowMs);

	const daysLeftInPeriod = subRemainingMs
		? Math.ceil(subRemainingMs / (24 * 60 * 60 * 1000))
		: null;

	return {
		hasActiveDayPass,
		dayPassExpiresAt,
		dayPassRemainingMs,
		dayPassRemainingHours: Math.ceil(dayPassRemainingMs / (60 * 60 * 1000)),
		hasActiveSubscription,
		subStatus,
		currentPeriodEnd,
		daysLeftInPeriod,
	};
}
