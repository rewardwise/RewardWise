/** @format */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TopNav from "@/components/TopNav";
import TropicalBackground from "@/components/TropicalBackground";

import {
	Star,
	Heart,
	ArrowLeft,
	CheckCircle,
	ChevronRight,
	ChevronUp,
	ChevronDown,
	ThumbsUp,
	ThumbsDown,
	Info,
} from "lucide-react";
type Trip = {
	id: number;
	origin: string;
	destination: string;
	date: string;
	airline: string;
	cabin: string;
	pointsUsed: number;
	program: string;
};
export default function HistoryPage() {
	const router = useRouter();

	const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
	const [feedbackGiven, setFeedbackGiven] = useState<number[]>([]);
	const [rating, setRating] = useState(0);
	const [verdictAccuracy, setVerdictAccuracy] = useState(null);
	const [comment, setComment] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const [priorities, setPriorities] = useState([
		"Price/value",
		"Direct flights",
		"Airline quality",
		"Schedule/timing",
		"Lounge access",
	]);

	const origOrder = [
		"Price/value",
		"Direct flights",
		"Airline quality",
		"Schedule/timing",
		"Lounge access",
	];

	const trips = [
		{
			id: 1,
			origin: "SFO",
			destination: "Tokyo",
			date: "Feb 2026",
			airline: "ANA",
			cabin: "Business",
			pointsUsed: 85000,
			program: "Virgin Atlantic",
		},
		{
			id: 2,
			origin: "JFK",
			destination: "London",
			date: "Jan 2026",
			airline: "British Airways",
			cabin: "Economy",
			pointsUsed: 30000,
			program: "Chase UR",
		},
	];

	const movePriority = (idx: number, dir: number) => {
		const next = idx + dir;
		if (next < 0 || next >= priorities.length) return;

		const arr = [...priorities];
		[arr[idx], arr[next]] = [arr[next], arr[idx]];
		setPriorities(arr);
	};

	const handleSubmit = () => {
		if (!selectedTrip) return;

		setFeedbackGiven((prev) => [...prev, selectedTrip.id]);
		setSubmitted(true);
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
													{trip.date} • {trip.airline} {trip.cabin} •{" "}
													{trip.pointsUsed.toLocaleString()} pts
												</p>
											</div>

											<ChevronRight className="w-5 h-5 text-gray-400" />
										</button>
									))}
							</div>
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

								{/* Submit */}
								<button
									onClick={handleSubmit}
									disabled={rating === 0}
									className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white py-3 rounded-lg"
								>
									Submit Feedback
								</button>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
