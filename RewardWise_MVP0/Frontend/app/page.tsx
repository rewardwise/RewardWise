/** @format */

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
	ArrowLeftRight,
	ArrowRight,
	Calendar,
	Check,
	ChevronDown,
	Loader2,
	MapPin,
	Plane,
	Route,
	Search,
	User,
} from "lucide-react";

import AirportSearch from "@/components/AirportSearch";
import LandingNav from "@/components/LandingNav";
import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";
import type { Cabin } from "@/utils/cabin";

// ---------------------------------------------------------------------------
// How-it-works — the three steps below the hero (redesign 01-search.png). No
// em-dashes (product-copy rule).
// ---------------------------------------------------------------------------
const HOW_IT_WORKS = [
	{
		icon: MapPin,
		title: "Tell us A → B",
		description: "Where from, where to, and when.",
	},
	{
		icon: Search,
		title: "We do the math",
		description: "Live cash and award prices across 30+ points programs.",
	},
	{
		icon: Check,
		title: "Get the verdict",
		description: "Pay cash or use points, plus how to book.",
	},
];

function LandingPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const searchCardRef = useRef<HTMLDivElement | null>(null);

	const { user, loading, signOut } = useAuth();
	const { setPendingSearch } = useSearchFill();

	const [origin, setOrigin] = useState("");
	const [destination, setDestination] = useState("");
	const [departDate, setDepartDate] = useState("");
	const [returnDate, setReturnDate] = useState("");
	const [cabin, setCabin] = useState<Cabin>("economy");
	const [travelers, setTravelers] = useState("1");
	const [maxStops, setMaxStops] = useState<string>("any");
	const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip");
	const [showMore, setShowMore] = useState(false);
	const [signingOutUnauthorized, setSigningOutUnauthorized] = useState(false);

	const accessDenied = searchParams.get("access") === "denied";

	// Auth redirect — logged-in guests belong in the app.
	useEffect(() => {
		if (!loading && user && !accessDenied) {
			router.replace("/home");
		}
	}, [accessDenied, loading, router, user]);

	// Sign-out on access denied
	useEffect(() => {
		if (!loading && accessDenied && user) {
			setSigningOutUnauthorized(true);
			void signOut().finally(() => {
				setSigningOutUnauthorized(false);
				router.replace("/?access=denied");
			});
		}
	}, [accessDenied, loading, router, signOut, user]);

	const savePendingSearch = () => {
		setPendingSearch({
			origin,
			destination,
			date: departDate,
			return_date: tripType === "roundtrip" ? returnDate : null,
			tripType,
			cabin,
			travelers,
			selectedPrograms: [],
			balances: {},
		});
	};

	const handleAuthRoute = (path: "/login" | "/signup") => {
		if (origin || destination || departDate) {
			savePendingSearch();
		}
		router.push(path);
	};

	const swapOriginDestination = () => {
		setOrigin(destination);
		setDestination(origin);
	};

	const scrollToSearch = () => {
		searchCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
	};

	// Guest search flow removed (cost decision): anonymous users never trigger a
	// live search. The form is a signup hook — whatever they typed rides along
	// via setPendingSearch and prefills after account creation.
	const handleSearch = () => {
		handleAuthRoute("/signup");
	};

	if (loading || signingOutUnauthorized) {
		return (
			<div className="font-mtw flex min-h-screen items-center justify-center bg-mtw-surface-mint text-mtw-ink">
				<div className="flex items-center gap-3 rounded-mtw-pill border border-mtw-border bg-white px-5 py-3 text-mtw-small shadow-mtw-ambient">
					<Loader2 className="h-4 w-4 animate-spin text-mtw-emerald" />
					{signingOutUnauthorized ? "Resetting access..." : "Loading..."}
				</div>
			</div>
		);
	}

	return (
		// NOTE: `mtw-light` is intentionally NOT on the root. Its
		// `.mtw-light .text-white { color:#1f2937 }` remap would turn the hero's
		// white H1/nav and every emerald button's white label dark. We scope it
		// to only the subtrees built from hardcoded dark utilities (AirportSearch,
		// SearchLoadingExperience); everything else already uses light mtw tokens.
		<div className="font-mtw min-h-screen bg-mtw-surface-mint text-mtw-ink">
			{/* ---------------------------------------------------------------- */}
			{/* HERO — island photo, white type, search card. Logged-out only.  */}
			{/* ---------------------------------------------------------------- */}
			<section className="relative isolate overflow-hidden">
				<Image
					src="/hero-island.jpg"
					alt=""
					fill
					priority
					sizes="100vw"
					className="-z-10 object-cover object-center"
				/>
				{/* Legibility scrim: darker toward the top for the white nav + H1. */}
				<div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,20,14,0.55),rgba(6,20,14,0.25)_45%,rgba(6,20,14,0.55))]" />

				<LandingNav />

				<div className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center sm:pt-14">
					{accessDenied ? (
						<div className="mx-auto mb-8 max-w-xl rounded-mtw-lg border border-amber-300/40 bg-amber-50/90 px-5 py-4 text-mtw-small text-amber-900">
							That account is not approved for access right now. Please use a
							permitted email or contact the team.
						</div>
					) : null}

					<h1
						data-testid="hero-h1"
						className="text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl"
					>
						Cash or points? We&apos;ll tell you.
					</h1>
					<p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/90 sm:text-lg">
						Tell us where you&apos;re going. We&apos;ll find the smartest way to
						pay. Free account, verdict in seconds.
					</p>

					{/* Search card (reskinned slim pill) */}
					<div
						ref={searchCardRef}
						data-testid="search-pill"
						className="mx-auto mt-8 max-w-2xl rounded-mtw-lg border border-mtw-border bg-white p-4 text-left shadow-mtw-ambient sm:p-5"
					>
						<div className="mb-3 flex flex-wrap items-center gap-2">
							{(["roundtrip", "oneway"] as const).map((type) => (
								<button
									key={type}
									type="button"
									onClick={() => {
										setTripType(type);
										if (type === "oneway") setReturnDate("");
									}}
									className={`rounded-mtw-pill px-3 py-1.5 text-mtw-small font-semibold transition-colors ${
										tripType === type
											? "bg-mtw-emerald text-white"
											: "border border-mtw-border bg-white text-mtw-muted hover:text-mtw-ink"
									}`}
								>
									{type === "roundtrip" ? "Round trip" : "One way"}
								</button>
							))}
							<button
								type="button"
								data-testid="more-options-toggle"
								onClick={() => setShowMore((v) => !v)}
								aria-expanded={showMore}
								aria-controls="landing-more-options"
								className="ml-auto inline-flex items-center gap-1 text-mtw-small font-medium text-mtw-muted hover:text-mtw-ink"
							>
								{travelers} {Number(travelers) === 1 ? "traveler" : "travelers"} ·{" "}
								{cabin === "premium_economy"
									? "Premium"
									: cabin.charAt(0).toUpperCase() + cabin.slice(1)}
								<ChevronDown
									className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`}
								/>
							</button>
						</div>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
							{/* mtw-light remaps AirportSearch's hardcoded dark input utilities
							    to light — scoped here so it can't touch the white button labels. */}
							<div className="mtw-light">
								<AirportSearch
									label="FROM"
									value={origin}
									onChange={setOrigin}
									placeholder="City or airport"
								/>
							</div>
							<div className="flex justify-center sm:contents">
								<button
									type="button"
									aria-label="Swap origin and destination"
									onClick={swapOriginDestination}
									className="mb-1 self-end rounded-mtw border border-mtw-border p-2 transition hover:border-mtw-emerald"
								>
									<ArrowLeftRight className="h-4 w-4 text-mtw-emerald" />
								</button>
							</div>
							<div className="mtw-light">
								<AirportSearch
									label="TO"
									value={destination}
									onChange={setDestination}
									placeholder="City or airport"
								/>
							</div>
						</div>

						<div
							className={`mt-3 grid grid-cols-1 gap-3 ${tripType === "roundtrip" ? "sm:grid-cols-2" : ""}`}
						>
							<div>
								<label className="mb-1 flex items-center gap-1 text-mtw-label uppercase text-mtw-muted">
									<Calendar className="h-3 w-3" /> Depart
								</label>
								<input
									type="date"
									min={new Date().toISOString().split("T")[0]}
									value={departDate}
									onChange={(event) => setDepartDate(event.target.value)}
									className="w-full rounded-mtw border border-mtw-border bg-white px-3 py-2.5 text-mtw-small text-mtw-ink [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-mtw-emerald"
								/>
							</div>
							{tripType === "roundtrip" && (
								<div>
									<label className="mb-1 flex items-center gap-1 text-mtw-label uppercase text-mtw-muted">
										<Calendar className="h-3 w-3" /> Return
									</label>
									<input
										type="date"
										min={departDate || new Date().toISOString().split("T")[0]}
										value={returnDate}
										onChange={(event) => setReturnDate(event.target.value)}
										className="w-full rounded-mtw border border-mtw-border bg-white px-3 py-2.5 text-mtw-small text-mtw-ink [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-mtw-emerald"
									/>
								</div>
							)}
						</div>

						{showMore && (
							<div
								id="landing-more-options"
								role="region"
								aria-label="More search options"
								data-testid="more-options"
								className="mt-3 grid grid-cols-1 gap-3 border-t border-mtw-border pt-3 sm:grid-cols-3"
							>
								<div>
									<label className="mb-1 flex items-center gap-1 text-mtw-label uppercase text-mtw-muted">
										<User className="h-3 w-3" /> Travelers
									</label>
									<select
										value={travelers}
										onChange={(event) => setTravelers(event.target.value)}
										className="w-full rounded-mtw border border-mtw-border bg-white px-3 py-2.5 text-mtw-small text-mtw-ink focus:outline-none focus:ring-2 focus:ring-mtw-emerald"
									>
										{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
											<option key={n} value={n}>
												{n} Traveler{n > 1 ? "s" : ""}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className="mb-1 flex items-center gap-1 text-mtw-label uppercase text-mtw-muted">
										<Route className="h-3 w-3" /> Stops
									</label>
									<select
										value={maxStops}
										onChange={(event) => setMaxStops(event.target.value)}
										className="w-full rounded-mtw border border-mtw-border bg-white px-3 py-2.5 text-mtw-small text-mtw-ink focus:outline-none focus:ring-2 focus:ring-mtw-emerald"
									>
										<option value="any">Any stops</option>
										<option value="nonstop">Nonstop only</option>
										<option value="one_or_fewer">1 stop or fewer</option>
										<option value="two_or_fewer">2 stops or fewer</option>
									</select>
								</div>
								<div>
									<label className="mb-1 flex items-center gap-1 text-mtw-label uppercase text-mtw-muted">
										<Plane className="h-3 w-3" /> Cabin
									</label>
									<select
										value={cabin}
										onChange={(event) => setCabin(event.target.value as Cabin)}
										className="w-full rounded-mtw border border-mtw-border bg-white px-3 py-2.5 text-mtw-small text-mtw-ink focus:outline-none focus:ring-2 focus:ring-mtw-emerald"
									>
										<option value="economy">Economy</option>
										<option value="premium_economy">Premium Economy</option>
										<option value="business">Business</option>
										<option value="first">First</option>
									</select>
								</div>
							</div>
						)}

						<button
							onClick={handleSearch}
							data-testid="landing-search-cta"
							className="mt-4 flex w-full items-center justify-center gap-2 rounded-mtw bg-mtw-emerald py-3 text-mtw-body font-semibold text-white transition-opacity hover:opacity-90"
						>
							See the smartest way to pay
						</button>
					</div>

					<p className="mt-4 text-mtw-small text-white/85">
						Create a free account and your search comes with you.
					</p>
				</div>
			</section>

			{/* ---------------------------------------------------------------- */}
			{/* Trust bar                                                        */}
			{/* ---------------------------------------------------------------- */}
			<section className="border-y border-mtw-border bg-mtw-surface-mint-trust">
				<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-4 text-mtw-small text-mtw-muted">
					<span>Compare 30+ points programs</span>
					<span className="hidden sm:inline text-mtw-border">·</span>
					<span>Live cash + award prices</span>
					<span className="hidden sm:inline text-mtw-border">·</span>
					<span>No spam, ever</span>
				</div>
			</section>

			{/* ---------------------------------------------------------------- */}
			{/* 3-step how-it-works                                              */}
			{/* ---------------------------------------------------------------- */}
			<section className="mx-auto max-w-5xl px-6 py-14">
				<div className="grid gap-6 sm:grid-cols-3">
					{HOW_IT_WORKS.map(({ icon: Icon, title, description }, i) => (
						<div key={title} className="text-center sm:text-left">
							<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-mtw bg-mtw-emerald/10 text-mtw-emerald sm:mx-0">
								<Icon className="h-5 w-5" />
							</div>
							<h3 className="mt-4 text-mtw-title text-mtw-ink">
								{i + 1}. {title}
							</h3>
							<p className="mt-1 text-mtw-small leading-6 text-mtw-muted">
								{description}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* ---------------------------------------------------------------- */}
			{/* Sample verdict — illustrative (NOT a claimed real booking).      */}
			{/* ---------------------------------------------------------------- */}
			<section className="mx-auto max-w-2xl px-6 pb-4">
				<p className="mb-3 text-center text-mtw-label uppercase tracking-wider text-mtw-muted">
					A real verdict looks like this
				</p>
				<div className="rounded-mtw-lg border border-mtw-border bg-white p-6 shadow-mtw-ambient">
					<div className="flex items-start gap-3">
						<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mtw-emerald/10 text-mtw-emerald">
							<Check className="h-4 w-4" />
						</span>
						<div>
							<h3 className="text-mtw-title text-mtw-ink">
								Pay cash — SFO → NYC, $352 round trip.
							</h3>
							<p className="mt-1 text-mtw-small leading-6 text-mtw-muted">
								Beats using about 25,000 points. Keep your miles for a bigger
								trip.
							</p>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<span className="rounded-mtw-pill border border-mtw-emerald/40 bg-mtw-emerald/10 px-3 py-1.5 text-mtw-small font-semibold text-mtw-emerald">
							Cash $352 · best value
						</span>
						<span className="rounded-mtw-pill border border-mtw-border px-3 py-1.5 text-mtw-small text-mtw-muted">
							~25,000 pts
						</span>
					</div>
					<p className="mt-3 text-mtw-label uppercase tracking-wider text-mtw-muted">
						SFO · JFK · $352 · nonstop
					</p>
				</div>
			</section>

			{/* ---------------------------------------------------------------- */}
			{/* Wallet-connect CTA                                               */}
			{/* ---------------------------------------------------------------- */}
			<section className="mx-auto max-w-2xl px-6 py-12">
				<div className="rounded-mtw-lg border border-mtw-emerald/20 bg-mtw-surface-mint-cta p-7 text-center">
					<h2 className="text-mtw-headline text-mtw-ink">
						See if YOU can book it with your points.
					</h2>
					<p className="mx-auto mt-2 max-w-lg text-mtw-small leading-6 text-mtw-muted">
						Connect your Amex, Chase, Citi or Capital One, and every verdict gets
						personalized to the cards you actually hold.
					</p>
					<div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
						<button
							type="button"
							onClick={() => handleAuthRoute("/signup")}
							className="inline-flex items-center gap-2 rounded-mtw bg-mtw-emerald px-5 py-2.5 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
						>
							Connect your wallet <ArrowRight className="h-4 w-4" />
						</button>
						<button
							type="button"
							onClick={scrollToSearch}
							className="text-mtw-small font-medium text-mtw-muted transition-colors hover:text-mtw-ink"
						>
							Maybe later
						</button>
					</div>
				</div>
			</section>

			{/* ---------------------------------------------------------------- */}
			{/* Footer                                                           */}
			{/* ---------------------------------------------------------------- */}
			<footer className="border-t border-mtw-border bg-white">
				<div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-mtw-small text-mtw-muted sm:flex-row sm:items-center sm:justify-between">
					<p className="font-semibold text-mtw-ink">
						MyTravelWallet
						<span className="ml-2 font-normal text-mtw-muted">
							© 2026 All rights reserved.
						</span>
					</p>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<button onClick={() => router.push("/about")} className="hover:text-mtw-ink">
							How it works
						</button>
						<button onClick={() => router.push("/about")} className="hover:text-mtw-ink">
							About
						</button>
						<button onClick={() => router.push("/privacy")} className="hover:text-mtw-ink">
							Privacy
						</button>
					</div>
				</div>
			</footer>

		</div>
	);
}

function LandingPageFallback() {
	return (
		<div className="font-mtw flex min-h-screen items-center justify-center bg-mtw-surface-mint text-mtw-ink">
			<div className="rounded-mtw-pill border border-mtw-border bg-white px-5 py-3 text-mtw-small shadow-mtw-ambient">
				Loading MyTravelWallet...
			</div>
		</div>
	);
}

export default function LandingPage() {
	return (
		<Suspense fallback={<LandingPageFallback />}>
			<LandingPageContent />
		</Suspense>
	);
}
