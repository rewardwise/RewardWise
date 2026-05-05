/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function grantDayPassFor24Hours(
	supabase: SupabaseClient,
	userId: string,
): Promise<void> {
	const now = Date.now();
	const { data: cur } = await supabase
		.from("profiles")
		.select("user_id, onboarding_state, day_pass_expires_at")
		.eq("user_id", userId)
		.maybeSingle();

	const currentExpiryMs = cur?.day_pass_expires_at
		? new Date(cur.day_pass_expires_at).getTime()
		: 0;
	const baseMs = Math.max(now, Number.isFinite(currentExpiryMs) ? currentExpiryMs : 0);
	const nextExpiryIso = new Date(baseMs + 24 * 60 * 60 * 1000).toISOString();

	if (cur?.user_id) {
		await supabase
			.from("profiles")
			.update({
				day_pass_expires_at: nextExpiryIso,
				modified_at: new Date().toISOString(),
			})
			.eq("user_id", userId);
	} else {
		await supabase.from("profiles").insert({
			user_id: userId,
			onboarding_state: "pending",
			day_pass_expires_at: nextExpiryIso,
		});
	}
}
