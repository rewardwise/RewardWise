/** @format */

"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SegmentedTabs from "@/components/SegmentedTabs";
import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";
import { cabinLabel } from "@/utils/cabin";
import { createClient } from "@/utils/supabase/client";
import { computeCpp, formatCpp } from "@/utils/cpp";
import { trackAnalyticsEvent } from "@/utils/analytics/client";

import {
	ArrowLeft,
	BellOff,
	Calendar,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	Loader2,
	Plane,
	RotateCcw,
	Search,
	Star,
	WalletCards,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

type TabKey = "searches" | "booked" | "alerts";
const TABS: { key: TabKey; label: string }[] = [
	{ key: "searches", label: "Searches" },
	{ key: "booked", label: "What you booked" },
	{ key: "alerts", label: "Alerts" },
];
function normalizeTab(raw: string | null): TabKey {
	return raw === "booked" || raw === "alerts" ? raw : "searches";
}

type Recommendation = "use_points" | "pay_cash" | "wait" | null;

type Trip = {
	id: string;
	verdictId: string | null;
	recommendation: Recommendation;
	summary: string | null;
	calculatedCpp: number | null;
	cashPriceUsed: number | null;
	pointsCostUsed: number | null;
	origin: string;
	destination: string;
	date: string;
	departureDate: string;
	returnDate?: string | null;
	tripType: "roundtrip" | "oneway";
	cabin: string;
	passengers: number;
	createdAt: string;
};

type VerdictRow = {
	id: string;
	recommendation: "use_points" | "pay_cash" | "wait";
	summary: string | null;
	calculated_cpp: number | null;
	cash_price_used: number | null;
	points_cost_used: number | null;
};

type SearchRow = {
	id: string;
	origin: string;
	destination: string;
	departure_date: string;
	return_date: string | null;
	passengers: number;
	cabin: string | null;
	trip_type: "roundtrip" | "oneway";
	created_at: string;
	verdicts?: VerdictRow[] | VerdictRow | null;
};

type BookingMethod = "cash" | "points" | string | null;

type BookedTrip = {
	id: string;
	origin: string;
	destination: string;
	departureDate: string;
	returnDate: string | null;
	passengers: number;
	cabin: string | null;
	tripType: "roundtrip" | "oneway" | string | null;
	recommendation: Recommendation;
	bookingMethod: BookingMethod;
	rating: number | null;
	comment: string | null;
	cashPriceUsed: number | null;
	pointsCostUsed: number | null;
	summary: string | null;
	bookedAt: string;
};

type FeedbackRow = {
	id: string;
	verdict_id: string | null;
	rating: number | null;
	comment: string | null;
	booking_method: BookingMethod;
	created_at: string;
};

type BookedVerdictRow = {
	id: string;
	search_id: string | null;
	recommendation: Recommendation;
	summary: string | null;
	calculated_cpp: number | null;
	cash_price_used: number | null;
	points_cost_used: number | null;
};

type BookedSearchRow = {
	id: string;
	origin: string;
	destination: string;
	departure_date: string;
	return_date: string | null;
	passengers: number;
	cabin: string | null;
	trip_type: string | null;
	created_at: string;
};

function formatMonthYear(dateStr: string) {
	return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function formatDateNice(dateStr?: string | null) {
	if (!dateStr) return "";
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
function verdictLabel(recommendation: Recommendation) {
	if (recommendation === "use_points") return "Use Points";
	if (recommendation === "pay_cash") return "Pay Cash";
	if (recommendation === "wait") return "Wait";
	return "No verdict";
}
/** Light-theme verdict badge classes (8b). */
function verdictClasses(recommendation: Recommendation) {
	if (recommendation === "use_points") return "border-emerald-200 bg-emerald-50 text-emerald-700";
	if (recommendation === "pay_cash") return "border-sky-200 bg-sky-50 text-sky-700";
	if (recommendation === "wait") return "border-amber-200 bg-amber-50 text-amber-700";
	return "border-mtw-border bg-mtw-surface text-mtw-muted";
}
function bookingMethodLabel(method: BookingMethod) {
	if (method === "points") return "Booked with Points";
	if (method === "cash") return "Booked with Cash";
	return "Marked Booked";
}
function formatMoney(value?: number | null) {
	if (typeof value !== "number" || Number.isNaN(value)) return null;
	return `$${Math.round(value).toLocaleString()}`;
}
function formatPoints(value?: number | null) {
	if (typeof value !== "number" || Number.isNaN(value)) return null;
	return value.toLocaleString();
}
function getVisiblePageNumbers(currentPage: number, totalPages: number) {
	const pages = new Set<number>([1, totalPages, currentPage]);
	if (currentPage > 1) pages.add(currentPage - 1);
	if (currentPage < totalPages) pages.add(currentPage + 1);
	return Array.from(pages)
		.filter((page) => page >= 1 && page <= totalPages)
		.sort((a, b) => a - b);
}

function HistoryInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loading: authLoading } = useAuth();
	const { setSearchFill } = useSearchFill();
	const supabase = useMemo(() => createClient(), []);

	const activeTab = normalizeTab(searchParams.get("tab"));

	const handleTabChange = (next: string) => {
		if (next === activeTab) return;
		trackAnalyticsEvent("tab_switched", {
			event_type: "navigation",
			metadata: { surface: "history", from: activeTab, to: next },
		});
		router.replace(`/history?tab=${next}`, { scroll: false });
	};

	// ----- Searches tab state -----
	const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
	const [feedbackGiven, setFeedbackGiven] = useState<string[]>([]);
	const [rating, setRating] = useState(0);
	const [comment, setComment] = useState("");
	const [didBook, setDidBook] = useState<boolean | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [trips, setTrips] = useState<Trip[]>([]);
	const [loadingTrips, setLoadingTrips] = useState(true);
	const [loadError, setLoadError] = useState("");
	const [submitError, setSubmitError] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);

	// ----- Booked tab state (lazy) -----
	const [booked, setBooked] = useState<BookedTrip[]>([]);
	const [bookedLoaded, setBookedLoaded] = useState(false);
	const [bookedLoading, setBookedLoading] = useState(false);
	const [bookedError, setBookedError] = useState("");
	const [bookedQuery, setBookedQuery] = useState("");
	const bookedViewedFired = useRef(false);

	useEffect(() => {
		const loadTrips = async () => {
			if (authLoading) return;
			if (!user) {
				setTrips([]);
				setLoadingTrips(false);
				return;
			}
			setLoadingTrips(true);
			setLoadError("");
			const { data, error } = await supabase
				.from("searches")
				.select(
					"id, origin, destination, departure_date, return_date, passengers, cabin, trip_type, created_at, verdicts(id,recommendation,summary,calculated_cpp,cash_price_used,points_cost_used)",
				)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });
			if (error) {
				setLoadError(error.message || "Failed to load your searches.");
				setTrips([]);
				setLoadingTrips(false);
				return;
			}
			const mapped: Trip[] =
				(data as SearchRow[] | null)?.map((row) => {
					const verdict: VerdictRow | null = Array.isArray(row.verdicts)
						? (row.verdicts[0] ?? null)
						: (row.verdicts ?? null);
					return {
						id: row.id,
						verdictId: verdict?.id ?? null,
						recommendation: verdict?.recommendation ?? null,
						summary: verdict?.summary ?? null,
						calculatedCpp: verdict?.calculated_cpp ?? null,
						cashPriceUsed: verdict?.cash_price_used ?? null,
						pointsCostUsed: verdict?.points_cost_used ?? null,
						origin: row.origin,
						destination: row.destination,
						date: formatMonthYear(row.departure_date),
						departureDate: row.departure_date,
						returnDate: row.return_date,
						tripType: row.trip_type === "oneway" ? "oneway" : "roundtrip",
						cabin: cabinLabel(row.cabin),
						passengers: row.passengers,
						createdAt: row.created_at,
					};
				}) ?? [];
			setTrips(mapped);
			setLoadingTrips(false);
		};
		void loadTrips();
	}, [authLoading, user, supabase]);

	// Lazy-load booked trips the first time the Booked tab is opened.
	useEffect(() => {
		if (activeTab !== "booked" || bookedLoaded || authLoading || !user) return;
		const loadBooked = async () => {
			setBookedLoading(true);
			setBookedError("");
			const { data: fb, error: fbErr } = await supabase
				.from("feedback")
				.select("id, verdict_id, rating, comment, booking_method, created_at")
				.eq("user_id", user.id)
				.eq("did_book", true)
				.order("created_at", { ascending: false });
			if (fbErr) {
				setBookedError(fbErr.message || "Failed to load booked trips.");
				setBookedLoading(false);
				setBookedLoaded(true);
				return;
			}
			const fbRows = (fb ?? []) as FeedbackRow[];
			const verdictIds = Array.from(new Set(fbRows.map((r) => r.verdict_id).filter(Boolean) as string[]));
			if (verdictIds.length === 0) {
				setBooked([]);
				setBookedLoading(false);
				setBookedLoaded(true);
				return;
			}
			const { data: vd } = await supabase
				.from("verdicts")
				.select("id, search_id, recommendation, summary, calculated_cpp, cash_price_used, points_cost_used")
				.in("id", verdictIds);
			const vdRows = (vd ?? []) as BookedVerdictRow[];
			const vdById = new Map(vdRows.map((r) => [r.id, r]));
			const searchIds = Array.from(new Set(vdRows.map((r) => r.search_id).filter(Boolean) as string[]));
			const { data: sr } = searchIds.length
				? await supabase
						.from("searches")
						.select("id, origin, destination, departure_date, return_date, passengers, cabin, trip_type, created_at")
						.in("id", searchIds)
				: { data: [] };
			const srById = new Map(((sr ?? []) as BookedSearchRow[]).map((r) => [r.id, r]));
			const mapped = fbRows
				.map((f) => {
					const v = f.verdict_id ? vdById.get(f.verdict_id) : null;
					const s = v?.search_id ? srById.get(v.search_id) : null;
					if (!s) return null;
					return {
						id: f.id,
						origin: s.origin,
						destination: s.destination,
						departureDate: s.departure_date,
						returnDate: s.return_date,
						passengers: s.passengers,
						cabin: s.cabin,
						tripType: s.trip_type,
						recommendation: v?.recommendation ?? null,
						bookingMethod: f.booking_method,
						rating: f.rating,
						comment: f.comment,
						cashPriceUsed: v?.cash_price_used ?? null,
						pointsCostUsed: v?.points_cost_used ?? null,
						summary: v?.summary ?? null,
						bookedAt: f.created_at,
					} satisfies BookedTrip;
				})
				.filter(Boolean) as BookedTrip[];
			setBooked(mapped);
			setBookedLoading(false);
			setBookedLoaded(true);
		};
		void loadBooked();
	}, [activeTab, bookedLoaded, authLoading, user, supabase]);

	// Fire trips_viewed once, after the booked tab's data settles.
	useEffect(() => {
		if (activeTab === "booked" && bookedLoaded && !bookedViewedFired.current) {
			bookedViewedFired.current = true;
			trackAnalyticsEvent("trips_viewed", {
				event_type: "trips",
				metadata: { count: booked.length },
			});
		}
	}, [activeTab, bookedLoaded, booked.length]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, feedbackGiven.length]);

	const availableTrips = useMemo(
		() => trips.filter((trip) => !feedbackGiven.includes(trip.id)),
		[feedbackGiven, trips],
	);
	const filteredTrips = useMemo(() => {
		const query = searchTerm.trim().toLowerCase();
		if (!query) return availableTrips;
		return availableTrips.filter((trip) =>
			[
				trip.origin,
				trip.destination,
				`${trip.origin} ${trip.destination}`,
				trip.cabin,
				trip.tripType,
				verdictLabel(trip.recommendation),
				formatDateNice(trip.departureDate),
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
				.includes(query),
		);
	}, [availableTrips, searchTerm]);

	const totalPages = Math.max(1, Math.ceil(filteredTrips.length / ITEMS_PER_PAGE));
	const safeCurrentPage = Math.min(currentPage, totalPages);
	const pageStart = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
	const visibleTrips = filteredTrips.slice(pageStart, pageStart + ITEMS_PER_PAGE);
	const pageNumbers = getVisiblePageNumbers(safeCurrentPage, totalPages);

	const filteredBooked = useMemo(() => {
		const q = bookedQuery.trim().toLowerCase();
		if (!q) return booked;
		return booked.filter((t) =>
			[t.origin, t.destination, cabinLabel(t.cabin), verdictLabel(t.recommendation), bookingMethodLabel(t.bookingMethod), t.comment ?? ""]
				.join(" ")
				.toLowerCase()
				.includes(q),
		);
	}, [booked, bookedQuery]);

	const resetFeedbackForm = () => {
		setRating(0);
		setComment("");
		setDidBook(null);
		setSubmitError("");
	};
	const handleSelectTrip = (trip: Trip) => {
		resetFeedbackForm();
		setSelectedTrip(trip);
	};
	const handleRerunSearch = (trip: Trip) => {
		const toIsoDate = (value?: string | null) => (value ? String(value).slice(0, 10) : "");
		setSearchFill({
			origin: trip.origin,
			destination: trip.destination,
			departDate: toIsoDate(trip.departureDate),
			returnDate: trip.returnDate ? toIsoDate(trip.returnDate) : null,
			travelers: trip.passengers,
			cabin: (trip.cabin || "Economy").toLowerCase(),
			tripType: trip.tripType,
		});
		router.push("/home");
	};
	const handleSubmit = async () => {
		if (!selectedTrip || !user) return;
		if (!selectedTrip.verdictId) {
			setSubmitError("Could not find verdict for this search. Please run the search again.");
			return;
		}
		if (rating === 0) return;
		setSubmitting(true);
		setSubmitError("");
		const derivedBookingMethod: "cash" | "points" | null =
			selectedTrip.recommendation === "pay_cash"
				? "cash"
				: selectedTrip.recommendation === "use_points"
					? "points"
					: null;
		const { error } = await supabase.from("feedback").insert({
			verdict_id: selectedTrip.verdictId,
			user_id: user.id,
			rating,
			comment: comment.trim() ? comment.trim() : null,
			did_book: didBook,
			booking_method: didBook ? derivedBookingMethod : null,
		});
		if (error) {
			setSubmitError(error.message || "Failed to save feedback.");
			setSubmitting(false);
			return;
		}
		setFeedbackGiven((prev) => [...prev, selectedTrip.id]);
		// A newly-booked search should re-appear in Booked next time it opens.
		if (didBook) setBookedLoaded(false);
		setSubmitted(true);
		setSubmitting(false);
	};

	const card = "rounded-2xl border border-mtw-border bg-white shadow-mtw-ambient";

	return (
		<div className="font-mtw min-h-screen">
			<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
				{/* HEADER */}
				<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold text-mtw-ink">History</h1>
						<p className="mt-1 text-mtw-small text-mtw-muted">
							Your past searches, the trips you booked, and route alerts.
						</p>
					</div>
					<button
						onClick={() => router.push("/home")}
						className="w-fit rounded-mtw border border-mtw-border bg-white px-4 py-2 text-mtw-small text-mtw-ink transition-colors hover:bg-mtw-surface"
					>
						Back to Home
					</button>
				</div>

				<div className="mb-6">
					<SegmentedTabs tabs={TABS} active={activeTab} onChange={handleTabChange} ariaLabel="History views" />
				</div>

				{/* ===================== SEARCHES TAB ===================== */}
				{activeTab === "searches" &&
					(submitted ? (
						<div className={`mx-auto max-w-2xl p-8 text-center ${card}`}>
							<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
								<Star className="h-7 w-7 text-mtw-emerald" />
							</div>
							<h2 className="mb-2 text-xl font-bold text-mtw-ink">Thanks for the feedback!</h2>
							<p className="mb-6 text-mtw-muted">We&apos;ll use it to sharpen future verdicts.</p>
							<div className="flex justify-center gap-3">
								<button
									onClick={() => {
										setSubmitted(false);
										setSelectedTrip(null);
										resetFeedbackForm();
									}}
									className="rounded-mtw bg-mtw-emerald px-6 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
								>
									Review another
								</button>
							</div>
						</div>
					) : !selectedTrip ? (
						<div className={card}>
							<div className="border-b border-mtw-border p-5 sm:p-6">
								<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<h2 className="text-mtw-title font-semibold text-mtw-ink">Select a search to review</h2>
										<p className="mt-1 text-mtw-small text-mtw-muted">Total searches: {availableTrips.length}</p>
									</div>
									<div className="relative w-full lg:max-w-sm">
										<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mtw-muted" />
										<input
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											placeholder="Search route, cabin, verdict..."
											className="w-full rounded-mtw border border-mtw-border bg-white py-2.5 pl-10 pr-3 text-mtw-small text-mtw-ink outline-none placeholder:text-mtw-muted focus:border-mtw-emerald"
										/>
									</div>
								</div>
							</div>

							{authLoading || loadingTrips ? (
								<div className="p-6 text-mtw-small text-mtw-muted">Loading your history…</div>
							) : !user ? (
								<div className="p-6 text-mtw-small text-mtw-muted">Sign in to see your search history.</div>
							) : loadError ? (
								<div className="p-6 text-mtw-small text-red-600">{loadError}</div>
							) : availableTrips.length === 0 ? (
								<div className="p-6 text-mtw-small text-mtw-muted">
									No searches yet. Run a few from Home and they&apos;ll appear here.
								</div>
							) : filteredTrips.length === 0 ? (
								<div className="p-6 text-mtw-small text-mtw-muted">
									No searches matched “{searchTerm}”.
								</div>
							) : (
								<>
									<div className="hidden overflow-x-auto md:block">
										<table className="w-full text-left text-mtw-small">
											<thead className="border-b border-mtw-border bg-mtw-surface text-xs uppercase tracking-[0.16em] text-mtw-muted">
												<tr>
													<th className="px-6 py-4 font-medium">Route</th>
													<th className="px-4 py-4 font-medium">Dates</th>
													<th className="px-4 py-4 font-medium">Details</th>
													<th className="px-4 py-4 font-medium">Verdict</th>
													<th className="px-6 py-4 text-right font-medium">Action</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-mtw-border">
												{visibleTrips.map((trip) => (
													<tr key={trip.id} className="hover:bg-mtw-surface">
														<td className="px-6 py-4">
															<p className="font-semibold text-mtw-ink">{trip.origin} → {trip.destination}</p>
															<p className="mt-1 text-xs text-mtw-muted">Searched {formatDateNice(trip.createdAt)}</p>
														</td>
														<td className="px-4 py-4 text-mtw-muted">
															<p>{formatDateNice(trip.departureDate)}</p>
															<p className="text-xs text-mtw-muted">
																{trip.tripType === "roundtrip" && trip.returnDate ? `Return ${formatDateNice(trip.returnDate)}` : "One way"}
															</p>
														</td>
														<td className="px-4 py-4 text-mtw-muted">
															<p>{trip.cabin}</p>
															<p className="text-xs text-mtw-muted">{trip.passengers} traveler{trip.passengers > 1 ? "s" : ""}</p>
														</td>
														<td className="px-4 py-4">
															<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(trip.recommendation)}`}>
																{verdictLabel(trip.recommendation)}
															</span>
														</td>
														<td className="px-6 py-4 text-right">
															<div className="flex items-center justify-end gap-2">
																<button
																	onClick={() => handleRerunSearch(trip)}
																	aria-label="Re-run search"
																	title="Re-run search"
																	className="inline-flex h-8 w-8 items-center justify-center rounded-mtw border border-mtw-border bg-white text-mtw-muted hover:bg-mtw-surface hover:text-mtw-ink"
																>
																	<RotateCcw className="h-4 w-4" />
																</button>
																<button
																	onClick={() => handleSelectTrip(trip)}
																	className="rounded-mtw bg-mtw-emerald px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
																>
																	Review
																</button>
															</div>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									<div className="divide-y divide-mtw-border md:hidden">
										{visibleTrips.map((trip) => (
											<button key={trip.id} onClick={() => handleSelectTrip(trip)} className="w-full p-4 text-left hover:bg-mtw-surface">
												<div className="flex items-start justify-between gap-3">
													<div>
														<p className="font-semibold text-mtw-ink">{trip.origin} → {trip.destination}</p>
														<p className="mt-1 text-mtw-small text-mtw-muted">
															{formatDateNice(trip.departureDate)}
															{trip.tripType === "roundtrip" && trip.returnDate ? ` • Return ${formatDateNice(trip.returnDate)}` : " • One way"}
														</p>
														<p className="mt-1 text-xs text-mtw-muted">{trip.cabin} • {trip.passengers} traveler{trip.passengers > 1 ? "s" : ""}</p>
													</div>
													<ChevronRight className="mt-1 h-5 w-5 shrink-0 text-mtw-muted" />
												</div>
												<span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(trip.recommendation)}`}>
													{verdictLabel(trip.recommendation)}
												</span>
											</button>
										))}
									</div>

									<div className="flex flex-col gap-3 border-t border-mtw-border p-4 sm:flex-row sm:items-center sm:justify-between">
										<p className="text-mtw-small text-mtw-muted">
											Showing {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, filteredTrips.length)} of {filteredTrips.length}
										</p>
										<div className="flex items-center gap-2">
											<button
												onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
												disabled={safeCurrentPage === 1}
												className="rounded-mtw border border-mtw-border bg-white p-2 text-mtw-muted hover:bg-mtw-surface disabled:cursor-not-allowed disabled:opacity-40"
												aria-label="Previous page"
											>
												<ChevronLeft className="h-4 w-4" />
											</button>
											{pageNumbers.map((page, index) => {
												const prev = pageNumbers[index - 1];
												const showGap = prev && page - prev > 1;
												return (
													<div key={page} className="flex items-center gap-2">
														{showGap ? <span className="text-mtw-muted">…</span> : null}
														<button
															onClick={() => setCurrentPage(page)}
															className={`h-9 min-w-9 rounded-mtw px-3 text-mtw-small ${
																safeCurrentPage === page
																	? "bg-mtw-emerald text-white"
																	: "border border-mtw-border bg-white text-mtw-muted hover:bg-mtw-surface"
															}`}
														>
															{page}
														</button>
													</div>
												);
											})}
											<button
												onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
												disabled={safeCurrentPage === totalPages}
												className="rounded-mtw border border-mtw-border bg-white p-2 text-mtw-muted hover:bg-mtw-surface disabled:cursor-not-allowed disabled:opacity-40"
												aria-label="Next page"
											>
												<ChevronRight className="h-4 w-4" />
											</button>
										</div>
									</div>
								</>
							)}
						</div>
					) : (
						/* Feedback detail */
						<div className={`mx-auto max-w-2xl p-6 ${card}`}>
							<button onClick={() => setSelectedTrip(null)} className="mb-4 flex items-center gap-2 text-mtw-small text-mtw-muted hover:text-mtw-ink">
								<ArrowLeft className="h-4 w-4" /> Back to searches
							</button>

							<div className="mb-6 rounded-mtw border border-mtw-border bg-mtw-surface p-4">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<p className="text-mtw-title font-semibold text-mtw-ink">{selectedTrip.origin} → {selectedTrip.destination}</p>
										<p className="mt-1 text-mtw-small text-mtw-muted">
											{formatDateNice(selectedTrip.departureDate)}
											{selectedTrip.tripType === "roundtrip" && selectedTrip.returnDate ? ` • Return ${formatDateNice(selectedTrip.returnDate)}` : " • One way"}
										</p>
										<p className="mt-1 text-xs text-mtw-muted">{selectedTrip.cabin} • {selectedTrip.passengers} traveler{selectedTrip.passengers > 1 ? "s" : ""}</p>
									</div>
									<span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(selectedTrip.recommendation)}`}>
										{verdictLabel(selectedTrip.recommendation)}
									</span>
								</div>
							</div>

							<button
								onClick={() => handleRerunSearch(selectedTrip)}
								className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-mtw bg-mtw-emerald px-4 py-3 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
							>
								<RotateCcw className="h-4 w-4" /> Re-run search
							</button>

							<div className="space-y-6">
								<div>
									<p className="mb-3 text-mtw-small text-mtw-ink">How was the overall experience?</p>
									<div className="flex gap-2">
										{[1, 2, 3, 4, 5].map((star) => (
											<button
												key={star}
												onClick={() => setRating(star)}
												className={`flex h-10 w-10 items-center justify-center rounded-mtw ${rating >= star ? "bg-amber-50 text-amber-500" : "bg-mtw-surface text-mtw-muted"}`}
											>
												<Star className="h-5 w-5" fill={rating >= star ? "currentColor" : "none"} />
											</button>
										))}
									</div>
								</div>
								<div>
									<p className="mb-2 text-mtw-small text-mtw-ink">Did you book this recommendation?</p>
									<div className="flex gap-2">
										<button onClick={() => setDidBook(true)} className={`rounded-mtw px-3 py-2 text-mtw-small ${didBook === true ? "bg-emerald-50 text-emerald-700" : "bg-mtw-surface text-mtw-muted"}`}>Yes</button>
										<button onClick={() => setDidBook(false)} className={`rounded-mtw px-3 py-2 text-mtw-small ${didBook === false ? "bg-emerald-50 text-emerald-700" : "bg-mtw-surface text-mtw-muted"}`}>No</button>
									</div>
								</div>
								<div>
									<p className="mb-2 text-mtw-small text-mtw-ink">Comment (optional)</p>
									<textarea
										value={comment}
										onChange={(e) => setComment(e.target.value)}
										placeholder="Tell us what worked or what could be better…"
										className="min-h-24 w-full rounded-mtw border border-mtw-border bg-white px-3 py-2.5 text-mtw-small text-mtw-ink focus:border-mtw-emerald focus:outline-none"
									/>
								</div>
								{submitError && <p className="text-mtw-small text-red-600">{submitError}</p>}
								<button
									onClick={handleSubmit}
									disabled={rating === 0 || submitting}
									className="w-full rounded-mtw bg-mtw-emerald py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
								>
									{submitting ? "Saving…" : "Submit feedback"}
								</button>
							</div>
						</div>
					))}

				{/* ===================== BOOKED TAB ===================== */}
				{activeTab === "booked" && (
					<div>
						<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-mtw-small text-mtw-muted">{booked.length} booked trip{booked.length === 1 ? "" : "s"}</p>
							<div className="relative w-full sm:max-w-sm">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mtw-muted" />
								<input
									value={bookedQuery}
									onChange={(e) => setBookedQuery(e.target.value)}
									placeholder="Search route, cabin, verdict…"
									className="w-full rounded-mtw border border-mtw-border bg-white py-2.5 pl-10 pr-3 text-mtw-small text-mtw-ink outline-none placeholder:text-mtw-muted focus:border-mtw-emerald"
								/>
							</div>
						</div>

						{authLoading || bookedLoading ? (
							<div className={`p-10 text-center ${card}`}>
								<Loader2 className="mx-auto h-8 w-8 animate-spin text-mtw-emerald" />
								<p className="mt-4 text-mtw-small text-mtw-muted">Loading your booked trips…</p>
							</div>
						) : !user ? (
							<div className={`p-6 text-mtw-small text-mtw-muted ${card}`}>Sign in to see your booked trips.</div>
						) : bookedError ? (
							<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-mtw-small text-red-700">{bookedError}</div>
						) : booked.length === 0 ? (
							<div className={`p-10 text-center ${card}`}>
								<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
									<Plane className="h-7 w-7 text-mtw-emerald" />
								</div>
								<h2 className="mt-5 text-mtw-title font-semibold text-mtw-ink">No booked trips yet</h2>
								<p className="mx-auto mt-2 max-w-md text-mtw-small leading-6 text-mtw-muted">
									When you review a search and mark “Yes, I booked,” it shows up here.
								</p>
								<button
									onClick={() => handleTabChange("searches")}
									className="mt-6 rounded-mtw bg-mtw-emerald px-4 py-3 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
								>
									Go to Searches
								</button>
							</div>
						) : filteredBooked.length === 0 ? (
							<div className={`p-8 text-center text-mtw-small text-mtw-muted ${card}`}>No booked trips match your search.</div>
						) : (
							<div className="space-y-4">
								{filteredBooked.map((trip) => {
									const isPoints = trip.bookingMethod === "points";
									const isCash = trip.bookingMethod === "cash";
									const cash = formatMoney(trip.cashPriceUsed);
									const points = formatPoints(trip.pointsCostUsed);
									const cpp = computeCpp(trip.cashPriceUsed, trip.pointsCostUsed);
									const metrics = [
										cash ? { label: "Cash price", value: cash } : null,
										points ? { label: "Points cost", value: points } : null,
										cpp !== null ? { label: "Redemption value", value: formatCpp(cpp) } : null,
									].filter(Boolean) as { label: string; value: string }[];
									return (
										<article key={trip.id} className={`p-5 ${card}`}>
											<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
												<div className="flex items-start gap-4">
													<div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isPoints ? "bg-emerald-50 text-emerald-600" : isCash ? "bg-amber-50 text-amber-600" : "bg-mtw-surface text-mtw-muted"}`}>
														{isPoints ? <WalletCards className="h-6 w-6" /> : isCash ? <CreditCard className="h-6 w-6" /> : <Plane className="h-6 w-6" />}
													</div>
													<div>
														<div className="flex flex-wrap items-center gap-2">
															<h2 className="text-mtw-title font-semibold text-mtw-ink">{trip.origin} → {trip.destination}</h2>
															<span className="rounded-full border border-mtw-border bg-mtw-surface px-2.5 py-1 text-xs font-medium text-mtw-muted">{cabinLabel(trip.cabin)}</span>
															<span className="rounded-full border border-mtw-border bg-mtw-surface px-2.5 py-1 text-xs font-medium text-mtw-muted">{trip.passengers} passenger{trip.passengers === 1 ? "" : "s"}</span>
														</div>
														<div className="mt-3 flex flex-wrap items-center gap-3 text-mtw-small text-mtw-muted">
															<span className="inline-flex items-center gap-2">
																<Calendar className="h-4 w-4 text-mtw-muted" />
																{formatDateNice(trip.departureDate)}{trip.returnDate ? ` – ${formatDateNice(trip.returnDate)}` : ""}
															</span>
															<span className="text-mtw-muted">•</span>
															<span>Marked booked {formatDateNice(trip.bookedAt)}</span>
														</div>
													</div>
												</div>
												<div className="flex flex-wrap gap-2 lg:justify-end">
													<span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isPoints ? "bg-emerald-50 text-emerald-700" : isCash ? "bg-amber-50 text-amber-700" : "bg-mtw-surface text-mtw-muted"}`}>
														{bookingMethodLabel(trip.bookingMethod)}
													</span>
													<span className="rounded-full bg-mtw-surface px-3 py-1.5 text-xs font-semibold text-mtw-muted">Verdict: {verdictLabel(trip.recommendation)}</span>
												</div>
											</div>

											{metrics.length > 0 && (
												<div className={`mt-5 grid gap-3 ${metrics.length === 1 ? "sm:grid-cols-1" : metrics.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
													{metrics.map((m) => (
														<div key={m.label} className="rounded-mtw border border-mtw-border bg-mtw-surface p-4">
															<p className="text-xs uppercase tracking-[0.2em] text-mtw-muted">{m.label}</p>
															<p className="mt-2 text-mtw-title font-semibold text-mtw-ink">{m.value}</p>
														</div>
													))}
												</div>
											)}

											{trip.summary && (
												<p className="mt-4 rounded-mtw border border-mtw-border bg-mtw-surface p-4 text-mtw-small leading-6 text-mtw-muted">{trip.summary}</p>
											)}

											<div className="mt-4 flex items-center gap-1 border-t border-mtw-border pt-4">
												{[1, 2, 3, 4, 5].map((star) => (
													<Star key={star} className={`h-4 w-4 ${trip.rating && star <= trip.rating ? "fill-amber-400 text-amber-400" : "text-mtw-border"}`} />
												))}
												{trip.comment && <span className="ml-2 text-mtw-small text-mtw-muted">“{trip.comment}”</span>}
											</div>
										</article>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* ===================== ALERTS TAB ===================== */}
				{activeTab === "alerts" && (
					<div className={`p-12 text-center ${card}`}>
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mtw-surface">
							<BellOff className="h-7 w-7 text-mtw-muted" />
						</div>
						<h2 className="mt-5 text-mtw-title font-semibold text-mtw-ink">Alerts are coming soon</h2>
						<p className="mx-auto mt-2 max-w-md text-mtw-small leading-6 text-mtw-muted">
							Once they&apos;re live, you&apos;ll see price and award-space alerts for the routes you&apos;re watching, right here.
						</p>
					</div>
				)}
			</main>
		</div>
	);
}

export default function HistoryPage() {
	return (
		<Suspense fallback={<div className="min-h-screen" />}>
			<HistoryInner />
		</Suspense>
	);
}
