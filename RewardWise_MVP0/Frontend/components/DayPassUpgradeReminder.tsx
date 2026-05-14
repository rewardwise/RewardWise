/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, Crown, X } from "lucide-react";

import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import {
	formatDayPassTimeLeft,
	getDayPassMsLeft,
	getNextDayPassUpgradeReminderAt,
	shouldShowDayPassUpgradeReminder,
} from "@/utils/entitlements/day-pass-reminders";

type ProfileDayPassRow = {
	day_pass_expires_at: string | null;
};

const HIDDEN_PATH_PREFIXES = [
	"/login",
	"/signup",
	"/auth",
	"/subscribe",
	"/subscription",
];

function readNumberFromLocalStorage(key: string): number | null {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;
		const value = Number(raw);
		return Number.isFinite(value) ? value : null;
	} catch {
		return null;
	}
}

export default function DayPassUpgradeReminder() {
	const router = useRouter();
	const pathname = usePathname();
	const { user, subscription } = useAuth();
	const [expiresAt, setExpiresAt] = useState<string | null>(null);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [snoozedUntilMs, setSnoozedUntilMs] = useState<number | null>(null);
	const supabase = useMemo(() => createClient(), []);

	const reminderStorageKey = useMemo(() => {
		return user?.id && expiresAt
			? `rw:day-pass-upgrade-reminder:${user.id}:${expiresAt}`
			: null;
	}, [expiresAt, user?.id]);

	useEffect(() => {
		const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!reminderStorageKey) {
			setSnoozedUntilMs(null);
			return;
		}
		setSnoozedUntilMs(readNumberFromLocalStorage(reminderStorageKey));
	}, [reminderStorageKey]);

	useEffect(() => {
		if (!user?.id || subscription === "pro") {
			setExpiresAt(null);
			return;
		}

		let cancelled = false;

		const loadDayPass = async () => {
			const { data, error } = await supabase
				.from("profiles")
				.select("day_pass_expires_at")
				.eq("user_id", user.id)
				.maybeSingle();

			if (cancelled) return;

			if (error) {
				console.warn("Could not load day pass reminder state", error);
				setExpiresAt(null);
				return;
			}

			const row = data as ProfileDayPassRow | null;
			setExpiresAt(row?.day_pass_expires_at ?? null);
		};

		void loadDayPass();

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void loadDayPass();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [subscription, supabase, user?.id]);

	const isHiddenPath = HIDDEN_PATH_PREFIXES.some((prefix) =>
		pathname?.startsWith(prefix),
	);
	const isPro = subscription === "pro";
	const msLeft = getDayPassMsLeft(expiresAt, nowMs);
	const shouldShow =
		!isHiddenPath &&
		shouldShowDayPassUpgradeReminder({
			expiresAt,
			isPro,
			nowMs,
			snoozedUntilMs,
		});

	if (!shouldShow) return null;

	const timeLeftLabel = formatDayPassTimeLeft(msLeft);

	const snoozeReminder = () => {
		const nextReminderAt = getNextDayPassUpgradeReminderAt(nowMs);
		setSnoozedUntilMs(nextReminderAt);
		if (reminderStorageKey) {
			try {
				window.localStorage.setItem(reminderStorageKey, String(nextReminderAt));
			} catch {
				// If localStorage is unavailable, keep the in-memory snooze for this tab.
			}
		}
	};

	return (
		<div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl sm:inset-x-6 sm:bottom-5">
			<div className="overflow-hidden rounded-2xl border border-emerald-300/25 bg-slate-950/94 text-white shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:rounded-[1.5rem]">
				<div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
					<div className="flex min-w-0 items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/20">
							<Clock3 className="h-5 w-5" />
						</div>
						<div className="min-w-0">
							<p className="text-sm font-bold text-white">
								Your day pass has {timeLeftLabel}
							</p>
							<p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">
								Upgrade to Monthly now to keep Zoe and Verdict Search active after the pass expires.
							</p>
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={() => router.push("/subscribe?upgrade=monthly")}
							className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-300 sm:flex-none"
						>
							<Crown className="h-4 w-4" />
							Upgrade
						</button>
						<button
							type="button"
							onClick={snoozeReminder}
							className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
							aria-label="Remind me later"
							title="Remind me later"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
