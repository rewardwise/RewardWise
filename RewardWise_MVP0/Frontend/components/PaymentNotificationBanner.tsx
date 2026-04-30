/** @format */
"use client";

import { useEffect, useState } from "react";
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

export default function PaymentNotificationBanner() {
	const { user } = useAuth();
	const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
	const supabase = createClient();

	useEffect(() => {
		if (!user) return;

		(async () => {
			const { data } = await supabase
				.from("payment_notifications")
				.select("*")
				.eq("user_id", user.id)
				.eq("is_read", false)
				.order("created_at", { ascending: false })
				.limit(3);

			if (data) setNotifications(data as PaymentNotification[]);
		})();
	}, [user, supabase]);

	const dismiss = async (id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
		await supabase
			.from("payment_notifications")
			.update({ is_read: true })
			.eq("id", id);
	};

	if (notifications.length === 0) return null;

	return (
		<div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
			{notifications.map((n) => (
				<div
					key={n.id}
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
						className="text-gray-500 hover:text-white flex-shrink-0"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
			))}
		</div>
	);
}
