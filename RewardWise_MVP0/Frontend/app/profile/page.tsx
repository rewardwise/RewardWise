/** @format */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	User,
	Wallet,
	BarChart3,
	Map,
	Coffee,
	Crown,
	Star,
	LogOut,
	Clock3,
} from "lucide-react";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import {
	DELETE_ACCOUNT_FAILED,
	DELETE_NOT_SIGNED_IN,
} from "@/utils/user-messages";

const supabase = createClient();

export default function ProfilePage() {
	const router = useRouter();
	const { user, signOut, subscription } = useAuth();
	const hasLoadedSettings = useRef(false);
	const settingsStorageKey = useMemo(
		() => `rw:profile-notification-settings:${user?.id ?? "guest"}`,
		[user?.id],
	);

	const defaultNotificationSettings = {
		watchlistEmailAlerts: true,
		weeklyPortfolioSummary: true,
		dealAlerts: true,
		pointsExpiryWarnings: true,
	};

	const [notificationSettings, setNotificationSettings] = useState(
		defaultNotificationSettings,
	);
	const [dayPassExpiresAt, setDayPassExpiresAt] = useState<number | null>(null);
	const [timeNow, setTimeNow] = useState(Date.now());
	const [canViewAnalytics, setCanViewAnalytics] = useState(false);

	useEffect(() => {
		if (!user?.id) {
			setCanViewAnalytics(false);
			setDayPassExpiresAt(null);
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
				? `Day Pass Active (${dayPassTimeLeft} left)`
				: "Free Plan";

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const raw = localStorage.getItem(settingsStorageKey);
				if (raw) {
					const parsed = JSON.parse(raw) as Partial<
						typeof defaultNotificationSettings
					>;
					if (!cancelled) {
						setNotificationSettings((prev) => ({ ...prev, ...parsed }));
					}
				}

				if (user?.id) {
					const { data, error } = await supabase.auth.getUser();
					if (error) throw error;
					const remote = (data.user?.user_metadata?.notification_settings ??
						null) as Partial<typeof defaultNotificationSettings> | null;
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
			desc: "Manage cards & balances",
			page: "/wallet-setup",
			color: "emerald",
		},
		{
			icon: BarChart3,
			label: "Health Check",
			desc: "Portfolio review",
			page: "/health-check",
			color: "blue",
		},
		{
			icon: Map,
			label: "Transfer Paths",
			desc: "Point optimizer",
			page: "/transfer-optimizer",
			color: "cyan",
		},
		{
			icon: Coffee,
			label: "Concierge",
			desc: "Flight booking · $19",
			page: "/concierge",
			color: "amber",
		},
		{
			icon: Crown,
			label: "Premium Concierge",
			desc: "White-glove · $199",
			page: "/concierge",
			color: "purple",
		},
		{
			icon: Star,
			label: "Past searches",
			desc: "Review your prior verdicts",
			page: "/history",
			color: "pink",
		},
	];

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950">
			<TropicalBackground />
			<main className="max-w-2xl mx-auto px-6 py-8">
				<h1 className="text-3xl font-bold text-white mb-6 drop-shadow-lg">
					Profile
				</h1>

				<div className="space-y-4">
					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6">
						<div className="flex items-center gap-4 mb-4">
							<div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
								<User className="w-7 h-7 text-emerald-400" />
							</div>

							<div>
								<p className="text-white font-semibold">
									{user?.email || "User"}
								</p>
								{hasActiveDayPass && subscription !== "pro" ? (
									<div className="mt-1.5 min-w-[260px]">
										<div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
											<Clock3 className="w-3.5 h-3.5" />
											Day Pass Active
											<span className="text-emerald-100/90">
												({dayPassTimeLeft} left)
											</span>
										</div>
									</div>
								) : (
									<p className="text-gray-400 text-sm capitalize">
										{planLabel}
									</p>
								)}
							</div>
						</div>

						<button
							onClick={async () => {
								if (subscription !== "pro") {
									router.push("/subscribe");
									return;
								}

								const res = await fetch("/api/payments/portal", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
								});
								const data = await res.json();

								if (data.url) {
									window.location.href = data.url;
								} else {
									router.push("/subscribe");
								}
							}}
							className="w-full bg-gray-800/50 hover:bg-gray-800 text-emerald-400 py-2.5 rounded-lg text-sm font-medium border border-gray-700"
						>
							{subscription === "pro"
								? "Manage Monthly Subscription"
								: hasActiveDayPass
									? "View Plans"
									: "Subscribe"}
						</button>
					</div>

					{canViewAnalytics && (
						<div className="bg-emerald-500/10 backdrop-blur rounded-xl p-5 border border-emerald-400/30">
							<div className="flex items-start gap-4">
								<div className="w-11 h-11 bg-emerald-400/15 rounded-xl flex items-center justify-center shrink-0">
									<BarChart3 className="w-5 h-5 text-emerald-300" />
								</div>

								<div className="flex-1">
									<p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80 font-semibold mb-1">
										Admin only
									</p>
									<h2 className="text-white text-lg font-semibold">
										Product Analytics
									</h2>
									<p className="text-gray-300 text-sm mt-1">
										Review tester behavior, page usage, route demand, Zoe usage,
										and ask the analytics copilot questions.
									</p>

									<button
										onClick={() => router.push("/admin/analytics")}
										className="mt-4 w-full sm:w-auto bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
									>
										Open Analytics Dashboard
									</button>
								</div>
							</div>
						</div>
					)}

					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6">
						<h2 className="text-lg font-semibold text-white mb-4">Tools</h2>

						<div className="grid grid-cols-2 gap-3">
							{tools.map((tool, i) => (
								<button
									key={i}
									onClick={() => router.push(tool.page)}
									className="bg-gray-800/50 hover:bg-gray-800 rounded-lg p-3 text-left transition-all border border-gray-700/50"
								>
									<tool.icon className="w-5 h-5 text-emerald-400 mb-2" />

									<p className="text-white text-sm font-medium">{tool.label}</p>

									<p className="text-gray-500 text-xs">{tool.desc}</p>
								</button>
							))}
						</div>
					</div>

					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6">
						<h2 className="text-lg font-semibold text-white mb-4">Settings</h2>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-gray-300 text-sm">
									Email alerts for watchlist
								</span>
								<input
									type="checkbox"
									checked={notificationSettings.watchlistEmailAlerts}
									onChange={(e) =>
										setNotificationSettings((prev) => ({
											...prev,
											watchlistEmailAlerts: e.target.checked,
										}))
									}
									className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500"
								/>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-gray-300 text-sm">
									Weekly portfolio summary
								</span>
								<input
									type="checkbox"
									checked={notificationSettings.weeklyPortfolioSummary}
									onChange={(e) =>
										setNotificationSettings((prev) => ({
											...prev,
											weeklyPortfolioSummary: e.target.checked,
										}))
									}
									className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500"
								/>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-gray-300 text-sm">Deal alerts</span>
								<input
									type="checkbox"
									checked={notificationSettings.dealAlerts}
									onChange={(e) =>
										setNotificationSettings((prev) => ({
											...prev,
											dealAlerts: e.target.checked,
										}))
									}
									className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500"
								/>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-gray-300 text-sm">
									Points expiry warnings
								</span>
								<input
									type="checkbox"
									checked={notificationSettings.pointsExpiryWarnings}
									onChange={(e) =>
										setNotificationSettings((prev) => ({
											...prev,
											pointsExpiryWarnings: e.target.checked,
										}))
									}
									className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500"
								/>
							</div>
						</div>
					</div>

					<button
						onClick={async () => {
							await signOut();
							router.replace("/");
						}}
						className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium py-3 rounded-xl border border-red-500/30 flex items-center justify-center gap-2"
					>
						<LogOut className="w-5 h-5" />
						Log Out
					</button>

					<button
						onClick={async () => {
							if (
								!confirm("This will permanently delete your account. Continue?")
							) {
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
						}}
						className="w-full bg-red-900/20 hover:bg-red-900/30 text-red-500 font-medium py-3 rounded-xl border border-red-900/30 flex items-center justify-center gap-2"
					>
						Delete Account
					</button>
				</div>
			</main>
		</div>
	);
}