/** @format */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Coffee,
  CreditCard,
  Edit3,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";

import CancelReasonModal, {
  type CancelReasonPayload,
} from "@/components/billing/CancelReasonModal";
import WalletManager from "@/components/profile/WalletManager";
import PreferencesForm from "@/components/profile/PreferencesForm";
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

type ProfileSection = "account" | "billing" | "wallet" | "preferences";

function formatBillingDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}
function formatMemberSince(value?: string | null) {
  if (!value) return "Recently joined";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently joined";
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}
function getInitial(name?: string | null, email?: string | null) {
  return (name?.trim() || email?.trim() || "User").charAt(0).toUpperCase();
}
function getStoredDisplayName(userMetadata?: Record<string, unknown> | null) {
  const fullName = userMetadata?.full_name;
  const name = userMetadata?.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  return "";
}

const card = "rounded-2xl border border-mtw-border bg-white shadow-mtw-ambient";

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, subscription } = useAuth();

  const [dayPassExpiresAt, setDayPassExpiresAt] = useState<number | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [billingError, setBillingError] = useState("");
  const [billingLoading, setBillingLoading] = useState<"portal" | "cancel" | null>(null);
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
        const expiry = data?.day_pass_expires_at ? new Date(data.day_pass_expires_at).getTime() : 0;
        setDayPassExpiresAt(expiry > 0 ? expiry : null);
      });

    void supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setBillingDetails(null);
          return;
        }
        const next = (data as BillingDetails | null) ?? null;
        setBillingDetails(next);
        if (next?.stripe_subscription_id && next.status === "active" && !next.current_period_end) {
          try {
            const syncRes = await fetch("/api/payments/sync-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            });
            const syncData = (await syncRes.json()) as { billing?: BillingDetails };
            if (!cancelled && syncRes.ok && syncData.billing) setBillingDetails(syncData.billing);
          } catch {
            /* non-fatal */
          }
        }
      });

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/access", { cache: "no-store" });
        const data = (await res.json()) as { canViewAnalytics?: boolean };
        if (!cancelled) setCanViewAnalytics(Boolean(data.canViewAnalytics));
      } catch {
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
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  })();

  const hasActiveDayPass = Boolean(dayPassTimeLeft);
  const planLabel = subscription === "pro" ? "Monthly Plan" : hasActiveDayPass ? "Day Pass" : "Free Plan";
  const planStatusLabel =
    subscription === "pro" ? "Pro access" : hasActiveDayPass ? `${dayPassTimeLeft} left` : "Limited access";
  const accessEndsLabel = formatBillingDate(billingDetails?.current_period_end);
  const cancellationScheduled = subscription === "pro" && Boolean(billingDetails?.cancel_at_period_end);
  const billingDateTitle = cancellationScheduled ? "Access ends" : "Next billing date";
  const billingDateValue =
    subscription === "pro" ? accessEndsLabel || "No monthly billing date yet" : "No recurring billing";
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
      const data = (await res.json()) as { ok?: boolean; accessEndsAt?: string | null; error?: string };
      if (!res.ok || !data.ok) {
        setBillingError(data.error || "Could not schedule cancellation. Please try again.");
        setBillingLoading(null);
        return;
      }
      setBillingDetails((prev) => ({
        status: prev?.status ?? "active",
        stripe_subscription_id: prev?.stripe_subscription_id ?? null,
        cancel_at_period_end: true,
        current_period_end: data.accessEndsAt ?? prev?.current_period_end ?? null,
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
      const { error } = await supabase.auth.updateUser({ data: { full_name: nextName, name: nextName } });
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

  const handleLogOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("This will permanently delete your account. Continue?")) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      alert(DELETE_NOT_SIGNED_IN);
      return;
    }
    const delRes = await fetch("/api/delete-account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const delData = await delRes.json().catch(() => ({}));
    if (!delRes.ok) {
      alert((delData as { error?: string }).error || DELETE_ACCOUNT_FAILED);
      return;
    }
    await signOut();
    router.replace("/");
  };

  // Tools fold (from the old Actions launcher): nav-redundant links dropped;
  // Concierge + Health kept; Admin only when the user is a PM tester.
  const tools = [
    { icon: Coffee, label: "Concierge", desc: "Human help from $19", page: "/concierge" },
    { icon: BarChart3, label: "Health check-in", desc: "Review your rewards setup", page: "/health-check" },
    ...(canViewAnalytics
      ? [{ icon: ShieldCheck, label: "Product analytics", desc: "Admin dashboard", page: "/admin/analytics" }]
      : []),
  ];

  const sectionNav: Array<{ key: ProfileSection; label: string; icon: typeof User }> = [
    { key: "account", label: "Account", icon: User },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "wallet", label: "Wallet", icon: Wallet },
    { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  ];

  return (
    <main className="font-mtw mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-mtw-ink">Profile</h1>
        <p className="mt-1 text-mtw-small text-mtw-muted">Account, billing, wallet, and search preferences.</p>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        {/* Sidebar (horizontal scroll on mobile) */}
        <nav className="mb-4 flex gap-2 overflow-x-auto lg:mb-0 lg:flex-col" aria-label="Profile sections">
          {sectionNav.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                data-testid={`profile-nav-${item.key}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-mtw px-3 py-2.5 text-mtw-small font-medium transition-colors lg:w-full ${
                  active
                    ? "bg-mtw-emerald text-white"
                    : "border border-mtw-border bg-white text-mtw-muted hover:text-mtw-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0">
          {/* ACCOUNT */}
          {activeSection === "account" && (
            <div className="space-y-4">
              <div className={`p-5 ${card}`}>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mtw-emerald text-lg font-semibold text-white">
                    {profileInitial}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditingProfile ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={profileDraftName}
                          onChange={(e) => setProfileDraftName(e.target.value)}
                          placeholder="Your name"
                          data-testid="profile-name-input"
                          className="min-w-0 flex-1 rounded-mtw border border-mtw-border bg-white px-3 py-2 text-mtw-small text-mtw-ink outline-none focus:border-mtw-emerald"
                        />
                        <button
                          type="button"
                          onClick={saveProfileName}
                          disabled={profileSaving}
                          className="inline-flex items-center gap-1 rounded-mtw bg-mtw-emerald px-3 py-2 text-mtw-small font-semibold text-white disabled:opacity-50"
                        >
                          {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingProfile(false);
                            setProfileDraftName(profileName);
                          }}
                          aria-label="Cancel"
                          className="rounded-mtw border border-mtw-border p-2 text-mtw-muted hover:text-mtw-ink"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="truncate text-mtw-title font-semibold text-mtw-ink">{displayName}</p>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(true)}
                          aria-label="Edit name"
                          className="text-mtw-muted hover:text-mtw-ink"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <p className="mt-1 truncate text-mtw-small text-mtw-muted">{user?.email}</p>
                    <p className="mt-1 text-xs text-mtw-muted">Member since {memberSince}</p>
                    {profileMessage && <p className="mt-1 text-xs text-mtw-emerald">{profileMessage}</p>}
                  </div>
                </div>
              </div>

              {/* Tools */}
              {tools.length > 0 && (
                <div className={`overflow-hidden ${card}`}>
                  <p className="border-b border-mtw-border px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-mtw-muted">
                    Tools
                  </p>
                  <div className="divide-y divide-mtw-border">
                    {tools.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => router.push(t.page)}
                          data-testid={`profile-tool-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-mtw-surface"
                        >
                          <Icon className="h-4 w-4 text-mtw-muted" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-mtw-body font-medium text-mtw-ink">{t.label}</span>
                            <span className="block text-xs text-mtw-muted">{t.desc}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-mtw-muted" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Session controls */}
              <div className={`p-5 ${card}`}>
                <button
                  type="button"
                  onClick={handleLogOut}
                  className="inline-flex items-center gap-2 text-mtw-small font-semibold text-mtw-ink hover:text-mtw-emerald"
                >
                  <LogOut className="h-4 w-4 text-mtw-muted" /> Log out
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="mt-4 flex items-center gap-2 text-mtw-small font-semibold text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Delete account
                </button>
              </div>
            </div>
          )}

          {/* BILLING — canonical home of Pro-access status */}
          {activeSection === "billing" && (
            <div className="space-y-4">
              <div className={`p-5 ${card}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-mtw-title font-semibold text-mtw-ink">{planLabel}</p>
                    <p className="mt-1 text-mtw-small text-mtw-muted">{billingDateTitle}: {billingDateValue}</p>
                  </div>
                  <span
                    data-testid="billing-plan-status"
                    className={`rounded-mtw-pill px-3 py-1 text-mtw-small font-semibold ${
                      subscription === "pro"
                        ? "bg-emerald-50 text-emerald-700"
                        : hasActiveDayPass
                          ? "bg-amber-50 text-amber-700"
                          : "bg-mtw-surface text-mtw-muted"
                    }`}
                  >
                    {planStatusLabel}
                  </span>
                </div>
                {cancellationScheduled && (
                  <p className="mt-3 rounded-mtw border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Cancellation scheduled — access ends {accessEndsLabel}.
                  </p>
                )}
              </div>

              <div className={`p-5 ${card}`}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-mtw-muted">Billing management</p>
                {subscription === "pro" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      disabled={billingLoading === "portal"}
                      className="inline-flex items-center gap-1.5 rounded-mtw bg-mtw-emerald px-4 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {billingLoading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Manage billing
                    </button>
                    {!cancellationScheduled && (
                      <button
                        type="button"
                        onClick={() => setCancelModalOpen(true)}
                        className="rounded-mtw border border-mtw-border px-4 py-2 text-mtw-small text-mtw-muted hover:text-mtw-ink"
                      >
                        Cancel at period end
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/subscribe")}
                    className="inline-flex items-center gap-1.5 rounded-mtw bg-mtw-emerald px-4 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    View plan options <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {billingError && <p className="mt-3 text-mtw-small text-red-600">{billingError}</p>}
              </div>
            </div>
          )}

          {/* WALLET */}
          {activeSection === "wallet" && <WalletManager />}

          {/* PREFERENCES */}
          {activeSection === "preferences" && <PreferencesForm />}
        </section>
      </div>

      <CancelReasonModal
        open={cancelModalOpen}
        submitting={billingLoading === "cancel"}
        onConfirm={cancelMonthlySubscription}
        onDismiss={() => {
          if (billingLoading !== "cancel") setCancelModalOpen(false);
        }}
      />
    </main>
  );
}
