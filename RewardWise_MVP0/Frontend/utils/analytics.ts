/** @format */

import { createClient } from "@/utils/supabase/client";

export type HandoffClickPayload = {
	program: string;
	origin: string;
	destination: string;
	depart_date: string;
	return_date?: string | null;
	travelers: number;
	cabin?: string;
	verdict_type: "cash" | "points";
	amount_cash?: number;
	amount_points?: number;
	taxes?: number;
};

export async function logHandoffClick(payload: HandoffClickPayload): Promise<void> {
	try {
		const supabase = createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;
		await supabase.from("booking_handoff_clicks").insert({
			user_id: user.id,
			...payload,
		});
	} catch (err) {
		console.warn("handoff click log failed", err);
	}
}
