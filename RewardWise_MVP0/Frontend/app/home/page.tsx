/** @format */
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletContext";
import { zoeNarration, zoeWelcome } from "@/utils/zoeNarration";
import type { Verdict as CanonicalVerdict, Ownership } from "@/types/verdict";
import { useSearchFill } from "@/context/SearchFillContext";
import { usePreferences } from "@/hooks/usePreferences";
import { useABTest } from "@/context/ABTestContext";
import VerdictCard from "@/components/VerdictCard";
import SearchLoadingExperience from "@/components/SearchLoadingExperience";
import AirportSearch from "@/components/AirportSearch";
import CashHorizonWarning from "@/components/CashHorizonWarning";
import ZoeChat from "@/components/zoe/ZoeChat";
import { trackAnalyticsEvent } from "@/utils/analytics/client";
import { buildSearchQueryParams } from "@/lib/searchQuery";
import { clampISODate, getMaxSearchDate } from "@/utils/dateInput";
import {
	Calendar,
	Plane,
	User,
	Search,
	Loader2,
	ArrowRight,
	ArrowLeftRight,
	Route,
	ChevronDown,
} from "lucide-react";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface FlightLeg {
	flight_number: string;
	airline: string;
	airline_logo: string;
	airplane: string;
	travel_class: string;
	legroom: string;
	duration: number;
	departure_airport: string;
	departure_iata: string;
	departure_time: string;
	arrival_airport: string;
	arrival_iata: string;
	arrival_time: string;
	extensions: string[];
	overnight: boolean;
	often_delayed: boolean;
}

interface CashFlight {
	price: number;
	total_duration: number;
	stops: number;
	departure_airport: string;
	departure_iata: string;
	departure_time: string;
	arrival_airport: string;
	arrival_iata: string;
	arrival_time: string;
	carbon_emissions: number | null;
	legs: FlightLeg[];
}

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
	/** Per-request ownership fork (PR 1/5). Typed here so the consistency-critical
	 *  `ownership.can_afford` path Zoe narrates from is checked, not blind-cast. */
	ownership?: Ownership | null;
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
	next_step?: {
		type: string;
		label: string;
		prompt: string;
	} | null;
}

