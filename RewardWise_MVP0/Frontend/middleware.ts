/** @format */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedTeamEmail } from "@/utils/auth/allowlist";

const publicRoutes = [
	"/",
	"/login",
	"/auth/callback",
	"/forgot-password",
	"/reset-password",
];

function isPublicRoute(pathname: string) {
	return publicRoutes.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);
}

function copyCookies(from: NextResponse, to: NextResponse) {
	for (const cookie of from.cookies.getAll()) {
		to.cookies.set(cookie);
	}
}

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
		url.pathname = "/";
		url.search = "";
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};