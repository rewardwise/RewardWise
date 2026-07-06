/** @format */

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
	Wallet,
} from "lucide-react";

import AirportSearch from "@/components/AirportSearch";
import SearchLoadingExperience from "@/components/SearchLoadingExperience";
import CuratedOptions from "@/components/verdict/CuratedOptions";
import LandingNav from "@/components/LandingNav";
import GuestZoeFab from "@/components/GuestZoeFab";
import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";
import type { Cabin } from "@/utils/cabin";
import {
	dedupeByProgram,
	filterByDate,
	type DedupeAwardOption,
} from "@/utils/awardOptions";
import type { Ownership } from "@/types/verdict";
import {
	PUBLIC_SEARCH_FREE_LIMIT,
	pluralizeSearch,
} from "@/utils/public-search";

interface VerdictWinner {
	program: string | null;
	points: number | null;
	taxes: number | null;
	cpp: number | null;
	direct: boolean | null;
}

interface BookingLink {
	seats_aero_link: string | null;
	airline_link: string | null;
	preferred: "seats_aero" | "airline" | "none";
}

interface Verdict {
	verdict: string;
	verdict_label?: string;
	recommendation?: "use_points" | "pay_cash" | "wait";
	headline?: string;
	explanation?: string;
	winner: VerdictWinner | null;
	pay_cash: boolean;
	confidence: "high" | "medium" | "low";
	confidence_reason?: string;
	booking_note: string;
	booking_link: BookingLink;
	data_quality?: string;
	missing_sources?: string[];
	metrics?: {
		cash_price?: number | null;
		points_cost?: number | null;
		taxes?: number | null;
		cpp?: number | null;
		estimated_savings?: number | null;
	};
}

interface SearchResult {
	search_id?: string | null;
	verdict_id?: string | null;
	public_trial_id?: string | null;
	origin: string;
	destination: string;
	date: string;
	return_date: string | null;
	cabin: string;
	travelers: number;
	is_roundtrip: boolean;
	cash_price: number | null;
	price_level: string | null;
	typical_price_range: [number, number] | null;
	flights: any[];
	award_options: any[];
	return_award_options: any[];
	verdict: Verdict;
}

const MIN_PUBLIC_SEARCH_LOADING_MS = 5000;

