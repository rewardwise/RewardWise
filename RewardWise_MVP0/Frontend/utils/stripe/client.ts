/** @format */

import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
	if (!process.env.STRIPE_SECRET_KEY) {
		throw new Error("Missing STRIPE_SECRET_KEY (use a test key: sk_test_...)");
	}
	if (!stripeSingleton) {
		stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY, {
			typescript: true,
		});
	}
	return stripeSingleton;
}

export function isStripeTestMode(): boolean {
	const k = process.env.STRIPE_SECRET_KEY ?? "";
	return k.startsWith("sk_test_");
}
