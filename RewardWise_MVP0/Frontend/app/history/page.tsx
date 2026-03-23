/** @format */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";

import {
	Star,
	Heart,
	ArrowLeft,
	ChevronRight,
} from "lucide-react";

type Trip = {
	id: string;
	verdictId: string | null;
	recommendation: "use_points" | "pay_cash" | "wait" | null;
	origin: string;
	destination: string;
	date: string;
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

export default function HistoryPage() {
	const router = useRouter();
	const { user, loading: authLoading } = useAuth();
	const supabase = createClient();

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
				<main className="max-w-2xl mx-auto px-6 py-8">
					{/* HEADER */}
					<div className="flex items-center gap-3 mb-6">
						<div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
							<Star className="w-6 h-6 text-pink-400" />
						</div>

						<div>
							<h1 className="text-3xl font-bold text-white">Trip Feedback</h1>

							<p className="text-gray-200">
								Help us learn your preferences for better recommendations
							</p>
						</div>
					</div>

					{submitted ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl">
							<div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
								<Heart className="w-8 h-8 text-pink-400" />
							</div>

							<h2 className="text-2xl font-bold text-white mb-2">
								Preferences Updated!
							</h2>

							<p className="text-gray-400 mb-6">
								We've updated your profile based on this feedback.
							</p>

							<div className="flex gap-3 justify-center">
								<button
									onClick={() => router.push("/profile")}
									className="border border-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-800 text-sm"
								>
									View Preferences
								</button>

								<button
									onClick={() => router.push("/home")}
									className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-6 rounded-lg text-sm"
								>
									Dashboard
								</button>
							</div>
						</div>
					) : !selectedTrip ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<h2 className="text-lg font-semibold text-white mb-4">
								Select a trip to review
							</h2>

							{authLoading || loadingTrips ? (
								<p className="text-gray-400 text-sm">Loading your history...</p>
							) : !user ? (
								<div>
									<p className="text-gray-400 text-sm mb-3">
										Please log in to view your trip history.
									</p>
									<button
										onClick={() => router.push("/login")}
										className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg text-sm"
									>
										Go to Login
									</button>
								</div>
							) : loadError ? (
								<p className="text-red-400 text-sm">{loadError}</p>
							) : trips.filter((t) => !feedbackGiven.includes(t.id)).length === 0 ? (
								<p className="text-gray-400 text-sm">
									No search history found yet. Run a few searches from Home and
									they will appear here.
								</p>
							) : (
								<div className="space-y-3">
									{trips
										.filter((t) => !feedbackGiven.includes(t.id))
										.map((trip) => (
										<button
											key={trip.id}
											onClick={() => setSelectedTrip(trip)}
											className="w-full flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 rounded-lg p-4 text-left"
										>
											<div>
												<p className="text-white font-medium">
													{trip.origin} → {trip.destination}
												</p>

												<p className="text-gray-400 text-sm">
													{trip.date}
													{trip.tripType === "roundtrip" && trip.returnDate
														? ` (${formatDateNice(trip.returnDate)} return)`
														: ""}
													{" • "}
													{trip.cabin}
													{" • "}
													{trip.passengers} traveler
													{trip.passengers > 1 ? "s" : ""}
												</p>
											</div>

											<ChevronRight className="w-5 h-5 text-gray-400" />
										</button>
										))}
								</div>
							)}
						</div>
					) : (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<button
								onClick={() => setSelectedTrip(null)}
								className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm"
							>
								<ArrowLeft className="w-4 h-4" /> Back
							</button>

							<div className="space-y-6">
								{/* Rating */}
								<div>
									<p className="text-gray-300 text-sm mb-3">
										How was the overall experience?
									</p>

									<div className="flex gap-2">
										{[1, 2, 3, 4, 5].map((star) => (
											<button
												key={star}
												onClick={() => setRating(star)}
												className={`w-10 h-10 rounded-lg flex items-center justify-center ${
													rating >= star
														? "bg-amber-500/30 text-amber-400"
														: "bg-gray-800 text-gray-600"
												}`}
											>
												<Star
													className="w-5 h-5"
													fill={rating >= star ? "currentColor" : "none"}
												/>
											</button>
										))}
									</div>
								</div>

								<div>
									<p className="text-gray-300 text-sm mb-2">
										Did you book this recommendation?
									</p>
									<div className="flex gap-2">
										<button
											onClick={() => setDidBook(true)}
											className={`px-3 py-2 rounded-lg text-sm ${
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
											className={`px-3 py-2 rounded-lg text-sm ${
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
									<p className="text-gray-300 text-sm mb-2">
										Comment (optional)
									</p>
									<textarea
										value={comment}
										onChange={(e) => setComment(e.target.value)}
										placeholder="Tell us what worked or what could be better..."
										className="w-full min-h-24 bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
									/>
								</div>

								{submitError && (
									<p className="text-red-400 text-sm">{submitError}</p>
								)}

								{/* Submit */}
								<button
									onClick={handleSubmit}
									disabled={rating === 0 || submitting}
									className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white py-3 rounded-lg"
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
