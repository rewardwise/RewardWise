/** @format */

import { NextResponse } from "next/server";
import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";

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

function readUnixSeconds(value: unknown, field: string) {
  const record = asRecord(value);
  const timestamp = record?.[field];
  return typeof timestamp === "number" && Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function getSubscriptionItemPeriods(subscription: unknown, field: string) {
  const record = asRecord(subscription);
  const items = asRecord(record?.items) as StripeListLike | null;
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

function getSubscriptionPeriodTime(subscription: unknown, field: string) {
  return fromUnixSeconds(getSubscriptionPeriodSeconds(subscription, field));
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = checkRateLimit(`cancel-sub:${ip}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    getStripeEnv();

    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      console.error("cancel subscription lookup:", subError);
    }

    if (!sub?.stripe_subscription_id || sub.status !== "active") {
      return NextResponse.json(
        { error: "No active monthly subscription found." },
        { status: 404 },
      );
    }

    const stripe = getStripe();
    const updated = (await stripe.subscriptions.update(
      sub.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      },
    )) as unknown;

    const accessEndsAt = getSubscriptionPeriodTime(
      updated,
      "current_period_end",
    );

    await supabase
      .from("subscriptions")
      .update({
        status: "active",
        cancel_at_period_end: true,
        canceled_at: fromUnixSeconds(asRecord(updated)?.canceled_at),
        current_period_start: getSubscriptionPeriodTime(
          updated,
          "current_period_start",
        ),
        current_period_end: accessEndsAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      accessEndsAt,
    });
  } catch (e) {
    console.error("cancel subscription:", e);
    return NextResponse.json(
      { error: "Could not schedule cancellation. Please try again." },
      { status: 500 },
    );
  }
}
