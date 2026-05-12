/** @format */

// Programs whose booking URLs can be constructed with date + pax params.
// All other programs fall through to VerdictBookingFallback structured copy.
//
// Verified deep-linkable airlines (cash booking flow):
//   - United: ?f=&t=&d=&r=&px=&sc= pattern, params honored
//
// Confirmed NOT deep-linkable (server-side session URLs, verified 2026-05-10):
//   - American Airlines (sid-based)
//   - Delta (cacheKeySuffix-based; partial param honor, airports ignored)
//   - Aeroplan (sid-based on aircanada.com cash flow)
//
// Program string comparison is case-insensitive — see isDeepLinkable.
// To add a program: verify in incognito that params in URL pre-fill the search,
// then add the lowercase form here.

export const DEEP_LINKABLE_PROGRAMS = new Set<string>(["united"]);

export function isDeepLinkable(program: string | undefined | null): boolean {
	if (!program) return false;
	return DEEP_LINKABLE_PROGRAMS.has(program.toLowerCase().trim());
}

// Display name lookup. Only needs entries for deep-linkable programs (the
// templated branch); fallback component receives airlineName as a prop.
const DISPLAY_NAMES: Record<string, string> = {
	united: "United",
};

export function airlineDisplayName(program: string): string {
	return DISPLAY_NAMES[program.toLowerCase().trim()] || program;
}
