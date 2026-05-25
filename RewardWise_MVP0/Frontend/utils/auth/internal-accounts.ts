/** @format */

/**
 * Internal accounts bypass the paywall entirely (skip middleware redirect,
 * skip auth/callback subscription check, see "internal account" pricing UX).
 *
 * Distinct from pm-testers.ts: PM testers still go through the paywall and
 * pay a $1 Monthly discount. Internal accounts pay $0 and never see the
 * paywall. The two allowlists are intentionally separate env vars.
 *
 * Configured via INTERNAL_EMAILS env var (comma-separated, trimmed,
 * lowercased). Update via Vercel project settings; no schema or migration.
 */
export function getInternalEmails() {
	return (process.env.INTERNAL_EMAILS ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isInternalEmail(email?: string | null) {
	if (!email) return false;
	return getInternalEmails().includes(email.trim().toLowerCase());
}
