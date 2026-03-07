/** @format */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import TropicalBackground from "@/components/TropicalBackground";
import TopNav from "@/components/TopNav";

import { Bell, Plus, X } from "lucide-react";

function formatDateNice(date: string) {
	if (!date) return "";
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default function WatchlistPage() {
	const router = useRouter();

	const [watchlist, setWatchlist] = useState([
		{
			id: 1,
			origin: "SFO",
			destination: "Tokyo",
			departDate: "2026-04-10",
			cabin: "business",
			addedAt: "2 days ago",
			currentPrice: 120000,
			priceChange: -12,
		},
		{
			id: 2,
			origin: "LAX",
			destination: "London",
			departDate: "2026-06-15",
			cabin: "first",
			addedAt: "5 days ago",
			currentPrice: 180000,
			priceChange: 8,
		},
		{
			id: 3,
			origin: "JFK",
			destination: "Paris",
			departDate: "2026-05-20",
			cabin: "business",
			addedAt: "1 week ago",
			currentPrice: 110000,
			priceChange: -5,
		},
	]);

	const removeItem = (id: number) =>
		setWatchlist(watchlist.filter((item) => item.id !== id));

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
							onClick={() => router.push("/search")}
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
									Add trips to get notified when award space opens
								</p>

								<button
									onClick={() => router.push("/search")}
									className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-4 rounded-lg"
								>
									Search for Flights
								</button>
							</div>
						) : (
							<>
								<div className="space-y-3">
									{watchlist.map((item) => (
										<div
											key={item.id}
											className="bg-gray-800/50 rounded-lg p-4"
										>
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
														<Bell className="w-5 h-5 text-amber-400" />
													</div>

													<div>
														<p className="text-white font-medium">
															{item.origin} → {item.destination}
														</p>

														<p className="text-gray-400 text-sm">
															{formatDateNice(item.departDate)} • {item.cabin} •
															Added {item.addedAt}
														</p>
													</div>
												</div>

												<span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
													Watching
												</span>
											</div>

											<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
												<div className="bg-gray-900/50 rounded p-2">
													<span className="text-gray-500">Current</span>
													<p className="text-white font-medium">
														{item.currentPrice.toLocaleString()} pts
													</p>
												</div>

												<div className="bg-gray-900/50 rounded p-2">
													<span className="text-gray-500">Trend</span>

													<p
														className={
															item.priceChange < 0
																? "text-emerald-400 font-medium"
																: "text-red-400 font-medium"
														}
													>
														{item.priceChange < 0
															? `↓ ${Math.abs(item.priceChange)}% cheaper`
															: `↑ ${item.priceChange}% higher`}
													</p>
												</div>

												<div className="bg-gray-900/50 rounded p-2">
													<span className="text-gray-500">Status</span>
													<p className="text-amber-400">Checking daily</p>
												</div>

												<div className="bg-gray-900/50 rounded p-2">
													<span className="text-gray-500">Best window</span>
													<p className="text-white">60-90 days out</p>
												</div>
											</div>

											<div className="flex gap-2">
												<button className="flex-1 border border-gray-600 text-white py-1.5 rounded text-xs hover:bg-gray-800">
													Edit Watch
												</button>

												<button className="flex-1 border border-gray-600 text-gray-400 py-1.5 rounded text-xs hover:bg-gray-800">
													Pause Alerts
												</button>

												<button
													onClick={() => removeItem(item.id)}
													className="px-3 border border-red-500/30 text-red-400 py-1.5 rounded text-xs hover:bg-red-500/10"
												>
													<X className="w-3 h-3" />
												</button>
											</div>
										</div>
									))}
								</div>

								{/* ALERT */}
								<div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
									<div className="flex items-center gap-2 mb-2">
										<Bell className="w-4 h-4 text-emerald-400" />

										<span className="text-emerald-400 text-sm font-semibold">
											🔔 Award Alert!
										</span>
									</div>

									<p className="text-white text-sm mb-1">
										SFO → Tokyo — 2 business class seats just opened!
									</p>

									<p className="text-gray-400 text-xs mb-3">
										ANA NH105 • 85,000 pts/person • These seats typically
										disappear in 24-48 hrs
									</p>

									<div className="flex gap-2">
										<button className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg font-medium">
											Book Now
										</button>

										<button className="border border-gray-600 text-white text-xs py-2 px-3 rounded-lg">
											Snooze 24hr
										</button>

										<button className="text-gray-500 text-xs py-2 px-3">
											Dismiss
										</button>
									</div>
								</div>
							</>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
