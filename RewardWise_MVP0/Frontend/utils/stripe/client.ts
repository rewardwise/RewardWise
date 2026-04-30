/** @format */

import Stripe from "stripe";
import { getStripeEnv } from "./env";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
	const { secretKey } = getStripeEnv();
	if (!stripeSingleton) {
		stripeSingleton = new Stripe(secretKey, {
			typescript: true,
		});
	}
	return stripeSingleton;
}
