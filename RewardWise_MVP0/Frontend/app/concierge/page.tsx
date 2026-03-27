/** @format */

"use client";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import {
	CheckCircle,
	Coffee,
	Star,
	Check,
	Crown,
	Loader2,
	MapPin,
	ClipboardList,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TravelRequestRow = {
	id: string;
	tier: string;
	status: string;
	origin: string;
	destination: string;
	departure_date: string;
	return_date: string | null;
	trip_type: string | null;
	passengers: number | null;
	cabin: string | null;
	quoted_price: number | null;
	currency: string | null;
	constraints: unknown;
	created_at: string;
};

function formatDate(d: string | null | undefined) {
	if (!d) return "-";
	return new Date(d).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}


function rowHasActiveConcierge(r: TravelRequestRow): boolean {
	const st = r.status;
	if (st === "cancelled" || st === "failed") return false;
	if (st === "paid" || st === "in_progress" || st === "delivered") return true;
	const c = r.constraints as Record<string, unknown> | null;
	if (c?.stripe_payment === "paid") return true;
	return false;
}

function statusLabel(status: string): { text: string; className: string } {
	const map: Record<string, { text: string; className: string }> = {
		draft: { text: "Draft", className: "text-gray-400 bg-gray-500/20" },
		submitted: { text: "Submitted", className: "text-gray-300 bg-gray-600/30" },
		payment_pending: {
			text: "Payment pending",
			className: "text-amber-200 bg-amber-500/20",
		},
		paid: { text: "Subscribed", className: "text-emerald-200 bg-emerald-600/30" },
		in_progress: {
			text: "In progress",
			className: "text-sky-200 bg-sky-600/30",
		},
		delivered: { text: "Delivered", className: "text-teal-200 bg-teal-600/30" },
		needs_info: {
			text: "Needs info",
			className: "text-orange-200 bg-orange-500/20",
		},
		cancelled: { text: "Cancelled", className: "text-red-300 bg-red-500/15" },
		failed: { text: "Failed", className: "text-red-400 bg-red-500/20" },
	};
	return map[status] ?? {
		text: status,
		className: "text-gray-300 bg-gray-600/30",
	};
}

export default function ConciergePage() {
	const router = useRouter();
	const { user } = useAuth();
	const supabase = createClient();
	const [loadingPaid, setLoadingPaid] = useState(true);
	const [hasPaidStandard, setHasPaidStandard] = useState(false);
	const [hasPaidPremium, setHasPaidPremium] = useState(false);
	const [trips, setTrips] = useState<TravelRequestRow[]>([]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!user) {
				setHasPaidStandard(false);
				setHasPaidPremium(false);
				setTrips([]);
				setLoadingPaid(false);
				return;
			}
			setLoadingPaid(true);
			const { data, error } = await supabase
				.from("travel_requests")
				.select(
					"id, tier, status, origin, destination, departure_date, return_date, trip_type, passengers, cabin, quoted_price, currency, constraints, created_at",
				)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false })
				.limit(25);

			if (cancelled) return;

			if (error) {
				console.error("travel_requests:", error);
				setTrips([]);
				setHasPaidStandard(false);
				setHasPaidPremium(false);
			} else {
				const rows = (data ?? []) as TravelRequestRow[];
				setTrips(rows);
				const active = rows.filter(rowHasActiveConcierge);
				setHasPaidStandard(active.some((r) => r.tier === "standard"));
				setHasPaidPremium(active.some((r) => r.tier === "premium"));
			}
			setLoadingPaid(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [user, supabase]);

	useEffect(() => {
		const onVis = () => {
			if (document.visibilityState !== "visible" || !user) return;
			(async () => {
				const { data } = await supabase
					.from("travel_requests")
					.select(
						"id, tier, status, origin, destination, departure_date, return_date, trip_type, passengers, cabin, quoted_price, currency, constraints, created_at",
					)
					.eq("user_id", user.id)
					.order("created_at", { ascending: false })
					.limit(25);
				const rows = (data ?? []) as TravelRequestRow[];
				setTrips(rows);
				const active = rows.filter(rowHasActiveConcierge);
				setHasPaidStandard(active.some((r) => r.tier === "standard"));
				setHasPaidPremium(active.some((r) => r.tier === "premium"));
			})();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, [user, supabase]);

	const paidSummary =
		hasPaidPremium && hasPaidStandard
			? "Standard and Premium"
			: hasPaidPremium
				? "Premium"
				: hasPaidStandard
					? "Standard"
					: null;

	return (
		<div className="relative min-h-screen overflow-hidden text-white">
			<TropicalBackground />
			<div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-10 px-6">
				<div className="text-center mb-6 max-w-xl">
					<h1 className="text-4xl font-bold mb-3">Concierge Booking Service</h1>
					<p className="text-gray-300">
						Let our experts handle the complex stuff. You just tell us where.
					</p>
					{loadingPaid && user && (
						<div className="mt-4 flex justify-center text-gray-400 text-sm gap-2 items-center">
							<Loader2 className="w-4 h-4 animate-spin" />
							Loading your concierge trips…
						</div>
					)}
					{!loadingPaid && paidSummary && (
						<div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-left">
							<div className="flex items-start gap-2">
								<CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-emerald-200 font-medium text-sm">
											You&apos;re subscribed - {paidSummary} concierge
									</p>
									<p className="text-gray-400 text-xs mt-1">
										Book
										another trip anytime.
									</p>
								</div>
							</div>
						</div>
					)}
				</div>


				<div className="w-full max-w-3xl">
					<div className="grid md:grid-cols-2 gap-6">
						<div
							className={`bg-gray-900/70 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl relative transition-[box-shadow,border-color] ${
								hasPaidPremium
									? "border-2 border-emerald-500/60 ring-2 ring-emerald-500/20"
									: "border border-purple-500/30"
							}`}
						>
							<div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
								{hasPaidPremium ? (
									<span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
										<CheckCircle className="w-3.5 h-3.5" /> Subscribed
									</span>
								) : (
									<span className="bg-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
										Most Popular
									</span>
								)}
							</div>
							<div className="bg-gradient-to-r from-purple-600/30 to-indigo-600/30 px-6 py-5">
								<Crown className="w-8 h-8 text-purple-400 mb-2" />
								<h2 className="text-xl font-bold text-white">
									Premium Concierge
								</h2>
								<p className="text-gray-300 text-sm mt-1">
									White-glove, end-to-end trip planning
								</p>
							</div>
							<div className="px-6 py-5">
								<div className="flex items-baseline gap-1 mb-4">
									<span className="text-4xl font-bold text-white">$199</span>
									<span className="text-gray-400 text-sm">per trip</span>
								</div>
								<div className="space-y-2.5 mb-6">
									{[
										"Full itinerary: flights + hotels + transfers",
										"Business & First class award optimization",
										"Hotel loyalty point optimization",
										"Airport lounge access coordination",
										"Restaurant & experience reservations",
										"Dedicated agent via WhatsApp/email",
										"24hr turnaround, unlimited revisions",
									].map((f, i) => (
										<div key={i} className="flex items-start gap-2">
											<Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
											<span className="text-gray-300 text-sm">{f}</span>
										</div>
									))}
								</div>
								<button
									type="button"
									onClick={() => router.push("/concierge/premium")}
									className={
										hasPaidPremium
											? "w-full border border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-100 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
											: "w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
									}
								>
									<Crown className="w-5 h-5" />
									{hasPaidPremium ? "Book another Premium trip" : "Get Premium"}
								</button>
								<p className="text-gray-500 text-xs text-center mt-2">
									Avg savings: $2,400+ per trip
								</p>
							</div>
						</div>

						
						<div
							className={`relative bg-gray-900/70 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl transition-[box-shadow,border-color] ${
								hasPaidStandard
									? "border-2 border-emerald-500/60 ring-2 ring-emerald-500/20"
									: "border border-gray-700/50"
							}`}
						>
							{hasPaidStandard && (
								<div className="absolute top-3 right-3 z-10">
									<span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
										<CheckCircle className="w-3.5 h-3.5" /> Subscribed
									</span>
								</div>
							)}
							<div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 px-6 py-5">
								<Coffee className="w-8 h-8 text-amber-400 mb-2" />
								<h2 className="text-xl font-bold text-white">
									Standard Concierge
								</h2>
								<p className="text-gray-300 text-sm mt-1">
									Expert flight booking optimization
								</p>
							</div>
							<div className="px-6 py-5">
								<div className="flex items-baseline gap-1 mb-4">
									<span className="text-4xl font-bold text-white">$39</span>
									<span className="text-gray-400 text-sm">per trip</span>
								</div>
								<div className="space-y-2.5 mb-6">
									{[
										"Optimal flight award redemption",
										"Points transfer path optimization",
										"Economy & Premium Economy focus",
										"Email support",
										"24-48hr turnaround",
										"1 round of revisions",
									].map((f, i) => (
										<div key={i} className="flex items-start gap-2">
											<Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
											<span className="text-gray-300 text-sm">{f}</span>
										</div>
									))}
									<div className="h-6" />
								</div>
								<button
									type="button"
									onClick={() => router.push("/concierge/standard")}
									className={
										hasPaidStandard
											? "w-full border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
											: "w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
									}
								>
									<Coffee className="w-5 h-5" />
									{hasPaidStandard
										? "Book another Standard trip"
										: "Get Standard"}
								</button>
								<p className="text-gray-500 text-xs text-center mt-2">
									Avg savings: $800+ per trip
								</p>
							</div>
						</div>
					</div>

					<div className="mt-8 flex justify-center px-2">
						<button
							type="button"
							onClick={() => router.push("/concierge/history")}
							className="inline-flex items-center justify-center gap-2 w-full max-w-sm border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100 font-semibold py-3 px-6 rounded-lg transition-colors"
						>
							<ClipboardList className="w-5 h-5 text-emerald-300" />
							View status
						</button>
					</div>
				</div>

				<div className="mt-8 text-center max-w-md">
					<div className="flex items-center justify-center gap-1 mb-1">
						{[1, 2, 3, 4, 5].map((s) => (
							<Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />
						))}
					</div>
					<p className="text-gray-400 text-sm">
						&quot;Saved us $3,200 on our anniversary trip to Tokyo. Worth every
						penny.&quot; - Sarah K.
					</p>
				</div>
			</div>
		</div>
	);
}
