/** @format */

"use client";

import TropicalBackground from "@/components/TropicalBackground";
import { Coffee, Star, Check, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
export default function ConciergePage() {
	const router = useRouter();
	return (
		<div className="relative h-screen overflow-hidden text-white">
			{" "}
			{/* Title */}
			<TropicalBackground />
			<div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
				<div className="text-center mb-6">
					<h1 className="text-4xl font-bold mb-3">Concierge Booking Service</h1>
					<p className="text-gray-300">
						Let our experts handle the complex stuff. You just tell us where.
					</p>
				</div>

				{/* Side-by-side: Premium LEFT, Standard RIGHT */}
				<div className="w-full max-w-3xl">
					<div className="grid md:grid-cols-2 gap-6">
						{/* PREMIUM — LEFT (anchor high, F-pattern first) */}
						<div className="bg-gray-900/70 backdrop-blur-xl backdrop-blur rounded-xl overflow-hidden shadow-2xl border border-purple-500/30 relative">
							<div className="absolute top-3 right-3 bg-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
								Most Popular
							</div>
							<div className="bg-gradient-to-r from-purple-600/30 to-indigo-600/30 px-6 py-5">
								<Crown className="w-8 h-8 text-purple-400 mb-2" />
								<h2 className="text-xl font-bold text-white">
									Premium Concierge
								</h2>
								<p className="text-gray-300 text-sm mt-1">
									White-glove, end-to-end trip planning
								</p>
							</div>
							<div className="px-6 py-5">
								<div className="flex items-baseline gap-1 mb-4">
									<span className="text-4xl font-bold text-white">$199</span>
									<span className="text-gray-400 text-sm">per trip</span>
								</div>
								<div className="space-y-2.5 mb-6">
									{[
										"Full itinerary: flights + hotels + transfers",
										"Business & First class award optimization",
										"Hotel loyalty point optimization",
										"Airport lounge access coordination",
										"Restaurant & experience reservations",
										"Dedicated agent via WhatsApp/email",
										"24hr turnaround, unlimited revisions",
									].map((f, i) => (
										<div key={i} className="flex items-start gap-2">
											<Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
											<span className="text-gray-300 text-sm">{f}</span>
										</div>
									))}
								</div>
								<button
									onClick={() => router.push("/concierge/premium")}
									className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
								>
									<Crown className="w-5 h-5" /> Get Premium
								</button>
								<p className="text-gray-500 text-xs text-center mt-2">
									Avg savings: $2,400+ per trip
								</p>
							</div>
						</div>

						{/* STANDARD — RIGHT */}
						<div className="bg-gray-900/70 backdrop-blur-xl backdrop-blur rounded-xl overflow-hidden shadow-2xl border border-gray-700/50">
							<div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 px-6 py-5">
								<Coffee className="w-8 h-8 text-amber-400 mb-2" />
								<h2 className="text-xl font-bold text-white">
									Standard Concierge
								</h2>
								<p className="text-gray-300 text-sm mt-1">
									Expert flight booking optimization
								</p>
							</div>
							<div className="px-6 py-5">
								<div className="flex items-baseline gap-1 mb-4">
									<span className="text-4xl font-bold text-white">$39</span>
									<span className="text-gray-400 text-sm">per trip</span>
								</div>
								<div className="space-y-2.5 mb-6">
									{[
										"Optimal flight award redemption",
										"Points transfer path optimization",
										"Economy & Premium Economy focus",
										"Email support",
										"24-48hr turnaround",
										"1 round of revisions",
									].map((f, i) => (
										<div key={i} className="flex items-start gap-2">
											<Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
											<span className="text-gray-300 text-sm">{f}</span>
										</div>
									))}
									<div className="h-6" /> {/* spacer to align buttons */}
								</div>
								<button
									onClick={() => router.push("/concierge/standard")}
									className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
								>
									<Coffee className="w-5 h-5" /> Get Standard
								</button>
								<p className="text-gray-500 text-xs text-center mt-2">
									Avg savings: $800+ per trip
								</p>
							</div>
						</div>
					</div>
				</div>
				{/* Social proof */}
				<div className="mt-2 text-center">
					<div className="flex items-center justify-center gap-1 mb-1">
						{[1, 2, 3, 4, 5].map((s) => (
							<Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />
						))}
					</div>
					<p className="text-gray-400 text-sm">
						"Saved us $3,200 on our anniversary trip to Tokyo. Worth every
						penny." — Sarah K.
					</p>
				</div>
			</div>
		</div>
	);
}
