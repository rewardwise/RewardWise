import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if user has cards (portfolio)
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
