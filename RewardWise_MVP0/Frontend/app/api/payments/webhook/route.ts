/** @format */

import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type StripeListLike = {
  data?: unknown[];
};

function fromUnixSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getSubscriptionField(sub: unknown, field: string) {
  return asRecord(sub)?.[field];
}

function readUnixSeconds(value: unknown, field: string) {
  const timestamp = asRecord(value)?.[field];
  return typeof timestamp === "number" && Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function getSubscriptionItemPeriods(subscription: unknown, field: string) {
  const items = asRecord(getSubscriptionField(subscription, "items")) as
    | StripeListLike
    | null;
  const data = Array.isArray(items?.data) ? items.data : [];

  return data
    .map((item) => readUnixSeconds(item, field))
    .filter((timestamp): timestamp is number => timestamp !== null);
}

function getSubscriptionPeriodSeconds(subscription: unknown, field: string) {
  const subscriptionLevel = readUnixSeconds(subscription, field);
  if (subscriptionLevel !== null) return subscriptionLevel;

  const itemPeriods = getSubscriptionItemPeriods(subscription, field);
  if (!itemPeriods.length) return null;

  if (field.endsWith("_end")) return Math.min(...itemPeriods);
  if (field.endsWith("_start")) return Math.max(...itemPeriods);

  return itemPeriods[0];
}

function getSubscriptionTime(sub: unknown, field: string) {
  if (field === "current_period_start" || field === "current_period_end") {
    return fromUnixSeconds(getSubscriptionPeriodSeconds(sub, field));
  }

  return fromUnixSeconds(getSubscriptionField(sub, field));
}

function getCancelAtPeriodEnd(sub: unknown) {
  return Boolean(getSubscriptionField(sub, "cancel_at_period_end"));
}

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
      const userId = (session.metadata as Record<string, string> | undefined)
        ?.user_id;
      const subscriptionId = session.subscription as string | undefined;
      const customerId = session.customer as string | undefined;
      const sessionId = session.id as string | undefined;
      const amountTotal = session.amount_total as number | undefined;

      if (userId && sessionId) {
        // Webhook-replay defense: processed_stripe_sessions PRIMARY KEY
        // (session_id) blocks any duplicate processing of the same
        // Checkout session. Stripe retries failed deliveries, and the
        // existing subscriptions upsert is naturally idempotent — but
        // we want the same architectural shape across all three
        // surfaces (day-pass, subscribe, concierge) so any future
        // side-effect added to this branch (e.g., a welcome email,
        // a referral credit) inherits the dedup for free.
        const ledgerInsert = await supabase
          .from("processed_stripe_sessions")
          .insert({
            session_id: sessionId,
            user_id: userId,
            purchase_type: "subscription",
            amount_cents: typeof amountTotal === "number" ? amountTotal : null,
          });
        const ledgerCode = (ledgerInsert.error as { code?: string } | null)
          ?.code;
        const alreadyProcessed = ledgerCode === "23505";

        if (!alreadyProcessed) {
          const stripeSubscription = subscriptionId
            ? await getStripe().subscriptions.retrieve(subscriptionId)
            : null;

          await supabase.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscriptionId ?? null,
              status: "active",
              plan: "pro",
              cancel_at_period_end: getCancelAtPeriodEnd(stripeSubscription),
              canceled_at: getSubscriptionTime(
                stripeSubscription,
                "canceled_at",
              ),
              current_period_start:
                getSubscriptionTime(
                  stripeSubscription,
                  "current_period_start",
                ) ?? new Date().toISOString(),
              current_period_end: getSubscriptionTime(
                stripeSubscription,
                "current_period_end",
              ),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        }

        // Release the parallel-checkout lock regardless of dedup
        // outcome. If we already processed this session_id, we still
        // want to clear any stale pending row (a replay 5+ minutes
        // after the original would otherwise time-block a fresh
        // resubscribe attempt).
        await supabase
          .from("pending_subscribe_sessions")
          .delete()
          .eq("user_id", userId);
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
          const constraints =
            (row?.constraints as Record<string, unknown> | null) ?? {};
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

        // Release the concierge parallel-checkout lock regardless of
        // whether the fulfillment update ran. A replay 5+ minutes after
        // the original session would otherwise time-block a fresh
        // submission on the same travel_request_id; the request is
        // already paid (idempotent above), so clearing the stale lock
        // is correct.
        await supabase
          .from("pending_concierge_sessions")
          .delete()
          .eq("travel_request_id", requestId);
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

    const updates = {
      status: mappedStatus,
      cancel_at_period_end: getCancelAtPeriodEnd(sub),
      canceled_at: getSubscriptionTime(sub, "canceled_at"),
      current_period_start: getSubscriptionTime(sub, "current_period_start"),
      current_period_end: getSubscriptionTime(sub, "current_period_end"),
      updated_at: new Date().toISOString(),
    };

    if (userId) {
      await supabase
        .from("subscriptions")
        .update(updates)
        .eq("user_id", userId);
    } else if (subscriptionId) {
      await supabase
        .from("subscriptions")
        .update(updates)
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

    const cancellationUpdate = {
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at:
        getSubscriptionTime(sub, "canceled_at") ?? new Date().toISOString(),
      current_period_start: getSubscriptionTime(sub, "current_period_start"),
      current_period_end: getSubscriptionTime(sub, "current_period_end"),
      updated_at: new Date().toISOString(),
    };

    if (userId) {
      await supabase
        .from("subscriptions")
        .update(cancellationUpdate)
        .eq("user_id", userId);
    } else if (subscriptionId) {
      await supabase
        .from("subscriptions")
        .update(cancellationUpdate)
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

  if (parsed.type === "checkout.session.expired") {
    // Release the parallel-checkout lock when the user's Stripe
    // Checkout session expires (default 24h, or sooner if the user
    // explicitly cancels). The 5-minute TTL on the lock row would
    // eventually reap stale entries on its own, but releasing here
    // lets the user retry immediately instead of waiting it out.
    //
    // We route on mode + purchase_type rather than checking all three
    // tables blindly: a day-pass expiry should not touch the
    // subscribe table (and vice versa), so misrouting would mask a
    // future bug instead of revealing it.
    const session = parsed.data?.object ?? {};
    const mode = session.mode as string | undefined;
    const metadata = session.metadata as Record<string, string> | undefined;
    const purchaseType = metadata?.purchase_type;
    const userId = metadata?.user_id;
    const travelRequestId =
      metadata?.travel_request_id ??
      (session.client_reference_id as string | undefined);

    if (
      mode === "payment" &&
      (purchaseType === "day_pass" || purchaseType === "zoe_single") &&
      userId
    ) {
      await supabase
        .from("pending_day_pass_sessions")
        .delete()
        .eq("user_id", userId);
    } else if (mode === "subscription" && userId) {
      await supabase
        .from("pending_subscribe_sessions")
        .delete()
        .eq("user_id", userId);
    } else if (mode === "payment" && travelRequestId) {
      // Concierge expiry: the day-pass branch above is gated on
      // purchase_type to avoid stomping concierge sessions (concierge
      // metadata has tier, not purchase_type). Once that branch passes,
      // any remaining mode=payment session with a travel_request_id
      // identifier is a concierge checkout.
      await supabase
        .from("pending_concierge_sessions")
        .delete()
        .eq("travel_request_id", travelRequestId);
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
    const subscriptionId = invoice.subscription as string | undefined;
    const amountPaid = invoice.amount_paid as number | undefined;
    const billingReason = invoice.billing_reason as string | undefined;
    const stripeSubscription = subscriptionId
      ? await getStripe().subscriptions.retrieve(subscriptionId)
      : null;

    if (customerId && billingReason === "subscription_cycle") {
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (subRow?.user_id) {
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            cancel_at_period_end: getCancelAtPeriodEnd(stripeSubscription),
            canceled_at: getSubscriptionTime(stripeSubscription, "canceled_at"),
            current_period_start: getSubscriptionTime(
              stripeSubscription,
              "current_period_start",
            ),
            current_period_end: getSubscriptionTime(
              stripeSubscription,
              "current_period_end",
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", subRow.user_id);

        const amount = amountPaid
          ? `$${(amountPaid / 100).toFixed(2)}`
          : "$3.99";
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
