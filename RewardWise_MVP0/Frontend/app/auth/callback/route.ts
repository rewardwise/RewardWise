import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);

	const errorCode = searchParams.get("error_code");
	if (errorCode === "otp_expired" || errorCode === "access_denied") {
		return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
	}

	const code = searchParams.get("code");

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				await supabase.auth.signOut();
				return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
			}

			const next = searchParams.get("next");
			if (
				next &&
				next.startsWith("/") &&
				!next.startsWith("//") &&
				!/^\/\\/.test(next) &&
				!next.includes("://")
			) {
				return NextResponse.redirect(`${origin}${next}`);
			}

			// Wind-down (2026-07): MyTravelWallet is free for everyone. The
			// post-login subscription gate that bounced non-subscribers to
			// /subscribe has been removed — every authenticated user proceeds
			// straight into the app (wallet setup, then /home).
			const { count } = await supabase
				.from("cards")
				.select("*", { count: "exact", head: true })
				.eq("user_id", user.id);

			if ((count ?? 0) > 0) {
				return NextResponse.redirect(`${origin}/home`);
			}

			return NextResponse.redirect(`${origin}/wallet-setup`);
		}
	}

	return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
