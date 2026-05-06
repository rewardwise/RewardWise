/** @format */

import Stripe from "stripe";
import { getStripeEnv } from "./env";

let stripeSingleton: Stripe | null = null;
let cachedSecretKey: string | null = null;

export function getStripe(): Stripe {
	const { secretKey } = getStripeEnv();
	if (!stripeSingleton || cachedSecretKey !== secretKey) {
		cachedSecretKey = secretKey;
		stripeSingleton = new Stripe(secretKey, {
			typescript: true,
		});
	}
	return stripeSingleton;
}
