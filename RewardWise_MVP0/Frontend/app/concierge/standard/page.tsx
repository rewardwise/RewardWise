/** @format */
"use client";
import TopNav from "@/components/TopNav";
import TropicalBackground from "@/components/TropicalBackground";
import { CheckCircle, Coffee, Loader2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
export default function ConciergePage() {
	const [step, setStep] = useState(1);
	const router = useRouter();
	const [form, setForm] = useState({
		destination: "",
		dates: "",
		flexibility: "flexible",
		travelers: "2",
		budget: "",
		preferences: "",
		cabin: "economy",
	});
	const [conciergeRequests, setConciergeRequests] = useState<
		ConciergeRequest[]
	>([]);
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	type ConciergeRequest = {
		destination: string;
		dates: string;
		flexibility: string;
		travelers: string;
		budget: string;
		preferences: string;
		cabin: string;
		type: string;
		status: string;
		date: string;
		id: number;
	};
	const handleSubmit = () => {
		setLoading(true);
		setTimeout(() => {
			setConciergeRequests((prev) => [
				...prev,
				{
					...form,
					type: "standard",
					status: "pending",
					date: "Just now",
					id: Date.now(),
				},
			]);

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
					{submitted ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center shadow-2xl">
							<div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
								<CheckCircle className="w-8 h-8 text-emerald-400" />
							</div>
							<h2 className="text-2xl font-bold text-white mb-2">
								Request Submitted!
							</h2>
							<p className="text-gray-400 mb-2">
								We're working on your {form.destination} trip.
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
									<span className="text-white text-sm">Standard Concierge</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Price</span>
									<span className="text-emerald-400 text-sm font-medium">
										$39
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Turnaround</span>
									<span className="text-white text-sm">24-48 hours</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400 text-sm">Status</span>
									<span className="text-amber-400 text-sm">
										⏳ Researching...
									</span>
								</div>
							</div>
							<p className="text-gray-500 text-sm mb-4">
								You'll receive The Verdict via email within 48 hours.
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
									<p>
										→ We check award availability across all partner airlines
									</p>
									<p>
										→ You receive a single recommended booking with alternatives
									</p>
								</div>
							</div>
							<button
								onClick={() => router.push("/home")}
								className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-lg w-full mb-2"
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
							<div className="flex items-center gap-2 mb-6">
								{[1, 2].map((s) => (
									<React.Fragment key={s}>
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}
										>
											{s}
										</div>
										{s < 2 && (
											<div
												className={`flex-1 h-0.5 ${step > s ? "bg-emerald-500" : "bg-gray-700"}`}
											/>
										)}
									</React.Fragment>
								))}
							</div>
							{step === 1 ? (
								<div className="space-y-4">
									<h2 className="text-lg font-semibold text-white mb-4">
										Trip Details
									</h2>
									<div>
										<label className="block text-gray-400 text-sm mb-1">
											Where do you want to go? *
										</label>
										<input
											value={form.destination}
											onChange={(e) =>
												setForm({ ...form, destination: e.target.value })
											}
											placeholder="e.g., Miami, Austin, Denver"
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-gray-400 text-sm mb-1">
												Travel Dates
											</label>
											<input
												value={form.dates}
												onChange={(e) =>
													setForm({ ...form, dates: e.target.value })
												}
												placeholder="e.g., March 15-20"
												className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
											/>
										</div>
										<div>
											<label className="block text-gray-400 text-sm mb-1">
												Flexibility
											</label>
											<select
												value={form.flexibility}
												onChange={(e) =>
													setForm({ ...form, flexibility: e.target.value })
												}
												className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
											>
												<option value="exact">Exact dates</option>
												<option value="flexible">± 3 days</option>
												<option value="very-flexible">± 1 week</option>
											</select>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-3">
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
												<option value="economy">Economy</option>
												<option value="premium">Premium Economy</option>
												<option value="business">Business</option>
												<option value="first">First</option>
											</select>
										</div>
									</div>
									<button
										onClick={() => setStep(2)}
										disabled={!form.destination}
										className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg mt-2"
									>
										Next
									</button>
								</div>
							) : (
								<div className="space-y-4">
									<h2 className="text-lg font-semibold text-white mb-4">
										Preferences
									</h2>
									<div>
										<label className="block text-gray-400 text-sm mb-1">
											Budget (optional)
										</label>
										<input
											value={form.budget}
											onChange={(e) =>
												setForm({ ...form, budget: e.target.value })
											}
											placeholder="Max cash you'd pay if points don't work"
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
											placeholder="e.g., prefer direct flights, need hotel too..."
											rows={3}
											className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
										/>
									</div>
									<div className="flex gap-3">
										<button
											onClick={() => setStep(1)}
											className="flex-1 border border-gray-600 text-white py-3 rounded-lg hover:bg-gray-800/50"
										>
											Back
										</button>
										<button
											onClick={handleSubmit}
											disabled={loading}
											className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
										>
											{loading ? (
												<>
													<Loader2 className="w-5 h-5 animate-spin" />{" "}
													Submitting...
												</>
											) : (
												"Submit Request"
											)}
										</button>
									</div>
								</div>
							)}
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
