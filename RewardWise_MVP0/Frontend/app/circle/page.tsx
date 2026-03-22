/** @format */

"use client";

import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";
import { useAlerts } from "@/context/AlertContext";

import { Bell, Plus, X, Plane } from "lucide-react";

function formatDateNice(date: string) {
	if (!date) return "";
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function timeAgo(iso: string) {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days === 1) return "1 day ago";
	if (days < 7) return `${days} days ago`;
	const weeks = Math.floor(days / 7);
	return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function cabinLabel(c: string) {
	return (
		({ economy: "Economy", premium: "Premium", business: "Business", first: "First" } as Record<string, string>)[c] ?? c
	);
}

export default function WatchlistPage() {
	const router = useRouter();
	const { watchlist, removeFromWatchlist, notifications } = useAlerts();

	// Find the most recent notification per watchlist item
	const latestNotifFor = (wId: string) =>
		notifications.find((n) => n.watchlistId === wId);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="max-w-3xl mx-auto px-6 py-8">
					{/* HEADER */}
					<div className="flex justify-between items-center mb-6">
						<div>
							<h1 className="text-3xl font-bold text-white drop-shadow-lg">
								Watchlist
							</h1>
							<p className="text-gray-200">
								Get notified when award availability opens
							</p>
						</div>

						<button
							onClick={() => router.push("/home")}
							className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg flex items-center gap-2"
						>
							<Plus className="w-4 h-4" /> Add Trip
						</button>
					</div>

					<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
						{watchlist.length === 0 ? (
							<div className="text-center py-8">
								<Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />

								<h2 className="text-lg font-semibold text-white mb-2">
									No trips being watched
								</h2>

								<p className="text-gray-400 mb-4">
									Search for a flight and tap "Set Alert" to start watching
								</p>

								<button
									onClick={() => router.push("/home")}
									className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg"
								>
									Search for Flights
								</button>
							</div>
						) : (
							<div className="space-y-3">
								{watchlist.map((item) => {
									const notif = latestNotifFor(item.id);
									return (
										<div
											key={item.id}
											className="bg-gray-800/50 rounded-lg p-4"
										>
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
														<Plane className="w-5 h-5 text-amber-400" />
													</div>

													<div>
														<p className="text-white font-medium">
															{item.origin} → {item.destination}
														</p>

														<p className="text-gray-400 text-sm">
															{formatDateNice(item.departDate)}
															{item.isRoundtrip && item.returnDate
																? ` – ${formatDateNice(item.returnDate)}`
																: ""}
															{" · "}
															{cabinLabel(item.cabin)}
															{" · "}
															{item.travelers} traveler{item.travelers > 1 ? "s" : ""}
															{" · Added "}
															{timeAgo(item.addedAt)}
														</p>
													</div>
												</div>

												<span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
													Watching
												</span>
											</div>

											<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
												{item.pointsRequired != null && (
													<div className="bg-gray-900/50 rounded p-2">
														<span className="text-gray-500">Points</span>
														<p className="text-white font-medium">
															{item.pointsRequired.toLocaleString()} pts
														</p>
													</div>
												)}

												{item.cashPrice != null && (
													<div className="bg-gray-900/50 rounded p-2">
														<span className="text-gray-500">Cash price</span>
														<p className="text-white font-medium">
															${item.cashPrice.toLocaleString()}
														</p>
													</div>
												)}

												<div className="bg-gray-900/50 rounded p-2">
													<span className="text-gray-500">Verdict</span>
													<p className={item.verdict === "points" ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
														{item.verdict === "points" ? "Use Points" : "Pay Cash"}
													</p>
												</div>

												<div className="bg-gray-900/50 rounded p-2">
													<span className="text-gray-500">Status</span>
													<p className="text-amber-400">Checking daily</p>
												</div>
											</div>

											<div className="flex gap-2">
												<button
													onClick={() => {
														router.push(`/home`);
													}}
													className="flex-1 border border-gray-600 text-white py-1.5 rounded text-xs hover:bg-gray-800"
												>
													Search Again
												</button>

												<button
													onClick={() => removeFromWatchlist(item.id)}
													className="px-3 border border-red-500/30 text-red-400 py-1.5 rounded text-xs hover:bg-red-500/10 flex items-center gap-1"
												>
													<X className="w-3 h-3" /> Remove
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
