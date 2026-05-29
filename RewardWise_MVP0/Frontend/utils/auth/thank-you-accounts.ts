/** @format */

/**
 * Thank-you allowlist: new signups whose email is in THANK_YOU_EMAILS get
 * coupon mtw-thank-you-2026-05 attached at Checkout (100% off, 2 months).
 *
 * SEPARATE from INTERNAL_EMAILS — internal accounts skip the paywall entirely.
 * Thank-you accounts still pay (after 2 months) and go through the normal
 * /api/payments/subscribe flow.
 *
 * Server-only: NO NEXT_PUBLIC_ twin. Emails on this list are prospect PII and
 * must not ship in the client bundle. The /subscribe banner is gated on a
 * boolean computed server-side (in app/subscribe/page.tsx) and passed to the
 * client component as a prop.
 */
export function getThankYouEmails() {
	const raw = process.env.THANK_YOU_EMAILS ?? "";
	return raw
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isThankYouEmail(email?: string | null) {
	if (!email) return false;
	return getThankYouEmails().includes(email.trim().toLowerCase());
}
