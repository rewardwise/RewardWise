/** @format */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function grantDayPassFor24Hours(
	supabase: SupabaseClient,
	userId: string,
): Promise<void> {
	const nowMs = Date.now();
	const nextExpiryIso = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();

	const { data: cur } = await supabase
		.from("profiles")
		.select("user_id")
		.eq("user_id", userId)
		.maybeSingle();

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
