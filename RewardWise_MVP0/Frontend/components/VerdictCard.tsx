/** @format */
"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  PlaneLanding,
  PlaneTakeoff,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
} from "lucide-react";
import { useAlerts } from "@/context/AlertContext";
import { createClient } from "@/utils/supabase/client";
import { fmtMoney } from "@/utils/format";

const supabase = createClient();

type Confidence = "high" | "medium" | "low";

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

interface NextStep {
  type: string;
  label: string;
  prompt: string;
}

interface Verdict {
  verdict: string;
  verdict_label?: string;
  recommendation?: "use_points" | "pay_cash" | "wait";
  headline?: string;
  explanation?: string;
  winner: VerdictWinner | null;
  pay_cash: boolean;
  confidence: Confidence;
  confidence_reason?: string;
  booking_note: string;
  booking_link: BookingLink;
  data_quality?: string;
  missing_sources?: string[];
  safe_fallback_used?: boolean;
  metrics?: {
    cash_price?: number | null;
    points_cost?: number | null;
    taxes?: number | null;
    estimated_savings?: number | null;
  };
  next_step?: NextStep | null;
}

interface CashLeg {
  flight_number?: string;
  airline?: string;
  airline_logo?: string;
  airplane?: string;
  travel_class?: string;
  duration?: number;
  departure_airport?: string;
  departure_iata?: string;
  departure_time?: string;
  arrival_airport?: string;
  arrival_iata?: string;
  arrival_time?: string;
}

interface CashReturnFlight {
  total_duration?: number;
  stops?: number;
  stop_places?: { id?: string | number; name?: string; iata?: string }[];
  departure_airport?: string;
  departure_iata?: string;
  departure_time?: string;
  arrival_airport?: string;
  arrival_iata?: string;
  arrival_time?: string;
  legs?: CashLeg[];
}

interface CashFlight {
  price?: number;
  total_duration?: number;
  stops?: number;
  stop_places?: { id?: string | number; name?: string; iata?: string }[];
  departure_airport?: string;
  departure_iata?: string;
  departure_time?: string;
  arrival_airport?: string;
  arrival_iata?: string;
  arrival_time?: string;
  legs?: CashLeg[];
  return_flight?: CashReturnFlight | null;
  booking_url?: string | null;
  raw_booking_url?: string | null;
  vendor?: string | null;
  agent_ids?: string[];
  pricing_option_id?: string | null;
  transfer_type?: string | null;
  score?: number | string | null;
  booking_proposition?: string | null;
  fare_basis_codes?: string[];
  booking_codes?: string[];
  fare_families?: string[];
  price_update_status?: string | null;
  price_last_updated?: string | null;
  quote_age?: number | string | null;
}

interface TripSegment {
  flight_number?: string;
  aircraft_name?: string;
  origin?: string;
  destination?: string;
  departs_at?: string;
  arrives_at?: string;
}

interface TripDetail {
  total_duration?: number;
  stops?: number;
  flight_numbers?: string;
  departs_at?: string;
  arrives_at?: string;
  segments?: TripSegment[];
}

interface AwardOption {
  program: string;
  points: number;
  taxes: number | null;
  cpp: number;
  direct: boolean;
  remaining_seats: number;
  airlines?: string;
  trips?: TripDetail[];
}

interface VerdictCardProps {
  verdict: Verdict;
  cashPrice: number | null;
  origin: string;
  destination: string;
  departDate: string;
  departDateEnd?: string | null;
  winningDate?: string | null;
  returnDate?: string | null;
  cabin?: string;
  travelers: number;
  isRoundtrip?: boolean;
  awardOptions?: AwardOption[];
  returnAwardOptions?: AwardOption[];
  flights?: CashFlight[];
  userPrograms?: string[];
  verdictId?: string | null;
  onAskZoe?: (context: string) => void;
  publicPreview?: boolean;
  onPublicPreviewSignup?: () => void;
  onPublicPreviewSignin?: () => void;
}