interface SearchResult {
	search_id?: string | null;
	verdict_id?: string | null;
	origin: string;
	destination: string;
	date: string;
	depart_date_end?: string | null;
	winning_date?: string | null;
	cabin: string;
	travelers: number;
	is_roundtrip: boolean;
	return_date: string | null;
	return_date_end?: string | null;
	winning_return_date?: string | null;
	cash_price: number | null;
	price_level: string | null;
	typical_price_range: [number, number] | null;
	flights: CashFlight[];
	award_options: any[];
	return_award_options: any[];
	user_cards?: string[];
	verdict: Verdict;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const MIN_SEARCH_LOADING_MS = 5000;

// Compact brand label for the wallet pill (e.g. "Amex Membership Rewards" → "Amex").
function sleep(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatDuration(mins: number) {
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return `${h}h ${m}m`;
}

// ─── CASH FLIGHT CARD ─────────────────────────────────────────────────────────

function FlightCard({ flight }: { flight: CashFlight }) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="bg-gray-800/60 rounded-lg overflow-hidden border border-white/5">
			<button
				onClick={() => setExpanded(!expanded)}
				className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700/50 transition-colors"
			>
				{flight.legs[0]?.airline_logo && (
					<img
						src={flight.legs[0].airline_logo}
						alt={flight.legs[0].airline}
						className="w-7 h-7 object-contain flex-shrink-0"
					/>
				)}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5">
						<span className="text-white font-semibold text-sm">
							{flight.departure_iata}
						</span>
						<ArrowRight className="w-3 h-3 text-gray-600" />
						<span className="text-white font-semibold text-sm">
							{flight.arrival_iata}
						</span>
						<span className="text-gray-500 text-xs ml-1">
							{flight.departure_time?.slice(11, 16)} –{" "}
							{flight.arrival_time?.slice(11, 16)}
						</span>
					</div>
					<div className="flex items-center gap-1.5 mt-0.5">
						<span className="text-gray-500 text-xs">
							{formatDuration(flight.total_duration)}
						</span>
						<span className="text-gray-700">·</span>
						<span className="text-gray-500 text-xs">
							{flight.stops === 0
								? "Nonstop"
								: `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
						</span>
						<span className="text-gray-700">·</span>
						<span className="text-gray-500 text-xs">
							{flight.legs[0]?.airline}
						</span>
					</div>
				</div>
				<div className="text-right flex-shrink-0">
					<p className="text-white font-bold">${flight.price}</p>
					<p className="text-gray-600 text-xs">
						{expanded ? "▲ less" : "▼ details"}
					</p>
				</div>
			</button>
			{expanded && (
				<div className="border-t border-gray-700/50 px-4 pb-4 pt-3 space-y-3">
					{flight.legs.map((leg, i) => (
						<div key={i} className="flex gap-3">
							<div className="flex flex-col items-center">
								<div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
								{i < flight.legs.length - 1 && (
									<div className="w-px flex-1 bg-gray-700 my-1" />
								)}
							</div>
							<div className="flex-1 pb-2">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-white text-sm font-medium">
											{leg.departure_iata} → {leg.arrival_iata}
										</p>
										<p className="text-gray-500 text-xs">
											{leg.departure_time?.slice(11, 16)} –{" "}
											{leg.arrival_time?.slice(11, 16)}
											{" · "}
											{formatDuration(leg.duration)}
										</p>
									</div>
									<div className="text-right">
										<p className="text-gray-400 text-xs font-mono">
											{leg.flight_number}
										</p>
										<p className="text-gray-600 text-xs">{leg.airplane}</p>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function HomePage() {
	const router = useRouter();
	const { searchCount, setSearchCount, session } = useAuth();
	const { userPrograms, hasWallet } = useWallet();
	const { searchFill } = useSearchFill();
	const { searchDefaults: prefsDefaults, loaded: prefsLoaded } = usePreferences();
	useABTest();

	const [isChatOpen, setIsChatOpen] = useState(false);
	const [verdictContext, setVerdictContext] = useState<string | null>(null);

	const [origin, setOrigin] = useState("");
	const [destination, setDestination] = useState("");

	const swapOriginDestination = () => {
		setOrigin(destination);
		setDestination(origin);
	};
	const [departDate, setDepartDate] = useState("");
	const [returnDate, setReturnDate] = useState("");
	// Forward cap for the calendar pickers. Tracks the award-provider
	// (seats.aero) horizon, not the year 2099. Computed once per mount —
	// crossing the day boundary mid-session is fine; the picker still
	// limits to a date inside the provider window.
	const maxSearchDate = useMemo(() => getMaxSearchDate(), []);
	const [travelers, setTravelers] = useState(1);
	const [cabin, setCabin] = useState("economy");
	const [maxStops, setMaxStops] = useState<string>("any");
	const [tripType, setTripType] = useState("roundtrip");
	const [dateMode, setDateMode] = useState<"exact" | "flexible">("exact");
	// Slim pill: secondary fields (trip-type, date-mode, travelers, stops, cabin)
	// collapse here. Defaults unchanged; collapsed by default.
	const [showMore, setShowMore] = useState(false);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [results, setResults] = useState<SearchResult | null>(null);

	// ── Zoe trigger refs ──────────────────────────────────────────────────────
	// runSearchRef always points to the latest runSearch so handleTriggerSearch
	// (a stable useCallback) never has a stale closure over state.
	const runSearchRef = useRef<() => Promise<void>>(async () => {});
	// When Zoe triggers search it has already validated all fields on the backend,
	// so we skip frontend validation to avoid the stale-closure false-positive.
	const zoeTriggerRef = useRef(false);

	// PartialDataCard / ErrorStateCard "Try a different date" CTA bounces the
	// user back to the DEPART picker. Smooth-scroll first so the picker is
	// visible before focus moves; native focus alone can scroll abruptly.
	// iOS Safari + some Android Chrome builds open the native date picker
	// on focus and re-scroll, which fights smoothScroll — defer focus past
	// the scroll animation and pass preventScroll to defend against the
	// browser's own focus-scroll.
	const departInputRef = useRef<HTMLInputElement | null>(null);
	const handleTryDifferentDate = useCallback(() => {
		const el = departInputRef.current;
		if (!el) return;
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		window.setTimeout(() => el.focus({ preventScroll: true }), 250);
	}, []);

	const currentSearchAnalyticsPayload = (triggerSource: string) => ({
		search_origin: origin || null,
		search_destination: destination || null,
		search_depart_date: departDate || null,
		search_return_date: tripType === "roundtrip" ? returnDate || null : null,
		search_trip_type: tripType,
		search_cabin: cabin,
		search_travelers: travelers,
		search_trigger_source: triggerSource,
		metadata: {
			origin,
			destination,
			departDate,
			returnDate: tripType === "roundtrip" ? returnDate : null,
			tripType,
			cabin,
			travelers,
			hasWallet,
			userProgramCount: userPrograms?.length ?? 0,
		},
	});

	const handleAskZoeAboutVerdict = (context: string) => {
		// Reset to null first so the useEffect in ZoeChat always fires,
		// even if the same verdict is clicked twice.
		setVerdictContext(null);
		setTimeout(() => {
			setVerdictContext(context);
			setIsChatOpen(true);
		}, 0);
	};

	const handleFillSearch = (data: any) => {
		trackAnalyticsEvent("zoe_filled_search_form", {
			event_type: "zoe",
			metadata: { ...data },
		});
		if (data.origin) setOrigin(data.origin);
		if (data.destination) setDestination(data.destination);
		if (data.cabin) setCabin(data.cabin);
		if (data.travelers) setTravelers(data.travelers);
		if (data.date) setDepartDate(data.date);
		if (data.tripType) setTripType(data.tripType);
		if ("return_date" in data) setReturnDate(data.return_date || "");
	};

	// Stable reference — ZoeChat holds this without re-renders causing issues.
	// Always delegates to runSearchRef.current which is kept fresh below.
	const handleTriggerSearch = useCallback(() => {
		trackAnalyticsEvent("zoe_triggered_search", { event_type: "zoe" });
		zoeTriggerRef.current = true;
		runSearchRef.current();
	}, []);

	useEffect(() => {
		if (!searchFill) return;
		if (searchFill.origin) setOrigin(searchFill.origin);
		if (searchFill.destination) setDestination(searchFill.destination);
		if (searchFill.cabin) setCabin(searchFill.cabin);
		if (searchFill.travelers) setTravelers(Number(searchFill.travelers));
		if (searchFill.departDate) setDepartDate(searchFill.departDate);
		if ("returnDate" in searchFill) setReturnDate(searchFill.returnDate || "");
		if (searchFill.tripType) setTripType(searchFill.tripType);
	}, [searchFill]);

	// Seed the pill from saved Preferences ONCE, after they load — but only when
	// there's no explicit deep-link / Zoe fill (which always wins). Precedence:
	// searchFill/Zoe > saved prefs > hardcoded defaults.
	const prefsSeededRef = useRef(false);
	useEffect(() => {
		if (!prefsLoaded || prefsSeededRef.current) return;
		prefsSeededRef.current = true;
		const hasFill = Boolean(
			searchFill && (searchFill.cabin || searchFill.travelers || searchFill.tripType),
		);
		if (hasFill) return;
		setCabin(prefsDefaults.cabin);
		setTravelers(prefsDefaults.travelers);
		setTripType(prefsDefaults.trip_type);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [prefsLoaded, prefsDefaults, searchFill]);

	const runSearch = async () => {
		const isZoeTrigger = zoeTriggerRef.current;
		const triggerSource = isZoeTrigger ? "zoe" : "manual";
		const searchStartedAt = Date.now();
		zoeTriggerRef.current = false; // reset immediately

		trackAnalyticsEvent("search_started", {
			event_type: "search",
			...currentSearchAnalyticsPayload(triggerSource),
		});

		// Skip validation for Zoe-triggered searches — backend already confirmed
		// all fields are present. Skipping avoids the stale-closure false-positive
		// where returnDate looks empty even though it was just set.
		if (!isZoeTrigger) {
			if (!origin || !destination || !departDate) {
				const message = "Please fill in origin, destination, and departure date.";
				setSearchError(message);
				trackAnalyticsEvent("search_validation_failed", {
					event_type: "search",
					...currentSearchAnalyticsPayload(triggerSource),
					search_success: false,
					search_error_message: message,
					metadata: {
						...currentSearchAnalyticsPayload(triggerSource).metadata,
						missing_fields: [
							!origin ? "origin" : null,
							!destination ? "destination" : null,
							!departDate ? "departDate" : null,
						].filter(Boolean),
					},
				});
				return;
			}
			if (tripType === "roundtrip" && !returnDate) {
				const message = "Please select a return date for round trips.";
				setSearchError(message);
				trackAnalyticsEvent("search_validation_failed", {
					event_type: "search",
					...currentSearchAnalyticsPayload(triggerSource),
					search_success: false,
					search_error_message: message,
					metadata: { ...currentSearchAnalyticsPayload(triggerSource).metadata, missing_fields: ["returnDate"] },
				});
				return;
			}
		}

		setSearchError("");
		setResults(null);
		setSearching(true);
		setSearchCount(searchCount + 1);

		trackAnalyticsEvent("search_submitted", {
			event_type: "search",
			...currentSearchAnalyticsPayload(triggerSource),
		});

		try {
			const params = buildSearchQueryParams({
				origin,
				destination,
				departDate,
				dateMode: dateMode as "exact" | "flexible",
				returnDate,
				tripType,
				cabin,
				travelers,
				maxStops,
			});

			const API_URL = process.env.NEXT_PUBLIC_API_URL;
			if (!session?.access_token) {
				throw new Error("You must be logged in to run searches.");
			}

			const res = await fetch(`${API_URL}/api/search?${params.toString()}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
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
			const remainingLoadingMs = MIN_SEARCH_LOADING_MS - (Date.now() - searchStartedAt);
			if (remainingLoadingMs > 0) {
				await sleep(remainingLoadingMs);
			}
			setResults(data);
			trackAnalyticsEvent("search_completed", {
				event_type: "search",
				...currentSearchAnalyticsPayload(triggerSource),
				search_id: data.search_id || null,
				verdict_id: data.verdict_id || null,
				search_success: true,
				latency_ms: Date.now() - searchStartedAt,
				search_provider: "backend",
				verdict_recommendation: data.verdict?.recommendation || data.verdict?.verdict || null,
				verdict_confidence: data.verdict?.confidence || null,
				cash_price: data.cash_price || null,
				award_points: data.verdict?.winner?.points || data.verdict?.metrics?.points_cost || null,
				award_fees: data.verdict?.winner?.taxes || data.verdict?.metrics?.taxes || null,
				cents_per_point: data.verdict?.winner?.cpp || data.verdict?.metrics?.cpp || null,
				historical_price_label: data.price_level || null,
				metadata: {
					...currentSearchAnalyticsPayload(triggerSource).metadata,
					flight_count: data.flights?.length ?? 0,
					award_option_count: data.award_options?.length ?? 0,
					return_award_option_count: data.return_award_options?.length ?? 0,
					typical_price_range: data.typical_price_range || null,
					data_quality: data.verdict?.data_quality || null,
				},
			});
		} catch (err: any) {
			const message = err.message || "Something went wrong. Try again.";
			setSearchError(message);
			trackAnalyticsEvent("search_failed", {
				event_type: "search",
				...currentSearchAnalyticsPayload(triggerSource),
				search_success: false,
				search_error_message: message,
				latency_ms: Date.now() - searchStartedAt,
				error_message: message,
				metadata: { ...currentSearchAnalyticsPayload(triggerSource).metadata, error_name: err?.name || null },
			});
		} finally {
			setSearching(false);
		}
	};