function sleep(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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

/**
 * Synthesize a client-side `logged_out` ownership so the guest verdict renders
 * the b1 "connect your wallet" fork (shipped in OwnershipFork, Phase 2a). The
 * backend never sends ownership for guests — it's wallet-derived — so we mark it
 * `applicable: true` (CuratedOptions gates the fork on that) with zeroed balances
 * and `fork_reason: "logged_out"`, which OwnershipFork keys off before any
 * balance math. No fabricated wallet numbers; the fork only invites a connect.
 */
function guestOwnership(winnerProgram: string | null): Ownership {
	return {
		applicable: true,
		program: winnerProgram ?? "",
		program_label: null,
		points_needed: 0,
		owned_balance: 0,
		shortfall: 0,
		can_afford: false,
		reachable_partners: [],
		buyable: false,
		buy_rate_cpp: null,
		redemption_cpp: null,
		buy_gap_cost: null,
		buy_gap_worth_it: false,
		fork_recommendation: "pay_cash",
		fork_reason: "logged_out",
		transfers_as_of: null,
	};
}

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
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [signingOutUnauthorized, setSigningOutUnauthorized] = useState(false);
	const [results, setResults] = useState<SearchResult | null>(null);
	// Client-side hint only (NOT the paywall). The backend `public_search_trials`
	// gate is the source of truth; a 429 flips `blocked`. We just count successful
	// guest searches this session to render "Search N of 3 free".
	const [searchesUsed, setSearchesUsed] = useState(0);
	const [blocked, setBlocked] = useState(false);

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

	const handleSearch = async () => {
		const searchStartedAt = Date.now();

		if (!origin || !destination || !departDate) {
			setSearchError("Please fill in origin, destination, and departure date.");
			return;
		}

		if (tripType === "roundtrip" && !returnDate) {
			setSearchError("Please select a return date for round trips.");
			return;
		}

		setSearchError("");
		setResults(null);
		setBlocked(false);
		setSearching(true);

		try {
			const params = new URLSearchParams({
				origin,
				destination,
				date: departDate,
				cabin,
				travelers,
			});

			if (tripType === "roundtrip" && returnDate) {
				params.append("return_date", returnDate);
			}
			if (maxStops !== "any") {
				params.append("max_stops", maxStops);
			}

			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			if (!API_URL) {
				throw new Error("Missing NEXT_PUBLIC_API_URL.");
			}

			const res = await fetch(`${API_URL}/api/public-search?${params.toString()}`, {
				method: "POST",
			});

			// 429 = the backend free-trial gate is exhausted. This is the paywall
			// (the "Search N of 3 free" chip is only a client-side hint); render the
			// block state instead of a generic error.
			if (res.status === 429) {
				setSearching(false);
				setBlocked(true);
				setSearchesUsed(PUBLIC_SEARCH_FREE_LIMIT);
				return;
			}

			if (!res.ok) {
				const errData = await res.json().catch(() => null);
				const detail = errData?.detail;
				const message = Array.isArray(detail)
					? (detail[0]?.msg?.replace("Value error, ", "") ??
						`Server error: ${res.status}`)
					: (detail ?? `Server error: ${res.status}`);
				throw new Error(message);
			}

			const data = await res.json();
			const remainingLoadingMs =
				MIN_PUBLIC_SEARCH_LOADING_MS - (Date.now() - searchStartedAt);
			if (remainingLoadingMs > 0) {
				await sleep(remainingLoadingMs);
			}
			setResults(data);
			setSearchesUsed((n) => Math.min(n + 1, PUBLIC_SEARCH_FREE_LIMIT));
		} catch (err: any) {
			setSearchError(err.message || "Something went wrong. Try again.");
		} finally {
			setSearching(false);
		}
	};

	// Map the public-search result into CuratedOptions props. Same dedupe path as
	// VerdictCard (dedupe-by-program), so the guest sees the identical curated set.
	const curatedAwards = useMemo(() => {
		if (!results) return [];
		const source = (results.award_options ?? []) as DedupeAwardOption[];
		return dedupeByProgram(filterByDate(source, null)).map((o) => ({
			program: o.program,
			points: o.points,
			taxes: o.taxes ?? null,
			direct: o.direct,
		}));
	}, [results]);

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

	const recommendation =
		results?.verdict.recommendation ??
		(results?.verdict.pay_cash ? "pay_cash" : "use_points");
	const winnerProgram = results?.verdict.winner?.program ?? null;
	const cashPrice = results?.verdict.metrics?.cash_price ?? results?.cash_price ?? null;
	const matchedCpp = results?.verdict.metrics?.cpp ?? null;
	const savings = results?.verdict.metrics?.estimated_savings ?? null;

	const routeSummary = results
		? `${results.origin} ${results.is_roundtrip ? "⇄" : "→"} ${results.destination}`
		: "";

	const showResultsArea = Boolean(searching || results || blocked);

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
						pay. No account needed.
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
							disabled={
								searching ||
								!origin ||
								!destination ||
								!departDate ||
								(tripType === "roundtrip" && !returnDate)
							}
							data-testid="landing-search-cta"
							className="mt-4 flex w-full items-center justify-center gap-2 rounded-mtw bg-mtw-emerald py-3 text-mtw-body font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{searching ? (
								<>
									<Loader2 className="h-5 w-5 animate-spin" /> Searching...
								</>
							) : (
								<>See the smartest way to pay</>
							)}
						</button>

						{searchError && (
							<div
								data-testid="landing-search-error"
								className="mt-3 rounded-mtw border border-red-200 bg-red-50 px-4 py-3 text-mtw-small text-red-700"
							>
								{searchError}
							</div>
						)}
					</div>

					<p className="mt-4 text-mtw-small text-white/85">
						Free to try. No sign-up. {PUBLIC_SEARCH_FREE_LIMIT}{" "}
						{pluralizeSearch()} on us.
					</p>
				</div>
			</section>

			{/* ---------------------------------------------------------------- */}
			{/* RESULTS AREA — guest verdict / loading / paywall block.          */}
			{/* ---------------------------------------------------------------- */}
			{showResultsArea ? (
				<section
					data-testid="landing-results"
					className="relative isolate overflow-hidden"
				>
					{/* ⓐ: the guest verdict floats on the ISLAND (not mint); the mint
					    sections below the hero are unchanged. */}
					<Image
						src="/hero-island.jpg"
						alt=""
						fill
						sizes="100vw"
						className="-z-10 object-cover object-center"
					/>
					<div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,20,14,0.55),rgba(6,20,14,0.30)_45%,rgba(6,20,14,0.55))]" />
					<div className="relative z-10 mx-auto max-w-2xl px-6 py-10">
					{/* N-of-3 top bar */}
					<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
						<p className="text-mtw-small font-medium text-white/85">
							{routeSummary}
						</p>
						<span
							data-testid="free-search-counter"
							className="rounded-mtw-pill border border-mtw-border bg-white px-3 py-1 text-mtw-label uppercase text-mtw-muted"
						>
							Search {Math.min(Math.max(searchesUsed, 1), PUBLIC_SEARCH_FREE_LIMIT)}{" "}
							of {PUBLIC_SEARCH_FREE_LIMIT} free
						</span>
					</div>

					{blocked ? (
						<div
							data-testid="paywall-block"
							className="rounded-mtw-lg border border-mtw-border bg-white p-6 text-center shadow-mtw-ambient"
						>
							<span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-mtw-emerald/10 text-mtw-emerald">
								<Wallet className="h-5 w-5" />
							</span>
							<h2 className="mt-4 text-mtw-headline text-mtw-ink">
								You&apos;ve used your {PUBLIC_SEARCH_FREE_LIMIT} free{" "}
								{pluralizeSearch()}.
							</h2>
							<p className="mx-auto mt-2 max-w-md text-mtw-small leading-6 text-mtw-muted">
								Create a free account to keep comparing trips, add your wallet,
								and get verdicts personalized to the cards you actually hold.
							</p>
							<div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
								<button
									type="button"
									onClick={() => handleAuthRoute("/signup")}
									className="rounded-mtw bg-mtw-emerald px-5 py-2.5 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
								>
									Create free account
								</button>
								<button
									type="button"
									onClick={() => handleAuthRoute("/login")}
									className="rounded-mtw border border-mtw-border px-5 py-2.5 text-mtw-small font-medium text-mtw-ink transition-colors hover:bg-mtw-surface"
								>
									Sign in
								</button>
							</div>
						</div>
					) : searching ? (
						<div className="mtw-light rounded-mtw-lg border border-mtw-border bg-white p-6 shadow-mtw-ambient">
							<SearchLoadingExperience
								origin={origin}
								destination={destination}
								cabin={cabin}
								travelers={Number(travelers)}
								isRoundtrip={tripType === "roundtrip"}
							/>
						</div>
					) : results?.verdict ? (
						<div
							data-testid="guest-verdict"
							className="rounded-mtw-lg border border-mtw-border bg-white p-6 shadow-mtw-ambient"
						>
							<CuratedOptions
								recommendation={recommendation}
								awardOptions={curatedAwards}
								winnerProgram={winnerProgram}
								cashPrice={cashPrice}
								matchedCpp={matchedCpp}
								savings={savings}
								ownership={guestOwnership(winnerProgram)}
								searchId={results.search_id ?? null}
								verdictId={results.verdict_id ?? null}
							/>
						</div>
					) : null}
					</div>
				</section>
			) : null}

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

			{/* Guest Zoe FAB — deterministic welcome (no auth-gated chat). */}
			<GuestZoeFab />
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
