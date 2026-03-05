/** @format */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require auth + cards (portfolio)
const portfolioRoutes = [
	"/home",
	"/dashboard",
	"/search",
	"/settings",
	"/trips",
	"/watchlist",
	"/concierge",
];

// Routes that require auth only (no portfolio needed)
const authOnlyRoutes = [
	"/wallet-setup",
	"/home",
	"/trips",
	"/circle",
	"/history",
	"/profile",
];

export async function proxy(request: NextRequest) {
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

	const isPortfolioRoute = portfolioRoutes.some((route) =>
		pathname.startsWith(route),
	);
	const isAuthOnlyRoute = authOnlyRoutes.some((route) =>
		pathname.startsWith(route),
	);

	// Not logged in → redirect to landing
	if ((isPortfolioRoute || isAuthOnlyRoute) && !user) {
		const url = request.nextUrl.clone();
		url.pathname = "/";
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
			url.pathname = "/";
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
