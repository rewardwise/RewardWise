/** @format */
"use client";
import TopNav from "@/components/TopNav";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { Crown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function ConciergePremiumPage() {
	const router = useRouter();
	const { subscription } = useAuth();
	const [form, setForm] = useState({
		destination: "",
		dates: "",
		travelers: "2",
		cabin: "business",
		hotel: "",
		specialRequests: "",
		loungeAccess: true,
		transfers: true,
		dining: false,
	});
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	const handleSubmit = () => {
		setLoading(true);
		setTimeout(() => {
			console.log("Premium request:", form);
			setSubmitted(true);
			setLoading(false);
		}, 1500);
	};
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />
			<div className="relative z-10">
				<main id="main-content" className="max-w-2xl mx-auto px-6 py-8">
					<div className="flex items-center gap-3 mb-6">
						<div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
							<Crown className="w-6 h-6 text-purple-400" />
						</div>
						<div>
							<h1 className="text-3xl font-bold text-white drop-shadow-lg">
								Premium Concierge
							</h1>
							<p className="text-gray-200">
								White-glove booking for international & premium travel
							</p>
						</div>
					</div>
					{subscription === "free" && (
						<div className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
							<Crown className="w-5 h-5 text-purple-400 flex-shrink-0" />
							<div>
								<p className="text-white text-sm font-medium">
									Premium feature
								</p>
								<p className="text-gray-300 text-xs">
									Upgrade to Pro or Premium to use.{" "}
									<button
										onClick={() => router.push("/subscription")}
										className="text-purple-400 hover:text-purple-300 underline"
									>
										View plans
									</button>
								</p>
							</div>
						</div>
					)}
					{submitted ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl">
							<div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
								<Crown className="w-8 h-8 text-purple-400" />
							</div>
							<h2 className="text-2xl font-bold text-white mb-2">
								Premium Request Submitted!
							</h2>
							<p className="text-gray-400 mb-2">
								A dedicated travel specialist is on it.
							</p>
							<div className="bg-gray-800/50 rounded-lg p-4 mb-4 text-left space-y-2">
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Order #</span>
									<span className="text-white text-sm font-mono">
										RW-2026-{String(Date.now()).slice(-5)}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Tier</span>
									<span className="text-purple-400 text-sm">
										Premium / Complex
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Price</span>
									<span className="text-purple-400 text-sm font-medium">
										$199
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Turnaround</span>
									<span className="text-white text-sm">
										10 hours (expedited)
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Status</span>
									<span className="text-purple-400 text-sm">
										🔬 Deep analysis in progress...
									</span>
								</div>
							</div>
							<p className="text-gray-500 text-sm mb-4">
								Full itinerary with flights, hotels, lounges, and transfers
								within 10 hours.
							</p>
							<div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
								<div className="flex items-center gap-2 mb-3">
									<Crown className="w-4 h-4 text-purple-400" />
									<span className="text-purple-400 text-sm font-medium">
										Premium includes
									</span>
								</div>
								<div className="space-y-2 text-gray-300 text-sm">
									<p>→ Dedicated specialist assigned to your trip</p>
									<p>→ Cross-program transfer optimization</p>
									<p>→ Hotel + lounge + transfer coordination</p>
									<p>→ Up to 3 revision rounds</p>
								</div>
							</div>
							<button
								onClick={() => router.push("/home")}
								className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-8 rounded-lg w-full mb-2"
							>
								View Status
							</button>
							<div className="flex gap-2">
								<button className="flex-1 border border-gray-600 text-white py-2 rounded-lg text-sm hover:bg-gray-800">
									Add Notes
								</button>
								<button className="flex-1 border border-red-500/30 text-red-400 py-2 rounded-lg text-sm hover:bg-red-500/10">
									Cancel Request
								</button>
							</div>
						</div>
					) : (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-3">
									<div className="col-span-2">
										<label className="block text-gray-400 text-sm mb-1">
											Destination *
										</label>
										<input
											value={form.destination}
											onChange={(e) =>
												setForm({ ...form, destination: e.target.value })
											}
											placeholder="e.g., Tokyo, Maldives, Paris"
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-gray-400 text-sm mb-1">
											Travel Dates
										</label>
										<input
											value={form.dates}
											onChange={(e) =>
												setForm({ ...form, dates: e.target.value })
											}
											placeholder="e.g., April 5-15"
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
									<div>
										<label className="block text-gray-400 text-sm mb-1">
											Travelers
										</label>
										<select
											value={form.travelers}
											onChange={(e) =>
												setForm({ ...form, travelers: e.target.value })
											}
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
										>
											{[1, 2, 3, 4, 5, 6].map((n) => (
												<option key={n} value={n}>
													{n}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="block text-gray-400 text-sm mb-1">
											Cabin
										</label>
										<select
											value={form.cabin}
											onChange={(e) =>
												setForm({ ...form, cabin: e.target.value })
											}
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
										>
											<option value="business">Business</option>
											<option value="first">First</option>
										</select>
									</div>
									<div>
										<label className="block text-gray-400 text-sm mb-1">
											Hotel Preference
										</label>
										<input
											value={form.hotel}
											onChange={(e) =>
												setForm({ ...form, hotel: e.target.value })
											}
											placeholder="e.g., Hyatt, Marriott, any 5-star"
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
								</div>
								<div>
									<label className="block text-gray-400 text-sm mb-2">
										Add-ons
									</label>
									<div className="space-y-2">
										{[
											{
												key: "loungeAccess",
												label: "Airport lounge access",
												icon: "🛋️",
											},
											{
												key: "transfers",
												label: "Airport transfers",
												icon: "🚗",
											},
											{
												key: "dining",
												label: "Restaurant reservations",
												icon: "🍽️",
											},
										].map((addon) => (
											<label
												key={addon.key}
												className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-800"
											>
												<input
													type="checkbox"
													checked={
														form[addon.key as keyof typeof form] as boolean
													}
													onChange={(e) =>
														setForm({ ...form, [addon.key]: e.target.checked })
													}
													className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-emerald-500"
												/>
												<span className="text-lg">{addon.icon}</span>
												<span className="text-gray-300 text-sm">
													{addon.label}
												</span>
											</label>
										))}
									</div>
								</div>
								<div>
									<label className="block text-gray-400 text-sm mb-1">
										Special Requests
									</label>
									<textarea
										value={form.specialRequests}
										onChange={(e) =>
											setForm({ ...form, specialRequests: e.target.value })
										}
										placeholder="Anniversary trip, connecting rooms, dietary restrictions..."
										rows={3}
										className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
									/>
								</div>
								<button
									onClick={handleSubmit}
									disabled={!form.destination || loading}
									className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
								>
									{loading ? (
										<>
											<Loader2 className="w-5 h-5 animate-spin" /> Submitting...
										</>
									) : (
										<>
											<Crown className="w-5 h-5" /> Submit Premium Request
										</>
									)}
								</button>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
