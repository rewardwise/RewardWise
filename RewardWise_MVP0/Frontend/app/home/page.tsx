/** @format */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletContext";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";
import VerdictCard, { VerdictCardSkeleton } from "@/components/VerdictCard";
import AirportSearch from "@/components/AirportSearch";
import ZoeChat from "@/components/zoe/ZoeChat";
import { createClient } from "@/utils/supabase/client";
import type { Message } from "@/components/zoe/ZoeChat";
import {
	Calendar,
	Plane,
	User,
	Search,
	Loader2,
	ArrowRight,
} from "lucide-react";


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

const supabase = createClient();

interface SearchResult {
	search_id?: string | null;
	verdict_id?: string | null;
	origin: string;
	destination: string;
	date: string;
	cabin: string;
	travelers: number;
	is_roundtrip: boolean;
	return_date: string | null;
	cash_price: number | null;
	price_level: string | null;
	typical_price_range: [number, number] | null;
	flights: CashFlight[];
	award_options: any[];
	return_award_options: any[];
	verdict: Verdict;
}


function formatDuration(mins: number) {
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return `${h}h ${m}m`;
}


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


export default function HomePage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { searchCount, setSearchCount, session, subscription, user } = useAuth();
	const { userPrograms, hasWallet } = useWallet();
	const { searchFill } = useSearchFill();
	useABTest();

	const [isChatOpen, setIsChatOpen] = useState(false);
	const [chatMessages, setChatMessages] = useState<Message[]>([]);

	const [origin, setOrigin] = useState("");
	const [destination, setDestination] = useState("");
	const [departDate, setDepartDate] = useState("");
	const [returnDate, setReturnDate] = useState("");
	const [travelers, setTravelers] = useState(1);
	const [cabin, setCabin] = useState("economy");
	const [tripType, setTripType] = useState("roundtrip");
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [results, setResults] = useState<SearchResult | null>(null);
	const [hasDayPassAccess, setHasDayPassAccess] = useState(false);

	const checkout = searchParams.get("checkout");
	const isDayPassSuccess =
		checkout === "pass_success" ||
		(checkout === "success" && Boolean(searchParams.get("for_search")));

	useEffect(() => {
		if (!user?.id) return;
		void supabase
			.from("profiles")
			.select("day_pass_expires_at")
			.eq("user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				const expiry = data?.day_pass_expires_at
					? new Date(data.day_pass_expires_at).getTime()
					: 0;
				setHasDayPassAccess(expiry > Date.now());
			});
	}, [user?.id]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const p = new URLSearchParams(window.location.search);
		const sessionId = p.get("session_id");

		const confirmDayPassFromStripe = async () => {
			if (!sessionId || !user?.id) return;
			try {
				await fetch("/api/payments/confirm-day-pass", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sessionId }),
				});
			} catch {}
		};

		if (p.get("checkout") === "pass_success") {
			void (async () => {
				await confirmDayPassFromStripe();
				if (user?.id) {
					const { data } = await supabase
						.from("profiles")
						.select("day_pass_expires_at")
						.eq("user_id", user.id)
						.maybeSingle();
					const expiry = data?.day_pass_expires_at
						? new Date(data.day_pass_expires_at).getTime()
						: 0;
					setHasDayPassAccess(expiry > Date.now());
				}
				router.replace("/home");
			})();
			return;
		}
		if (p.get("checkout") !== "success" || !p.get("for_search")) return;
		const forSearch = p.get("for_search")!;

		const fromSession = sessionStorage.getItem("zoe_last_search_result");
		if (fromSession) {
			try {
				const parsed = JSON.parse(fromSession) as SearchResult;
				if (parsed.search_id === forSearch) {
					void (async () => {
						await confirmDayPassFromStripe();
						setResults(parsed);
						sessionStorage.removeItem("zoe_last_search_result");
						router.replace("/home");
					})();
					return;
				}
			} catch {}
		}

		let cancelled = false;
		(async () => {
			await confirmDayPassFromStripe();
			const { data: verdictRow } = await supabase
				.from("verdicts")
				.select("id, details, cash_price_used")
				.eq("search_id", forSearch)
				.maybeSingle();
			const { data: searchRow } = await supabase
				.from("searches")
				.select(
					"id, origin, destination, departure_date, return_date, passengers, cabin, trip_type",
				)
				.eq("id", forSearch)
				.maybeSingle();
			if (cancelled || !verdictRow?.details || !searchRow) return;
			const verdictDetails = verdictRow.details as Verdict;
			setResults({
				search_id: searchRow.id,
				verdict_id: verdictRow.id,
				origin: searchRow.origin,
				destination: searchRow.destination,
				date: searchRow.departure_date,
				return_date: searchRow.return_date,
				cabin: searchRow.cabin ?? "economy",
				travelers: searchRow.passengers ?? 1,
				is_roundtrip: searchRow.trip_type === "roundtrip",
				cash_price:
					verdictRow.cash_price_used ??
					verdictDetails.metrics?.cash_price ??
					null,
				price_level: null,
				typical_price_range: null,
				flights: [],
				award_options: [],
				return_award_options: [],
				verdict: verdictDetails,
			});
			router.replace("/home");
		})();

		return () => {
			cancelled = true;
		};
	}, [router, user?.id, supabase]);

	useEffect(() => {
		if (subscription === "pro") return;
		if (!user?.id) return;
		void supabase
			.from("profiles")
			.select("day_pass_expires_at")
			.eq("user_id", user.id)
			.maybeSingle()
			.then(({ data }) => {
				const expiry = data?.day_pass_expires_at
					? new Date(data.day_pass_expires_at).getTime()
					: 0;
				setHasDayPassAccess(expiry > Date.now());
			});
	}, [subscription, user?.id, results?.search_id]);

	useEffect(() => {
		if (!results?.verdict || !user?.id) return;
		if (subscription === "pro" || hasDayPassAccess) return;
		try {
			sessionStorage.setItem(
				"zoe_last_search_result",
				JSON.stringify(results),
			);
		} catch {
			/* ignore quota / private mode */
		}
		const q = new URLSearchParams();
		q.set("from", "home");
		if (results.search_id) {
			q.set("search_id", results.search_id);
		}
		router.replace(`/subscribe?${q.toString()}`);
	}, [results, subscription, hasDayPassAccess, user?.id, router]);

	const runSearchRef = useRef<() => Promise<void>>(async () => {});
	const zoeTriggerRef = useRef(false);

	const handleFillSearch = (data: any) => {
		if (data.origin) setOrigin(data.origin);
		if (data.destination) setDestination(data.destination);
		if (data.cabin) setCabin(data.cabin);
		if (data.travelers) setTravelers(data.travelers);
		if (data.date) setDepartDate(data.date);
		if (data.tripType) setTripType(data.tripType);
		if ("return_date" in data) setReturnDate(data.return_date || "");
	};

	const handleTriggerSearch = useCallback(() => {
		zoeTriggerRef.current = true;
		runSearchRef.current();
	}, []);

	useEffect(() => {
		if (!searchFill) return;
		if (searchFill.origin) setOrigin(searchFill.origin);
		if (searchFill.destination) setDestination(searchFill.destination);
		if (searchFill.cabin) setCabin(searchFill.cabin);
		if (searchFill.travelers) setTravelers(Number(searchFill.travelers));
	}, [searchFill]);

	const runSearch = async () => {
		const isZoeTrigger = zoeTriggerRef.current;
		zoeTriggerRef.current = false;
		if (!isZoeTrigger) {
			if (!origin || !destination || !departDate) {
				setSearchError(
					"Please fill in origin, destination, and departure date.",
				);
				return;
			}
			if (tripType === "roundtrip" && !returnDate) {
				setSearchError("Please select a return date for round trips.");
				return;
			}
		}

		setSearchError("");
		setResults(null);
		setSearching(true);
		setSearchCount(searchCount + 1);

		try {
			const params = new URLSearchParams({
				origin,
				destination,
				date: departDate,
				cabin,
				travelers: travelers.toString(),
			});
			if (tripType === "roundtrip" && returnDate) {
				params.append("return_date", returnDate);
			}

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

			setResults(await res.json());
		} catch (err: any) {
			setSearchError(err.message || "Something went wrong. Try again.");
		} finally {
			setSearching(false);
		}
	};

	runSearchRef.current = runSearch;

	const numTravelers = results?.travelers ?? travelers;

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10">
				<main className="max-w-5xl mx-auto px-6 py-6">
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-white mb-1">
							Let's optimize your wallet.
						</h1>
						<p className="text-gray-400 text-sm">
							Search a route or ask Zoe - we'll find the best decision for your
							rewards.
						</p>
						{isDayPassSuccess && hasDayPassAccess && (
							<div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 max-w-xl">
								<p className="font-semibold text-emerald-200">
									Day pass activated
								</p>
								<p className="mt-1 text-emerald-100/90">
									You now have access to Verdict Search and Zoe.
								</p>
							</div>
						)}
					</div>

					<div className="flex gap-2 mb-3">
						{(["roundtrip", "oneway"] as const).map((type) => (
							<button
								key={type}
								onClick={() => {
									setTripType(type);
									if (type === "oneway") setReturnDate("");
								}}
								className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
									tripType === type
										? "bg-emerald-500 text-white"
										: "bg-gray-800 text-gray-400 hover:bg-gray-700"
								}`}
							>
								{type === "roundtrip" ? "Round Trip" : "One Way"}
							</button>
						))}
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
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
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<Calendar className="w-3 h-3" /> DEPART
							</label>
							<input
								type="date"
								min={new Date().toISOString().split("T")[0]}
								value={departDate}
								onChange={(e) => setDepartDate(e.target.value)}
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
						{tripType === "roundtrip" ? (
							<div>
								<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
									<Calendar className="w-3 h-3" /> RETURN
								</label>
								<input
									type="date"
									min={departDate || new Date().toISOString().split("T")[0]}
									value={returnDate}
									onChange={(e) => setReturnDate(e.target.value)}
									className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
								/>
							</div>
						) : (
							<div />
						)}
						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<User className="w-3 h-3" /> TRAVELERS
							</label>
							<select
								value={travelers}
								onChange={(e) => setTravelers(Number(e.target.value))}
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
							>
								{[1, 2, 3, 4, 5, 6].map((n) => (
									<option key={n} value={n}>
										{n} Traveler{n > 1 ? "s" : ""}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
								<Plane className="w-3 h-3" /> CABIN
							</label>
							<select
								value={cabin}
								onChange={(e) => setCabin(e.target.value)}
								className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
							>
								<option value="economy">Economy</option>
								<option value="business">Business</option>
								<option value="first">First</option>
							</select>
						</div>
					</div>

					<button
						onClick={runSearch}
						disabled={searching}
						className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mb-4 transition-colors"
					>
						{searching ? (
							<>
								<Loader2 className="w-5 h-5 animate-spin" /> Searching...
							</>
						) : (
							<>
								<Search className="w-5 h-5" /> Search Flights
							</>
						)}
					</button>

					{searchError && (
						<p className="text-red-400 text-sm text-center mb-4">
							{searchError}
						</p>
					)}

					{(searching || results) && (
						<div className="mt-2 space-y-4">
							{searching ? (
								<VerdictCardSkeleton
									origin={origin}
									destination={destination}
								/>
							) : results?.verdict ? (
								subscription === "pro" ||
								hasDayPassAccess ? (
									<VerdictCard
										verdict={results.verdict}
										cashPrice={results.cash_price}
										origin={results.origin}
										destination={results.destination}
										departDate={results.date}
										returnDate={results.return_date}
										cabin={results.cabin}
										travelers={numTravelers}
										isRoundtrip={results.is_roundtrip}
										awardOptions={results.award_options}
										returnAwardOptions={results.return_award_options}
										flights={results.flights}
										userPrograms={userPrograms}
										verdictId={results.verdict_id}
									/>
								) : (
									<div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400 text-sm">
										<Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
										<p>Opening plans…</p>
									</div>
								)
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
					)}

					<ZoeChat
						isOpen={isChatOpen}
						setIsOpen={setIsChatOpen}
						onFillSearch={handleFillSearch}
						onTriggerSearch={handleTriggerSearch}
						currentPage="home"
						messages={chatMessages}
						setMessages={setChatMessages}
						isAuthenticated={true}
					/>
				</main>
			</div>
		</div>
	);
}
