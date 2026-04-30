/** @format */
"use client";

import TropicalBackground from "@/components/TropicalBackground";
import AirportSearch from "@/components/AirportSearch";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle, Coffee, Loader2, Sparkles } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ConfirmedRequest = {
	id: string;
	tier: string;
	status: string;
	origin: string;
	destination: string;
	departure_date: string;
	quoted_price: number | null;
	currency: string;
	sla_hours: number | null;
	created_at: string;
};

function orderDisplayId(row: ConfirmedRequest) {
	const y = new Date(row.created_at).getFullYear();
	const tail = row.id.replace(/-/g, "").slice(-5).toUpperCase();
	return `RW-${y}-${tail}`;
}

function tierLabel(tier: string) {
	if (tier === "premium") return "Premium Concierge";
	return "Standard Concierge";
}

function statusUi(status: string) {
	if (status === "in_progress")
		return { text: "Working on your trip", cls: "text-sky-300" };
	if (status === "delivered") return { text: "Delivered", cls: "text-teal-300" };
	if (status === "paid")
		return { text: "Reviewing your best options", cls: "text-amber-300" };
	return { text: status.replace(/_/g, " "), cls: "text-gray-300" };
}

function turnaroundLabel(sla: number | null, tier: string) {
	if (sla != null && sla > 0) {
		if (sla <= 24) return `${sla} hours`;
		return `${sla}–${sla + 24} hours`;
	}
	return tier === "premium" ? "10 hours (expedited)" : "24–48 hours";
}

function ConciergeStandardInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const requestParam = searchParams.get("request");
	const supabase = createClient();
	const { user } = useAuth();

	const [form, setForm] = useState({
		origin: "",
		destination: "",
		tripType: "roundtrip",
		departureDate: "",
		returnDate: "",
		flexibility: "flexible",
		travelers: "2",
		cabin: "economy",
		budget: "",
		preferences: "",
	});
	const [loading, setLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [requestId, setRequestId] = useState<string | null>(null);
	const [confirmed, setConfirmed] = useState<ConfirmedRequest | null>(null);
	const [loadConfirm, setLoadConfirm] = useState(false);
	const [canceling, setCanceling] = useState(false);

	useEffect(() => {
		if (!user || !requestParam) {
			if (!requestParam) {
				setConfirmed(null);
				setSubmitted(false);
				setRequestId(null);
			}
			return;
		}

		let cancelled = false;
		setLoadConfirm(true);
		(async () => {
			const { data, error } = await supabase
				.from("travel_requests")
				.select(
					"id, tier, status, origin, destination, departure_date, quoted_price, currency, sla_hours, created_at",
				)
				.eq("id", requestParam)
				.eq("user_id", user.id)
				.single();

			if (cancelled) return;
			setLoadConfirm(false);

			if (error || !data) {
				setSubmitError("We could not load this concierge request.");
				setSubmitted(false);
				setConfirmed(null);
				setRequestId(null);
				return;
			}

			const row = data as ConfirmedRequest;
			const okStatus = ["paid", "in_progress", "delivered"].includes(row.status);
			if (!okStatus) {
				setSubmitError(
					"This request is not confirmed yet. Please complete payment or use the correct link.",
				);
				setSubmitted(false);
				setConfirmed(null);
				setRequestId(null);
				return;
			}

			setConfirmed(row);
			setRequestId(row.id);
			setSubmitted(true);
			setSubmitError("");
		})();

		return () => {
			cancelled = true;
		};
	}, [user, supabase, requestParam]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("stripe_canceled") !== "1") return;
		if (!user) return;

		const rid = params.get("travel_request_id");
		let cancelled = false;
		(async () => {
			if (rid) {
				await supabase
					.from("travel_requests")
					.update({ status: "cancelled" })
					.eq("id", rid)
					.eq("user_id", user.id);
			}
			if (cancelled) return;
			setSubmitError("Payment was cancelled. You can try again anytime.");
			router.replace("/concierge/standard", { scroll: false });
		})();
		return () => {
			cancelled = true;
		};
	}, [router, supabase, user]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const sid = params.get("stripe_session_id");
		if (!sid || !user) return;

		let cancelled = false;
		let attempts = 0;
		const maxAttempts = 10;

		const pollPayment = async () => {
			const res = await fetch(
				`/api/payments/session?session_id=${encodeURIComponent(sid)}`,
			);
			const data = (await res.json()) as {
				payment_status?: string;
				travel_request_id?: string;
				error?: string;
			};
			if (cancelled) return;
			if (!res.ok) {
				setSubmitError(data.error || "We could not confirm payment.");
				return;
			}
			if (data.payment_status === "paid" && data.travel_request_id) {
				router.replace(
					`/concierge/standard?request=${encodeURIComponent(data.travel_request_id)}`,
					{ scroll: false },
				);
				return;
			}
			attempts++;
			if (attempts < maxAttempts) {
				setTimeout(pollPayment, 2000);
			} else {
				setSubmitError(
					"Payment is being processed. Please refresh the page in a moment.",
				);
			}
		};

		pollPayment();

		return () => {
			cancelled = true;
		};
	}, [router, supabase, user]);

	const handleSubmit = async () => {
		if (!user) return setSubmitError("Please sign in to submit a request.");
		if (!form.origin || !form.destination || !form.departureDate) {
			return setSubmitError("Origin, destination, and departure date are required.");
		}
		if (form.tripType === "roundtrip" && !form.returnDate) {
			return setSubmitError("Please choose a return date for roundtrip.");
		}

		setSubmitError("");
		setLoading(true);

		const { data, error } = await supabase
			.from("travel_requests")
			.insert({
				user_id: user.id,
				tier: "standard",
				status: "payment_pending",
				origin: form.origin.trim().toUpperCase(),
				destination: form.destination.trim().toUpperCase(),
				departure_date: form.departureDate,
				return_date:
					form.tripType === "roundtrip" ? form.returnDate || null : null,
				trip_type: form.tripType,
				passengers: Number(form.travelers),
				cabin: form.cabin,
				budget_cash: form.budget ? Number(form.budget) : null,
				constraints: { flexibility: form.flexibility, stripe_payment: "pending" },
				notes: form.preferences || null,
				quoted_price: 39,
				currency: "USD",
				sla_hours: 48,
			})
			.select("id")
			.single();

		if (error || !data) {
			setSubmitError(error?.message || "We could not submit your request.");
			setLoading(false);
			return;
		}

		setRequestId(data.id);
		await supabase.from("travel_request_events").insert({
			request_id: data.id,
			event_type: "created",
			payload: { tier: "standard", flexibility: form.flexibility },
			actor_user_id: user.id,
		});

		const checkoutRes = await fetch("/api/payments/checkout", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ travelRequestId: data.id }),
		});
		const checkout = (await checkoutRes.json()) as { url?: string; error?: string };
		if (!checkoutRes.ok) {
			setSubmitError(checkout.error || "Unable to start payment. Please try again.");
			setLoading(false);
			return;
		}
		if (checkout.url) {
			window.location.href = checkout.url;
			return;
		}
		setSubmitError("No checkout URL returned.");
		setLoading(false);
	};

	const handleCancelRequest = async () => {
		if (!user || !requestId) return;
		setCanceling(true);
		const { error } = await supabase
			.from("travel_requests")
			.update({ status: "cancelled" })
			.eq("id", requestId)
			.eq("user_id", user.id);
		setCanceling(false);
		if (error) {
			setSubmitError(error.message);
			return;
		}
		router.push("/concierge");
	};

	const destLabel = confirmed?.destination ?? "";
	const st = confirmed ? statusUi(confirmed.status) : { text: "", cls: "" };
	const price =
		confirmed?.quoted_price != null
			? `${confirmed.currency ?? "USD"} $${Number(confirmed.quoted_price).toFixed(0)}`
			: "$39";

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />
			<div className="relative z-10">
				<main className="max-w-2xl mx-auto px-6 py-8">
					<div className="flex items-center gap-3 mb-6">
						<div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
							<Coffee className="w-6 h-6 text-amber-400" />
						</div>
						<div>
							<h1 className="text-3xl font-bold text-white drop-shadow-lg">
								Concierge
							</h1>
							<p className="text-gray-200">
								Let us handle the booking. You just tell us where.
							</p>
						</div>
					</div>

					{loadConfirm && requestParam && (
						<div className="flex justify-center text-gray-400 text-sm gap-2 py-8">
							<Loader2 className="w-4 h-4 animate-spin" />
							Loading your confirmation…
						</div>
					)}

					{!loadConfirm && submitted && confirmed ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl">
							<div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
								<CheckCircle className="w-8 h-8 text-emerald-400" />
							</div>
							<h2 className="text-2xl font-bold text-white mb-2">
								Request Submitted!
							</h2>
							<p className="text-gray-400 mb-2">
								We&apos;re already working on your trip
								{destLabel ? ` to ${destLabel}` : ""}.
							</p>

							<div className="bg-gray-800/50 rounded-lg p-4 mb-4 text-left space-y-2">
								<div className="flex justify-between gap-4">
									<span className="text-gray-400 text-sm">Order #</span>
									<span className="text-white text-sm font-mono">
										{orderDisplayId(confirmed)}
									</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-gray-400 text-sm">Tier</span>
									<span className="text-emerald-300 text-sm">
										{tierLabel(confirmed.tier)}
									</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-gray-400 text-sm">Price</span>
									<span className="text-emerald-400 text-sm font-medium">
										{price}
									</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-gray-400 text-sm">Turnaround</span>
									<span className="text-white text-sm">
										{turnaroundLabel(confirmed.sla_hours, confirmed.tier)}
									</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-gray-400 text-sm">Status</span>
									<span className={`text-sm ${st.cls}`}>{st.text}</span>
								</div>
							</div>

							<p className="text-gray-500 text-sm mb-4">
								You&apos;ll receive your recommendation within the turnaround
								window above (keep an eye on your email).
							</p>

							<div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
								<div className="flex items-center gap-2 mb-3">
									<Sparkles className="w-4 h-4 text-emerald-400" />
									<span className="text-emerald-400 text-sm font-medium">
										What happens next
									</span>
								</div>
								<div className="space-y-2 text-gray-300 text-sm">
									<p>→ Our AI analyzes your wallet for the best redemption</p>
									<p>→ We check award availability across partner airlines</p>
									<p>→ You receive a single recommended booking path</p>
								</div>
							</div>

							<button
								type="button"
								onClick={() =>
									router.push(
										confirmed?.id
											? `/concierge/history?highlight=${encodeURIComponent(confirmed.id)}`
											: "/concierge/history",
									)
								}
								className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-lg w-full mb-2"
							>
								View my status
							</button>
							<div className="flex gap-2">
								<button
									type="button"
									className="flex-1 border border-gray-600 text-white py-2 rounded-lg text-sm hover:bg-gray-800"
								>
									Add note
								</button>
								<button
									type="button"
									disabled={canceling}
									onClick={handleCancelRequest}
									className="flex-1 border border-red-500/30 text-red-400 py-2 rounded-lg text-sm hover:bg-red-500/10 disabled:opacity-50"
								>
									{canceling ? "Canceling…" : "Cancel Request"}
								</button>
							</div>
						</div>
					) : !loadConfirm ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl space-y-4">
							<div className="grid grid-cols-2 gap-3">
								<AirportSearch
									label="FROM"
									value={form.origin}
									onChange={(code) => setForm({ ...form, origin: code })}
									placeholder="City or airport"
								/>
								<AirportSearch
									label="TO"
									value={form.destination}
									onChange={(code) => setForm({ ...form, destination: code })}
									placeholder="City or airport"
								/>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-gray-400 text-sm mb-1">Trip Type</label>
									<select
										value={form.tripType}
										onChange={(e) => setForm({ ...form, tripType: e.target.value })}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
									>
										<option value="roundtrip">Roundtrip</option>
										<option value="oneway">One way</option>
									</select>
								</div>
								<div>
									<label className="block text-gray-400 text-sm mb-1">Departure *</label>
									<input
										type="date"
										min={new Date().toISOString().split("T")[0]}
										value={form.departureDate}
										onChange={(e) =>
											setForm({ ...form, departureDate: e.target.value })
										}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
									/>
								</div>
								<div>
									<label className="block text-gray-400 text-sm mb-1">Return</label>
									<input
										type="date"
										min={
											form.departureDate || new Date().toISOString().split("T")[0]
										}
										disabled={form.tripType === "oneway"}
										value={form.returnDate}
										onChange={(e) =>
											setForm({ ...form, returnDate: e.target.value })
										}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white disabled:opacity-50"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-gray-400 text-sm mb-1">Travelers</label>
									<select
										value={form.travelers}
										onChange={(e) =>
											setForm({ ...form, travelers: e.target.value })
										}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
									>
										{[1, 2, 3, 4, 5, 6].map((n) => (
											<option key={n} value={n}>
												{n}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-gray-400 text-sm mb-1">Cabin</label>
									<select
										value={form.cabin}
										onChange={(e) => setForm({ ...form, cabin: e.target.value })}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
									>
										<option value="economy">Economy</option>
										<option value="premium">Premium Economy</option>
										<option value="business">Business</option>
										<option value="first">First</option>
									</select>
								</div>
							</div>

							<div>
								<label className="block text-gray-400 text-sm mb-1">Flexibility</label>
								<select
									value={form.flexibility}
									onChange={(e) =>
										setForm({ ...form, flexibility: e.target.value })
									}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
								>
									<option value="exact">Exact dates</option>
									<option value="flexible">± 3 days</option>
									<option value="very-flexible">± 1 week</option>
								</select>
							</div>

							<div>
								<label className="block text-gray-400 text-sm mb-1">
									Budget (optional)
								</label>
								<input
									value={form.budget}
									onChange={(e) =>
										setForm({
											...form,
											budget: e.target.value.replace(/[^0-9.]/g, ""),
										})
									}
									placeholder="e.g. 1200"
									className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500"
								/>
							</div>

							<div>
								<label className="block text-gray-400 text-sm mb-1">
									Anything else we should know?
								</label>
								<textarea
									value={form.preferences}
									onChange={(e) =>
										setForm({ ...form, preferences: e.target.value })
									}
									rows={3}
									placeholder="Preferences, constraints, direct flights only..."
									className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 resize-none"
								/>
							</div>

							{submitError && <p className="text-red-400 text-sm">{submitError}</p>}

							<div className="rounded-lg border border-gray-700/80 bg-gray-800/40 px-3 py-2 text-sm text-gray-300 flex justify-between items-center">
								<span>Concierge fee</span>
								<span className="text-white font-semibold">$39.00 USD</span>
							</div>

							<button
								type="button"
								onClick={handleSubmit}
								disabled={loading}
								className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
							>
								{loading ? (
									<>
										<Loader2 className="w-5 h-5 animate-spin" /> Redirecting to secure checkout...
									</>
								) : (
									"Continue to checkout"
								)}
							</button>
						</div>
					) : null}
				</main>
			</div>
		</div>
	);
}

export default function ConciergeStandardPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 flex items-center justify-center text-gray-400 gap-2">
					<Loader2 className="w-5 h-5 animate-spin" />
					Loading…
				</div>
			}
		>
			<ConciergeStandardInner />
		</Suspense>
	);
}
