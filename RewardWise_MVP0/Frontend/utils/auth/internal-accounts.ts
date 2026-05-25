/** @format */

/**
 * Internal accounts bypass the paywall entirely (skip middleware redirect,
 * skip auth/callback subscription check, see "internal account" pricing UX).
 *
 * Distinct from pm-testers.ts: PM testers still go through the paywall and
 * pay a $1 Monthly discount. Internal accounts pay $0 and never see the
 * paywall. The two allowlists are intentionally separate env vars.
 *
 * Configured via INTERNAL_EMAILS (server-only, used by middleware +
 * auth/callback) and NEXT_PUBLIC_INTERNAL_EMAILS (mirrored for client
 * components that need to render internal-account UI). Both must be kept
 * in sync via Vercel project settings; no schema or migration.
 */
export function getInternalEmails() {
	const raw =
		process.env.INTERNAL_EMAILS ?? process.env.NEXT_PUBLIC_INTERNAL_EMAILS ?? "";
	return raw
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isInternalEmail(email?: string | null) {
	if (!email) return false;
	return getInternalEmails().includes(email.trim().toLowerCase());
}
