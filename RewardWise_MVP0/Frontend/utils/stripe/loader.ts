/** @format */

type StripeCheckoutSession = {
	id: string;
	url: string | null;
	payment_status?: string | null;
	metadata?: Record<string, string> | null;
	client_reference_id?: string | null;
	amount_total?: number | null;
};

type StripeClientLike = {
	checkout: {
		sessions: {
			create(input: Record<string, unknown>): Promise<StripeCheckoutSession>;
			retrieve(sessionId: string): Promise<StripeCheckoutSession>;
		};
	};
	webhooks: {
		constructEvent(rawBody: string, sig: string, secret: string): unknown;
	};
};

/**
 * Loads Stripe runtime only when available.
 * If the stripe module is removed later, caller gets null and can fallback.
 */
export async function getStripeClientOrNull(): Promise<StripeClientLike | null> {
	const provider = (process.env.PAYMENT_PROVIDER ?? "stripe").toLowerCase();
	if (provider === "none" || provider === "disabled") {
		return null;
	}

	try {
		const mod = (await import("@/utils/stripe/client")) as {
			getStripe?: () => StripeClientLike;
		};
		if (typeof mod.getStripe !== "function") return null;
		return mod.getStripe();
	} catch (error) {
		console.warn("Stripe adapter unavailable. Falling back to no-stripe mode.", error);
		return null;
	}
}
