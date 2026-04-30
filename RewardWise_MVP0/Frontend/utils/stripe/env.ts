/** @format */

export type StripeEnv = {
	secretKey: string;
	webhookSecret: string;
	publishableKey: string;
};

let cached: StripeEnv | null = null;

export function getStripeEnv(): StripeEnv {
	if (cached) return cached;

	const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
	const publishableKey =
		process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

	if (!secretKey) {
		throw new Error(
			"STRIPE_SECRET_KEY is not set. Payment processing is unavailable.",
		);
	}
	if (!webhookSecret && process.env.NODE_ENV === "production") {
		throw new Error(
			"STRIPE_WEBHOOK_SECRET is not set. Webhook verification will fail.",
		);
	}
	if (!publishableKey) {
		throw new Error(
			"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.",
		);
	}

	if (!secretKey.startsWith("sk_live_")) {
		throw new Error(
			"STRIPE_SECRET_KEY must be a live key (sk_live_...). Test keys are not accepted.",
		);
	}

	if (!publishableKey.startsWith("pk_live_")) {
		throw new Error(
			"NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...). Test keys are not accepted.",
		);
	}

	cached = { secretKey, webhookSecret, publishableKey };
	return cached;
}
