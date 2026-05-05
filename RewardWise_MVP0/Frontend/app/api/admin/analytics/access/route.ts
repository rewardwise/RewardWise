/** @format */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";
import { isPmTesterEmail } from "@/utils/auth/pm-testers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const supabase = await createRouteHandlerClient();
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error || !user?.email) {
			return NextResponse.json({ canViewAnalytics: false });
		}

		return NextResponse.json({
			canViewAnalytics: isPmTesterEmail(user.email),
		});
	} catch (error) {
		console.error("Could not check analytics access", error);
		return NextResponse.json({ canViewAnalytics: false });
	}
}
