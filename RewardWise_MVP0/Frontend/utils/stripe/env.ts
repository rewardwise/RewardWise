/** @format */

export type StripeEnv = {
	secretKey: string;
	webhookSecret: string;
	publishableKey: string;
};

let cached: StripeEnv | null = null;

const isProduction = process.env.NODE_ENV === "production";

export function getStripeEnv(): StripeEnv {
	if (cached) return cached;

	const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
	const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

	if (!secretKey) {
		throw new Error(
			"STRIPE_SECRET_KEY is not set. Payment processing is unavailable.",
		);
	}

	if (!publishableKey) {
		throw new Error(
			"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.",
		);
	}

	if (isProduction) {
		if (!webhookSecret) {
			throw new Error(
				"STRIPE_WEBHOOK_SECRET is required in production. Add the signing secret from your Stripe Dashboard webhook endpoint.",
			);
		}
		if (!secretKey.startsWith("sk_live_")) {
			throw new Error(
				"In production, STRIPE_SECRET_KEY must be a live key (sk_live_...).",
			);
		}
		if (!publishableKey.startsWith("pk_live_")) {
			throw new Error(
				"In production, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...).",
			);
		}
	} else if (
		secretKey.startsWith("sk_live_") !==
		publishableKey.startsWith("pk_live_")
	) {
		throw new Error(
			"Secret and publishable keys must both be live or both be test (sk_/pk_ prefix mismatch).",
		);
	} else if (
		!webhookSecret &&
		typeof console !== "undefined"
	) {
		console.warn(
			"[Stripe] STRIPE_WEBHOOK_SECRET is empty; webhook verification will fail until it is set.",
		);
	}

	cached = { secretKey, webhookSecret, publishableKey };
	return cached;
}

export function clearStripeEnvCache(): void {
	cached = null;
}
