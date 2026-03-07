/** @format */

"use client";

import { useRouter } from "next/navigation";
import TropicalBackground from "@/components/TropicalBackground";
import TopNav from "@/components/TopNav";

import { Plane, Calendar, Star, Search, ChevronRight } from "lucide-react";

export default function TripsPage() {
	const router = useRouter();
	const pastTrips = [
		{
			id: 1,
			origin: "SFO",
			destination: "Tokyo",
			airline: "ANA",
			flight: "NH105",
			cabin: "business",
			date: "Jan 12, 2026",
			returnDate: "Jan 19, 2026",
			verdict: "points",
			pointsUsed: 120000,
			cashEquivalent: 8400,
			saved: 6180,
			program: "Chase UR → Virgin Atlantic → ANA",
			rating: 5,
		},
		{
			id: 2,
			origin: "JFK",
			destination: "London",
			airline: "British Airways",
			flight: "BA178",
			cabin: "business",
			date: "Nov 20, 2025",
			returnDate: "Nov 27, 2025",
			verdict: "points",
			pointsUsed: 85000,
			cashEquivalent: 5200,
			saved: 3900,
			program: "Chase UR → British Airways",
			rating: 4,
		},
		{
			id: 3,
			origin: "SFO",
			destination: "Honolulu",
			airline: "United",
			flight: "UA1523",
			cabin: "economy",
			date: "Sep 5, 2025",
			returnDate: "Sep 12, 2025",
			verdict: "cash",
			cashPaid: 487,
			pointsWouldCost: 35000,
			rating: 4,
		},
		{
			id: 4,
			origin: "LAX",
			destination: "Paris",
			airline: "Air France",
			flight: "AF65",
			cabin: "business",
			date: "Jul 8, 2025",
			returnDate: "Jul 18, 2025",
			verdict: "points",
			pointsUsed: 110000,
			cashEquivalent: 6800,
			saved: 5100,
			program: "Amex MR → Air France KLM",
			rating: 5,
		},
		{
			id: 5,
			origin: "SFO",
			destination: "Singapore",
			airline: "Singapore Airlines",
			flight: "SQ31",
			cabin: "first",
			date: "Apr 15, 2025",
			returnDate: "Apr 25, 2025",
			verdict: "points",
			pointsUsed: 185000,
			cashEquivalent: 14200,
			saved: 11800,
			program: "Chase UR → Singapore KrisFlyer",
			rating: 5,
		},
	];
	const totalSaved = pastTrips.reduce((sum, t) => sum + (t.saved || 0), 0);
	const totalTrips = pastTrips.length;
	const optimizedTrips = pastTrips.filter((t) => t.verdict === "points").length;

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="max-w-3xl mx-auto px-6 py-8">
					{/* HEADER */}
					<div className="flex justify-between items-center mb-6">
						<div>
							<h1 className="text-3xl font-bold text-white drop-shadow-lg">
								My Trips
							</h1>
							<p className="text-gray-200">Your travel history & savings</p>
						</div>

						<button
							onClick={() => router.push("/search")}
							className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg flex items-center gap-2"
						>
							<Search className="w-4 h-4" />
							New Search
						</button>
					</div>

					{/* SUMMARY */}
					<div className="grid grid-cols-3 gap-3 mb-6">
						<div className="bg-gray-900/80 backdrop-blur rounded-xl p-4 text-center border border-gray-700/50">
							<p className="text-3xl font-bold text-emerald-400">
								${totalSaved.toLocaleString()}
							</p>
							<p className="text-gray-400 text-sm">Total saved</p>
						</div>

						<div className="bg-gray-900/80 backdrop-blur rounded-xl p-4 text-center border border-gray-700/50">
							<p className="text-3xl font-bold text-white">{totalTrips}</p>
							<p className="text-gray-400 text-sm">Trips optimized</p>
						</div>

						<div className="bg-gray-900/80 backdrop-blur rounded-xl p-4 text-center border border-gray-700/50">
							<p className="text-3xl font-bold text-white">
								${Math.round(totalSaved / totalTrips).toLocaleString()}
							</p>
							<p className="text-gray-400 text-sm">Avg per trip</p>
						</div>
					</div>
					{/* Trip list */}
					<div className="space-y-4">
						{pastTrips.map((trip) => (
							<div
								key={trip.id}
								className="bg-gray-900/80 backdrop-blur rounded-xl p-5 border border-gray-700/50 hover:border-gray-600 transition-colors"
							>
								<div className="flex justify-between items-start mb-3">
									<div className="flex items-center gap-3">
										<div
											className={`w-10 h-10 rounded-lg flex items-center justify-center ${
												trip.verdict === "points"
													? "bg-emerald-500/20"
													: "bg-amber-500/20"
											}`}
										>
											<Plane
												className={`w-5 h-5 ${
													trip.verdict === "points"
														? "text-emerald-400"
														: "text-amber-400"
												}`}
											/>
										</div>

										<div>
											<p className="text-white font-semibold">
												{trip.origin} ↔ {trip.destination}
											</p>

											<p className="text-gray-400 text-sm">
												{trip.airline} {trip.flight} · {trip.cabin}
											</p>
										</div>
									</div>

									<div className="text-right">
										<span
											className={`px-2 py-1 rounded text-xs font-medium ${
												trip.verdict === "points"
													? "bg-emerald-500/20 text-emerald-400"
													: "bg-amber-500/20 text-amber-400"
											}`}
										>
											{trip.verdict === "points" ? "Used Points" : "Paid Cash"}
										</span>
									</div>
								</div>

								{/* Dates */}
								<div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
									<Calendar className="w-3.5 h-3.5" />
									<span>
										{trip.date} – {trip.returnDate}
									</span>
								</div>

								{/* POINTS TRIP */}
								{trip.verdict === "points" ? (
									<div className="grid grid-cols-3 gap-3 bg-gray-800/50 rounded-lg p-3">
										<div>
											<p className="text-gray-400 text-xs">Points used</p>
											<p className="text-white font-medium text-sm">
												{/* {trip.pointsUsed.toLocaleString()} */}
											</p>
										</div>

										<div>
											<p className="text-gray-400 text-xs">Cash equivalent</p>
											<p className="text-white font-medium text-sm">
												{/* ${trip.cashEquivalent.toLocaleString()} */}
											</p>
										</div>

										<div>
											<p className="text-gray-400 text-xs">You saved</p>
											<p className="text-emerald-400 font-bold text-sm">
												{/* ${trip.saved.toLocaleString()} */}
											</p>
										</div>
									</div>
								) : (
									/* CASH TRIP */
									<div className="grid grid-cols-3 gap-3 bg-gray-800/50 rounded-lg p-3">
										<div>
											<p className="text-gray-400 text-xs">Cash paid</p>
											<p className="text-white font-medium text-sm">
												{/* ${trip.cashPaid} */}
											</p>
										</div>

										<div>
											<p className="text-gray-400 text-xs">Points would cost</p>
											<p className="text-white font-medium text-sm">
												{/* {trip.pointsWouldCost.toLocaleString()} */}
											</p>
										</div>

										<div>
											<p className="text-gray-400 text-xs">Verdict</p>
											<p className="text-amber-400 font-medium text-sm">
												Cash was better
											</p>
										</div>
									</div>
								)}

								{/* Transfer Path */}
								{trip.program && (
									<p className="text-gray-500 text-xs mt-2">
										Transfer path: {trip.program}
									</p>
								)}

								{/* Rating + Action */}
								<div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50">
									<div className="flex items-center gap-1">
										{[1, 2, 3, 4, 5].map((s) => (
											<Star
												key={s}
												className={`w-3.5 h-3.5 ${
													s <= trip.rating
														? "text-amber-400 fill-amber-400"
														: "text-gray-600"
												}`}
											/>
										))}
									</div>

									<button
										onClick={() => router.push("/history")}
										className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1"
									>
										Rate this trip
										<ChevronRight className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						))}
					</div>
				</main>
			</div>
		</div>
	);
}
