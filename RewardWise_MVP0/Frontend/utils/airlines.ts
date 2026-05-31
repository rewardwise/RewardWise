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

// V1 frontend-only program domain map. Drift risk with backend _get_booking_link_for_verdict.
// Centralize in V2 — see ticket 86b9xxadk.
//
// Key set must cover seats.aero PROGRAM_ALIASES (utils/programAliases.ts).
// Backend mirror: Backend/app/services/verdict_service.py PROGRAM_URL_OVERRIDES.

export const PROGRAM_HOMEPAGE_URLS: Record<string, string> = {
	united: "https://www.united.com",
	delta: "https://www.delta.com",
	american: "https://www.aa.com",
	americanairlines: "https://www.aa.com",
	alaska: "https://www.alaskaair.com/mileageplan",
	jetblue: "https://trueblue.jetblue.com",
	aeroplan: "https://www.aircanada.com/aeroplan",
	virginatlantic: "https://flyingclub.virginatlantic.com",
	flyingblue: "https://www.flyingblue.com",
	air_france: "https://www.flyingblue.com",
	british: "https://www.britishairways.com/executiveclub",
	britishairways: "https://www.britishairways.com/executiveclub",
	singapore: "https://www.singaporeair.com",
	cathay: "https://www.cathaypacific.com",
	emirates: "https://www.emirates.com",
	turkish: "https://www.turkishairlines.com",
	qantas: "https://www.qantas.com",
	avianca: "https://www.lifemiles.com",
	lifemiles: "https://www.lifemiles.com",
	etihad: "https://www.etihad.com",
	qatar: "https://www.qatarairways.com",
	saudia: "https://www.saudia.com",
	smiles: "https://www.smiles.com.br",
	azul: "https://www.voeazul.com.br",
	korean: "https://www.koreanair.com",
	ana: "https://www.ana.co.jp",
	southwest: "https://www.southwest.com",
	hyatt: "https://www.hyatt.com/world-of-hyatt",
	marriott: "https://www.marriott.com/loyalty",
};

export const PROGRAM_DISPLAY_NAMES: Record<string, string> = {
	united: "United",
	delta: "Delta SkyMiles",
	american: "American Airlines",
	americanairlines: "American Airlines",
	alaska: "Alaska Airlines",
	jetblue: "JetBlue TrueBlue",
	aeroplan: "Aeroplan",
	virginatlantic: "Virgin Atlantic Flying Club",
	flyingblue: "Flying Blue",
	air_france: "Flying Blue (Air France/KLM)",
	british: "British Airways",
	britishairways: "British Airways",
	singapore: "Singapore KrisFlyer",
	cathay: "Cathay Pacific Asia Miles",
	emirates: "Emirates Skywards",
	turkish: "Turkish Miles&Smiles",
	qantas: "Qantas Frequent Flyer",
	avianca: "Avianca LifeMiles",
	lifemiles: "Avianca LifeMiles",
	etihad: "Etihad Guest",
	qatar: "Qatar Privilege Club",
	saudia: "Saudia Alfursan",
	smiles: "GOL Smiles",
	azul: "Azul TudoAzul",
	korean: "Korean Air SKYPASS",
	ana: "ANA Mileage Club",
	southwest: "Southwest Rapid Rewards",
	hyatt: "World of Hyatt",
	marriott: "Marriott Bonvoy",
};

// Title-case a raw program key as a last-resort display fallback so an
// unknown key like "saudia" still renders as "Saudia" — never the bare slug.
function titleCaseProgramKey(key: string): string {
	const cleaned = key.replace(/[_-]+/g, " ").trim();
	return cleaned
		.split(/\s+/)
		.map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
		.join(" ");
}

export function getProgramHandoffInfo(programKey: string): { url: string; displayName: string } {
	const normalized = programKey.toLowerCase().trim();
	const mappedUrl = PROGRAM_HOMEPAGE_URLS[normalized];
	// Mirror backend _get_airline_url: synthesize https://www.{slug}.com/ when
	// the explicit map misses. The slug strips non-alphanumerics so keys with
	// underscores ("air_france") yield a syntactically valid host.
	const slug = normalized.replace(/[^a-z0-9]+/g, "");
	const fallbackUrl = slug ? `https://www.${slug}.com` : "#";
	return {
		url: mappedUrl || fallbackUrl,
		displayName: PROGRAM_DISPLAY_NAMES[normalized] || titleCaseProgramKey(programKey),
	};
}
