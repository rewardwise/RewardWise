/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";

import {
	ArrowLeft,
	Calendar,
	CreditCard,
	Loader2,
	Plane,
	Search,
	Star,
	WalletCards,
} from "lucide-react";

type Recommendation = "use_points" | "pay_cash" | "wait" | null;
type BookingMethod = "cash" | "points" | string | null;

type FeedbackRow = {
	id: string;
	verdict_id: string | null;
	rating: number | null;
	comment: string | null;
	booking_method: BookingMethod;
	created_at: string;
};

type VerdictRow = {
	id: string;
	search_id: string | null;
	recommendation: Recommendation;
	summary: string | null;
	calculated_cpp: number | null;
	cash_price_used: number | null;
	points_cost_used: number | null;
};

type SearchRow = {
	id: string;
	origin: string;
	destination: string;
	departure_date: string;
	return_date: string | null;
	passengers: number;
	cabin: string | null;
	trip_type: "roundtrip" | "oneway" | string | null;
	created_at: string;
};

type BookedTrip = {
	id: string;
	feedbackId: string;
	verdictId: string | null;
	searchId: string | null;
	origin: string;
	destination: string;
	departureDate: string;
	returnDate: string | null;
	passengers: number;
	cabin: string | null;
	tripType: "roundtrip" | "oneway" | string | null;
	recommendation: Recommendation;
	bookingMethod: BookingMethod;
	rating: number | null;
	comment: string | null;
	cashPriceUsed: number | null;
	pointsCostUsed: number | null;
	calculatedCpp: number | null;
	summary: string | null;
	bookedAt: string;
	searchedAt: string | null;
};