	// Keep runSearchRef pointing at the latest runSearch on every render
	runSearchRef.current = runSearch;

	const numTravelers = results?.travelers ?? travelers;

	useEffect(() => {
		if (!results?.verdict) return;
		trackAnalyticsEvent("verdict_viewed", {
			event_type: "verdict",
			search_id: results.search_id || null,
			verdict_id: results.verdict_id || null,
			search_origin: results.origin,
			search_destination: results.destination,
			search_depart_date: results.date,
			search_return_date: results.return_date,
			search_trip_type: results.is_roundtrip ? "roundtrip" : "oneway",
			search_cabin: results.cabin,
			search_travelers: results.travelers,
			verdict_recommendation: results.verdict.recommendation || results.verdict.verdict,
			verdict_confidence: results.verdict.confidence,
			cash_price: results.cash_price,
			award_points: results.verdict.winner?.points || results.verdict.metrics?.points_cost || null,
			award_fees: results.verdict.winner?.taxes || results.verdict.metrics?.taxes || null,
			cents_per_point: results.verdict.winner?.cpp || results.verdict.metrics?.cpp || null,
			historical_price_label: results.price_level || null,
			metadata: {
				headline: results.verdict.headline || null,
				data_quality: results.verdict.data_quality || null,
				missing_sources: results.verdict.missing_sources || [],
			},
		});
	}, [results]);

