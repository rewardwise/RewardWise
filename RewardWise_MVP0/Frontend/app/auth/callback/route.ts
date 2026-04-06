import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAllowedTeamEmail } from "@/utils/auth/allowlist";

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

			if (!user || !isAllowedTeamEmail(user.email)) {
				await supabase.auth.signOut();
				return NextResponse.redirect(`${origin}/?access=denied`);
			}

			const next = searchParams.get("next");
			if (next) {
				return NextResponse.redirect(`${origin}${next}`);
			}

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