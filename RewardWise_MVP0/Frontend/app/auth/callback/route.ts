import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase redirects here with error params when OTP/link is invalid or expired
  const errorCode = searchParams.get("error_code");
  if (errorCode === "otp_expired" || errorCode === "access_denied") {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
  }

  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If an explicit redirect was requested (e.g. password reset), honor it
      const next = searchParams.get("next");
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Otherwise, route based on portfolio state
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_error`);
}
