/** @format */

/**
 * Private invitation-only mode (2026-07-27).
 *
 * MyTravelWallet no longer accepts public signups. Enforcement is layered:
 *   - /auth/callback DELETES a freshly-provisioned non-exempt account
 *     (OAuth signups, email-confirm signups, magic links all traverse it).
 *   - middleware.ts BLOCKS any non-exempt session on every request (covers
 *     password-flow signups that never traverse the callback). It signs the
 *     user out and shows the private-mode banner; it never deletes.
 *   - /signup renders the banner instead of the form (UI layer only).
 *
 * Exemption rules, in order (each alone is sufficient):
 *   1. invited_at set — an admin-invited account is authorized by definition.
 *      Future invites = Supabase admin invite; no env edit needed.
 *   2. Email on the SERVER-side allowlist (INTERNAL_EMAILS env — never
 *      NEXT_PUBLIC_INTERNAL_EMAILS, which ships in the client bundle and
 *      would leak invitee emails) or the built-in owner list below.
 *   3. Grandfathered: the account's EARLIEST identity predates the cutoff.
 *      Keyed on min(created_at, identities[].created_at) so a returning user
 *      whose new sign-in method (e.g. first Google login) links onto their
 *      existing user is never treated as new. (If Supabase declines to link
 *      a duplicate email, no new row is minted — nothing to gate.)
 *
 * Test provisioning is unaffected: the Playwright fixture mints sessions
 * purely server-side (admin magic link + verifyOtp + cookie injection) and
 * never traverses the callback; fixture accounts also predate the cutoff.
 *
 * Cutoff: verified 2026-07-27 that the newest existing account was created
 * 2026-07-21 — every pre-existing user clears the cutoff by 6 days.
 */

export const PRIVATE_MODE_CUTOFF_ISO = "2026-07-27T00:00:00.000Z";

/** Owner accounts, always invited. Public-by-design (the banner itself
 *  publishes the contact address); everything else rides INTERNAL_EMAILS. */
const BUILT_IN_INVITES = [
	"sarabjit.nagi@gmail.com",
	"mytravelwalletai@gmail.com",
];

export function getServerInviteAllowlist(): string[] {
	// Server-only env var, deliberately NOT the shared internal-accounts
	// helper (which falls back to NEXT_PUBLIC_INTERNAL_EMAILS).
	const env = (process.env.INTERNAL_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return [...new Set([...env, ...BUILT_IN_INVITES])];
}

export interface GateUser {
	email?: string | null;
	created_at?: string | null;
	invited_at?: string | null;
	identities?: Array<{ created_at?: string | null }> | null;
}

/** True when the account may use the app under private mode. */
export function isExemptFromPrivateGate(user: GateUser | null | undefined): boolean {
	if (!user) return false;
	if (user.invited_at) return true;
	const email = (user.email ?? "").trim().toLowerCase();
	if (email && getServerInviteAllowlist().includes(email)) return true;
	const stamps = [user.created_at, ...(user.identities ?? []).map((i) => i?.created_at)]
		.filter((s): s is string => Boolean(s))
		.map((s) => new Date(s).getTime())
		.filter((t) => Number.isFinite(t));
	if (stamps.length === 0) return false;
	return Math.min(...stamps) < new Date(PRIVATE_MODE_CUTOFF_ISO).getTime();
}

export const PRIVATE_MODE_BANNER =
	"MyTravelWallet is now private — invitation only. To request access, email mytravelwalletai@gmail.com.";
