/** @format */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/utils/stripe/client";
import { getStripeEnv } from "@/utils/stripe/env";
import { checkRateLimit, getClientIp } from "@/utils/security/rate-limit";
import { createRouteHandlerClient } from "@/utils/supabase/route-handler";

export const runtime = "nodejs";

type StripeSubscriptionLike = Record<string, unknown>;

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

function mapStripeStatus(value: unknown) {
  if (value === "active" || value === "trialing") return "active";
  if (value === "past_due") return "past_due";
  return "canceled";
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = checkRateLimit(`sync-sub:${ip}`, {
      maxRequests: 10,
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

    const authSupabase = await createRouteHandlerClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: localSub, error: subError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subError) {
      console.error("sync subscription lookup:", subError);
      return NextResponse.json(
        { error: "Could not load subscription." },
        { status: 500 },
      );
    }

    if (!localSub?.stripe_subscription_id || localSub.status !== "active") {
      return NextResponse.json(
        { error: "No active monthly subscription found." },
        { status: 404 },
      );
    }

    const stripeSub = (await getStripe().subscriptions.retrieve(
      localSub.stripe_subscription_id,
    )) as unknown as StripeSubscriptionLike;

    const billing = {
      status: mapStripeStatus(stripeSub.status),
      current_period_end: getSubscriptionPeriodTime(
        stripeSub,
        "current_period_end",
      ),
      cancel_at_period_end: Boolean(stripeSub.cancel_at_period_end),
      stripe_subscription_id: localSub.stripe_subscription_id as string,
    };

    await admin
      .from("subscriptions")
      .update({
        status: billing.status,
        cancel_at_period_end: billing.cancel_at_period_end,
        canceled_at: fromUnixSeconds(stripeSub.canceled_at),
        current_period_start: getSubscriptionPeriodTime(
          stripeSub,
          "current_period_start",
        ),
        current_period_end: billing.current_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, billing });
  } catch (error) {
    console.error("sync subscription:", error);
    return NextResponse.json(
      { error: "Could not sync billing details." },
      { status: 500 },
    );
  }
}
