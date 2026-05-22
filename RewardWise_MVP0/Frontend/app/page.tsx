/** @format */

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	ArrowRight,
	BarChart3,
	Calendar,
	Check,
	ChevronDown,
	CreditCard,
	Loader2,
	Plane,
	Search,
	Sparkles,
	User,
	Wallet,
	type LucideIcon,
} from "lucide-react";

import AirportSearch from "@/components/AirportSearch";
import NewsletterSignup from "@/components/NewsletterSignup";
import SearchLoadingExperience from "@/components/SearchLoadingExperience";
import VerdictCard from "@/components/VerdictCard";
import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";

import type { Cabin } from "@/utils/cabin";

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

type StoryStep = {
	label: string;
	title: string;
	description: string;
	icon: LucideIcon;
	chips: string[];
	panelTitle: string;
	panelDescription: string;
	accentColor: string;
	accentBg: string;
};

const FEATURE_CARDS = [
	{
		icon: Wallet,
		title: "Compare points vs cash",
		description:
			"See whether using points is actually a good deal before you book.",
	},
	{
		icon: CreditCard,
		title: "Bring your rewards together",
		description:
			"Track balances across programs and understand the value of your travel wallet.",
	},
	{
		icon: BarChart3,
		title: "Get one clear verdict",
		description:
			"MyTravelWallet cuts through the noise and tells you when to pay cash, use points, or wait.",
	},
];

const HOW_IT_WORKS = [
	{
		step: "01",
		title: "Tell us about your trip",
		description:
			"Start with a route, dates, cabin, and travelers so the app knows what to compare.",
	},
	{
		step: "02",
		title: "Add your rewards balances",
		description:
			"Bring in the loyalty programs you care about so verdicts reflect your actual wallet.",
	},
	{
		step: "03",
		title: "Book with confidence",
		description:
			"Get a clean recommendation and explanation instead of guessing if points are worth it.",
	},
];

const STORY_STEPS: StoryStep[] = [
	{
		label: "Your wallet",
		title: "Start with the rewards you already have",
		description:
			"Bring your real points and programs into one place so the recommendation actually reflects your wallet.",
		icon: Wallet,
		chips: ["Chase UR", "United", "Amex MR"],
		panelTitle: "Rewards in view",
		panelDescription:
			"Your balances and programs become the starting point instead of scattered tabs and guesswork.",
		accentColor: "text-emerald-300",
		accentBg: "bg-emerald-400/15 border-emerald-400/20",
	},
	{
		label: "Your trip",
		title: "Layer in the flight you want to take",
		description:
			"Add the route, dates, cabin, and travelers so MyTravelWallet knows exactly what it should compare.",
		icon: Search,
		chips: ["EWR → YHZ", "Jun 10–17", "Economy", "1 traveler"],
		panelTitle: "Trip details captured",
		panelDescription:
			"The search context narrows the analysis to the flight decision you actually care about.",
		accentColor: "text-sky-300",
		accentBg: "bg-sky-400/15 border-sky-400/20",
	},
	{
		label: "Our analysis",
		title: "We evaluate the stuff that really matters",
		description:
			"Cash price, award cost, point value, and timing get weighed together so you are not doing mental math alone.",
		icon: BarChart3,
		chips: ["Cash fares", "Award pricing", "Point value", "Timing"],
		panelTitle: "Decision engine running",
		panelDescription:
			"Instead of bouncing between programs and prices, the app condenses the tradeoffs into one analysis.",
		accentColor: "text-violet-300",
		accentBg: "bg-violet-400/15 border-violet-400/20",
	},
	{
		label: "Your verdict",
		title: "You get one clean booking recommendation",
		description:
			"Know whether to pay cash, use points, or wait — without opening 47 tabs to figure it out.",
		icon: Sparkles,
		chips: ["Pay Cash", "Use Points", "Wait"],
		panelTitle: "Clear verdict delivered",
		panelDescription:
			"The final answer is simple, calm, and built around your trip plus your rewards wallet.",
		accentColor: "text-amber-300",
		accentBg: "bg-amber-400/15 border-amber-400/20",
	},
];

