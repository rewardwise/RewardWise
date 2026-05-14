/** @format */

import { SupabaseClient } from "@supabase/supabase-js";

export async function isSubscriptionActive(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  const periodEnd = data?.current_period_end
    ? new Date(data.current_period_end).getTime()
    : 0;

  return Boolean(data && (!periodEnd || periodEnd > Date.now()));
}
