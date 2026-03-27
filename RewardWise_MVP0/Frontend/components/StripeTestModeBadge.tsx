/** @format */

"use client";

export default function StripeTestModeBadge() {
	const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

	if (!pk?.startsWith("pk_test_")) return null;

}