	return (
		<div className="relative overflow-hidden">
			{/* TIER 1 — island entry band (island spec v2, ⓒ): header + search pill
			    (left) and the Zoe pane (right) sit ON the island; the verdict renders
			    LIGHT in TIER 2 below. */}
			<section className="relative isolate overflow-hidden">
				<Image
					src="/hero-island.jpg"
					alt=""
					fill
					priority
					sizes="100vw"
					className="-z-10 object-cover object-center"
				/>
				<div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,20,14,0.55),rgba(6,20,14,0.30)_45%,rgba(6,20,14,0.55))]" />
				<main className="relative z-10 max-w-6xl mx-auto px-6 py-6 lg:grid lg:grid-cols-[58fr_42fr] lg:gap-6 lg:items-start">
					{/* LEFT — entry. NOT mtw-light so the header stays white on the photo;
					    the search pill is wrapped in its own mtw-light below so its
					    hardcoded dark inputs still remap to light. */}
					<div className="font-mtw min-w-0">
					{/* HEADER */}
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-white mb-1">
							Let's optimize your wallet.
						</h1>
						<p className="text-white/80 text-sm">
							Search a route or ask Zoe — we'll find the best decision for your
							rewards.
						</p>
						{/* Wallet balances now live in the global nav pill (TopNav). */}
					</div>

					{/* SLIM SEARCH PILL — From / To / When visible; 5 secondary fields
					    collapse under "More options". Same inputs/handlers/defaults,
					    reorganized only. */}
					<div className="mtw-light">
					<div
						data-testid="search-pill"
						className="mb-4 rounded-2xl border border-mtw-border bg-white p-3 shadow-mtw-ambient sm:p-4"
					>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
							<AirportSearch label="FROM" value={origin} onChange={setOrigin} placeholder="City or airport" />
							<div className="flex justify-center sm:contents">
								<button
									type="button"
									aria-label="Swap origin and destination"
									onClick={swapOriginDestination}
									className="mb-1 self-end rounded-lg border border-gray-700 bg-gray-800 p-2 transition hover:border-emerald-500 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
								>
									<ArrowLeftRight className="h-4 w-4 text-emerald-400" />
								</button>
							</div>
							<AirportSearch label="TO" value={destination} onChange={setDestination} placeholder="City or airport" />
						</div>

						<div className={`mt-3 grid grid-cols-1 gap-3 ${tripType === "roundtrip" ? "sm:grid-cols-2" : ""}`}>
							<div>
								<label className="mb-1 flex items-center gap-1 text-xs text-mtw-muted">
									<Calendar className="h-3 w-3" />
									{dateMode === "flexible" ? "WHEN (±7 days)" : "WHEN"}
								</label>
								<input
									ref={departInputRef}
									type="date"
									min={new Date().toISOString().split("T")[0]}
									max={maxSearchDate}
									value={departDate}
									onChange={(e) => setDepartDate(clampISODate(e.target.value, departDate))}
									className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-500"
								/>
								<CashHorizonWarning date={departDate} />
							</div>
							{tripType === "roundtrip" && (
								<div>
									<label className="mb-1 flex items-center gap-1 text-xs text-mtw-muted">
										<Calendar className="h-3 w-3" /> RETURN
									</label>
									<input
										type="date"
										min={departDate || new Date().toISOString().split("T")[0]}
										max={maxSearchDate}
										value={returnDate}
										onChange={(e) => setReturnDate(clampISODate(e.target.value, returnDate))}
										className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-500"
									/>
									<CashHorizonWarning date={returnDate} />
								</div>
							)}
						</div>

						<button
							type="button"
							data-testid="more-options-toggle"
							onClick={() => setShowMore((v) => !v)}
							aria-expanded={showMore}
							aria-controls="search-more-options"
							className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-mtw-muted hover:text-mtw-ink"
						>
							More options
							<ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
						</button>

						{showMore && (
							<div id="search-more-options" role="region" aria-label="More search options" data-testid="more-options" className="mt-3 space-y-3 border-t border-mtw-border pt-3">
								<div className="flex gap-2">
									{(["roundtrip", "oneway"] as const).map((type) => (
										<button
											key={type}
											onClick={() => {
												setTripType(type);
												if (type === "oneway") setReturnDate("");
											}}
											className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
												tripType === type ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
											}`}
										>
											{type === "roundtrip" ? "Round Trip" : "One Way"}
										</button>
									))}
								</div>
								<div className="flex flex-wrap gap-3 text-xs text-gray-300">
									<label className="inline-flex cursor-pointer items-center gap-1.5">
										<input type="radio" name="dateMode" value="exact" checked={dateMode === "exact"} onChange={() => setDateMode("exact")} className="accent-emerald-500" />
										Exact date
									</label>
									<label className="inline-flex cursor-pointer items-center gap-1.5">
										<input type="radio" name="dateMode" value="flexible" checked={dateMode === "flexible"} onChange={() => setDateMode("flexible")} className="accent-emerald-500" />
										Flexible (±7 days)
									</label>
								</div>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
									<div>
										<label className="mb-1 flex items-center gap-1 text-xs text-mtw-muted"><User className="h-3 w-3" /> TRAVELERS</label>
										<select value={travelers} onChange={(e) => setTravelers(Number(e.target.value))} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
											{/* 1-9 to match the backend validator + saved Preferences default
											    (a saved 7-9 must have a matching option, not render blank). */}
											{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
												<option key={n} value={n}>
													{n} Traveler{n > 1 ? "s" : ""}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="mb-1 flex items-center gap-1 text-xs text-mtw-muted"><Route className="h-3 w-3" /> STOPS</label>
										<select value={maxStops} onChange={(e) => setMaxStops(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
											<option value="any">Any stops</option>
											<option value="nonstop">Nonstop only</option>
											<option value="one_or_fewer">1 stop or fewer</option>
											<option value="two_or_fewer">2 stops or fewer</option>
										</select>
									</div>
									<div>
										<label className="mb-1 flex items-center gap-1 text-xs text-mtw-muted"><Plane className="h-3 w-3" /> CABIN</label>
										<select value={cabin} onChange={(e) => setCabin(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
											<option value="economy">Economy</option>
											<option value="premium_economy">Premium Economy</option>
											<option value="business">Business</option>
											<option value="first">First</option>
										</select>
									</div>
								</div>
							</div>
						)}

						<button
							onClick={runSearch}
							disabled={searching}
							className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 font-semibold text-white transition-colors hover:bg-emerald-600 disabled:bg-gray-700"
						>
							{searching ? (
								<>
									<Loader2 className="h-5 w-5 animate-spin" /> Searching...
								</>
							) : (
								<>
									<Search className="h-5 w-5" /> Search Flights
								</>
							)}
						</button>
					</div>

					{searchError && (
						<p className="text-red-400 text-sm text-center mb-4">
							{searchError}
						</p>
					)}

					</div>{/* /search-pill mtw-light wrapper */}

					</div>{/* /LEFT COLUMN (entry) */}

					{/* RIGHT COLUMN (42%) — Zoe docked (kept dark; light restyle deferred) */}
					<div className="mt-4 lg:mt-0 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
						<ZoeChat
							isOpen={isChatOpen}
							setIsOpen={setIsChatOpen}
							onFillSearch={handleFillSearch}
							onAutoSearch={handleTriggerSearch}
							verdictContext={verdictContext}
							variant="docked"
							narration={
								results?.verdict
									? zoeNarration(
											results.verdict as unknown as CanonicalVerdict,
											results.verdict.ownership ?? null,
										)
									: null
							}
							welcome={zoeWelcome()}
						/>
					</div>
				</main>
			</section>

			{/* TIER 2 — light results, full width below the island band (ⓒ: the
			    verdict renders as a LIGHT card, not on the photo). */}
			{(searching || results) && (
				<section
					data-testid="home-results"
					className="mtw-light font-mtw mx-auto max-w-6xl px-6 pb-10"
				>
					<div className="mt-2 space-y-4">
						{searching ? (
							<SearchLoadingExperience
								origin={origin}
								destination={destination}
								cabin={cabin}
								travelers={travelers}
								isRoundtrip={tripType === "roundtrip"}
							/>
						) : results?.verdict ? (
							<VerdictCard
								theme="light"
								onAskZoe={handleAskZoeAboutVerdict}
								verdict={results.verdict}
								cashPrice={results.cash_price}
								origin={results.origin}
								destination={results.destination}
								departDate={results.date}
								departDateEnd={results.depart_date_end ?? null}
								winningDate={results.winning_date ?? null}
								returnDate={results.return_date}
								returnDateEnd={results.return_date_end ?? null}
								winningReturnDate={results.winning_return_date ?? null}
								cabin={results.cabin}
								travelers={numTravelers}
								isRoundtrip={results.is_roundtrip}
								awardOptions={results.award_options}
								returnAwardOptions={results.return_award_options}
								flights={results.flights}
								userPrograms={userPrograms}
								userCards={results.user_cards ?? []}
								verdictId={results.verdict_id}
								searchId={results.search_id}
								onTryDifferentDate={handleTryDifferentDate}
							/>
						) : !hasWallet ? (
							<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
								<p className="text-amber-400 text-sm font-semibold mb-1">
									No wallet set up yet
								</p>
								<p className="text-gray-400 text-xs mb-2">
									Add your loyalty programs to get a personalized verdict.
								</p>
								<button
									onClick={() => router.push("/wallet-setup")}
									className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
								>
									Set up wallet →
								</button>
							</div>
						) : null}
					</div>
				</section>
			)}
		</div>
	);
}
