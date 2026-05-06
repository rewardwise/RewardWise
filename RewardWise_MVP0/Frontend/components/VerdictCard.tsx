/** @format */
"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
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
  returnDate?: string | null;
  cabin?: string;
  travelers: number;
  isRoundtrip?: boolean;
  awardOptions?: AwardOption[];
  returnAwardOptions?: AwardOption[];
  flights?: CashFlight[];
  userPrograms?: string[];
  verdictId?: string | null;
}

function formatDate(d: string) {
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function fmtMoney(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toFixed(digits)}`;
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
  returnDate,
  cabin,
  travelers,
  isRoundtrip,
  awardOptions = [],
  returnAwardOptions = [],
  flights = [],
  userPrograms = [],
  verdictId,
}: VerdictCardProps) {
  const { addToWatchlist, isWatching } = useAlerts();
  const [justAdded, setJustAdded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(true);
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

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-400">The Verdict</p>
            <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">{recommendationLabel}</h2>
              {displayCashPrice != null && (
                <span className="text-4xl font-extrabold tracking-tight text-emerald-400 md:text-5xl">
                  {fmtMoney(displayCashPrice, displayCashPrice % 1 === 0 ? 0 : 2)}
                </span>
              )}
            </div>
            <p className="mt-5 max-w-4xl text-lg font-medium leading-8 text-slate-300 md:text-xl">
              {mainExplanation}
            </p>
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

        {reasoningOpen && (
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

            <div className="mt-5 flex flex-wrap gap-3">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {verdict.next_step?.label && (
          <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">Next step</p>
            <p className="font-semibold text-white">{verdict.next_step.label}</p>
            {verdict.next_step.prompt && <p className="mt-1 text-sm text-slate-300">Try asking: “{verdict.next_step.prompt}”</p>}
          </div>
        )}

        {verdict.missing_sources && verdict.missing_sources.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200">Missing data</p>
            <p className="mt-1 text-sm leading-6 text-slate-200">
              Zoe could not fully verify: {verdict.missing_sources.map((item) => item.replace(/_/g, " ")).join(", ")}.
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-white/10 pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setReasoningOpen((value) => !value)}
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
                style={{
                  borderColor: "rgba(251,191,36,0.25)",
                  background: "rgba(251,191,36,0.08)",
                  color: "#fbbf24",
                }}
              >
                {alreadyWatching || justAdded ? <Check className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {alreadyWatching || justAdded ? "Alert set" : "Set alert"}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
              >
                Ask Zoe <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {verdict.booking_note && <p className="mt-4 text-xs text-slate-500">{verdict.booking_note}</p>}
        <FeedbackInline verdictId={verdictId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-xl md:p-6">
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-indigo-300">Trip summary</p>
          <h3 className="text-2xl font-bold text-white">{origin} → {destination}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {formatDate(departDate)}{returnDate ? ` → ${formatDate(returnDate)}` : ""} · {travelers} traveler{travelers !== 1 ? "s" : ""} · {(cabin || "economy").replace(/_/g, " ")}
          </p>
          {userPrograms.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">Wallet programs considered: {userPrograms.join(", ")}</p>}
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-xl md:p-6">
          {recommendation === "pay_cash" ? (
            <>
              {renderCashLeg(bestCashFlight, isRoundtrip ? "Best cash option · outbound" : "Best cash option")}
              {isRoundtrip && renderCashLeg(bestCashFlight?.return_flight ?? null, "Best cash option · return", true)}
            </>
          ) : recommendation === "use_points" ? (
            <>
              {renderAwardLeg(bestOutbound ?? null, isRoundtrip ? "Outbound award" : "Award option")}
              {isRoundtrip && renderAwardLeg(bestReturn ?? null, "Return award", true)}
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-1 font-semibold text-white">This one needs a second look</p>
              <p className="text-sm text-slate-300">The current data is not decisive enough yet, so the safest move is to compare another nearby date or cabin before booking.</p>
            </div>
          )}

          {bestOutbound && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                {recommendation === "pay_cash" ? "Points comparison" : "Best points path"}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{fmtProgram(bestOutbound.program)}</p>
                  <p className="text-sm text-slate-400">
                    {bestOutbound.direct ? "Nonstop" : `${bestOutbound.remaining_seats ? `${bestOutbound.remaining_seats} seat${bestOutbound.remaining_seats !== 1 ? "s" : ""} left` : "Award space found"}`}
                    {bestOutbound.taxes != null && bestOutbound.taxes > 0 ? ` · $${Number(bestOutbound.taxes).toFixed(2)} taxes` : ""}
                  </p>
                </div>
                <p className="text-lg font-bold text-emerald-300">{(bestOutbound.points * travelers).toLocaleString()} pts</p>
              </div>
              {recommendation === "pay_cash" && cashPrice != null && (
                <p className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2 text-sm leading-6 text-slate-300">
                  Cash is the cleaner move here because the cash fare is only {fmtMoney(cashPrice, cashPrice % 1 === 0 ? 0 : 2)}, while the best points option still requires {(bestOutbound.points * travelers).toLocaleString()} points{bestOutbound.taxes != null && bestOutbound.taxes > 0 ? ` plus ${fmtMoney(bestOutbound.taxes, 2)} in taxes` : ""}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
