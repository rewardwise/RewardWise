/** @format */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = ["/", "/about", "/login", "/signup"];

const protectedRoutes = [
	"/home",
	"/dashboard",
	"/search",
	"/settings",
	"/trips",
	"/watchlist",
	"/concierge",
	"/profile",
	"/history",
	"/circle",
	"/wallet-setup",
];

// Routes that require auth only (no portfolio needed)
const authOnlyRoutes = ["/wallet-setup", "/reset-password"];


export async function middleware(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });

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

					supabaseResponse = NextResponse.next({ request });

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

	const isPublic = publicRoutes.some(
		(route) => pathname === route || pathname.startsWith(route + "/"),
	);

	const isProtected = protectedRoutes.some((route) =>
		pathname.startsWith(route),
	);

	const isPortfolioRoute = isProtected && !authOnlyRoutes.some((route) =>
		pathname.startsWith(route),
	);

	if (isProtected && !user) {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		return NextResponse.redirect(url);
	}

	// Logged in, trying to access a portfolio route → check cards
	if (isPortfolioRoute && user) {
		const { count } = await supabase
			.from("cards")
			.select("*", { count: "exact", head: true })
			.eq("user_id", user.id);

		const skip = request.nextUrl.searchParams.get("skip");

		if ((count ?? 0) === 0 && !skip) {
			const url = request.nextUrl.clone();
			url.pathname = "/wallet-setup";
			return NextResponse.redirect(url);
		}
	}

	return supabaseResponse;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
