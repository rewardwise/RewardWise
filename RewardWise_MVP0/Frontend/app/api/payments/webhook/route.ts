/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const rawBody = await request.text();
	const headerList = await headers();
	const sig = headerList.get("stripe-signature");

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceKey) {
		console.error(
			"CRITICAL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
		);
		return NextResponse.json(
			{ error: "Server misconfiguration" },
			{ status: 500 },
		);
	}

	const { webhookSecret } = getStripeEnv();

	if (!sig) {
		return NextResponse.json(
			{ error: "Missing stripe-signature header" },
			{ status: 400 },
		);
	}

	let event: unknown;
	try {
		const stripe = getStripe();
		event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
	} catch (err) {
		console.error("Webhook signature verification failed:", err);
		return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
	}

	const parsed = event as {
		type?: string;
		data?: { object?: Record<string, unknown> };
	};

	const supabase = createClient(supabaseUrl, supabaseServiceKey);

	if (parsed.type === "checkout.session.completed") {
		const session = parsed.data?.object ?? {};
		const mode = session.mode as string | undefined;

		if (mode === "subscription") {
			const userId = (session.metadata as Record<string, string> | undefined)?.user_id;
			const subscriptionId = session.subscription as string | undefined;
			const customerId = session.customer as string | undefined;

			if (userId) {
				await supabase.from("subscriptions").upsert(
					{
						user_id: userId,
						stripe_customer_id: customerId ?? null,
						stripe_subscription_id: subscriptionId ?? null,
						status: "active",
						plan: "pro",
						current_period_start: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
					{ onConflict: "user_id" },
				);
			}
		} else {
			const requestId =
				((session.metadata as Record<string, string> | undefined)
					?.travel_request_id as string | undefined) ??
				(session.client_reference_id as string | undefined);

			if (requestId) {
				const { data: row } = await supabase
					.from("travel_requests")
					.select("constraints, status")
					.eq("id", requestId)
					.single();

				if (row?.status !== "paid") {
					const constraints = (row?.constraints as Record<string, unknown> | null) ?? {};
					await supabase
						.from("travel_requests")
						.update({
							status: "paid",
							constraints: {
								...constraints,
								stripe_payment: "paid",
								stripe_checkout_session_id: session.id as string | undefined,
								stripe_payment_confirmed_at: new Date().toISOString(),
							},
						})
						.eq("id", requestId);
				}
			}
		}
	}

	if (parsed.type === "customer.subscription.updated") {
		const sub = parsed.data?.object ?? {};
		const stripeStatus = sub.status as string;
		const metadata = sub.metadata as Record<string, string> | undefined;
		const userId = metadata?.user_id;
		const subscriptionId = sub.id as string;

		let mappedStatus: string;
		if (stripeStatus === "active" || stripeStatus === "trialing") {
			mappedStatus = "active";
		} else if (stripeStatus === "past_due") {
			mappedStatus = "past_due";
		} else {
			mappedStatus = "canceled";
		}

		if (userId) {
			await supabase
				.from("subscriptions")
				.update({
					status: mappedStatus,
					updated_at: new Date().toISOString(),
				})
				.eq("user_id", userId);
		} else if (subscriptionId) {
			await supabase
				.from("subscriptions")
				.update({
					status: mappedStatus,
					updated_at: new Date().toISOString(),
				})
				.eq("stripe_subscription_id", subscriptionId);
		}
	}

	if (parsed.type === "customer.subscription.deleted") {
		const sub = parsed.data?.object ?? {};
		const subscriptionId = sub.id as string;
		const metadata = sub.metadata as Record<string, string> | undefined;
		const userId = metadata?.user_id;

		const cancelledUserId = userId
			? userId
			: await (async () => {
					const { data } = await supabase
						.from("subscriptions")
						.select("user_id")
						.eq("stripe_subscription_id", subscriptionId)
						.single();
					return data?.user_id as string | undefined;
				})();

		if (userId) {
			await supabase
				.from("subscriptions")
				.update({ status: "canceled", updated_at: new Date().toISOString() })
				.eq("user_id", userId);
		} else if (subscriptionId) {
			await supabase
				.from("subscriptions")
				.update({ status: "canceled", updated_at: new Date().toISOString() })
				.eq("stripe_subscription_id", subscriptionId);
		}

		if (cancelledUserId) {
			await supabase.from("payment_notifications").insert({
				user_id: cancelledUserId,
				type: "subscription_canceled",
				title: "Subscription canceled",
				message:
					"Your MyTravelWallet Pro subscription has been canceled. You can resubscribe at any time from your profile.",
			});
		}
	}

	if (parsed.type === "invoice.payment_failed") {
		const invoice = parsed.data?.object ?? {};
		const subscriptionId = invoice.subscription as string | undefined;
		const customerId = invoice.customer as string | undefined;

		if (subscriptionId) {
			await supabase
				.from("subscriptions")
				.update({ status: "past_due", updated_at: new Date().toISOString() })
				.eq("stripe_subscription_id", subscriptionId);

			if (customerId) {
				const { data: subRow } = await supabase
					.from("subscriptions")
					.select("user_id")
					.eq("stripe_customer_id", customerId)
					.single();

				if (subRow?.user_id) {
					await supabase.from("payment_notifications").insert({
						user_id: subRow.user_id,
						type: "payment_failed",
						title: "Payment failed",
						message:
							"We couldn't process your subscription renewal. Please update your payment method to keep your access.",
					});
				}
			}
		}
	}

	if (parsed.type === "invoice.payment_succeeded") {
		const invoice = parsed.data?.object ?? {};
		const customerId = invoice.customer as string | undefined;
		const amountPaid = invoice.amount_paid as number | undefined;
		const billingReason = invoice.billing_reason as string | undefined;

		if (customerId && billingReason === "subscription_cycle") {
			const { data: subRow } = await supabase
				.from("subscriptions")
				.select("user_id")
				.eq("stripe_customer_id", customerId)
				.single();

			if (subRow?.user_id) {
				await supabase
					.from("subscriptions")
					.update({ status: "active", updated_at: new Date().toISOString() })
					.eq("user_id", subRow.user_id);

				const amount = amountPaid ? `$${(amountPaid / 100).toFixed(2)}` : "$9.99";
				await supabase.from("payment_notifications").insert({
					user_id: subRow.user_id,
					type: "renewal_success",
					title: "Subscription renewed",
					message: `Your Pro subscription was renewed successfully. ${amount} was charged to your card.`,
				});
			}
		}
	}

	return NextResponse.json({ received: true });
}
