/** @format */

"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import TropicalBackground from "@/components/TropicalBackground";

export default function AboutPage() {
	const router = useRouter();
	const { user } = useAuth();

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="max-w-3xl mx-auto px-6 py-10">
					<div className="text-center mb-10">
						<h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
							About <span className="text-emerald-400">MyTravelWallet</span>
						</h1>

						<p className="text-gray-300 text-lg">
							One verdict, not 47 options.
						</p>
					</div>

					<div className="rounded-2xl overflow-hidden mb-10 shadow-2xl">
						<img
							src="https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&q=80"
							alt="Happy family traveling together"
							className="w-full h-64 sm:h-80 object-cover"
						/>
					</div>

					<div className="bg-gray-900/80 backdrop-blur rounded-2xl p-8 mb-10 border border-gray-700/50">
						<div className="space-y-5 text-gray-300 leading-relaxed text-[17px]">
							<p>
								Hi, I&apos;m Sabby Nagi, and I built MyTravelWallet because my family needed it.
							</p>

							<p>
								My family is spread across the globe. When I had kids, I realized how much I needed grandparents, siblings, and the people I love close by, not just for holidays, but for real, everyday life. The problem? International flights are expensive. Like, really expensive.
							</p>

							<p>
								So I started digging into credit card points, airline transfer partners, and award charts. I built spreadsheets. I spent hours comparing routes, calculating cents-per-point, figuring out whether to send Chase points to United or Virgin Atlantic for the exact same flight. For years, I ran this manually, first for my family, then for friends who kept asking <span className="italic text-gray-400"> “how are you flying business class for that price?”</span>
							</p>

							<p>
								It worked. I was saving my family thousands every year. Business class to Asia for the price of economy, first class to Europe using points that would have expired sitting in an account. But every trip took <span className="text-white font-medium">hours of research</span>. I was essentially running a one-person travel optimization desk out of Google Sheets. Not exactly scalable.
							</p>

							<p className="border-l-2 border-emerald-500 pl-5 py-1 text-white">
								Then it hit me: millions of people have points scattered across a dozen programs, slowly losing value. They <span className="text-emerald-400 font-medium">want </span> to use them smartly, but they don&apos;t have three hours to research each trip. They need someone, or something, to just <span className="text-emerald-400 font-medium">tell them what to do</span>.
							</p>

							<p>
								That&apos;s MyTravelWallet. You tell us where you want to go. We look at everything: your balances, every transfer partner, every routing, and cash prices vs. points prices. Then we give you one clear answer. <span className="text-white font-medium">The Verdict.</span> Sometimes it&apos;s “use your points this way.” Sometimes it&apos;s “pay cash this time, your points are worth more saved for later.” We&apos;re not a search engine showing you 47 options. We tell you the best move.
							</p>

							<p>Three steps, and you&apos;re done:</p>

							<div className="grid grid-cols-3 gap-3 py-2">
								<div className="bg-gray-800/60 rounded-xl p-4 text-center">
									<div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
										<span className="text-emerald-400 font-bold text-sm">1</span>
									</div>
									<p className="text-white font-medium text-sm">Scan</p>
									<p className="text-gray-400 text-xs mt-1">Link your programs</p>
								</div>

								<div className="bg-gray-800/60 rounded-xl p-4 text-center">
									<div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
										<span className="text-emerald-400 font-bold text-sm">2</span>
									</div>
									<p className="text-white font-medium text-sm">Optimize</p>
									<p className="text-gray-400 text-xs mt-1">We find the best path</p>
								</div>

								<div className="bg-gray-800/60 rounded-xl p-4 text-center">
									<div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
										<span className="text-emerald-400 font-bold text-sm">3</span>
									</div>
									<p className="text-white font-medium text-sm">Go</p>
									<p className="text-gray-400 text-xs mt-1">Book with confidence</p>
								</div>
							</div>

							<p>
								Most users save <span className="text-emerald-400 font-semibold">$150+ per trip</span>. Heavy travelers with points across multiple programs? We&apos;re talking <span className="text-emerald-400 font-semibold">thousands of dollars a year</span> that would otherwise be left on the table, or worse, expire unused.
							</p>

							<p>
								But honestly, the savings are just the start. What I really care about is what those savings <span className="text-white font-medium">unlock</span>. A grandparent who gets to be there for a first birthday. A family reunion that actually happens instead of being “maybe next year.” A friend who can finally visit.
							</p>

							<p>
								That&apos;s why we&apos;re building <span className="text-white font-medium">Circle</span>, a way for your family and close friends to pool points together, help each other out, and optimize travel for everyone. Your mom&apos;s unused Delta miles could get your sister&apos;s family home for the holidays. Your best friend&apos;s Amex points could top off what you need for that upgrade.
							</p>

							<p className="text-white font-medium text-lg pt-2">
								We believe distance shouldn&apos;t keep families apart. That&apos;s the mission: make the world a little smaller for the people who matter most.
							</p>

							<p className="text-gray-400 text-sm pt-2">Sabby Nagi, Founder</p>
						</div>
					</div>

					{user ? (
						<button
							onClick={() => router.push("/home")}
							className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-10 py-4 rounded-xl text-lg flex items-center gap-3 mx-auto transition-all"
						>
							Try It Youeself <ArrowRight className="w-5 h-5" />
						</button>
					) : (
						<>
							<button
								onClick={() => router.push("/")}
								className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-10 py-4 rounded-xl text-lg flex items-center gap-3 mx-auto transition-all"
							>
								Return to Home <ArrowRight className="w-5 h-5" />
							</button>

							<p className="text-gray-400 text-sm mt-4 text-center">
								Public access now begins from the main landing page.
							</p>
						</>
					)}
				</main>
			</div>
		</div>
	);
}