function formatDateNice(dateStr?: string | null) {
	if (!dateStr) return "Not set";
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = year && month && day ? new Date(year, month - 1, day) : new Date(dateStr);

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatBookedDate(dateStr?: string | null) {
	if (!dateStr) return "Recently";
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function cabinLabel(cabin?: string | null) {
	if (!cabin) return "Economy";
	const labels: Record<string, string> = {
		economy: "Economy",
		premium: "Premium",
		business: "Business",
		first: "First",
	};
	return labels[cabin] ?? cabin;
}

function verdictLabel(recommendation: Recommendation) {
	if (recommendation === "use_points") return "Use Points";
	if (recommendation === "pay_cash") return "Pay Cash";
	if (recommendation === "wait") return "Wait";
	return "No verdict";
}

function bookingMethodLabel(method: BookingMethod) {
	if (method === "points") return "Booked with Points";
	if (method === "cash") return "Booked with Cash";
	return "Marked Booked";
}

function formatMoney(value?: number | null) {
	if (typeof value !== "number" || Number.isNaN(value)) return "—";
	return `$${Math.round(value).toLocaleString()}`;
}

function formatPoints(value?: number | null) {
	if (typeof value !== "number" || Number.isNaN(value)) return "—";
	return value.toLocaleString();
}

function formatCpp(value?: number | null) {
	if (typeof value !== "number" || Number.isNaN(value)) return "—";
	return `${value.toFixed(2)}¢`;
}

export default function TripsPage() {
	const router = useRouter();
	const { user, loading: authLoading } = useAuth();
	const supabase = useMemo(() => createClient(), []);

	const [trips, setTrips] = useState<BookedTrip[]>([]);
	const [loadingTrips, setLoadingTrips] = useState(true);
	const [loadError, setLoadError] = useState("");
	const [query, setQuery] = useState("");

	useEffect(() => {
		const loadBookedTrips = async () => {
			if (authLoading) return;

			if (!user) {
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			setLoadingTrips(true);
			setLoadError("");

			const { data: feedbackData, error: feedbackError } = await supabase
				.from("feedback")
				.select("id, verdict_id, rating, comment, booking_method, created_at")
				.eq("user_id", user.id)
				.eq("did_book", true)
				.order("created_at", { ascending: false });

			if (feedbackError) {
				setLoadError(feedbackError.message || "Failed to load booked trips.");
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			const feedbackRows = (feedbackData ?? []) as FeedbackRow[];
			const verdictIds = Array.from(
				new Set(feedbackRows.map((row) => row.verdict_id).filter(Boolean) as string[]),
			);

			if (verdictIds.length === 0) {
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			const { data: verdictData, error: verdictError } = await supabase
				.from("verdicts")
				.select(
					"id, search_id, recommendation, summary, calculated_cpp, cash_price_used, points_cost_used",
				)
				.in("id", verdictIds);

			if (verdictError) {
				setLoadError(verdictError.message || "Failed to load booked trip verdicts.");
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			const verdictRows = (verdictData ?? []) as VerdictRow[];
			const verdictById = new Map(verdictRows.map((row) => [row.id, row]));
			const searchIds = Array.from(
				new Set(verdictRows.map((row) => row.search_id).filter(Boolean) as string[]),
			);

			if (searchIds.length === 0) {
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			const { data: searchData, error: searchError } = await supabase
				.from("searches")
				.select(
					"id, origin, destination, departure_date, return_date, passengers, cabin, trip_type, created_at",
				)
				.in("id", searchIds);

			if (searchError) {
				setLoadError(searchError.message || "Failed to load booked trip details.");
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			const searchRows = (searchData ?? []) as SearchRow[];
			const searchById = new Map(searchRows.map((row) => [row.id, row]));

			const mappedTrips = feedbackRows
				.map((feedback) => {
					const verdict = feedback.verdict_id ? verdictById.get(feedback.verdict_id) : null;
					const search = verdict?.search_id ? searchById.get(verdict.search_id) : null;

					if (!search) return null;

					return {
						id: feedback.id,
						feedbackId: feedback.id,
						verdictId: feedback.verdict_id,
						searchId: search.id,
						origin: search.origin,
						destination: search.destination,
						departureDate: search.departure_date,
						returnDate: search.return_date,
						passengers: search.passengers,
						cabin: search.cabin,
						tripType: search.trip_type,
						recommendation: verdict?.recommendation ?? null,
						bookingMethod: feedback.booking_method,
						rating: feedback.rating,
						comment: feedback.comment,
						cashPriceUsed: verdict?.cash_price_used ?? null,
						pointsCostUsed: verdict?.points_cost_used ?? null,
						calculatedCpp: verdict?.calculated_cpp ?? null,
						summary: verdict?.summary ?? null,
						bookedAt: feedback.created_at,
						searchedAt: search.created_at,
					} satisfies BookedTrip;
				})
				.filter(Boolean) as BookedTrip[];

			setTrips(mappedTrips);
			setLoadingTrips(false);
		};

		void loadBookedTrips();
	}, [authLoading, supabase, user]);

	const filteredTrips = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return trips;

		return trips.filter((trip) => {
			const searchable = [
				trip.origin,
				trip.destination,
				cabinLabel(trip.cabin),
				verdictLabel(trip.recommendation),
				bookingMethodLabel(trip.bookingMethod),
				formatDateNice(trip.departureDate),
				formatDateNice(trip.returnDate),
				trip.comment ?? "",
			]
				.join(" ")
				.toLowerCase();

			return searchable.includes(normalized);
		});
	}, [query, trips]);

	const bookedWithPoints = trips.filter((trip) => trip.bookingMethod === "points").length;
	const bookedWithCash = trips.filter((trip) => trip.bookingMethod === "cash").length;
	const ratedTrips = trips.filter((trip) => typeof trip.rating === "number");
	const averageRating = ratedTrips.length
		? ratedTrips.reduce((sum, trip) => sum + (trip.rating ?? 0), 0) / ratedTrips.length
		: 0;

	return (
		<div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8">
					<div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<button
								onClick={() => router.push("/home")}
								className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-cyan-300"
							>
								<ArrowLeft className="h-4 w-4" />
								Back to Home
							</button>

							<div className="flex items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 shadow-lg shadow-cyan-950/30">
									<Plane className="h-6 w-6 text-cyan-200" />
								</div>
								<div>
									<h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">
										My Trips
									</h1>
									<p className="mt-1 text-sm text-slate-300">
										Trips you marked as booked from your Zoe history.
									</p>
								</div>
							</div>
						</div>

						<button
							onClick={() => router.push("/search")}
							className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-600"
						>
							<Search className="h-4 w-4" />
							New Search
						</button>
					</div>

					<div className="mb-6 grid gap-3 sm:grid-cols-3">
						<div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/20 backdrop-blur">
							<p className="text-sm text-slate-400">Booked trips</p>
							<p className="mt-2 text-3xl font-bold text-white">{trips.length}</p>
						</div>

						<div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/20 backdrop-blur">
							<p className="text-sm text-slate-400">Points / cash</p>
							<p className="mt-2 text-3xl font-bold text-white">
								{bookedWithPoints} / {bookedWithCash}
							</p>
						</div>

						<div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/20 backdrop-blur">
							<p className="text-sm text-slate-400">Avg rating</p>
							<p className="mt-2 text-3xl font-bold text-white">
								{averageRating ? averageRating.toFixed(1) : "—"}
							</p>
						</div>
					</div>

					<div className="mb-5 rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-xl shadow-slate-950/20 backdrop-blur">
						<label htmlFor="trip-search" className="sr-only">
							Search booked trips
						</label>
						<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
							<Search className="h-4 w-4 text-slate-400" />
							<input
								id="trip-search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search route, cabin, verdict, booking method, or note..."
								className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
							/>
						</div>
					</div>

					{loadingTrips ? (
						<div className="rounded-3xl border border-white/10 bg-slate-950/70 p-10 text-center shadow-xl shadow-slate-950/20 backdrop-blur">
							<Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
							<p className="mt-4 text-sm text-slate-300">Loading your booked trips...</p>
						</div>
					) : loadError ? (
						<div className="rounded-3xl border border-rose-400/20 bg-rose-950/40 p-6 text-sm text-rose-100 shadow-xl shadow-slate-950/20 backdrop-blur">
							{loadError}
						</div>
					) : trips.length === 0 ? (
						<div className="rounded-3xl border border-white/10 bg-slate-950/70 p-10 text-center shadow-xl shadow-slate-950/20 backdrop-blur">
							<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10">
								<Plane className="h-7 w-7 text-cyan-200" />
							</div>
							<h2 className="mt-5 text-xl font-semibold text-white">No booked trips yet</h2>
							<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
								When you review a search in History and mark “Yes, I booked,” it will show up here automatically.
							</p>
							<button
								onClick={() => router.push("/history")}
								className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
							>
								Go to History
							</button>
						</div>
					) : filteredTrips.length === 0 ? (
						<div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-xl shadow-slate-950/20 backdrop-blur">
							<p className="text-sm text-slate-300">No booked trips match your search.</p>
						</div>
					) : (
						<div className="space-y-4">
							{filteredTrips.map((trip) => {
								const isPointsBooking = trip.bookingMethod === "points";
								const isCashBooking = trip.bookingMethod === "cash";

								return (
									<article
										key={trip.id}
										className="rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-xl shadow-slate-950/20 backdrop-blur transition hover:border-cyan-300/30"
									>
										<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
											<div className="flex items-start gap-4">
												<div
													className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
														isPointsBooking
															? "bg-emerald-400/10 text-emerald-300"
															: isCashBooking
																? "bg-amber-400/10 text-amber-300"
																: "bg-cyan-300/10 text-cyan-200"
													}`}
												>
													{isPointsBooking ? (
														<WalletCards className="h-6 w-6" />
													) : isCashBooking ? (
														<CreditCard className="h-6 w-6" />
													) : (
														<Plane className="h-6 w-6" />
													)}
												</div>

												<div>
													<div className="flex flex-wrap items-center gap-2">
														<h2 className="text-xl font-semibold text-white">
															{trip.origin} → {trip.destination}
														</h2>
														<span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-300">
															{cabinLabel(trip.cabin)}
														</span>
														<span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-300">
															{trip.passengers} passenger{trip.passengers === 1 ? "" : "s"}
														</span>
													</div>

													<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
														<span className="inline-flex items-center gap-2">
															<Calendar className="h-4 w-4 text-slate-500" />
															{formatDateNice(trip.departureDate)}
															{trip.returnDate ? ` – ${formatDateNice(trip.returnDate)}` : ""}
														</span>
														<span className="text-slate-500">•</span>
														<span>Marked booked {formatBookedDate(trip.bookedAt)}</span>
													</div>
												</div>
											</div>

											<div className="flex flex-wrap gap-2 lg:justify-end">
												<span
													className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
														isPointsBooking
															? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20"
															: isCashBooking
																? "bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20"
																: "bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20"
													}`}
												>
													{bookingMethodLabel(trip.bookingMethod)}
												</span>
												<span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
													Verdict: {verdictLabel(trip.recommendation)}
												</span>
											</div>
										</div>

										<div className="mt-5 grid gap-3 sm:grid-cols-3">
											<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
												<p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cash price</p>
												<p className="mt-2 text-lg font-semibold text-white">{formatMoney(trip.cashPriceUsed)}</p>
											</div>

											<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
												<p className="text-xs uppercase tracking-[0.2em] text-slate-500">Points cost</p>
												<p className="mt-2 text-lg font-semibold text-white">{formatPoints(trip.pointsCostUsed)}</p>
											</div>

											<div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
												<p className="text-xs uppercase tracking-[0.2em] text-slate-500">CPP</p>
												<p className="mt-2 text-lg font-semibold text-white">{formatCpp(trip.calculatedCpp)}</p>
											</div>
										</div>

										{trip.summary && (
											<p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
												{trip.summary}
											</p>
										)}

										<div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
											<div className="flex items-center gap-1">
												{[1, 2, 3, 4, 5].map((star) => (
													<Star
														key={star}
														className={`h-4 w-4 ${
															trip.rating && star <= trip.rating
																? "fill-amber-400 text-amber-400"
																: "text-slate-600"
														}`}
													/>
												))}
												{trip.comment && (
													<span className="ml-2 text-sm text-slate-400">“{trip.comment}”</span>
												)}
											</div>

											<button
												onClick={() => router.push("/history")}
												className="text-left text-sm font-medium text-cyan-300 transition hover:text-cyan-200 sm:text-right"
											>
												View in History
											</button>
										</div>
									</article>
								);
							})}
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