// Total scroll height per step (px). Tune this to feel right.
const SCROLL_PER_STEP = 600;
const TOTAL_SCROLL = SCROLL_PER_STEP * STORY_STEPS.length;

function LandingPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const trySearchRef = useRef<HTMLDivElement | null>(null);

	// Refs for the scroll-driven story section
	const storyOuterRef = useRef<HTMLDivElement | null>(null);

	const { user, loading, signOut } = useAuth();
	const { setPendingSearch } = useSearchFill();

	const [origin, setOrigin] = useState("");
	const [destination, setDestination] = useState("");
	const [departDate, setDepartDate] = useState("");
	const [returnDate, setReturnDate] = useState("");
	const [cabin, setCabin] = useState<Cabin>("economy");
	const [travelers, setTravelers] = useState("1");
	const [tripType, setTripType] = useState<"roundtrip" | "oneway">("roundtrip");
	const [showTrySearch, setShowTrySearch] = useState(false);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [signingOutUnauthorized, setSigningOutUnauthorized] = useState(false);
	const [results, setResults] = useState<SearchResult | null>(null);

	// Scroll-driven story state
	const [storyProgress, setStoryProgress] = useState(0); // 0–1 across full section
	const [activeStoryIndex, setActiveStoryIndex] = useState(0);
	const [navVisible, setNavVisible] = useState(true);
	const lastScrollY = useRef(0);

	const accessDenied = searchParams.get("access") === "denied";

	// Auth redirect
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

	// Scroll to teaser search when revealed
	useEffect(() => {
		if (showTrySearch) {
			trySearchRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}
	}, [showTrySearch]);

	// Hide nav on scroll down, show on scroll up
	useEffect(() => {
		const handleNavScroll = () => {
			const currentY = window.scrollY;
			// Only hide after scrolled past 80px so it doesn't flicker at the top
			if (currentY < 80) {
				setNavVisible(true);
			} else if (currentY > lastScrollY.current + 6) {
				setNavVisible(false);
			} else if (currentY < lastScrollY.current - 4) {
				setNavVisible(true);
			}
			lastScrollY.current = currentY;
		};

		window.addEventListener("scroll", handleNavScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleNavScroll);
	}, []);

	// ---------------------------------------------------------------------------
	// Scroll-progress tracking for the story section.
	//
	// Strategy: the outer wrapper div has height = TOTAL_SCROLL + 100vh.
	// The inner sticky panel fills 100vh and stays pinned while you scroll
	// through the wrapper. We read scrollY relative to the wrapper top to get
	// progress. No wheel hijacking — fully passive, browser-native.
	// ---------------------------------------------------------------------------
	useEffect(() => {
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		const handleScroll = () => {
			const outer = storyOuterRef.current;
			if (!outer || window.innerWidth < 1024) return;

			const rect = outer.getBoundingClientRect();
			// How far we've scrolled into the outer wrapper (past its top edge)
			const scrolledIn = -rect.top;
			// The usable scroll range (wrapper height minus the 100vh sticky panel)
			const scrollRange = TOTAL_SCROLL;

			const raw = scrolledIn / scrollRange;
			const clamped = Math.max(0, Math.min(1, raw));

			if (prefersReducedMotion) {
				// Jump directly to the step without smooth animation
				const stepIndex = Math.min(
					STORY_STEPS.length - 1,
					Math.floor(clamped * STORY_STEPS.length),
				);
				setActiveStoryIndex(stepIndex);
				setStoryProgress(clamped);
				return;
			}

			setStoryProgress(clamped);

			// Map progress to step index, capped at last step
			const stepIndex = Math.min(
				STORY_STEPS.length - 1,
				Math.floor(clamped * STORY_STEPS.length),
			);
			setActiveStoryIndex(stepIndex);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

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

			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			if (!API_URL) {
				throw new Error("Missing NEXT_PUBLIC_API_URL.");
			}

			const res = await fetch(`${API_URL}/api/public-search?${params.toString()}`, {
				method: "POST",
			});

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
		} catch (err: any) {
			setSearchError(err.message || "Something went wrong. Try again.");
		} finally {
			setSearching(false);
		}
	};

	if (loading || signingOutUnauthorized) {
		return (
			<div className="relative min-h-screen overflow-hidden bg-[#07101E] text-white">
				<div
					className="absolute inset-0 bg-cover bg-center"
					style={{ backgroundImage: "url('/beach-hero.png')" }}
				/>
				<div className="absolute inset-0 bg-[rgba(6,14,26,0.72)]" />
				<div className="relative z-10 flex min-h-screen items-center justify-center px-6">
					<div className="flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white/85 backdrop-blur-xl">
						<Loader2 className="h-4 w-4 animate-spin" />
						{signingOutUnauthorized ? "Resetting access..." : "Loading..."}
					</div>
				</div>
			</div>
		);
	}

	const activeStory = STORY_STEPS[activeStoryIndex];
	const ActiveStoryIcon = activeStory.icon;

	// Progress within the current step (0–1), used for sub-step animations
	const stepProgress =
		(storyProgress * STORY_STEPS.length) % 1;

	return (
		<div className="relative min-h-screen bg-[#07101E] text-white">
			<div
				className="fixed inset-0 bg-cover bg-center"
				style={{ backgroundImage: "url('/beach-hero.png')" }}
			/>
			<div className="fixed inset-0 bg-[rgba(6,14,26,0.68)]" />
			<div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_26%)]" />

			<div className="relative z-10">
				{/* ------------------------------------------------------------------ */}
				{/* Header */}
				{/* ------------------------------------------------------------------ */}
				<header className={`sticky top-0 z-20 border-b border-white/8 bg-[rgba(7,16,30,0.42)] backdrop-blur-2xl transition-transform duration-300 ease-in-out ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
					<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
						<button
							onClick={() => router.push("/")}
							className="flex items-center gap-2"
						>
							<div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/12 bg-white/8 backdrop-blur-xl">
								<Plane className="h-4 w-4 text-white" />
							</div>
							<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
								MyTravelWallet
							</span>
						</button>

						<nav className="hidden items-center gap-8 md:flex">
							<button
								onClick={() =>
									storyOuterRef.current?.scrollIntoView({ behavior: "smooth" })
								}
								className="text-sm text-white/65 transition hover:text-white"
							>
								How it works
							</button>
							<button
								onClick={() => setShowTrySearch((prev) => !prev)}
								className="text-sm text-white/65 transition hover:text-white"
							>
								Try a search
							</button>
						</nav>

						<div className="flex items-center gap-2">
							<button
								onClick={() => handleAuthRoute("/login")}
								className="hidden rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex"
							>
								Sign in
							</button>
							<button
								onClick={() => handleAuthRoute("/signup")}
								className="inline-flex items-center gap-2 rounded-full bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#07101E] transition hover:bg-[#16A34A]"
							>
								Get started
								<ArrowRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</header>

				<main>
					{/* ---------------------------------------------------------------- */}
					{/* Hero */}
					{/* ---------------------------------------------------------------- */}
					<section className="mx-auto max-w-7xl px-6 pb-10 pt-6 sm:pt-10">
						{accessDenied ? (
							<div className="mb-8 max-w-3xl rounded-2xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50 backdrop-blur-xl">
								That account is not approved for access right now. Please use a
								permitted email or contact the team.
							</div>
						) : null}

						{/* Two-column hero on desktop */}
						<div className="grid items-center gap-12 lg:grid-cols-[1fr_400px]">
							{/* Left: copy */}
							<div>
								<div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80 backdrop-blur-xl">
									<Sparkles className="h-4 w-4 text-[#86EFAC]" />
									Know when to pay cash, use points, or wait.
								</div>

								<h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
									Travel smarter with the rewards you already have.
								</h1>

								<p className="mt-6 max-w-xl text-lg leading-8 text-white/70 sm:text-xl">
									MyTravelWallet compares points versus cash, helps you understand
									your rewards balances, and gives you one clean booking verdict
									before you commit.
								</p>

								<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
									<button
										onClick={() => handleAuthRoute("/signup")}
										className="inline-flex items-center justify-center gap-2 rounded-full bg-[#22C55E] px-6 py-3.5 text-sm font-semibold text-[#07101E] transition hover:bg-[#16A34A]"
									>
										Create your account
										<ArrowRight className="h-4 w-4" />
									</button>
									<button
										onClick={() => handleAuthRoute("/login")}
										className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/7 px-6 py-3.5 text-sm font-medium text-white/80 transition hover:bg-white/12 hover:text-white"
									>
										Sign in
									</button>
								</div>

								<button
									onClick={() => setShowTrySearch((prev) => !prev)}
									className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#86EFAC] transition hover:text-[#bbf7d0]"
								>
									<Search className="h-4 w-4" />
									Or try a search first — no signup needed
									<ChevronDown
										className={`h-4 w-4 transition-transform duration-300 ${showTrySearch ? "rotate-180" : ""}`}
									/>
								</button>
							</div>

							{/* Right: compact sample verdict card — desktop only */}
							<div className="hidden lg:flex lg:items-center lg:self-stretch">
								<div className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(7,16,30,0.56)] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.34)] backdrop-blur-3xl">
									<div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(134,239,172,0.14),transparent_68%)]" />
									<div className="pointer-events-none absolute -right-10 bottom-4 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" />

									<div className="relative flex items-center justify-between gap-3">
										<div>
											<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86EFAC]/75">
												Sample verdict
											</p>
											<h3 className="mt-1 text-lg font-semibold tracking-tight text-white">EWR → YHZ</h3>
											<p className="mt-0.5 text-xs text-white/42">Business · 1 traveler</p>
										</div>
										<span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
											Use Points
										</span>
									</div>

									<div className="relative mt-5 rounded-3xl border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(255,255,255,0.04))] p-4">
										<div className="flex items-end justify-between gap-4">
											<div>
												<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/70">Best move</p>
												<p className="mt-1 text-2xl font-bold tracking-tight text-white">Use points</p>
											</div>
											<div className="text-right">
												<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Value</p>
												<p className="mt-1 text-2xl font-bold text-emerald-200">4.9¢</p>
											</div>
										</div>
										<p className="mt-3 text-sm leading-6 text-white/62">
											The cash fare is high enough that this redemption is worth saving your money for.
										</p>
									</div>

									<div className="relative mt-4 grid grid-cols-2 gap-3">
										<div className="rounded-2xl border border-white/8 bg-white/[0.045] p-3">
											<p className="text-[10px] uppercase tracking-[0.12em] text-white/36">Cash fare</p>
											<p className="mt-1 text-lg font-semibold text-white">$3,240</p>
										</div>
										<div className="rounded-2xl border border-white/8 bg-white/[0.045] p-3">
											<p className="text-[10px] uppercase tracking-[0.12em] text-white/36">Award</p>
											<p className="mt-1 text-lg font-semibold text-white">65k pts</p>
										</div>
									</div>

									<div className="relative mt-4 flex flex-wrap gap-2">
										{/* {["Chase UR", "United", "Amex MR"].map((program) => (
											<span
												key={program}
												className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/55"
											>
												{program}
											</span>
										))} */}
									</div>

									<div className="relative mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
										<div className="flex items-center justify-between gap-3 text-xs">
											<span className="text-white/38">your wallet</span>
											<span className="h-px flex-1 bg-white/8" />
											<span className="text-white/38">your trip</span>
											<span className="h-px flex-1 bg-white/8" />
											<span className="font-medium text-[#86EFAC]/80">one verdict</span>
										</div>
									</div>
								</div>
							</div>
						</div>
						{/* One-time public search form */}
						{(showTrySearch || searching || results || searchError) ? (
							<div
								ref={trySearchRef}
								className="mt-10 overflow-hidden rounded-[32px] border border-white/12 bg-[rgba(7,16,30,0.72)] shadow-2xl shadow-black/30 backdrop-blur-2xl"
							>
								<div className="border-b border-white/8 px-6 py-5 sm:px-8">
									<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86EFAC]/90">
										One free search
									</p>
									<h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
										Try the same search flow before signing up
									</h3>
									<p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
										Use the full route/date/cabin flow once for free. After that,
										create an account to keep comparing trips.
									</p>
								</div>

								<div className="p-6 sm:p-8">
									{!searching && !results ? (
										<>
											<div className="mb-4 flex gap-2">
												{(["roundtrip", "oneway"] as const).map((type) => (
													<button
														key={type}
														type="button"
														onClick={() => {
															setTripType(type);
															if (type === "oneway") setReturnDate("");
														}}
														className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
															tripType === type
																? "bg-emerald-500 text-white"
																: "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white"
														}`}
													>
														{type === "roundtrip" ? "Round Trip" : "One Way"}
													</button>
												))}
											</div>

											<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
												<AirportSearch
													label="FROM"
													value={origin}
													onChange={setOrigin}
													placeholder="City or airport"
												/>
												<AirportSearch
													label="TO"
													value={destination}
													onChange={setDestination}
													placeholder="City or airport"
												/>
												<div>
													<label className="mb-1 flex items-center gap-1 text-xs text-emerald-400">
														<Calendar className="h-3 w-3" /> DEPART
													</label>
													<input
														type="date"
														min={new Date().toISOString().split("T")[0]}
														value={departDate}
														onChange={(event) => setDepartDate(event.target.value)}
														className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-500"
													/>
												</div>
											</div>

											<div
												className={`mt-3 grid grid-cols-1 gap-3 ${
													tripType === "roundtrip" ? "sm:grid-cols-3" : "sm:grid-cols-2"
												}`}
											>
												{tripType === "roundtrip" && (
													<div>
														<label className="mb-1 flex items-center gap-1 text-xs text-emerald-400">
															<Calendar className="h-3 w-3" /> RETURN
														</label>
														<input
															type="date"
															min={departDate || new Date().toISOString().split("T")[0]}
															value={returnDate}
															onChange={(event) => setReturnDate(event.target.value)}
															className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-500"
														/>
													</div>
												)}
												<div>
													<label className="mb-1 flex items-center gap-1 text-xs text-emerald-400">
														<User className="h-3 w-3" /> TRAVELERS
													</label>
													<select
														value={travelers}
														onChange={(event) => setTravelers(event.target.value)}
														className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
													>
														{[1, 2, 3, 4, 5, 6].map((n) => (
															<option key={n} value={n}>
																{n} Traveler{n > 1 ? "s" : ""}
															</option>
														))}
													</select>
												</div>
												<div>
													<label className="mb-1 flex items-center gap-1 text-xs text-emerald-400">
														<Plane className="h-3 w-3" /> CABIN
													</label>
													<select
														value={cabin}
														onChange={(event) => setCabin(event.target.value as Cabin)}
														className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
													>
														<option value="economy">Economy</option>
														<option value="business">Business</option>
														<option value="first">First</option>
													</select>
												</div>
											</div>

											<button
												onClick={handleSearch}
												disabled={
													searching ||
													!origin ||
													!destination ||
													!departDate ||
													(tripType === "roundtrip" && !returnDate)
												}
												className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 font-semibold text-white transition-colors hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-white/40"
											>
												<Search className="h-5 w-5" /> Search Flights
											</button>

											{searchError && (
												<div className="mt-4 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
													{searchError}
												</div>
											)}
										</>
									) : null}

									{searching ? (
										<SearchLoadingExperience
											origin={origin}
											destination={destination}
											cabin={cabin}
											travelers={Number(travelers)}
											isRoundtrip={tripType === "roundtrip"}
										/>
									) : null}

									{results?.verdict ? (
										<div className="space-y-5">
											<VerdictCard
												verdict={results.verdict}
												cashPrice={results.cash_price}
												origin={results.origin}
												destination={results.destination}
												departDate={results.date}
												returnDate={results.return_date}
												cabin={results.cabin}
												travelers={results.travelers}
												isRoundtrip={results.is_roundtrip}
												awardOptions={results.award_options}
												returnAwardOptions={results.return_award_options}
												flights={results.flights}
												userPrograms={[]}
												verdictId={results.verdict_id}
												publicPreview
												onPublicPreviewSignup={() => {
													if (origin || destination || departDate) savePendingSearch();
													router.push("/signup?utm_source=landing-verdict");
												}}
												onPublicPreviewSignin={() => handleAuthRoute("/login")}
											/>

										</div>
									) : null}
								</div>
							</div>
						) : null}

					</section>

					{/* ---------------------------------------------------------------- */}
					{/* Scroll-driven product flow — DESKTOP ONLY                        */}
					{/*                                                                  */}
					{/* How this works:                                                  */}
					{/* • storyOuterRef div has height = TOTAL_SCROLL + 100vh.           */}
					{/*   That extra height IS the scroll budget. As the user scrolls    */}
					{/*   through those px, the sticky inner panel stays pinned.         */}
					{/* • We read getBoundingClientRect().top each scroll event and      */}
					{/*   map it to 0–1 progress. Fully passive — no wheel hijacking.   */}
					{/* • CSS transitions on opacity/transform drive the visual.         */}
					{/* ---------------------------------------------------------------- */}
					<div
						ref={storyOuterRef}
						className="relative hidden lg:block"
						style={{ height: `calc(${TOTAL_SCROLL}px + 100vh)` }}
						aria-label="Product flow"
					>
						{/* Sticky panel — stays in the viewport while you scroll the outer */}
						<div className="sticky top-0 h-screen">
							<div className="mx-auto flex h-full max-w-7xl flex-col justify-center px-6">

								{/* Section header */}
								<div className="mb-10">
									<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86EFAC]/90">
										Scroll through the product flow
									</p>
									<h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">
										From rewards to verdict — in four steps.
									</h2>
								</div>

								<div className="grid grid-cols-[0.9fr_1.1fr] items-start gap-12">
									{/* ---- Left: step list ---- */}
									<div className="space-y-4">
										{STORY_STEPS.map((step, index) => {
											const Icon = step.icon;
											const isActive = index === activeStoryIndex;
											const isPast = index < activeStoryIndex;

											return (
												<div
													key={step.label}
													className={`rounded-[24px] border px-5 py-4 backdrop-blur-xl transition-all duration-500 ease-out ${
														isActive
															? "border-white/16 bg-white/10 shadow-xl shadow-black/20"
															: isPast
																? "border-white/8 bg-white/[0.035] opacity-70"
																: "border-white/6 bg-white/[0.02] opacity-40"
													}`}
												>
													<div className="flex items-start gap-4">
														<div
															className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
																isActive
																	? `${step.accentBg} border`
																	: isPast
																		? "border border-white/10 bg-white/6 text-white/50"
																		: "border border-white/8 bg-white/4 text-white/30"
															}`}
														>
															<Icon
																className={`h-4 w-4 transition-colors duration-500 ${
																	isActive ? step.accentColor : ""
																}`}
															/>
														</div>
														<div>
															<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
																{step.label}
															</p>
															<h3
																className={`mt-0.5 text-lg font-semibold transition-colors duration-500 ${isActive ? "text-white" : "text-white/60"}`}
															>
																{step.title}
															</h3>
															{isActive && (
																<p className="mt-2 text-sm leading-6 text-white/60">
																	{step.description}
																</p>
															)}
														</div>
													</div>

													{/* Chips */}
													{isActive && (
														<div className="mt-4 flex flex-wrap gap-2 pl-[52px]">
															{step.chips.map((chip, i) => (
																<span
																	key={chip}
																	className={`rounded-full border px-3 py-1 text-xs font-medium text-white/75 transition-all duration-300 ${step.accentBg}`}
																	style={{
																		transitionDelay: `${i * 60}ms`,
																	}}
																>
																	{chip}
																</span>
															))}
														</div>
													)}
												</div>
											);
										})}

										{/* Step progress dots */}
										<div className="flex items-center gap-2 pl-2 pt-1">
											{STORY_STEPS.map((_, i) => (
												<div
													key={i}
													className={`rounded-full transition-all duration-500 ${
														i < activeStoryIndex
															? "h-1.5 w-4 bg-emerald-400/60"
															: i === activeStoryIndex
																? "h-1.5 w-8 bg-emerald-400"
																: "h-1.5 w-1.5 bg-white/20"
													}`}
												/>
											))}
										</div>
									</div>

									{/* ---- Right: glassmorphism panel ---- */}
									<div className="relative">
										<div className="relative overflow-hidden rounded-[32px] border border-white/12 bg-[rgba(7,16,30,0.74)] p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl">
											{/* Ambient glow that shifts per step */}
											<div
												className="pointer-events-none absolute inset-x-0 top-0 h-48 transition-all duration-700"
												style={{
													background:
														activeStoryIndex === 0
															? "radial-gradient(circle at top, rgba(134,239,172,0.18), transparent 65%)"
															: activeStoryIndex === 1
																? "radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 65%)"
																: activeStoryIndex === 2
																	? "radial-gradient(circle at top, rgba(167,139,250,0.18), transparent 65%)"
																	: "radial-gradient(circle at top, rgba(251,191,36,0.18), transparent 65%)",
												}}
											/>

											{/* Panel header */}
											<div className="relative mb-6 flex items-start justify-between">
												<div>
													<p
														className={`text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-500 ${activeStory.accentColor}`}
													>
														Live flow preview
													</p>
													<h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
														{activeStory.panelTitle}
													</h3>
												</div>
												<div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/50">
													{activeStoryIndex + 1} / {STORY_STEPS.length}
												</div>
											</div>

											{/* Active step detail card */}
											<div
												key={activeStoryIndex}
												className="relative rounded-[24px] border border-white/10 bg-white/6 p-5"
												style={{
													animation: "fadeSlideIn 0.4s ease-out both",
												}}
											>
												<div className="flex items-start gap-4">
													<div
														className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${activeStory.accentBg}`}
													>
														<ActiveStoryIcon
															className={`h-4 w-4 ${activeStory.accentColor}`}
														/>
													</div>
													<div className="min-w-0">
														<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
															{activeStory.label}
														</p>
														<h4 className="mt-0.5 text-lg font-semibold text-white">
															{activeStory.title}
														</h4>
														<p className="mt-2 text-sm leading-6 text-white/62">
															{activeStory.panelDescription}
														</p>
													</div>
												</div>
												<div className="mt-4 flex flex-wrap gap-2">
													{activeStory.chips.map((chip) => (
														<span
															key={chip}
															className={`rounded-full border px-3 py-1 text-xs font-medium ${activeStory.accentBg} text-white/80`}
														>
															{chip}
														</span>
													))}
												</div>
											</div>

											{/* Progress pipeline — 3 mini cards showing wallet / trip / analysis */}
											<div className="relative mt-5 grid grid-cols-3 gap-3">
												{[
													{ label: "Wallet", color: "emerald" },
													{ label: "Trip", color: "sky" },
													{ label: "Analysis", color: "violet" },
												].map(({ label, color }, i) => {
													const isLit = activeStoryIndex >= i;
													return (
														<div
															key={label}
															className={`rounded-2xl border p-4 transition-all duration-500 ${
																isLit
																	? color === "emerald"
																		? "border-emerald-300/18 bg-emerald-300/10"
																		: color === "sky"
																			? "border-sky-300/18 bg-sky-300/10"
																			: "border-violet-300/18 bg-violet-300/10"
																	: "border-white/8 bg-white/4"
															}`}
														>
															<p className="text-[10px] uppercase tracking-[0.14em] text-white/42">
																{label}
															</p>
															<div
																className={`mt-2 h-1.5 w-full rounded-full bg-white/10 transition-all duration-700 delay-100`}
															>
																<div
																	className={`h-full rounded-full transition-all duration-700 ${
																		isLit
																			? color === "emerald"
																				? "bg-emerald-400"
																				: color === "sky"
																					? "bg-sky-400"
																					: "bg-violet-400"
																			: "w-0"
																	}`}
																	style={{ width: isLit ? "100%" : "0%" }}
																/>
															</div>
														</div>
													);
												})}
											</div>

											{/* Final verdict row — lights up on last step */}
											<div
												className={`mt-4 rounded-[22px] border p-5 transition-all duration-700 ${
													activeStoryIndex === STORY_STEPS.length - 1
														? "border-amber-300/20 bg-[linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))] shadow-[0_0_40px_rgba(251,191,36,0.07)]"
														: "border-white/8 bg-white/4"
												}`}
											>
												<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
													Final outcome
												</p>
												<p
													className={`mt-1.5 text-xl font-semibold transition-all duration-500 ${
														activeStoryIndex === STORY_STEPS.length - 1
															? "text-white"
															: "text-white/35"
													}`}
												>
													Pay Cash · Use Points · Wait
												</p>
												<p className="mt-1.5 text-sm leading-5 text-white/50">
													One clean recommendation, built around your wallet.
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* ---------------------------------------------------------------- */}
					{/* Mobile: stacked product flow (no scroll locking)                 */}
					{/* ---------------------------------------------------------------- */}
					<section className="mx-auto max-w-7xl px-6 py-10 lg:hidden">
						<div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,30,0.58)] p-6 backdrop-blur-2xl">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86EFAC]/90">
								Product flow
							</p>
							<h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
								How it all comes together.
							</h2>
							<div className="mt-6 space-y-4">
								{STORY_STEPS.map((step) => {
									const Icon = step.icon;
									return (
										<div
											key={step.label}
											className="rounded-[24px] border border-white/10 bg-white/6 p-5"
										>
											<div className="flex items-start gap-4">
												<div
													className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${step.accentBg}`}
												>
													<Icon className={`h-4 w-4 ${step.accentColor}`} />
												</div>
												<div>
													<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
														{step.label}
													</p>
													<h3 className="mt-0.5 text-lg font-semibold text-white">
														{step.title}
													</h3>
													<p className="mt-2 text-sm leading-6 text-white/62">
														{step.description}
													</p>
													<div className="mt-3 flex flex-wrap gap-2">
														{step.chips.map((chip) => (
															<span
																key={chip}
																className={`rounded-full border px-2.5 py-1 text-[11px] font-medium text-white/72 ${step.accentBg}`}
															>
																{chip}
															</span>
														))}
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</section>

					{/* ---------------------------------------------------------------- */}
					{/* Why MyTravelWallet */}
					{/* ---------------------------------------------------------------- */}
					<section className="mx-auto max-w-7xl px-6 py-16">
						<div className="mx-auto max-w-3xl text-center">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#86EFAC]/90">
								Why MyTravelWallet
							</p>
							<h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
								Designed to make travel rewards actually useful.
							</h2>
							<p className="mt-4 text-base leading-7 text-white/65">
								Instead of juggling award charts, transfer partners, and cash
								prices on your own, you get a calmer, cleaner decision experience.
							</p>
						</div>
						<div className="mt-10 grid gap-5 lg:grid-cols-3">
							{FEATURE_CARDS.map(({ icon: Icon, title, description }) => (
								<div
									key={title}
									className="rounded-[28px] border border-white/10 bg-[rgba(7,16,30,0.55)] p-6 backdrop-blur-xl"
								>
									<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-[#86EFAC]">
										<Icon className="h-5 w-5" />
									</div>
									<h3 className="mt-5 text-xl font-semibold text-white">
										{title}
									</h3>
									<p className="mt-3 text-sm leading-6 text-white/62">
										{description}
									</p>
								</div>
							))}
						</div>
					</section>

					<NewsletterSignup />
				</main>

				{/* ------------------------------------------------------------------ */}
				{/* Footer */}
				{/* ------------------------------------------------------------------ */}
				<footer className="border-t border-white/8 bg-[rgba(7,16,30,0.35)]">
					<div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-white/48 sm:flex-row sm:items-center sm:justify-between">
						<p>© 2026 MyTravelWallet. One verdict, not 47 tabs.</p>
						<div className="flex items-center gap-5">
							<button
								onClick={() => router.push("/about")}
								className="transition hover:text-white/80"
							>
								About
							</button>
							<button
								onClick={() => handleAuthRoute("/login")}
								className="transition hover:text-white/80"
							>
								Sign in
							</button>
						</div>
					</div>
				</footer>
			</div>

			{/* Global keyframe for step card entrance */}
			<style>{`
				@keyframes fadeSlideIn {
					from {
						opacity: 0;
						transform: translateY(10px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				@media (prefers-reduced-motion: reduce) {
					* {
						animation-duration: 0.01ms !important;
						transition-duration: 0.01ms !important;
					}
				}
			`}</style>
		</div>
	);
}

function LandingPageFallback() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07101E] text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/beach-hero.png')" }}
      />
      <div className="absolute inset-0 bg-[rgba(6,14,26,0.72)]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white/85 backdrop-blur-xl">
          Loading MyTravelWallet...
        </div>
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
