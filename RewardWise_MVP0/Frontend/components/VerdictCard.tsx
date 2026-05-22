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
  Sparkles,
} from "lucide-react";
import { useAlerts } from "@/context/AlertContext";
import { cabinLabel } from "@/utils/cabin";
import { fmtMoney } from "@/utils/format";
import { dedupeByProgram } from "@/utils/awardOptions";
import { buildOutboundLeg, buildInboundLeg } from "@/utils/flightLegs";
import VerdictTopRow from "@/components/verdict/VerdictTopRow";
import ErrorStateCard from "@/components/verdict/ErrorStateCard";
import FlightSection, { FlightLeg } from "@/components/verdict/FlightSection";
import AwardDetailsSection, { AwardProgramOption } from "@/components/verdict/AwardDetailsSection";
import MultiHandoffGrid, { MultiHandoffProgram, MultiHandoffCashAirline } from "@/components/verdict/MultiHandoffGrid";
import WalletFramingPreview from "@/components/verdict/WalletFramingPreview";

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
  returnDateEnd?: string | null;
  winningReturnDate?: string | null;
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

export default function VerdictCard({
  verdict,
  cashPrice,
  origin,
  destination,
  departDate,
  departDateEnd = null,
  winningDate = null,
  returnDate,
  returnDateEnd = null,
  winningReturnDate = null,
  cabin,
  travelers,
  isRoundtrip,
  awardOptions: rawAwardOptions = [],
  returnAwardOptions: rawReturnAwardOptions = [],
  flights = [],
  userPrograms = [],
  verdictId,
  onAskZoe,
  publicPreview = false,
  onPublicPreviewSignup,
  onPublicPreviewSignin,
}: VerdictCardProps) {
  // Metro + flex searches return multiple award_options per program (different
  // airport pairs / dates). Collapse to best-per-program before any consumer
  // (AwardDetailsSection header, MultiHandoffGrid cards) reads the list.
  const awardOptions = useMemo(() => dedupeByProgram(rawAwardOptions), [rawAwardOptions]);
  const returnAwardOptions = useMemo(() => dedupeByProgram(rawReturnAwardOptions), [rawReturnAwardOptions]);

  const { addToWatchlist, isWatching } = useAlerts();
  const [justAdded, setJustAdded] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [flightDetailsOpen, setFlightDetailsOpen] = useState(false);
  const alreadyWatching = isWatching(origin, destination, departDate);

  const recommendation = verdict.recommendation ?? (verdict.pay_cash ? "pay_cash" : "use_points");
  const recommendationLabel = verdict.verdict_label ?? (recommendation === "pay_cash" ? "Pay Cash" : recommendation === "wait" ? "Wait" : "Use Points");
  const winner = verdict.winner;
  const confidence = verdict.confidence ?? "medium";
  const bookingUrl = verdict.booking_link?.preferred === "seats_aero" && verdict.booking_link?.seats_aero_link
    ? verdict.booking_link.seats_aero_link
    : verdict.booking_link?.airline_link ?? null;
  const bestDate = winningDate || departDate;
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

  const recommendationHeadline = (() => {
    if (recommendation === "use_points") {
      return displayCashPrice != null
        ? `Use Points · Cash fare ${fmtMoney(displayCashPrice, displayCashPrice % 1 === 0 ? 0 : 2)}`
        : "Use Points";
    }
    if (recommendation === "pay_cash") {
      return displayCashPrice != null
        ? `Pay Cash · ${fmtMoney(displayCashPrice, displayCashPrice % 1 === 0 ? 0 : 2)}`
        : "Pay Cash";
    }
    return verdict.verdict_label ?? "Wait";
  })();

  const isOutboundFlex = Boolean(departDateEnd && departDateEnd !== departDate);
  const isReturnFlex = Boolean(
    returnDate && returnDateEnd && returnDateEnd !== returnDate,
  );
  const bothLegsFlex = isOutboundFlex && isReturnFlex;
  const outboundLabel = bothLegsFlex ? "Outbound: searched" : "Searched";
  const outboundCopy = isOutboundFlex
    ? winningDate && winningDate !== departDate
      ? `${outboundLabel} ${formatShortDate(departDate)} to ${formatShortDate(departDateEnd!)}, best is ${formatShortDate(winningDate)}.`
      : `${outboundLabel} ${formatShortDate(departDate)} to ${formatShortDate(departDateEnd!)}.`
    : null;
  const returnCopy = isReturnFlex
    ? winningReturnDate && winningReturnDate !== returnDate
      ? `Return: searched ${formatShortDate(returnDate!)} to ${formatShortDate(returnDateEnd!)}, best is ${formatShortDate(winningReturnDate)}.`
      : `Return: searched ${formatShortDate(returnDate!)} to ${formatShortDate(returnDateEnd!)}.`
    : null;
  const searchedRangeCopy =
    [outboundCopy, returnCopy].filter(Boolean).join(" ") || null;

  const outboundLeg: FlightLeg | null = buildOutboundLeg({
    recommendation,
    bestOutbound,
    bestCashFlight,
    origin,
    destination,
    departDate,
    winningDate,
  });

  const inboundLeg: FlightLeg | null = buildInboundLeg({
    recommendation,
    isRoundtrip: Boolean(isRoundtrip),
    bestOutbound,
    bestReturn,
    bestCashFlight,
    origin,
    destination,
    returnDate,
    winningReturnDate,
  });

  const operatingAirline: string | null = (() => {
    if (recommendation === "pay_cash") {
      return bestCashFlight?.legs?.[0]?.airline ?? null;
    }
    if (bestOutbound?.airlines) return bestOutbound.airlines;
    return null;
  })();

  const programOptions: AwardProgramOption[] = awardOptions.map((opt) => ({
    program: opt.program,
    points: opt.points,
    taxes: opt.taxes,
    cpp: opt.cpp,
    remaining_seats: opt.remaining_seats,
    direct: opt.direct,
  }));

  const walletSet = new Set(userPrograms.map((p) => p.toLowerCase()));
  const inWalletAwards = awardOptions.filter((opt) => walletSet.has(opt.program.toLowerCase()));
  const handoffPrograms: MultiHandoffProgram[] = (inWalletAwards.length > 0 ? inWalletAwards : awardOptions.slice(0, 1)).map(
    (opt) => ({
      program: opt.program,
      points: opt.points * travelers,
      taxes: opt.taxes,
    }),
  );
  const cashHandoff: MultiHandoffCashAirline | null = bestCashFlight
    ? {
        airline: bestCashFlight.legs?.[0]?.airline || "the airline",
        cashPrice: bestCashFlight.price ?? displayCashPrice ?? null,
        bookingUrl: bestCashFlight.booking_url ?? bookingUrl,
      }
    : null;
  const routeLabel = isRoundtrip ? `${origin} ⇄ ${destination}` : `${origin} → ${destination}`;
  const travelersLabel = `${travelers} traveler${travelers !== 1 ? "s" : ""}, ${cabinLabel(cabin || "economy").toLowerCase()}`;

  const reasoningCopy = verdict.confidence_reason || (
    recommendation === "pay_cash"
      ? "Live cash fare matched our estimate. Award redemptions on this route look less efficient right now, so your points may work harder on international business or peak holiday trips."
      : recommendation === "use_points"
        ? "The award option is stronger than the cash fare right now, so using points protects cash while still getting solid redemption value."
        : "The current signal is mixed, so it is worth checking nearby dates or another cabin before booking."
  );

  const readout = useMemo(() => {
    const pieces = [
      `${recommendationLabel}.`,
      verdict.headline || "",
      verdict.explanation || verdict.verdict || "",
      verdict.confidence ? `${confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence.` : "",
      verdict.confidence_reason || "",
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

  if (recommendation === "wait") {
    return <ErrorStateCard />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8 flex flex-col">

            {/* Header */}
            <VerdictTopRow
              recommendationHeadline={recommendationHeadline}
              confidence={confidence}
              speaking={speaking}
              onListenToggle={speak}
              verdictId={verdictId}
              publicPreview={publicPreview}
            />

            <div
              data-testid="verdict-reasoning-block"
              role="region"
              aria-label="Verdict reasoning"
            >
              <p className="mt-5 max-w-4xl text-lg font-medium leading-8 text-slate-300 md:text-xl">
                {mainExplanation}
              </p>
              {searchedRangeCopy && (
                <p className="mt-3 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {searchedRangeCopy}
                </p>
              )}

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
              </div>
            </div>

            {!publicPreview && (
              <>
                <FlightSection
                  recommendation={recommendation}
                  isRoundtrip={Boolean(isRoundtrip)}
                  outbound={outboundLeg}
                  inbound={inboundLeg}
                />
                <AwardDetailsSection
                  recommendation={recommendation}
                  operatingAirline={operatingAirline}
                  awardOptions={programOptions}
                  userPrograms={userPrograms}
                  travelers={travelers}
                />
                {recommendation === "use_points" ? (
                  <MultiHandoffGrid
                    recommendation="use_points"
                    programs={handoffPrograms}
                    bestDate={bestDate}
                    routeLabel={routeLabel}
                    travelersLabel={travelersLabel}
                  />
                ) : recommendation === "pay_cash" ? (
                  <MultiHandoffGrid
                    recommendation="pay_cash"
                    cashAirline={cashHandoff}
                    bestDate={bestDate}
                    routeLabel={routeLabel}
                    travelersLabel={travelersLabel}
                  />
                ) : null}
              </>
            )}

            {/* Guest-only wallet framing — shown when verdict defaults to cash
                because no wallet info is available. Conversion play: surface
                what wallets would change about the verdict (ticket 86ba11m1f). */}
            {publicPreview && recommendation === "pay_cash" && (
              <WalletFramingPreview onSignup={onPublicPreviewSignup} />
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

            {/* Footer controls — full app only */}
            {!publicPreview && (
              <div className="mt-8 border-t border-white/10 pt-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex flex-wrap items-center gap-3">
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
                          `on ${bestDate}${returnDate ? ` returning ${returnDate}` : ""}, ${travelers} traveler${travelers !== 1 ? "s" : ""}, ${cabinLabel(cabin || "economy").toLowerCase()} class.`,
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
          </div>

      {publicPreview && (onPublicPreviewSignup || onPublicPreviewSignin) && (
        <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Keep comparing trips</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This free search shows the verdict and key details only — and it&apos;s limited to one use per network. Create an account to save searches, add your wallet, and unlock the full experience with booking tools, alerts, and deeper comparisons.
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
  );
}
