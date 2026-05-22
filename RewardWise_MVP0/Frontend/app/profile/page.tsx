/** @format */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  ChevronRight,
  Clock3,
  Coffee,
  CreditCard,
  Crown,
  Edit3,
  Loader2,
  LogOut,
  Mail,
  Map,
  PlaneTakeoff,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";

import TropicalBackground from "@/components/TropicalBackground";
import CancelReasonModal, {
  type CancelReasonPayload,
} from "@/components/billing/CancelReasonModal";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import {
  DELETE_ACCOUNT_FAILED,
  DELETE_NOT_SIGNED_IN,
} from "@/utils/user-messages";

const supabase = createClient();

type BillingDetails = {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string | null;
};

type NotificationSettings = {
  watchlistEmailAlerts: boolean;
  weeklyPortfolioSummary: boolean;
  dealAlerts: boolean;
  pointsExpiryWarnings: boolean;
};

type NotificationKey = keyof NotificationSettings;
type ProfileSection = "account" | "subscription" | "actions" | "notifications";

const defaultNotificationSettings: NotificationSettings = {
  watchlistEmailAlerts: true,
  weeklyPortfolioSummary: true,
  dealAlerts: true,
  pointsExpiryWarnings: true,
};

function formatBillingDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMemberSince(value?: string | null) {
  if (!value) return "Recently joined";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently joined";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getInitial(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "User";
  return source.charAt(0).toUpperCase();
}

