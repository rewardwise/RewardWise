/** @format */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const { email } = await request.json();

		if (!email) {
			return NextResponse.json({ isGoogleOnly: false });
		}

		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!,
		);

		const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

		if (error || !data) {
			return NextResponse.json({ isGoogleOnly: false });
		}

		const user = data.users.find(
			(u) => u.email?.toLowerCase() === email.toLowerCase(),
		);

		if (!user) {
			return NextResponse.json({ isGoogleOnly: false });
		}

		const providers: string[] = user.app_metadata?.providers ?? [];
		const isGoogleOnly =
			providers.includes("google") && !providers.includes("email");

		return NextResponse.json({ isGoogleOnly });
	} catch {
		return NextResponse.json({ isGoogleOnly: false });
	}
}