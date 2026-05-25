/** @format */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isInternalEmail } from "@/utils/auth/internal-accounts";

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
];

/**
 * Routes reachable without an active Zoe subscription.
 * Keep this tight. Do NOT include core app routes like /home, /concierge,
 * /wallet-setup, /history, /trips, etc.
 */
const subscriptionFreeRoutes = ["/subscribe", "/profile"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isSubscriptionFreeRoute(pathname: string) {
  return subscriptionFreeRoutes.some((route) => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicRoute(pathname);
  const isSubscriptionFree = isSubscriptionFreeRoute(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (user && !isPublic && !isSubscriptionFree) {
    if (isInternalEmail(user.email)) {
      return supabaseResponse;
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("day_pass_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const dayPassExpiryMs = profile?.day_pass_expires_at
      ? new Date(profile.day_pass_expires_at).getTime()
      : 0;

    const hasActiveDayPass = dayPassExpiryMs > Date.now();

    if (hasActiveDayPass) {
      return supabaseResponse;
    }

    const subscriptionPeriodEndMs = sub?.current_period_end
      ? new Date(sub.current_period_end).getTime()
      : 0;
    const hasActiveSubscription =
      sub?.status === "active" &&
      (!subscriptionPeriodEndMs || subscriptionPeriodEndMs > Date.now());

    if (sub?.status === "past_due") {
      const url = request.nextUrl.clone();
      url.pathname = "/subscribe";
      url.search = "";
      url.searchParams.set("past_due", "1");

      const redirectResponse = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirectResponse);
      return redirectResponse;
    }

    if (!hasActiveSubscription) {
      const url = request.nextUrl.clone();
      url.pathname = "/subscribe";
      url.search = "";

      const redirectResponse = NextResponse.redirect(url);
      copyCookies(supabaseResponse, redirectResponse);
      return redirectResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
