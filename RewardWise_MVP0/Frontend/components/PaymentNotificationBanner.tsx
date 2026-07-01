/** @format */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { AlertTriangle, CheckCircle, X } from "lucide-react";

type PaymentNotification = {
	id: string;
	type: string;
	title: string;
	message: string;
	is_read: boolean;
	created_at: string;
};

const AUTO_DISMISS_MS = 8000;

export default function PaymentNotificationBanner() {
	const { user } = useAuth();
	const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
	// Memoized so it's a stable dep: createClient() returns a NEW browser client
	// each call, and an unstable dep here made the fetch effect re-run (and
	// re-fetch) on every render — part of why the toast appeared to re-fire.
	const supabase = useMemo(() => createClient(), []);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		(async () => {
			// `is_read = false` filters SERVER-SIDE, so a notification already marked
			// seen never comes back over the wire — no client-side flash on reload.
			const { data } = await supabase
				.from("payment_notifications")
				.select("*")
				.eq("user_id", user.id)
				.eq("is_read", false)
				.order("created_at", { ascending: false })
				.limit(3);
			if (!cancelled && data) setNotifications(data as PaymentNotification[]);
		})();
		return () => {
			cancelled = true;
		};
	}, [user, supabase]);

	// Pending auto-dismiss timers, keyed by notification id. A ref so an unrelated
	// re-render doesn't cancel them; cleared on unmount.
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

	const dismiss = useCallback(
		async (id: string) => {
			// Cancel + forget any pending auto-dismiss timer for this id (so a manual
			// dismiss doesn't leave a timer that later re-fires dismiss redundantly).
			const timer = timersRef.current.get(id);
			if (timer) clearTimeout(timer);
			timersRef.current.delete(id);
			setNotifications((prev) => prev.filter((n) => n.id !== id));
			// Persist "seen" in the backend (payment_notifications.is_read) so the
			// server-side filter excludes it on the next load. Idempotent.
			await supabase.from("payment_notifications").update({ is_read: true }).eq("id", id);
		},
		[supabase],
	);

	// Auto-dismiss non-critical notifications 8s after they first render (also
	// marks them seen). `payment_failed` is EXEMPT: a failed-payment alert must
	// persist until the user manually dismisses it — auto-hiding + marking it read
	// would let a critical alert vanish after 8s and never return.
	useEffect(() => {
		notifications.forEach((n) => {
			if (n.type === "payment_failed") return;
			if (timersRef.current.has(n.id)) return;
			timersRef.current.set(
				n.id,
				setTimeout(() => void dismiss(n.id), AUTO_DISMISS_MS),
			);
		});
	}, [notifications, dismiss]);
	useEffect(() => {
		const timers = timersRef.current;
		return () => timers.forEach((t) => clearTimeout(t));
	}, []);

	if (notifications.length === 0) return null;

	return (
		<div className="fixed top-16 right-4 z-50 space-y-2 max-w-[calc(100vw-2rem)] sm:max-w-sm">
			{notifications.map((n) => (
				<div
					key={n.id}
					data-testid="payment-notification"
					className={`rounded-lg p-4 shadow-lg border backdrop-blur flex items-start gap-3 ${
						n.type === "payment_failed"
							? "bg-red-950/90 border-red-500/30"
							: "bg-emerald-950/90 border-emerald-500/30"
					}`}
				>
					{n.type === "payment_failed" ? (
						<AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
					) : (
						<CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
					)}
					<div className="flex-1 min-w-0">
						<p className="text-white text-sm font-medium">{n.title}</p>
						<p className="text-gray-400 text-xs mt-1">{n.message}</p>
					</div>
					<button
						onClick={() => dismiss(n.id)}
						aria-label="Dismiss notification"
						className="text-gray-500 hover:text-white flex-shrink-0"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
			))}
		</div>
	);
}
