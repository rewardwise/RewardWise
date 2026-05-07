/** @format */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedTeamEmail } from "@/utils/auth/allowlist";

const publicRoutes = [
	"/",
	"/login",
	"/signup",
	"/auth/callback",
	"/forgot-password",
	"/reset-password",
];

/** Routes reachable without an active Zoe subscription (paywall / purchase flows). */
const subscriptionFreeRoutes = [
	"/subscribe",
	"/profile",
	"/home",
	"/concierge",
	"/wallet-setup",
];

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
	const isAllowed = isAllowedTeamEmail(user?.email);

	if (user && !isAllowed) {
		await supabase.auth.signOut();

		const url = request.nextUrl.clone();
		url.pathname = "/";
		url.search = "";
		url.searchParams.set("access", "denied");

		const redirectResponse = NextResponse.redirect(url);
		copyCookies(supabaseResponse, redirectResponse);
		return redirectResponse;
	}

	if (!user && !isPublic) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		url.search = "";
		const redirectResponse = NextResponse.redirect(url);
		copyCookies(supabaseResponse, redirectResponse);
		return redirectResponse;
	}

	if (user && !isPublic && !isSubscriptionFreeRoute(pathname)) {
		const { data: sub } = await supabase
			.from("subscriptions")
			.select("status")
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

		if (!sub || sub.status === "canceled") {
			const url = request.nextUrl.clone();
			url.pathname = "/subscribe";
			url.search = "";
			const redirectResponse = NextResponse.redirect(url);
			copyCookies(supabaseResponse, redirectResponse);
			return redirectResponse;
		}

		if (sub.status === "past_due") {
			const url = request.nextUrl.clone();
			url.pathname = "/subscribe";
			url.search = "";
			url.searchParams.set("past_due", "1");
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