function getStoredDisplayName(userMetadata?: Record<string, unknown> | null) {
  const fullName = userMetadata?.full_name;
  const name = userMetadata?.name;

  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  return "";
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, subscription } = useAuth();
  const hasLoadedSettings = useRef(false);
  const settingsStorageKey = useMemo(
    () => `rw:profile-notification-settings:${user?.id ?? "guest"}`,
    [user?.id],
  );

  const [notificationSettings, setNotificationSettings] = useState(
    defaultNotificationSettings,
  );
  const [dayPassExpiresAt, setDayPassExpiresAt] = useState<number | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(
    null,
  );
  const [billingError, setBillingError] = useState("");
  const [billingLoading, setBillingLoading] = useState<
    "portal" | "cancel" | null
  >(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [timeNow, setTimeNow] = useState(Date.now());
  const [canViewAnalytics, setCanViewAnalytics] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDraftName, setProfileDraftName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [activeSection, setActiveSection] = useState<ProfileSection>("account");

  useEffect(() => {
    const storedName = getStoredDisplayName(user?.user_metadata ?? null);
    setProfileName(storedName);
    setProfileDraftName(storedName);
    setIsEditingProfile(false);
    setProfileMessage("");
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    if (!user?.id) {
      setCanViewAnalytics(false);
      setDayPassExpiresAt(null);
      setBillingDetails(null);
      return;
    }

    let cancelled = false;

    void supabase
      .from("profiles")
      .select("day_pass_expires_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const expiry = data?.day_pass_expires_at
          ? new Date(data.day_pass_expires_at).getTime()
          : 0;
        setDayPassExpiresAt(expiry > 0 ? expiry : null);
      });

    void supabase
      .from("subscriptions")
      .select(
        "status, current_period_end, cancel_at_period_end, stripe_subscription_id",
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Could not load billing details", error);
          setBillingDetails(null);
          return;
        }
        const nextBillingDetails = (data as BillingDetails | null) ?? null;
        setBillingDetails(nextBillingDetails);

        if (
          nextBillingDetails?.stripe_subscription_id &&
          nextBillingDetails.status === "active" &&
          !nextBillingDetails.current_period_end
        ) {
          try {
            const syncRes = await fetch("/api/payments/sync-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            });
            const syncData = (await syncRes.json()) as {
              billing?: BillingDetails;
            };

            if (!cancelled && syncRes.ok && syncData.billing) {
              setBillingDetails(syncData.billing);
            }
          } catch (syncError) {
            console.warn("Could not sync billing date", syncError);
          }
        }
      });

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/access", {
          cache: "no-store",
        });
        const data = (await res.json()) as { canViewAnalytics?: boolean };

        if (!cancelled) {
          setCanViewAnalytics(Boolean(data.canViewAnalytics));
        }
      } catch (error) {
        console.warn("Could not check analytics admin access", error);
        if (!cancelled) setCanViewAnalytics(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setTimeNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const dayPassTimeLeft = (() => {
    if (!dayPassExpiresAt) return null;
    const msLeft = dayPassExpiresAt - timeNow;
    if (msLeft <= 0) return null;
    const totalMinutes = Math.ceil(msLeft / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  })();

  const hasActiveDayPass = Boolean(dayPassTimeLeft);
  const planLabel =
    subscription === "pro"
      ? "Monthly Plan"
      : hasActiveDayPass
        ? "Day Pass"
        : "Free Plan";
  const planStatusLabel =
    subscription === "pro"
      ? "Pro access"
      : hasActiveDayPass
        ? `${dayPassTimeLeft} left`
        : "Limited access";
  const accessEndsLabel = formatBillingDate(billingDetails?.current_period_end);
  const cancellationScheduled =
    subscription === "pro" && Boolean(billingDetails?.cancel_at_period_end);
  const billingDateTitle = cancellationScheduled
    ? "Access ends"
    : "Next billing date";
  const billingDateValue =
    subscription === "pro"
      ? accessEndsLabel || "No monthly billing date yet"
      : "No recurring billing";
  const displayName = profileName || "Add your name";
  const profileInitial = getInitial(profileName, user?.email);
  const memberSince = formatMemberSince(user?.created_at);

  const openBillingPortal = async () => {
    setBillingError("");
    setBillingLoading("portal");
    try {
      const res = await fetch("/api/payments/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { url?: string; error?: string };

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setBillingError(data.error || "Could not open billing settings.");
    } catch {
      setBillingError("Could not open billing settings.");
    }
    setBillingLoading(null);
  };

  const cancelMonthlySubscription = async (reason: CancelReasonPayload) => {
    setBillingError("");
    setBillingLoading("cancel");
    try {
      const res = await fetch("/api/payments/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        accessEndsAt?: string | null;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setBillingError(
          data.error || "Could not schedule cancellation. Please try again.",
        );
        setBillingLoading(null);
        return;
      }

      setBillingDetails((prev) => ({
        status: prev?.status ?? "active",
        stripe_subscription_id: prev?.stripe_subscription_id ?? null,
        cancel_at_period_end: true,
        current_period_end:
          data.accessEndsAt ?? prev?.current_period_end ?? null,
      }));
      setCancelModalOpen(false);
    } catch {
      setBillingError("Could not schedule cancellation. Please try again.");
    }
    setBillingLoading(null);
  };

  const saveProfileName = async () => {
    setProfileMessage("");
    setProfileSaving(true);

    const nextName = profileDraftName.trim();
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: nextName,
          name: nextName,
        },
      });

      if (error) {
        setProfileMessage("Could not save profile changes.");
        return;
      }

      setProfileName(nextName);
      setProfileDraftName(nextName);
      setIsEditingProfile(false);
      setProfileMessage("Profile updated.");
    } catch {
      setProfileMessage("Could not save profile changes.");
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(settingsStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
          if (!cancelled) {
            setNotificationSettings((prev) => ({ ...prev, ...parsed }));
          }
        }

        if (user?.id) {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          const remote = (data.user?.user_metadata?.notification_settings ??
            null) as Partial<NotificationSettings> | null;
          if (remote && !cancelled) {
            setNotificationSettings((prev) => ({ ...prev, ...remote }));
          }
        }
      } catch (error) {
        console.warn("Could not load notification settings", error);
      } finally {
        if (!cancelled) hasLoadedSettings.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsStorageKey, user?.id]);

  useEffect(() => {
    if (!hasLoadedSettings.current) return;
    try {
      localStorage.setItem(
        settingsStorageKey,
        JSON.stringify(notificationSettings),
      );
    } catch (error) {
      console.warn("Could not save notification settings", error);
    }
    if (!user?.id) return;
    (async () => {
      const { error } = await supabase.auth.updateUser({
        data: {
          notification_settings: notificationSettings,
        },
      });
      if (error) {
        console.warn("Could not sync notification settings", error);
      }
    })();
  }, [notificationSettings, settingsStorageKey, user?.id]);

  const tools = [
    {
      icon: Wallet,
      label: "My Wallet",
      desc: "Cards, balances, and programs",
      page: "/wallet-setup",
    },
    {
      icon: PlaneTakeoff,
      label: "New Search",
      desc: "Compare cash vs points",
      page: "/home",
    },
    {
      icon: BarChart3,
      label: "Health Check",
      desc: "Review your rewards setup",
      page: "/health-check",
    },
    {
      icon: Map,
      label: "Transfer Paths",
      desc: "Find partner transfer routes",
      page: "/transfer-optimizer",
    },
    {
      icon: Coffee,
      label: "Concierge",
      desc: "Human help from $19",
      page: "/concierge",
    },
    {
      icon: Star,
      label: "Past Searches",
      desc: "Revisit previous verdicts",
      page: "/history",
    },
  ];

  const notificationRows: Array<{
    key: NotificationKey;
    label: string;
    desc: string;
  }> = [
    {
      key: "watchlistEmailAlerts",
      label: "Watchlist alerts",
      desc: "Get notified when a saved route becomes worth booking.",
    },
    {
      key: "weeklyPortfolioSummary",
      label: "Weekly portfolio summary",
      desc: "A simple recap of cards, points, and missed opportunities.",
    },
    {
      key: "dealAlerts",
      label: "Deal alerts",
      desc: "Launch offers and unusually strong redemption opportunities.",
    },
    {
      key: "pointsExpiryWarnings",
      label: "Points expiry warnings",
      desc: "Reminders before balances become risky.",
    },
  ];

  const sectionNav: Array<{
    key: ProfileSection;
    label: string;
    desc: string;
    icon: typeof User;
  }> = [
    {
      key: "account",
      label: "Account",
      desc: "Personal info",
      icon: User,
    },
    {
      key: "subscription",
      label: "Subscription",
      desc: "Plan & billing",
      icon: CreditCard,
    },
    {
      key: "actions",
      label: "Actions",
      desc: "Travel tools",
      icon: PlaneTakeoff,
    },
    {
      key: "notifications",
      label: "Notifications",
      desc: "Email prefs",
      icon: Bell,
    },
  ];

  const planDescription =
    subscription === "pro"
      ? cancellationScheduled
        ? `Your Pro access stays active through ${accessEndsLabel || "the end of your billing period"}.`
        : "You have monthly access to RewardWise features."
      : hasActiveDayPass
        ? `Your day pass is active for ${dayPassTimeLeft}.`
        : "You can still manage your account and upgrade when ready.";

  const billingDescription =
    subscription === "pro"
      ? cancellationScheduled
        ? `Cancellation is scheduled. Access remains active until ${accessEndsLabel || "your billing period ends"}.`
        : accessEndsLabel
          ? `Your next billing date is ${accessEndsLabel}. You can cancel at period end anytime.`
          : "Manage your monthly subscription or cancel at period end."
      : "View available plans if you want a day pass, monthly access, or concierge help.";

  const handleLogOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("This will permanently delete your account. Continue?")) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert(DELETE_NOT_SIGNED_IN);
      return;
    }

    const delRes = await fetch("/api/delete-account", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const delData = (await delRes.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!delRes.ok) {
      alert(delData.error || DELETE_ACCOUNT_FAILED);
      return;
    }

    await signOut();
    router.replace("/");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 text-white">
      <TropicalBackground />
      <div className="relative z-10">
        <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:flex lg:min-h-screen lg:items-center lg:px-8">
          <section className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/88 shadow-2xl shadow-slate-950/45 backdrop-blur-xl sm:rounded-[2rem] lg:grid lg:grid-cols-[88px_minmax(0,1fr)]">
            <aside className="border-b border-white/10 bg-white/[0.035] p-2 sm:p-3 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-4 gap-1 lg:flex lg:flex-col lg:items-center lg:gap-2">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 font-black text-emerald-100 lg:flex">
                  {profileInitial}
                </div>

                <div className="hidden h-px w-10 shrink-0 bg-white/10 lg:block" />

                {sectionNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveSection(item.key)}
                      className={`group flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center transition sm:rounded-2xl lg:min-w-0 lg:px-2 ${
                        isActive
                          ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/20"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      }`}
                      aria-pressed={isActive}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate text-[10px] font-bold leading-none sm:text-xs lg:hidden">
                        {item.label}
                      </span>
                      <span className="hidden text-[10px] font-bold uppercase tracking-wide lg:block">
                        {item.label.slice(0, 3)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-h-0 bg-slate-950/35 p-3 sm:p-6 lg:min-h-[660px] lg:p-7">
              <div className="mb-5 hidden flex-col gap-3 border-b border-white/10 pb-4 sm:mb-6 sm:flex sm:flex-row sm:items-end sm:justify-between sm:pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/75">
                    Account Settings
                  </p>
                  <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-3xl">
                    {
                      sectionNav.find((item) => item.key === activeSection)
                        ?.label
                    }
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                    {activeSection === "account" &&
                      "Personal details and account controls."}
                    {activeSection === "subscription" &&
                      "Your current plan, billing date, and cancellation options."}
                    {activeSection === "actions" &&
                      "Fast paths back into the tools you use most."}
                    {activeSection === "notifications" &&
                      "Choose which travel and account alerts you want."}
                  </p>
                </div>
              </div>

              {activeSection === "account" && (
                <div className="space-y-3 sm:space-y-5">
                  <div className="grid gap-3 sm:gap-5 xl:grid-cols-2">
                    <section className="flex min-h-0 flex-col rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-3 sm:min-h-[220px] sm:rounded-[1.5rem] sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-lg font-black text-emerald-100 sm:h-16 sm:w-16 sm:text-2xl">
                            {profileInitial}
                            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-950 bg-emerald-400 text-slate-950">
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
                              Profile details
                            </p>
                            <h2 className="mt-1 truncate text-lg font-bold text-white sm:text-2xl">
                              {displayName}
                            </h2>
                            <p className="mt-1 flex items-center gap-2 truncate text-xs font-medium text-slate-300 sm:mt-2 sm:text-sm">
                              <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                              {user?.email || "Not available"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileDraftName(profileName);
                            setProfileMessage("");
                            setIsEditingProfile((value) => !value);
                          }}
                          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 sm:w-auto"
                        >
                          {isEditingProfile ? (
                            <>
                              <X className="h-3.5 w-3.5" />
                              Close
                            </>
                          ) : (
                            <>
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit profile
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 sm:gap-3 sm:pt-5">
                        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 sm:rounded-2xl sm:p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Member since
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-100">
                            {memberSince}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 sm:rounded-2xl sm:p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Account status
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-100">
                            {planStatusLabel}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="flex min-h-0 flex-col rounded-[1.25rem] border border-emerald-300/20 bg-emerald-300/[0.08] p-3 sm:min-h-[220px] sm:rounded-[1.5rem] sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div>
                          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                            <Sparkles className="h-3.5 w-3.5" />
                            Current plan
                          </p>
                          <h2 className="mt-2 text-lg font-bold text-white sm:mt-3 sm:text-2xl">
                            {planLabel}
                          </h2>
                        </div>
                        <span className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-xs font-bold text-emerald-100">
                          {planStatusLabel}
                        </span>
                      </div>
                      <p className="mt-2 hidden text-sm leading-6 text-emerald-50/75 sm:mt-3 sm:block sm:min-h-[48px]">
                        {planDescription}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveSection("subscription")}
                        className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-950/45 px-3 py-2.5 text-left text-xs font-bold text-emerald-100 transition hover:bg-slate-950/65 sm:mt-auto sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                      >
                        Open billing settings
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </section>
                  </div>

                  {isEditingProfile && (
                    <section className="rounded-[1.25rem] border border-emerald-300/15 bg-emerald-300/[0.06] p-4 sm:rounded-[1.5rem] sm:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/75">
                            Display name
                          </label>
                          <input
                            value={profileDraftName}
                            onChange={(event) =>
                              setProfileDraftName(event.target.value)
                            }
                            placeholder="Add your name"
                            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/15"
                          />
                          <p className="mt-2 text-xs text-emerald-50/65">
                            Saved to your auth profile, so no database migration
                            is needed.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={saveProfileName}
                          disabled={profileSaving}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                        >
                          {profileSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Save profile
                            </>
                          )}
                        </button>
                      </div>
                    </section>
                  )}

                  {profileMessage && (
                    <p className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-200">
                      {profileMessage}
                    </p>
                  )}

                  <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-3 sm:rounded-[1.5rem] sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Account controls
                        </p>
                        <h2 className="mt-1 text-base font-bold text-white sm:mt-2 sm:text-xl">
                          Session and account access
                        </h2>
                      </div>
                      <p className="hidden max-w-md text-sm leading-6 text-slate-400 sm:block">
                        Sign out of this device or permanently delete your
                        RewardWise account.
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={handleLogOut}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-left transition hover:bg-white/[0.07] sm:rounded-2xl sm:px-4 sm:py-3"
                      >
                        <span className="inline-flex items-center gap-3 text-sm font-semibold text-slate-200">
                          <LogOut className="h-4 w-4 text-slate-400" />
                          Log out
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="flex items-center justify-between rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-left transition hover:bg-red-500/15 sm:rounded-2xl sm:px-4 sm:py-3"
                      >
                        <span className="inline-flex items-center gap-3 text-sm font-semibold text-red-100">
                          <Trash2 className="h-4 w-4 text-red-300" />
                          Delete account
                        </span>
                        <ChevronRight className="h-4 w-4 text-red-300/70" />
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeSection === "subscription" && (
                <div className="grid gap-3 sm:gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <section className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-300/[0.08] p-3 sm:rounded-[1.5rem] sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/75">
                          Current plan
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-white sm:mt-2 sm:text-3xl">
                          {planLabel}
                        </h2>
                      </div>
                      <span className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-xs font-bold text-emerald-100">
                        {planStatusLabel}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-emerald-50/75 sm:mt-4">
                      {planDescription}
                    </p>

                    <div className="mt-3 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-1 2xl:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 sm:rounded-2xl sm:p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                          <CalendarClock className="h-4 w-4 text-emerald-300" />
                          {billingDateTitle}
                        </div>
                        <p className="mt-2 text-sm text-slate-300">
                          {billingDateValue}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3 sm:rounded-2xl sm:p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                          <Clock3 className="h-4 w-4 text-cyan-300" />
                          Day pass
                        </div>
                        <p className="mt-2 text-sm text-slate-300">
                          {hasActiveDayPass
                            ? `${dayPassTimeLeft} remaining`
                            : "Inactive"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-3 sm:rounded-[1.5rem] sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Plan & Billing
                        </p>
                        <h2 className="mt-1 text-base font-bold text-white sm:mt-2 sm:text-xl">
                          Billing management
                        </h2>
                      </div>
                      <CreditCard className="h-5 w-5 text-emerald-300" />
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {billingDescription}
                    </p>

                    {billingError && (
                      <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {billingError}
                      </p>
                    )}

                    <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
                      {subscription === "pro" ? (
                        <>
                          <button
                            type="button"
                            onClick={openBillingPortal}
                            disabled={billingLoading !== null}
                            className="flex w-full items-center justify-between rounded-xl bg-emerald-400 px-3 py-2.5 text-left text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:py-3"
                          >
                            <span className="inline-flex items-center gap-2">
                              {billingLoading === "portal" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CreditCard className="h-4 w-4" />
                              )}
                              Manage billing
                            </span>
                            <ArrowRight className="h-4 w-4" />
                          </button>

                          {cancellationScheduled ? (
                            <p className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50">
                              Your subscription is scheduled to end on{" "}
                              {accessEndsLabel ||
                                "the end of your billing period"}
                              .
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancelModalOpen(true)}
                              disabled={billingLoading !== null}
                              data-testid="open-cancel-modal"
                              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-4 sm:py-3"
                            >
                              <span className="inline-flex items-center gap-2">
                                {billingLoading === "cancel" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CalendarClock className="h-4 w-4" />
                                )}
                                Cancel at period end
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push("/subscribe")}
                          className="flex w-full items-center justify-between rounded-xl bg-emerald-400 px-3 py-2.5 text-left text-sm font-bold text-slate-950 transition hover:bg-emerald-300 sm:rounded-2xl sm:px-4 sm:py-3"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            View plan options
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeSection === "actions" && (
                <div className="space-y-4 sm:space-y-5">
                  <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                    {tools.map((tool) => (
                      <button
                        key={tool.label}
                        type="button"
                        onClick={() => router.push(tool.page)}
                        className="group rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300/25 hover:bg-white/[0.07] sm:rounded-[1.35rem] sm:p-4"
                      >
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/80 text-emerald-300 ring-1 ring-white/10">
                          <tool.icon className="h-5 w-5" />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-white">
                            {tool.label}
                          </p>
                          <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-emerald-200" />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {tool.desc}
                        </p>
                      </button>
                    ))}
                  </div>

                  {canViewAnalytics && (
                    <section className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-300/10 p-4 sm:rounded-[1.5rem] sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/75">
                            Admin only
                          </p>
                          <h2 className="mt-1 text-xl font-bold text-white">
                            Product Analytics
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                            Review tester usage, route demand, Zoe activity, and
                            app behavior.
                          </p>
                        </div>
                        <BarChart3 className="h-5 w-5 text-emerald-200" />
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push("/admin/analytics")}
                        className="mt-5 flex w-full items-center justify-between rounded-2xl bg-emerald-300 px-4 py-3 text-left text-sm font-bold text-slate-950 transition hover:bg-emerald-200"
                      >
                        Open dashboard
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </section>
                  )}
                </div>
              )}

              {activeSection === "notifications" && (
                <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-4 sm:rounded-[1.5rem] sm:p-5">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Preferences
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-white">
                        Notification settings
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Keep the alerts that help you book smarter, turn off the
                        rest.
                      </p>
                    </div>
                    <Bell className="h-5 w-5 text-cyan-300" />
                  </div>

                  <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                    {notificationRows.map((row) => (
                      <label
                        key={row.key}
                        className="flex cursor-pointer items-start justify-between gap-3 p-3 transition hover:bg-white/[0.04] sm:gap-4 sm:p-4"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-100">
                            {row.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-400">
                            {row.desc}
                          </span>
                        </span>

                        <span className="relative inline-flex shrink-0 items-center">
                          <input
                            type="checkbox"
                            checked={notificationSettings[row.key]}
                            onChange={(event) =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                [row.key]: event.target.checked,
                              }))
                            }
                            className="peer sr-only"
                          />
                          <span className="h-7 w-12 rounded-full bg-slate-700 transition peer-checked:bg-emerald-400" />
                          <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </section>
        </main>
      </div>

      <CancelReasonModal
        open={cancelModalOpen}
        submitting={billingLoading === "cancel"}
        onConfirm={cancelMonthlySubscription}
        onDismiss={() => {
          if (billingLoading !== "cancel") setCancelModalOpen(false);
        }}
      />
    </div>
  );
}