function formatDate(d: string) {
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(d: string) {
  const [year, month, day] = d.split("-").map(Number);
  if (!year || !month || !day) return d;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtTime(t?: string) {
  if (!t) return "";
  const safe = t.includes("T") ? t : t.replace(" ", "T");
  const bare = safe.replace("Z", "").split("+")[0];
  const [datePart, timePart] = bare.split("T");
  if (!datePart || !timePart) return t;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDuration(mins?: number) {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtShortDateTime(value?: string | null) {
  if (!value) return "—";
  const safe = value.includes("T") ? value : value.replace(" ", "T");
  const bare = safe.replace("Z", "").split("+")[0];
  const parsed = new Date(bare);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function quoteAgeText(value?: number | string | null) {
  if (value == null || value === "") return "—";
  const raw = Number(value);
  if (Number.isNaN(raw)) return String(value);
  if (raw < 60) return `${raw} min`;
  const hours = Math.floor(raw / 60);
  const mins = raw % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function joinList(values?: string[] | null, fallback = "—") {
  const clean = (values ?? []).filter(Boolean);
  return clean.length ? clean.join(", ") : fallback;
}

function stopText(stops?: number) {
  if (stops == null) return "Stops unknown";
  return stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`;
}

function segmentAirlines(legs?: CashLeg[]) {
  const names = Array.from(new Set((legs ?? []).map((leg) => leg.airline).filter(Boolean))) as string[];
  return names.length > 0 ? names.join(" + ") : "Airline details pending";
}

function flightNumbers(legs?: CashLeg[]) {
  const nums = (legs ?? []).map((leg) => leg.flight_number).filter(Boolean);
  return nums.length > 0 ? nums.join(", ") : "Flight numbers pending";
}

function fmtProgram(s?: string | null) {
  const raw = (s || "").replace(/_/g, " ").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();
  const special: Record<string, string> = {
    flyingblue: "Flying Blue",
    "flying blue": "Flying Blue",
    virginatlantic: "Virgin Atlantic",
    "virgin atlantic": "Virgin Atlantic",
    "american airlines": "American Airlines",
    "british airways": "British Airways",
  };
  if (special[normalized]) return special[normalized];
  return raw
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildGoogleFlightsUrl(origin: string, destination: string, departDate: string, returnDate?: string | null, cabin?: string): string {
  const cabinStr = ({ economy: "economy", premium_economy: "premium economy", business: "business", first: "first class" } as Record<string, string>)[cabin ?? "economy"] ?? "economy";
  const q = returnDate
    ? `Flights from ${origin} to ${destination} on ${departDate} returning ${returnDate} ${cabinStr}`
    : `Flights from ${origin} to ${destination} on ${departDate} ${cabinStr}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

function confidenceTone(confidence: Confidence) {
  if (confidence === "high") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (confidence === "medium") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

function confidenceDot(confidence: Confidence) {
  if (confidence === "high") return "bg-emerald-300";
  if (confidence === "medium") return "bg-amber-300";
  return "bg-slate-300";
}

export function VerdictCardSkeleton({ origin, destination }: { origin: string; destination: string }) {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-2 h-3 w-20 rounded bg-white/10" />
          <div className="h-8 w-40 rounded bg-white/10" />
        </div>
        <div className="h-6 w-24 rounded-full bg-white/10" />
      </div>
      <div className="h-44 rounded-2xl bg-white/5" />
      <p className="mt-6 text-sm text-slate-500">Loading {origin} → {destination}…</p>
    </div>
  );
}

function FeedbackInline({ verdictId }: { verdictId?: string | null }) {
  const [choice, setChoice] = useState<1 | 5 | null>(null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!verdictId) return null;

  const submit = async () => {
    if (!choice || saving) return;
    setSaving(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Please log in again before submitting feedback.");
      return;
    }
    const payload = {
      verdict_id: verdictId,
      user_id: userId,
      rating: choice,
      comment: comment.trim() || null,
      did_book: false,
      booking_method: null,
    };
    const { error: insertError } = await supabase.from("feedback").insert(payload);
    if (insertError) {
      setSaving(false);
      setError(insertError.message || "Failed to save feedback.");
      return;
    }
    setSaving(false);
    setSaved(true);
    setOpen(false);
  };

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-300">
          <MessageSquare className="h-4 w-4" />
          <span className="text-sm font-medium">Was this useful?</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setChoice(5);
              setOpen(true);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${choice === 5 ? "border-emerald-400 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
          >
            <ThumbsUp className="h-4 w-4" /> Helpful
          </button>
          <button
            onClick={() => {
              setChoice(1);
              setOpen(true);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${choice === 1 ? "border-rose-400 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
          >
            <ThumbsDown className="h-4 w-4" /> Needs work
          </button>
        </div>
      </div>
      {open && !saved && (
        <div className="mt-3 space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: what should Zoe do better here?"
            className="min-h-[92px] w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-slate-700"
            >
              {saving ? "Saving…" : "Submit feedback"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">Cancel</button>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
      )}
      {saved && <p className="mt-3 text-sm text-emerald-300">Thanks — your feedback was saved.</p>}
    </div>
  );
}

export default function VerdictCard({
  verdict,
  cashPrice,
  origin,
  destination,
  departDate,
  departDateEnd = null,
  winningDate = null,
  returnDate,
  cabin,
  travelers,
  isRoundtrip,
  awardOptions = [],
  returnAwardOptions = [],
  flights = [],
  userPrograms = [],
  verdictId,
  onAskZoe,
  publicPreview = false,
  onPublicPreviewSignup,
  onPublicPreviewSignin,
}: VerdictCardProps) {
  const { addToWatchlist, isWatching } = useAlerts();
  const [justAdded, setJustAdded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const [inlineAnswer, setInlineAnswer] = useState<{ question: string; answer: string } | null>(null);
  const [slide, setSlide] = useState(0); // 0 = verdict, 1 = details
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [inlineLoading, setInlineLoading] = useState<string | null>(null); // which question is loading
  const [flightDetailsOpen, setFlightDetailsOpen] = useState(false);
  const alreadyWatching = isWatching(origin, destination, departDate);

  const recommendation = verdict.recommendation ?? (verdict.pay_cash ? "pay_cash" : "use_points");
  const recommendationLabel = verdict.verdict_label ?? (recommendation === "pay_cash" ? "Pay Cash" : recommendation === "wait" ? "Wait" : "Use Points");
  const winner = verdict.winner;
  const confidence = verdict.confidence ?? "medium";
  const bookingUrl = verdict.booking_link?.preferred === "seats_aero" && verdict.booking_link?.seats_aero_link
    ? verdict.booking_link.seats_aero_link
    : verdict.booking_link?.airline_link ?? null;
  const googleFlightsUrl = buildGoogleFlightsUrl(origin, destination, departDate, returnDate, cabin);
  const bestCashFlight = flights[0] ?? null;
  const bestOutbound = winner?.program
    ? (awardOptions.find((option) => option.program.toLowerCase() === winner.program!.toLowerCase()) ?? awardOptions[0])
    : awardOptions[0];
  const bestReturn = returnAwardOptions[0] ?? null;
  const metrics = verdict.metrics ?? {};
  const displayCashPrice = metrics.cash_price ?? cashPrice ?? bestCashFlight?.price ?? null;
  const displayPoints = metrics.points_cost ?? (bestOutbound ? bestOutbound.points * travelers : winner?.points ? winner.points * travelers : null);
  const displayTaxes = metrics.taxes ?? bestOutbound?.taxes ?? winner?.taxes ?? null;
  const displaySavings = metrics.estimated_savings ?? null;
  const hasAward = displayPoints != null && displayPoints > 0;
  const mainExplanation = verdict.explanation || verdict.verdict || "Zoe compared the live cash fare against the strongest award option available for this trip.";

  const isFlexibleSearch = Boolean(departDateEnd && departDateEnd !== departDate);
  const searchedRangeCopy = isFlexibleSearch
    ? winningDate && winningDate !== departDate
      ? `Searched ${formatShortDate(departDate)} to ${formatShortDate(departDateEnd!)}, best is ${formatShortDate(winningDate)}.`
      : `Searched ${formatShortDate(departDate)} to ${formatShortDate(departDateEnd!)}.`
    : null;

  const reasoningCopy = verdict.confidence_reason || (
    recommendation === "pay_cash"
      ? "Live cash fare matched our estimate. Award redemptions on this route look less efficient right now, so your points may work harder on international business or peak holiday trips."
      : recommendation === "use_points"
        ? "The award option is stronger than the cash fare right now, so using points protects cash while still getting solid redemption value."
        : "The current signal is mixed, so it is worth checking nearby dates or another cabin before booking."
  );

  const quickQuestions = [
    recommendation === "pay_cash" ? "Why not points?" : "Why not cash?",
    "Show alternatives",
    "What if I’m flush with miles?",
  ];

  const askInline = async (question: string) => {
    if (inlineLoading) return;
    setInlineLoading(question);
    setInlineAnswer(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const context = [
        `Verdict for ${origin} → ${destination}, ${(cabin || "economy").replace(/_/g, " ")}, ${travelers} traveler${travelers !== 1 ? "s" : ""}.`,
        `Verdict: ${verdict.verdict_label ?? (verdict.pay_cash ? "Pay Cash" : "Use Points")}.`,
        verdict.metrics?.cash_price != null ? `Cash fare: ${fmtMoney(Math.round(verdict.metrics.cash_price))}.` : null,
        verdict.winner?.points && verdict.winner?.program
          ? `Best award: ${verdict.winner.points.toLocaleString()} points via ${verdict.winner.program.replace(/_/g, " ")}.`
          : null,
        verdict.winner?.cpp != null ? `Value: ${verdict.winner.cpp.toFixed(2)} cents per point.` : null,
        `Confidence: ${verdict.confidence}.`,
        verdict.confidence_reason ?? null,
        verdict.explanation ?? null,
      ].filter(Boolean).join(" ");

      const res = await fetch("/api/zoe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: `Given this search result: ${context} Answer this question in 2-3 sentences max, no fluff: ${question}`,
          history: [],
        }),
      });
      const data = await res.json();
      setInlineAnswer({ question, answer: data.message || "Couldn't get an answer right now." });
    } catch {
      setInlineAnswer({ question, answer: "Something went wrong — try again." });
    } finally {
      setInlineLoading(null);
    }
  };

  const readout = useMemo(() => {
    const pieces = [
      `${recommendationLabel}.`,
      verdict.headline || "",
      verdict.explanation || verdict.verdict || "",
      verdict.confidence ? `${confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence.` : "",
      verdict.confidence_reason || "",
      verdict.next_step?.label ? `Next step: ${verdict.next_step.label}.` : "",
    ].filter(Boolean);
    return pieces.join(" ");
  }, [confidence, recommendationLabel, verdict]);

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(readout);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSetAlert = () => {
    if (alreadyWatching || justAdded) return;
    addToWatchlist({
      origin,
      destination,
      departDate,
      returnDate,
      cabin: cabin ?? "economy",
      passengers: travelers,
      tripType: isRoundtrip ? "roundtrip" : "oneway",
      cashPrice,
      pointsRequired: winner?.points ? winner.points * travelers : null,
      program: winner?.program ?? null,
      verdict: recommendation === "pay_cash" ? "cash" : "points",
    });
    setJustAdded(true);
  };

  const renderCashLeg = (flight: CashFlight | CashReturnFlight | null, label: string, isReturnLeg = false) => {
    if (!flight) return null;
    const legs = flight.legs ?? [];
    const hasSegments = legs.length > 0;
    const departureCode = (flight as CashFlight).departure_iata || "—";
    const arrivalCode = (flight as CashFlight).arrival_iata || "—";
    const departureAirport = (flight as CashFlight).departure_airport;
    const arrivalAirport = (flight as CashFlight).arrival_airport;
    const bookingLink = "booking_url" in flight ? flight.booking_url : null;
    const seller = "vendor" in flight ? flight.vendor : null;
    const stopPlaces = (flight as CashFlight).stop_places ?? [];
    const fareBasis = "fare_basis_codes" in flight ? joinList(flight.fare_basis_codes) : "—";
    const bookingCodes = "booking_codes" in flight ? joinList(flight.booking_codes) : "—";
    const fareFamilies = "fare_families" in flight ? joinList(flight.fare_families) : "—";
    const lastUpdated = "price_last_updated" in flight ? fmtShortDateTime(flight.price_last_updated) : "—";
    const quoteAge = "quote_age" in flight ? quoteAgeText(flight.quote_age) : "—";
    const transferType = "transfer_type" in flight && flight.transfer_type ? flight.transfer_type : "—";
    const bookingProposition = "booking_proposition" in flight && flight.booking_proposition ? flight.booking_proposition : "—";
    const providerScore = "score" in flight && flight.score != null ? String(flight.score) : "—";

    const summaryTiles = [
      { label: "Airline", value: segmentAirlines(legs) },
      { label: "Stops", value: stopText((flight as CashFlight).stops) },
      { label: "Duration", value: fmtDuration((flight as CashFlight).total_duration) || "—" },
      { label: "Seller", value: seller || "Seller pending" },
    ];

    const hiddenTiles = [
      { label: "Flight", value: flightNumbers(legs) },
      { label: "Updated", value: lastUpdated },
      { label: "Quote age", value: quoteAge },
      { label: "Fare basis", value: fareBasis },
      { label: "Booking code", value: bookingCodes },
      { label: "Fare family", value: fareFamilies },
      { label: "Transfer", value: transferType },
      { label: "Booking type", value: bookingProposition },
      { label: "Provider score", value: providerScore },
    ];

    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15">
            {isReturnLeg ? <PlaneLanding className="h-4 w-4 text-indigo-300" /> : <PlaneTakeoff className="h-4 w-4 text-indigo-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.14em] text-indigo-300">{label}</p>
                <p className="text-base font-bold text-white">{departureCode} → {arrivalCode}</p>
              </div>
              {"price" in flight && flight.price != null && <p className="text-lg font-extrabold text-emerald-300">{fmtMoney(flight.price, flight.price % 1 === 0 ? 0 : 2)}</p>}
            </div>

            <p className="mt-1 text-sm text-slate-300">
              {fmtTime((flight as CashFlight).departure_time) || "Time pending"}
              {fmtTime((flight as CashFlight).arrival_time) ? ` – ${fmtTime((flight as CashFlight).arrival_time)}` : ""}
              {(flight as CashFlight).total_duration ? ` · ${fmtDuration((flight as CashFlight).total_duration)}` : ""}
              {` · ${stopText((flight as CashFlight).stops)}`}
            </p>

            {(departureAirport || arrivalAirport) && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {departureAirport || departureCode} → {arrivalAirport || arrivalCode}
              </p>
            )}

            {stopPlaces.length > 0 && (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Layover: {stopPlaces.map((stop) => stop.iata || stop.name).filter(Boolean).join(", ")}
              </p>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {summaryTiles.map((tile) => (
                <div key={`${label}-${tile.label}`} className="rounded-xl border border-white/8 bg-slate-900/55 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{tile.label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-white">{tile.value}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFlightDetailsOpen((value) => !value)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
            >
              {flightDetailsOpen ? "Hide flight details" : "Show flight details"}
              {flightDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {flightDetailsOpen && (
              <div className="mt-3 space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {hiddenTiles.map((tile) => (
                    <div key={`${label}-${tile.label}`} className="rounded-xl border border-white/8 bg-slate-900/55 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{tile.label}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-white">{tile.value}</p>
                    </div>
                  ))}
                </div>

                {hasSegments && (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Segment details</p>
                    {legs.map((leg, index) => (
                      <div key={`${label}-${index}-${leg.flight_number ?? "segment"}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-300" />
                          {index < legs.length - 1 && <div className="my-1 w-px flex-1 bg-white/10" />}
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {leg.departure_iata || "—"} → {leg.arrival_iata || "—"}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {fmtTime(leg.departure_time) || "Time pending"}
                                {fmtTime(leg.arrival_time) ? ` – ${fmtTime(leg.arrival_time)}` : ""}
                                {leg.duration ? ` · ${fmtDuration(leg.duration)}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-slate-200">{leg.airline || "Airline pending"}</p>
                              <p className="text-[11px] text-slate-500">
                                {leg.flight_number ? `Flight ${leg.flight_number}` : "Flight # pending"}
                                {leg.airplane ? ` · ${leg.airplane}` : ""}
                                {leg.travel_class ? ` · ${leg.travel_class}` : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bookingLink && (
              <a href={bookingLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15">
                Open booking option <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAwardLeg = (option: AwardOption | null, label: string, isReturnLeg = false) => {
    if (!option) return null;
    const trip = option.trips?.[0];
    const first = trip?.segments?.[0];
    const last = trip?.segments?.[trip.segments.length - 1];
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/15">
            {isReturnLeg ? <PlaneLanding className="h-4 w-4 text-emerald-300" /> : <PlaneTakeoff className="h-4 w-4 text-emerald-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
            <p className="text-sm font-semibold text-white">{fmtProgram(option.program)}</p>
            <p className="mt-1 text-xs text-slate-400">
              {first?.origin && last?.destination ? `${first.origin} → ${last.destination}` : "Award itinerary"}
              {trip?.departs_at && trip?.arrives_at ? ` · ${fmtTime(trip.departs_at)} – ${fmtTime(trip.arrives_at)}` : ""}
              {trip?.total_duration ? ` · ${fmtDuration(trip.total_duration)}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-emerald-300">{(option.points * travelers).toLocaleString()} pts</p>
            {option.taxes != null && option.taxes > 0 && <p className="text-xs text-slate-400">+${Number(option.taxes).toFixed(2)}</p>}
          </div>
        </div>
      </div>
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (publicPreview) return;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (publicPreview) return;
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = (touchStartX.current ?? 0) - (touchEndX.current ?? 0);
    if (Math.abs(diff) > 50) setSlide(diff > 0 ? 1 : 0);
  };

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Slide track. Public previews render verdict + details side by side on desktop. ── */}
      <div
        className={
          publicPreview
            ? "grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.84fr)]"
            : "flex items-stretch transition-transform duration-300 ease-in-out"
        }
        style={publicPreview ? undefined : { transform: `translateX(-${slide * 100}%)` }}
      >

        {/* ════════════════════════════════════════
            SLIDE 1 — Verdict
        ════════════════════════════════════════ */}
        <div className={publicPreview ? "min-w-0 flex h-full flex-col gap-5" : "min-w-full flex flex-col"}>
          <div className="flex-1 rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8 flex flex-col">

            {/* Header */}
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-400">The Verdict</p>
                <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">{recommendationLabel}</h2>
                  {displayCashPrice != null && (
                    <>
                      {recommendation === "use_points" && (
                        <span className="text-sm font-semibold text-slate-400">· Cash fare</span>
                      )}
                      <span className="text-4xl font-extrabold tracking-tight text-emerald-400 md:text-5xl">
                        {fmtMoney(displayCashPrice, displayCashPrice % 1 === 0 ? 0 : 2)}
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-5 max-w-4xl text-lg font-medium leading-8 text-slate-300 md:text-xl">
                  {mainExplanation}
                </p>
                {searchedRangeCopy && (
                  <p className="mt-3 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    {searchedRangeCopy}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold capitalize ${confidenceTone(confidence)}`}>
                  <span className={`h-2 w-2 rounded-full ${confidenceDot(confidence)}`} />
                  {confidence} confidence
                </span>
                {verdict.data_quality && verdict.data_quality !== "full" && (
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                    Partial data
                  </span>
                )}
              </div>
            </div>

            {/* Reasoning panel — always visible in public preview, togglable otherwise */}
            {(publicPreview || reasoningOpen) && (
              <div className="mt-8 rounded-2xl bg-white/[0.04] p-5 md:p-6">
                <div className="grid gap-5 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Cash fare</p>
                    <p className="mt-2 text-2xl font-bold text-white">{fmtMoney(displayCashPrice, displayCashPrice != null && displayCashPrice % 1 !== 0 ? 2 : 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Best award</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {hasAward ? `${Number(displayPoints).toLocaleString()} pts` : "—"}
                      {displayTaxes != null && displayTaxes > 0 && <span className="text-base font-semibold text-slate-300"> + {fmtMoney(displayTaxes, 0)}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Value preserved</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-400">
                      {displaySavings != null ? `~${fmtMoney(displaySavings, 0)}` : "—"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-base leading-7 text-slate-300">{reasoningCopy}</p>

                {/* Quick questions — full-app only */}
                {!publicPreview && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {quickQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void askInline(question)}
                        disabled={!!inlineLoading}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          inlineAnswer?.question === question
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                        } disabled:opacity-50`}
                      >
                        {inlineLoading === question ? (
                          <span className="flex items-center gap-2">
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            {question}
                          </span>
                        ) : question}
                      </button>
                    ))}
                  </div>
                )}

                {/* Inline answer */}
                {!publicPreview && inlineAnswer && (
                  <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">{inlineAnswer.question}</p>
                    <p className="text-sm leading-6 text-slate-200">{inlineAnswer.answer}</p>
                    <button type="button" onClick={() => setInlineAnswer(null)} className="mt-2 text-xs text-slate-500 hover:text-slate-300">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Zoe locked features — public preview filler to balance height */}
{publicPreview && (
  <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      Full access with an account
    </p>

    <div className="space-y-4">
      {[
        {
          icon: "✦",
          color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
          label: "Ask Zoe anything",
          sub: "Get follow-up answers about your specific trip — why not points, what if you wait, nearby dates.",
        },
        {
          icon: "⚡",
          color: "text-amber-300 bg-amber-400/10 border-amber-400/20",
          label: "Set price alerts",
          sub: "Zoe watches the route and pings you when cash fares drop or award space opens up.",
        },
        {
          icon: "◈",
          color: "text-sky-300 bg-sky-400/10 border-sky-400/20",
          label: "Your wallet, your verdict",
          sub: "Connect your loyalty programs so every recommendation is built around what you actually have.",
        },
        {
          icon: "↺",
          color: "text-violet-300 bg-violet-400/10 border-violet-400/20",
          label: "Personalized trip history",
          sub: "Save past searches and compare future trips against what you’ve already looked at.",
        },
        {
          icon: "⌁",
          color: "text-rose-300 bg-rose-400/10 border-rose-400/20",
          label: "Smarter points timing",
          sub: "See when it may be better to save your points for a higher-value redemption.",
        },
        {
          icon: "✓",
          color: "text-green-300 bg-green-400/10 border-green-400/20",
          label: "Less guesswork",
          sub: "One clear answer before you book.",
        },
      ].map(({ icon, color, label, sub }) => (
        <div key={label} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border text-sm font-semibold ${color}`}
          >
            {icon}
          </span>

          <div>
            <p className="text-sm font-semibold text-slate-300">{label}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

            {/* Next step — full-app only */}
            {!publicPreview && verdict.next_step?.label && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">Next step</p>
                <p className="font-semibold text-white">{verdict.next_step.label}</p>
                {verdict.next_step.prompt && <p className="mt-1 text-sm text-slate-300">Try asking: "{verdict.next_step.prompt}"</p>}
              </div>
            )}

            {/* Missing data */}
            {verdict.missing_sources && verdict.missing_sources.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200">Missing data</p>
                <p className="mt-1 text-sm leading-6 text-slate-200">
                  We could not fully verify: {verdict.missing_sources.map((item) => item.replace(/_/g, " ")).join(", ")}.
                </p>
              </div>
            )}

            {/* Footer controls — full app only */}
            {!publicPreview && (
              <div className="mt-8 border-t border-white/10 pt-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setReasoningOpen((v) => !v)}
                    className="inline-flex items-center gap-2 text-base font-semibold text-slate-300 hover:text-white"
                  >
                    {reasoningOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {reasoningOpen ? "Hide reasoning" : "See how Zoe decided"}
                  </button>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={speak} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.06]">
                      {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {speaking ? "Stop" : "Listen"}
                    </button>
                    {bookingUrl ? (
                      <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300">
                        Book / verify <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <a href={googleFlightsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300">
                        Search fares <Search className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={handleSetAlert}
                      disabled={alreadyWatching || justAdded}
                      className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                      style={{ borderColor: "rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}
                    >
                      {alreadyWatching || justAdded ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      {alreadyWatching || justAdded ? "Alert set" : "Set alert"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!onAskZoe) return;
                        const cashStr = displayCashPrice != null ? fmtMoney(Math.round(displayCashPrice)) : null;
                        const ptsStr = displayPoints != null ? `${Number(displayPoints).toLocaleString()} points` : null;
                        const progStr = winner?.program ? winner.program.replace(/_/g, " ") : null;
                        const cppStr = winner?.cpp != null ? `${winner.cpp.toFixed(2)} cents per point` : null;
                        const savingsStr = displaySavings != null ? `saving roughly ${fmtMoney(Math.round(displaySavings))}` : null;
                        const parts = [
                          `The search returned a verdict for ${origin} → ${destination}`,
                          `on ${departDate}${returnDate ? ` returning ${returnDate}` : ""}, ${travelers} traveler${travelers !== 1 ? "s" : ""}, ${(cabin || "economy").replace(/_/g, " ")} class.`,
                          `Verdict: ${recommendationLabel}.`,
                          cashStr ? `Cash fare: ${cashStr}.` : null,
                          ptsStr && progStr ? `Best award: ${ptsStr} via ${progStr}.` : null,
                          cppStr ? `Value: ${cppStr}.` : null,
                          savingsStr ? `Using points would save ${savingsStr} vs cash.` : null,
                          `Confidence: ${confidence}.`,
                          verdict.confidence_reason ?? null,
                          verdict.explanation ?? null,
                        ].filter(Boolean).join(" ");
                        onAskZoe(parts);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                    >
                      Ask Zoe <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}



            {!publicPreview && verdict.booking_note && <p className="mt-4 text-xs text-slate-500">{verdict.booking_note}</p>}
            {!publicPreview && <FeedbackInline verdictId={verdictId} />}
          </div>
        </div>

        {/* ════════════════════════════════════════
            SLIDE 2 — Trip details
        ════════════════════════════════════════ */}
        <div className={publicPreview ? "min-w-0 flex flex-col" : "min-w-full flex flex-col"}>
          <div className="flex-1 rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8">

            {/* ── Header row ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Flight details</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-white">{origin}</span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                  </svg>
                  <span className="text-2xl font-extrabold tracking-tight text-white">{destination}</span>
                  {isRoundtrip && (
                    <>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                      </svg>
                      <span className="text-2xl font-extrabold tracking-tight text-slate-400">{origin}</span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {isFlexibleSearch
                    ? `${formatShortDate(departDate)} to ${formatShortDate(departDateEnd!)}${winningDate && winningDate !== departDate ? ` (best ${formatShortDate(winningDate)})` : ""}`
                    : formatDate(departDate)}
                  {returnDate ? ` – ${formatDate(returnDate)}` : ""} · {travelers} traveler{travelers !== 1 ? "s" : ""} · <span className="capitalize">{(cabin || "economy").replace(/_/g, " ")}</span>
                </p>
              </div>
              {displayCashPrice != null && (
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Cash fare</p>
                  <p className="text-2xl font-extrabold text-white">{fmtMoney(displayCashPrice, displayCashPrice % 1 === 0 ? 0 : 2)}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">

              {/* ── Best cash flight ── */}
              {bestCashFlight && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                  {/* Flight bar */}
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {bestCashFlight.legs?.[0]?.airline_logo ? (
                        <img src={bestCashFlight.legs[0].airline_logo} alt={bestCashFlight.legs[0].airline ?? ""} className="h-8 w-8 rounded-lg object-contain bg-white/5 p-1 flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center flex-shrink-0">
                          <PlaneTakeoff className="h-4 w-4 text-indigo-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white">
                            {fmtTime(bestCashFlight.departure_time) || "—"}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className="text-base font-bold text-white">
                            {fmtTime(bestCashFlight.arrival_time) || "—"}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400">
                            {stopText(bestCashFlight.stops)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {bestCashFlight.departure_iata || bestCashFlight.departure_airport}
                          {" → "}
                          {bestCashFlight.arrival_iata || bestCashFlight.arrival_airport}
                          {bestCashFlight.total_duration ? ` · ${fmtDuration(bestCashFlight.total_duration)}` : ""}
                          {bestCashFlight.legs?.[0]?.airline ? ` · ${bestCashFlight.legs[0].airline}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {bestCashFlight.price != null && (
                        <p className="text-xl font-extrabold text-emerald-400">{fmtMoney(bestCashFlight.price, bestCashFlight.price % 1 === 0 ? 0 : 2)}</p>
                      )}
                      {bestCashFlight.vendor && (
                        <p className="text-[11px] text-slate-500 mt-0.5">via {bestCashFlight.vendor}</p>
                      )}
                    </div>
                  </div>

                  {/* Segment detail — only if we have segments */}
                  {bestCashFlight.legs && bestCashFlight.legs.length > 0 && (
                    <div className="border-t border-white/6 px-5 pb-4 pt-3">
                      <div className="relative space-y-3">
                        {bestCashFlight.legs.map((leg, idx) => (
                          <div key={idx} className="flex gap-3">
                            <div className="flex flex-col items-center pt-1">
                              <div className="h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" />
                              {idx < (bestCashFlight.legs?.length ?? 0) - 1 && (
                                <div className="mt-1 w-px flex-1 bg-white/10" style={{minHeight: "1.5rem"}} />
                              )}
                            </div>
                            <div className="pb-2 min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {leg.departure_iata || "—"} → {leg.arrival_iata || "—"}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {fmtTime(leg.departure_time) || "—"}
                                    {fmtTime(leg.arrival_time) ? ` – ${fmtTime(leg.arrival_time)}` : ""}
                                    {leg.duration ? ` · ${fmtDuration(leg.duration)}` : ""}
                                  </p>
                                </div>
                                <div className="text-right">
                                  {leg.flight_number && (
                                    <p className="text-xs font-mono text-slate-400">{leg.flight_number}</p>
                                  )}
                                  {leg.airplane && (
                                    <p className="text-[11px] text-slate-600">{leg.airplane}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking CTA */}
                  {!publicPreview && bestCashFlight.booking_url && (
                    <div className="border-t border-white/6 px-5 py-3">
                      <a
                        href={bestCashFlight.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-400/25 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Book this flight
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* ── Return flight ── */}
              {isRoundtrip && bestCashFlight?.return_flight && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-400/15 flex items-center justify-center flex-shrink-0">
                        <PlaneLanding className="h-4 w-4 text-indigo-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-300">Return</span>
                          <span className="text-base font-bold text-white">
                            {fmtTime(bestCashFlight.return_flight.departure_time) || "—"}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className="text-base font-bold text-white">
                            {fmtTime(bestCashFlight.return_flight.arrival_time) || "—"}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400">
                            {stopText(bestCashFlight.return_flight.stops)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {bestCashFlight.return_flight.departure_iata || bestCashFlight.return_flight.departure_airport}
                          {" → "}
                          {bestCashFlight.return_flight.arrival_iata || bestCashFlight.return_flight.arrival_airport}
                          {bestCashFlight.return_flight.total_duration ? ` · ${fmtDuration(bestCashFlight.return_flight.total_duration)}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Points option ── */}
              {bestOutbound && (
                <div className={`rounded-2xl overflow-hidden border ${recommendation === "use_points" ? "border-emerald-400/25 bg-emerald-500/[0.06]" : "border-white/8 bg-white/[0.02]"}`}>
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${recommendation === "use_points" ? "text-emerald-300" : "text-slate-500"}`}>
                          {recommendation === "use_points" ? "✦ Best award" : "Points comparison"}
                        </span>
                      </div>
                      <p className="text-base font-bold text-white">{fmtProgram(bestOutbound.program)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {bestOutbound.direct ? "Nonstop" : bestOutbound.remaining_seats ? `${bestOutbound.remaining_seats} seat${bestOutbound.remaining_seats !== 1 ? "s" : ""} left` : "Award space available"}
                        {bestOutbound.airlines ? ` · ${bestOutbound.airlines}` : ""}
                        {bestOutbound.taxes != null && bestOutbound.taxes > 0 ? ` · +$${Number(bestOutbound.taxes).toFixed(0)} taxes` : " · No fuel surcharges"}
                      </p>
                      {bestOutbound.cpp != null && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                          <span className="text-[11px] font-semibold text-slate-300">{bestOutbound.cpp.toFixed(2)}¢/pt</span>
                          <span className="text-[11px] text-slate-600">·</span>
                          <span className={`text-[11px] font-semibold ${bestOutbound.cpp >= 1.8 ? "text-emerald-300" : bestOutbound.cpp >= 1.3 ? "text-amber-300" : "text-slate-400"}`}>
                            {bestOutbound.cpp >= 1.8 ? "Strong value" : bestOutbound.cpp >= 1.3 ? "Decent value" : "Weak value"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-extrabold ${recommendation === "use_points" ? "text-emerald-300" : "text-slate-300"}`}>
                        {(bestOutbound.points * travelers).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500">pts</p>
                    </div>
                  </div>
                  {recommendation === "pay_cash" && cashPrice != null && (
                    <div className="border-t border-white/6 px-5 py-3">
                      <p className="text-xs leading-5 text-slate-500">
                        At {fmtMoney(cashPrice, 0)} cash, your points are worth more on a premium redemption.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── No data state ── */}
              {!bestCashFlight && !bestOutbound && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-8 text-center">
                  <p className="text-sm text-slate-500">No flight details available for this search.</p>
                </div>
              )}

              {/* ── Zoe chat demo (public preview only) ── */}
              {publicPreview && (
                <div className="rounded-2xl border border-white/8 bg-[#0d1420] overflow-hidden">
                  {/* Zoe header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">Zoe</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Your travel agent</p>
                    </div>
                  </div>
                  {/* Chat messages */}
                  <div className="px-4 py-4 space-y-3">
                    {/* User bubble */}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-emerald-500 px-4 py-2.5">
                        <p className="text-sm font-medium text-white leading-5">
                          Can you explain why I should pay cash for {origin} → {destination}?
                        </p>
                      </div>
                    </div>
                    {/* Zoe bubble */}
                    <div className="flex justify-start">
                      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/8 px-4 py-3">
                        <p className="text-sm leading-6 text-slate-200">
                          The cash fare is {fmtMoney(displayCashPrice, 0)} — that's a solid price for this route. The best award I found is{" "}
                          {hasAward ? `${Number(displayPoints).toLocaleString()} pts` : "not available"}
                          {displayTaxes != null && displayTaxes > 0 ? ` + ${fmtMoney(displayTaxes, 0)} in taxes` : ""}, which works out to only{" "}
                          {bestOutbound?.cpp != null ? `${bestOutbound.cpp.toFixed(2)}¢ per point` : "weak value"}.
                          {" "}Your points are worth more saved for a premium cabin or international trip where redemption value is higher.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Locked input bar */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5 cursor-not-allowed" onClick={onPublicPreviewSignup}>
                      <p className="flex-1 text-sm text-slate-600">Ask Zoe a follow-up…</p>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                      </div>
                    </div>
                    <p className="mt-2 text-center text-[11px] text-slate-600">Sign up to chat with Zoe about your trip</p>
                  </div>
                </div>
              )}

            </div>
          </div>
          {publicPreview && (onPublicPreviewSignup || onPublicPreviewSignin) && (
            <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Keep comparing trips</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                This free search shows the verdict and key details only — and it's limited to one use per network. Create an account to save searches, add your wallet, and unlock the full experience with booking tools, alerts, and deeper comparisons.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onPublicPreviewSignup}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={onPublicPreviewSignin}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>

      </div>{/* end slide track */}

      {/* ── Navigation dots + arrows. Hidden for public previews because both sections are visible together. ── */}
      {!publicPreview && (
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setSlide(0)}
          disabled={slide === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {[0, 1].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              className={`rounded-full transition-all duration-200 ${
                slide === i
                  ? "h-2.5 w-6 bg-emerald-400"
                  : "h-2 w-2 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSlide(1)}
          disabled={slide === 1}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      )}
    </div>
  );
}
