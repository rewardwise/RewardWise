/** @format */

"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";

export default function AboutPage() {
	const router = useRouter();
	const { user } = useAuth();

	return (
		<div className="font-mtw min-h-screen bg-mtw-surface-mint text-mtw-ink">
			{/* Island hero band (island spec v2): photo + scrim, white heading. */}
			<section className="relative isolate overflow-hidden">
				<Image
					src="/hero-island.jpg"
					alt=""
					fill
					priority
					sizes="100vw"
					className="-z-10 object-cover object-center"
				/>
				<div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,20,14,0.55),rgba(6,20,14,0.25)_45%,rgba(6,20,14,0.55))]" />

				<div className="mx-auto max-w-3xl px-6 pb-20 pt-14 text-center">
					<h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
						About <span className="text-[#86EFAC]">MyTravelWallet</span>
					</h1>
					<p className="mt-4 text-lg text-white/85">One verdict, not 47 options.</p>
				</div>
			</section>

			<main className="mx-auto max-w-3xl px-6 pb-14">
				{/* Family photo — pulled up to overlap the hero band. */}
				<div className="relative z-10 -mt-12 overflow-hidden rounded-mtw-lg shadow-mtw-ambient">
					<img
						src="/about-family-travel.jpg"
						alt="Happy family traveling together"
						className="h-64 w-full object-cover sm:h-80"
					/>
				</div>

				{/* Founder story — relit light card. */}
				<div
					data-testid="about-story-card"
					className="mt-8 rounded-mtw-lg border border-mtw-border bg-white p-8 shadow-mtw-ambient"
				>
					<div className="space-y-5 text-[17px] leading-relaxed text-mtw-ink">
						<p>
							Hi, I&apos;m Sabby Nagi, and I built MyTravelWallet because my family needed it.
						</p>

						<p>
							My family is spread across the globe. When I had kids, I realized how much I needed grandparents, siblings, and the people I love close by, not just for holidays, but for real, everyday life. The problem? International flights are expensive. Like, really expensive.
						</p>

						<p>
							So I started digging into credit card points, airline transfer partners, and award charts. I built spreadsheets. I spent hours comparing routes, calculating cents-per-point, figuring out whether to send Chase points to United or Virgin Atlantic for the exact same flight. For years, I ran this manually, first for my family, then for friends who kept asking <span className="italic text-mtw-muted"> “how are you flying business class for that price?”</span>
						</p>

						<p>
							It worked. I was saving my family thousands every year. Business class to Asia for the price of economy, first class to Europe using points that would have expired sitting in an account. But every trip took <span className="font-medium text-mtw-ink-strong">hours of research</span>. I was essentially running a one-person travel optimization desk out of Google Sheets. Not exactly scalable.
						</p>

						<p className="border-l-2 border-mtw-emerald bg-mtw-emerald/[0.06] py-2 pl-5 text-mtw-ink-strong">
							Then it hit me: millions of people have points scattered across a dozen programs, slowly losing value. They <span className="font-medium text-mtw-emerald">want </span> to use them smartly, but they don&apos;t have three hours to research each trip. They need someone, or something, to just <span className="font-medium text-mtw-emerald">tell them what to do</span>.
						</p>

						<p>
							That&apos;s MyTravelWallet. You tell us where you want to go. We look at everything: your balances, every transfer partner, every routing, and cash prices vs. points prices. Then we give you one clear answer. <span className="font-medium text-mtw-ink-strong">The Verdict.</span> Sometimes it&apos;s “use your points this way.” Sometimes it&apos;s “pay cash this time, your points are worth more saved for later.” We&apos;re not a search engine showing you 47 options. We tell you the best move.
						</p>

						<p>Three steps, and you&apos;re done:</p>

						<div className="grid grid-cols-3 gap-3 py-2">
							{[
								{ n: "1", title: "Scan", sub: "Link your programs" },
								{ n: "2", title: "Optimize", sub: "We find the best path" },
								{ n: "3", title: "Go", sub: "Book with confidence" },
							].map((step) => (
								<div
									key={step.n}
									className="rounded-mtw border border-mtw-border bg-mtw-surface p-4 text-center"
								>
									<div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-mtw-emerald/15">
										<span className="text-sm font-bold text-mtw-emerald">{step.n}</span>
									</div>
									<p className="text-sm font-medium text-mtw-ink">{step.title}</p>
									<p className="mt-1 text-xs text-mtw-muted">{step.sub}</p>
								</div>
							))}
						</div>

						<p>
							The goal is simple: <span className="font-semibold text-mtw-emerald">save on flights you&apos;d otherwise overpay for</span>, and put the points you&apos;ve already earned to work before they expire unused.
						</p>

						<p>
							But honestly, the savings are just the start. What I really care about is what those savings <span className="font-medium text-mtw-ink-strong">unlock</span>. A grandparent who gets to be there for a first birthday. A family reunion that actually happens instead of being “maybe next year.” A friend who can finally visit.
						</p>

						<p className="pt-2 text-lg font-medium text-mtw-ink-strong">
							We believe distance shouldn&apos;t keep families apart. That&apos;s the mission: make the world a little smaller for the people who matter most.
						</p>

						<p className="pt-2 text-sm text-mtw-muted">Sabby Nagi, Founder</p>
					</div>
				</div>

				{user ? (
					<button
						onClick={() => router.push("/home")}
						className="mx-auto mt-10 flex items-center gap-3 rounded-mtw bg-mtw-emerald px-10 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
					>
						Try it yourself <ArrowRight className="h-5 w-5" />
					</button>
				) : (
					<>
						<button
							onClick={() => router.push("/")}
							className="mx-auto mt-10 flex items-center gap-3 rounded-mtw bg-mtw-emerald px-10 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
						>
							Return to home <ArrowRight className="h-5 w-5" />
						</button>

						<p className="mt-4 text-center text-sm text-mtw-muted">
							Public access now begins from the main landing page.
						</p>
					</>
				)}
			</main>
		</div>
	);
}
