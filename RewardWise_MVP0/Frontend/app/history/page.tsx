/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";

import {
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	Heart,
	Search,
	Star,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

type Trip = {
	id: string;
	verdictId: string | null;
	recommendation: "use_points" | "pay_cash" | "wait" | null;
	origin: string;
	destination: string;
	date: string;
	departureDate: string;
	returnDate?: string | null;
	tripType: "roundtrip" | "oneway";
	cabin: string;
	passengers: number;
	createdAt: string;
};

type SearchRow = {
	id: string;
	origin: string;
	destination: string;
	departure_date: string;
	return_date: string | null;
	passengers: number;
	cabin: string | null;
	trip_type: "roundtrip" | "oneway";
	created_at: string;
	verdicts?:
		| { id: string; recommendation: "use_points" | "pay_cash" | "wait" }[]
		| { id: string; recommendation: "use_points" | "pay_cash" | "wait" }
		| null;
};

function formatMonthYear(dateStr: string) {
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});
}

function formatDateNice(dateStr?: string | null) {
	if (!dateStr) return "";
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

function verdictLabel(recommendation: Trip["recommendation"]) {
	const labels: Record<NonNullable<Trip["recommendation"]>, string> = {
		use_points: "Use Points",
		pay_cash: "Pay Cash",
		wait: "Wait",
	};
	return recommendation ? labels[recommendation] : "No verdict";
}

function verdictClasses(recommendation: Trip["recommendation"]) {
	if (recommendation === "use_points") {
		return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
	}
	if (recommendation === "pay_cash") {
		return "border-sky-400/30 bg-sky-400/10 text-sky-300";
	}
	if (recommendation === "wait") {
		return "border-amber-400/30 bg-amber-400/10 text-amber-300";
	}
	return "border-gray-500/30 bg-gray-500/10 text-gray-300";
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
	const pages = new Set<number>([1, totalPages, currentPage]);

	if (currentPage > 1) pages.add(currentPage - 1);
	if (currentPage < totalPages) pages.add(currentPage + 1);

	return Array.from(pages)
		.filter((page) => page >= 1 && page <= totalPages)
		.sort((a, b) => a - b);
}

export default function HistoryPage() {
	const router = useRouter();
	const { user, loading: authLoading } = useAuth();
	const supabase = useMemo(() => createClient(), []);

	const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
	const [feedbackGiven, setFeedbackGiven] = useState<string[]>([]);
	const [rating, setRating] = useState(0);
	const [comment, setComment] = useState("");
	const [didBook, setDidBook] = useState<boolean | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [trips, setTrips] = useState<Trip[]>([]);
	const [loadingTrips, setLoadingTrips] = useState(true);
	const [loadError, setLoadError] = useState("");
	const [submitError, setSubmitError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);

	useEffect(() => {
		const loadTrips = async () => {
			if (authLoading) return;
			if (!user) {
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			setLoadingTrips(true);
			setLoadError("");

			const { data, error } = await supabase
				.from("searches")
				.select(
					"id, origin, destination, departure_date, return_date, passengers, cabin, trip_type, created_at, verdicts(id,recommendation)",
				)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				setLoadError(error.message || "Failed to load trip history.");
				setTrips([]);
				setLoadingTrips(false);
				return;
			}

			const mapped: Trip[] =
				(data as SearchRow[] | null)?.map((row) => ({
					id: row.id,
					verdictId: Array.isArray(row.verdicts)
						? (row.verdicts[0]?.id ?? null)
						: (row.verdicts?.id ?? null),
					recommendation: Array.isArray(row.verdicts)
						? (row.verdicts[0]?.recommendation ?? null)
						: (row.verdicts?.recommendation ?? null),
					origin: row.origin,
					destination: row.destination,
					date: formatMonthYear(row.departure_date),
					departureDate: row.departure_date,
					returnDate: row.return_date,
					tripType: row.trip_type === "oneway" ? "oneway" : "roundtrip",
					cabin: cabinLabel(row.cabin),
					passengers: row.passengers,
					createdAt: row.created_at,
				})) ?? [];

			setTrips(mapped);
			setLoadingTrips(false);
		};

		void loadTrips();
	}, [authLoading, user, supabase]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, feedbackGiven.length]);

	const availableTrips = useMemo(
		() => trips.filter((trip) => !feedbackGiven.includes(trip.id)),
		[feedbackGiven, trips],
	);

	const filteredTrips = useMemo(() => {
		const query = searchTerm.trim().toLowerCase();
		if (!query) return availableTrips;

		return availableTrips.filter((trip) => {
			const searchableText = [
				trip.origin,
				trip.destination,
				`${trip.origin} ${trip.destination}`,
				`${trip.origin}-${trip.destination}`,
				`${trip.origin}→${trip.destination}`,
				trip.cabin,
				trip.tripType,
				verdictLabel(trip.recommendation),
				formatDateNice(trip.departureDate),
				formatDateNice(trip.returnDate),
				formatDateNice(trip.createdAt),
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			return searchableText.includes(query);
		});
	}, [availableTrips, searchTerm]);

	const totalPages = Math.max(1, Math.ceil(filteredTrips.length / ITEMS_PER_PAGE));
	const safeCurrentPage = Math.min(currentPage, totalPages);
	const pageStart = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
	const visibleTrips = filteredTrips.slice(pageStart, pageStart + ITEMS_PER_PAGE);
	const pageNumbers = getVisiblePageNumbers(safeCurrentPage, totalPages);

	const resetFeedbackForm = () => {
		setRating(0);
		setComment("");
		setDidBook(null);
		setSubmitError("");
	};

	const handleSelectTrip = (trip: Trip) => {
		resetFeedbackForm();
		setSelectedTrip(trip);
	};

	const handleSubmit = async () => {
		if (!selectedTrip || !user) return;
		if (!selectedTrip.verdictId) {
			setSubmitError("Could not find verdict for this search. Please run the search again.");
			return;
		}
		if (rating === 0) return;

		setSubmitting(true);
		setSubmitError("");
		const derivedBookingMethod: "cash" | "points" | null =
			selectedTrip.recommendation === "pay_cash"
				? "cash"
				: selectedTrip.recommendation === "use_points"
					? "points"
					: null;
		const payload = {
			verdict_id: selectedTrip.verdictId,
			user_id: user.id,
			rating,
			comment: comment.trim() ? comment.trim() : null,
			did_book: didBook,
			booking_method: didBook ? derivedBookingMethod : null,
		};

		const { error } = await supabase.from("feedback").insert(payload);
		if (error) {
			setSubmitError(error.message || "Failed to save feedback.");
			setSubmitting(false);
			return;
		}

		setFeedbackGiven((prev) => [...prev, selectedTrip.id]);
		setSubmitted(true);
		setSubmitting(false);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
					{/* HEADER */}
					<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/20">
								<Star className="h-6 w-6 text-pink-400" />
							</div>

							<div>
								<h1 className="text-3xl font-bold text-white">Trip Feedback</h1>
								<p className="text-sm text-gray-200 sm:text-base">
									Review your recent searches and help Zoe improve future verdicts.
								</p>
							</div>
						</div>

						<button
							onClick={() => router.push("/home")}
							className="w-fit rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10 hover:text-white"
						>
							Back to Home
						</button>
					</div>

					{submitted ? (
						<div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-gray-900/90 p-8 text-center shadow-2xl backdrop-blur">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
								<Heart className="h-8 w-8 text-pink-400" />
							</div>

							<h2 className="mb-2 text-2xl font-bold text-white">
								Preferences Updated!
							</h2>

							<p className="mb-6 text-gray-400">
								We&apos;ve updated your profile based on this feedback.
							</p>

							<div className="flex justify-center gap-3">
								<button
									onClick={() => router.push("/profile")}
									className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-800"
								>
									View Preferences
								</button>

								<button
									onClick={() => {
										setSubmitted(false);
										setSelectedTrip(null);
										resetFeedbackForm();
									}}
									className="rounded-lg bg-emerald-500 px-6 py-2 text-sm text-white hover:bg-emerald-600"
								>
									Review Another
								</button>
							</div>
						</div>
					) : !selectedTrip ? (
						<div className="rounded-2xl border border-white/10 bg-gray-900/90 shadow-2xl backdrop-blur">
							<div className="border-b border-white/10 p-5 sm:p-6">
								<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<h2 className="text-lg font-semibold text-white">
											Select a search to review
										</h2>
										<p className="mt-1 text-sm text-gray-400">
											Total Searches: {availableTrips.length}
										</p>
									</div>

									<div className="relative w-full lg:max-w-sm">
										<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
										<input
											value={searchTerm}
											onChange={(event) => setSearchTerm(event.target.value)}
											placeholder="Search route, cabin, verdict..."
											className="w-full rounded-xl border border-white/10 bg-gray-950/70 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
										/>
									</div>
								</div>
							</div>

							{authLoading || loadingTrips ? (
								<div className="p-6 text-sm text-gray-400">Loading your history...</div>
							) : !user ? (
								<div className="p-6">
									<p className="mb-3 text-sm text-gray-400">
										You need an active team session to view your trip history.
									</p>
									<button
										onClick={() => router.push("/")}
										className="rounded-lg bg-emerald-500 px-4 py-2 text-sm text-white hover:bg-emerald-600"
									>
										Back to Home
									</button>
								</div>
							) : loadError ? (
								<div className="p-6 text-sm text-red-400">{loadError}</div>
							) : availableTrips.length === 0 ? (
								<div className="p-6 text-sm text-gray-400">
									No search history found yet. Run a few searches from Home and they will appear here.
								</div>
							) : filteredTrips.length === 0 ? (
								<div className="p-6 text-sm text-gray-400">
									No searches matched “{searchTerm}”. Try a route code, destination, cabin, or verdict.
								</div>
							) : (
								<>
									{/* DESKTOP TABLE */}
									<div className="hidden overflow-x-auto md:block">
										<table className="w-full text-left text-sm">
											<thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-gray-500">
												<tr>
													<th className="px-6 py-4 font-medium">Route</th>
													<th className="px-4 py-4 font-medium">Dates</th>
													<th className="px-4 py-4 font-medium">Details</th>
													<th className="px-4 py-4 font-medium">Verdict</th>
													<th className="px-6 py-4 text-right font-medium">Action</th>
												</tr>
											</thead>

											<tbody className="divide-y divide-white/10">
												{visibleTrips.map((trip) => (
													<tr key={trip.id} className="hover:bg-white/[0.03]">
														<td className="px-6 py-4">
															<p className="font-semibold text-white">
																{trip.origin} → {trip.destination}
															</p>
															<p className="mt-1 text-xs text-gray-500">
																Searched {formatDateNice(trip.createdAt)}
															</p>
														</td>

														<td className="px-4 py-4 text-gray-300">
															<p>{formatDateNice(trip.departureDate)}</p>
															{trip.tripType === "roundtrip" && trip.returnDate ? (
																<p className="text-xs text-gray-500">
																	Return {formatDateNice(trip.returnDate)}
																</p>
															) : (
																<p className="text-xs text-gray-500">One way</p>
															)}
														</td>

														<td className="px-4 py-4 text-gray-300">
															<p>{trip.cabin}</p>
															<p className="text-xs text-gray-500">
																{trip.passengers} traveler{trip.passengers > 1 ? "s" : ""}
															</p>
														</td>

														<td className="px-4 py-4">
															<span
																className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(
																	trip.recommendation,
																)}`}
															>
																{verdictLabel(trip.recommendation)}
															</span>
														</td>

														<td className="px-6 py-4 text-right">
															<button
																onClick={() => handleSelectTrip(trip)}
																className="rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
															>
																Review
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									{/* MOBILE CARDS */}
									<div className="divide-y divide-white/10 md:hidden">
										{visibleTrips.map((trip) => (
											<button
												key={trip.id}
												onClick={() => handleSelectTrip(trip)}
												className="w-full p-4 text-left hover:bg-white/[0.03]"
											>
												<div className="flex items-start justify-between gap-3">
													<div>
														<p className="font-semibold text-white">
															{trip.origin} → {trip.destination}
														</p>
														<p className="mt-1 text-sm text-gray-400">
															{formatDateNice(trip.departureDate)}
															{trip.tripType === "roundtrip" && trip.returnDate
																? ` • Return ${formatDateNice(trip.returnDate)}`
																: " • One way"}
														</p>
														<p className="mt-1 text-xs text-gray-500">
															{trip.cabin} • {trip.passengers} traveler{trip.passengers > 1 ? "s" : ""}
														</p>
													</div>

													<ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-500" />
												</div>

												<span
													className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(
														trip.recommendation,
													)}`}
												>
													{verdictLabel(trip.recommendation)}
												</span>
											</button>
										))}
									</div>

									<div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
										<p className="text-sm text-gray-500">
											Showing {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, filteredTrips.length)} of {filteredTrips.length}
										</p>

										<div className="flex items-center gap-2">
											<button
												onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
												disabled={safeCurrentPage === 1}
												className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
												aria-label="Previous page"
											>
												<ChevronLeft className="h-4 w-4" />
											</button>

											{pageNumbers.map((page, index) => {
												const previousPage = pageNumbers[index - 1];
												const showGap = previousPage && page - previousPage > 1;

												return (
													<div key={page} className="flex items-center gap-2">
														{showGap ? <span className="text-gray-600">...</span> : null}
														<button
															onClick={() => setCurrentPage(page)}
															className={`h-9 min-w-9 rounded-lg px-3 text-sm ${
																safeCurrentPage === page
																	? "bg-emerald-500 text-white"
																	: "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
															}`}
														>
															{page}
														</button>
													</div>
												);
											})}

											<button
												onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
												disabled={safeCurrentPage === totalPages}
												className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
												aria-label="Next page"
											>
												<ChevronRight className="h-4 w-4" />
											</button>
										</div>
									</div>
								</>
							)}
						</div>
					) : (
						<div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl backdrop-blur">
							<button
								onClick={() => setSelectedTrip(null)}
								className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
							>
								<ArrowLeft className="h-4 w-4" /> Back to History
							</button>

							<div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<p className="text-lg font-semibold text-white">
											{selectedTrip.origin} → {selectedTrip.destination}
										</p>
										<p className="mt-1 text-sm text-gray-400">
											{formatDateNice(selectedTrip.departureDate)}
											{selectedTrip.tripType === "roundtrip" && selectedTrip.returnDate
												? ` • Return ${formatDateNice(selectedTrip.returnDate)}`
												: " • One way"}
										</p>
									</div>

									<span
										className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(
											selectedTrip.recommendation,
										)}`}
									>
										{verdictLabel(selectedTrip.recommendation)}
									</span>
								</div>
							</div>

							<div className="space-y-6">
								{/* Rating */}
								<div>
									<p className="mb-3 text-sm text-gray-300">
										How was the overall experience?
									</p>

									<div className="flex gap-2">
										{[1, 2, 3, 4, 5].map((star) => (
											<button
												key={star}
												onClick={() => setRating(star)}
												className={`flex h-10 w-10 items-center justify-center rounded-lg ${
													rating >= star
														? "bg-amber-500/30 text-amber-400"
														: "bg-gray-800 text-gray-600"
												}`}
											>
												<Star
													className="h-5 w-5"
													fill={rating >= star ? "currentColor" : "none"}
												/>
											</button>
										))}
									</div>
								</div>

								<div>
									<p className="mb-2 text-sm text-gray-300">
										Did you book this recommendation?
									</p>
									<div className="flex gap-2">
										<button
											onClick={() => setDidBook(true)}
											className={`rounded-lg px-3 py-2 text-sm ${
												didBook === true
													? "bg-emerald-500/30 text-emerald-300"
													: "bg-gray-800 text-gray-300"
											}`}
										>
											Yes
										</button>
										<button
											onClick={() => {
												setDidBook(false);
											}}
											className={`rounded-lg px-3 py-2 text-sm ${
												didBook === false
													? "bg-emerald-500/30 text-emerald-300"
													: "bg-gray-800 text-gray-300"
											}`}
										>
											No
										</button>
									</div>
								</div>

								<div>
									<p className="mb-2 text-sm text-gray-300">Comment (optional)</p>
									<textarea
										value={comment}
										onChange={(e) => setComment(e.target.value)}
										placeholder="Tell us what worked or what could be better..."
										className="min-h-24 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
									/>
								</div>

								{submitError && <p className="text-sm text-red-400">{submitError}</p>}

								{/* Submit */}
								<button
									onClick={handleSubmit}
									disabled={rating === 0 || submitting}
									className="w-full rounded-lg bg-emerald-500 py-3 text-white hover:bg-emerald-600 disabled:bg-gray-700"
								>
									{submitting ? "Saving..." : "Submit Feedback"}
								</button>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
