/** @format */

import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const adminClient = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!,
		);

		const { data, error } = await adminClient.auth.admin.getUserById(user.id);

		if (error || !data?.user) {
			return NextResponse.json({ isGoogleOnly: false });
		}

		const providers: string[] = data.user.app_metadata?.providers ?? [];
		const isGoogleOnly =
			providers.includes("google") && !providers.includes("email");

		return NextResponse.json({ isGoogleOnly });
	} catch {
		return NextResponse.json({ isGoogleOnly: false });
	}
}
