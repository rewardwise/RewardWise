/** @format */

import { SupabaseClient } from "@supabase/supabase-js";

export async function isSubscriptionActive(
	supabase: SupabaseClient,
	userId: string,
): Promise<boolean> {
	const { data } = await supabase
		.from("subscriptions")
		.select("status")
		.eq("user_id", userId)
		.eq("status", "active")
		.single();

	return !!data;
}
