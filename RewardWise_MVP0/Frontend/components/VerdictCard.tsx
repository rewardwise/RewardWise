/** @format */
"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Sparkles,
} from "lucide-react";
import { cabinLabel } from "@/utils/cabin";
import { fmtMoney } from "@/utils/format";
import { dedupeByProgram, filterByDate } from "@/utils/awardOptions";
import { buildOutboundLeg, buildInboundLeg } from "@/utils/flightLegs";
import VerdictTopRow from "@/components/verdict/VerdictTopRow";
import EmptyWalletCTA from "@/components/verdict/EmptyWalletCTA";
import ErrorStateCard from "@/components/verdict/ErrorStateCard";
import FlightSection, { FlightLeg } from "@/components/verdict/FlightSection";
import MultiHandoffGrid, { MultiHandoffProgram, MultiHandoffCashAirline } from "@/components/verdict/MultiHandoffGrid";
import HowToBook from "@/components/verdict/HowToBook";
import OwnershipFork from "@/components/verdict/OwnershipFork";
import { getProgramHandoffInfo } from "@/utils/airlines";
import PartialDataCard from "@/components/verdict/PartialDataCard";
import { selectTopProgram } from "@/utils/topProgramSelection";
import type { Verdict } from "@/types/verdict";

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
  departure_token?: string | null;
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
  origin_airport?: string;
  destination_airport?: string;
  date?: string;
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
  userCards?: string[];
  verdictId?: string | null;
  searchId?: string | null;
  onAskZoe?: (context: string) => void;
  /** Lazy return-leg fetch (session-authed, lives in the page). Returns the
   *  raw return_flight object for a departure_token, or null. */
  onFetchReturnFlight?: ((departureToken: string) => Promise<CashReturnFlight | null>) | null;
  onTryDifferentDate?: () => void;
  /**
   * Color theme. "dark" (default) keeps the existing styling everywhere it's
   * used today (incl. the landing page). "light" inverts colors ONLY — adds
   * `mtw-light` to the root, which remaps the dark utilities to light via a
   * scoped block in globals.css. No structural/content change.
   */
  theme?: "light" | "dark";
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
  userCards = [],
  verdictId,
  onAskZoe,
  onFetchReturnFlight = null,
  onTryDifferentDate,
  theme = "dark",
  searchId,
}: VerdictCardProps) {
  // Metro + flex searches return multiple award_options per program (different
  // airport pairs / dates). Pin to winning_date first so flex multi-date noise
  // doesn't surface trips on a date the user didn't book (86ba4t6f1), then
  // collapse to best-per-program before any consumer (MultiHandoffGrid cards,
  // FlightSection segments) reads the list.
  const awardOptions = useMemo(
    () => dedupeByProgram(filterByDate(rawAwardOptions, winningDate)),
    [rawAwardOptions, winningDate],
  );
  const returnAwardOptions = useMemo(
    () => dedupeByProgram(filterByDate(rawReturnAwardOptions, winningReturnDate)),
    [rawReturnAwardOptions, winningReturnDate],
  );

  const [speaking, setSpeaking] = useState(false);

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
  // Round-trip-aware fallback: sum outbound + return points before scaling by
  // travelers. Pre-fix this took bestOutbound.points × travelers and dropped
  // the return-leg points, undercounting the true RT cost by ~2×.
  // Backend ships metrics.points_cost already in matched (full-booking)
  // scope, so the metrics-first branch wins whenever the backend hydrated.
  const fallbackPerTravelerPoints = bestOutbound
    ? bestOutbound.points + (bestReturn?.points ?? 0)
    : winner?.points != null
      ? winner.points + (bestReturn?.points ?? 0)
      : null;
  const displayPoints =
    metrics.points_cost ??
    (fallbackPerTravelerPoints != null ? fallbackPerTravelerPoints * travelers : null);
  const displayPointsPerTraveler =
    metrics.points_cost_per_traveler ?? fallbackPerTravelerPoints ?? null;
  const travelersCount = metrics.travelers ?? travelers;
  const displayTaxes = metrics.taxes ?? bestOutbound?.taxes ?? winner?.taxes ?? null;
  const displaySavings = metrics.estimated_savings ?? null;
  const displayCpp = metrics.cpp ?? bestOutbound?.cpp ?? winner?.cpp ?? null;
  const hasAward = displayPoints != null && displayPoints > 0;
  const showPerTravelerCaption =
    hasAward &&
    travelersCount > 1 &&
    displayPointsPerTraveler != null &&
    displayPointsPerTraveler > 0;
  const remainingSeats = bestOutbound?.remaining_seats ?? null;
  const mainExplanation = verdict.explanation || verdict.verdict || "Zoe compared the live cash fare against the strongest award option available for this trip.";

  const verdictTier = recommendation === "use_points" ? verdict.verdict_tier ?? null : null;
  const tierExplanation = recommendation === "use_points" ? verdict.tier_explanation ?? null : null;
  const tierLabel = (() => {
    if (verdictTier === "premium") return "Premium value";
    if (verdictTier === "solid") return "Solid value";
    if (verdictTier === "marginal") return "Marginal value";
    return null;
  })();
  const tierClasses = (() => {
    if (verdictTier === "premium") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
    if (verdictTier === "solid") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
    if (verdictTier === "marginal") return "border-slate-400/30 bg-slate-500/15 text-slate-200";
    return "";
  })();

  const recommendationHeadline = (() => {
    if (recommendation === "use_points") {
      return displaySavings != null
        ? `Use points — Save ~${fmtMoney(displaySavings, 0)}`
        : "Use points";
    }
    if (recommendation === "pay_cash") {
      return displayCashPrice != null
        ? `Pay cash — ${fmtMoney(displayCashPrice, 0)}`
        : "Pay cash";
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
  // Whether Zoe picked a date that differs from what the user entered. When
  // true the searched-range copy gets a prominent emerald banner so the user
  // notices the swap (was a tiny inline pill — Anshu feedback 86ba4tc81).
  const hasBetterOutboundDate = Boolean(
    winningDate && departDate && winningDate !== departDate,
  );
  const hasBetterReturnDate = Boolean(
    winningReturnDate && returnDate && winningReturnDate !== returnDate,
  );
  const hasBetterDate = hasBetterOutboundDate || hasBetterReturnDate;

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

  // Top-1 program per leg: wallet-fit-adjusted cpp, single card not five.
  // selectTopProgram returns null if all awards have null/zero cpp.
  const topOutboundAward = selectTopProgram(awardOptions, userPrograms, userCards);
  const handoffPrograms: MultiHandoffProgram[] = topOutboundAward
    ? [
        {
          program: topOutboundAward.program,
          points: topOutboundAward.points * travelers,
          taxes: topOutboundAward.taxes,
        },
      ]
    : [];
  const topReturnAward = selectTopProgram(returnAwardOptions, userPrograms, userCards);
  const returnHandoffPrograms: MultiHandoffProgram[] = topReturnAward
    ? [
        {
          program: topReturnAward.program,
          points: topReturnAward.points * travelers,
          taxes: topReturnAward.taxes,
        },
      ]
    : [];
  // Trade line (v3): ONE line, ONE basis — the round trip. Sums the two
  // chosen per-leg options (already x travelers) so the points figure covers
  // the same trip as the cash figure; cpp shown only when the engine's
  // matched-scope cpp exists (same-program both legs). Display-only.
  const tradeLegsPts =
    (handoffPrograms[0]?.points ?? 0) + (returnHandoffPrograms[0]?.points ?? 0);
  const tradeLegsTaxes =
    (handoffPrograms[0]?.taxes ?? 0) + (returnHandoffPrograms[0]?.taxes ?? 0);
  const tradePts = tradeLegsPts > 0 ? tradeLegsPts : (displayPoints ?? 0);
  const tradeTaxes = tradeLegsPts > 0 ? tradeLegsTaxes : (displayTaxes ?? 0);
  const mScope = (metrics as any).scope as string | undefined;
  const mComparison = (metrics as any).comparison_cash as number | null | undefined;
  const scopeLabel =
    mScope === "outbound_only"
      ? "outbound award \u00b7 return stays a cash purchase"
      : mScope === "one_way"
        ? "one way"
        : "round trip";
  const honestyLine =
    recommendation === "use_points" && tradePts > 0 && (mComparison ?? displayCashPrice) != null
      ? `${Number(tradePts).toLocaleString()} pts${
          tradeTaxes > 0 ? ` + ${fmtMoney(tradeTaxes, 2)}` : ""
        } instead of ${fmtMoney((mComparison ?? displayCashPrice) as number, 0)} cash${
          metrics.cpp != null ? ` \u00b7 ${metrics.cpp.toFixed(2)}\u00a2/pt` : ""
        } \u00b7 ${scopeLabel}`
      : null;

  const bestReturnDate = winningReturnDate || returnDate || "";
  // Lazy To-Flight details: only for pay_cash round trips where the provider
  // gave us a departure_token and no detailed return legs. Reuses the standard
  // inbound-leg builder so the fetched leg renders identically to the From tab.
  const lazyReturnLoader =
    onFetchReturnFlight &&
    recommendation === "pay_cash" &&
    isRoundtrip &&
    bestCashFlight?.departure_token &&
    !(bestCashFlight.return_flight?.legs?.length)
      ? async () => {
          const rf = await onFetchReturnFlight(bestCashFlight.departure_token as string);
          if (!rf) return null;
          return buildInboundLeg({
            recommendation: "pay_cash",
            isRoundtrip: true,
            bestCashFlight: { ...bestCashFlight, return_flight: rf },
            origin,
            destination,
            returnDate,
            winningReturnDate,
          });
        }
      : null;

  const cashHandoff: MultiHandoffCashAirline | null = bestCashFlight
    ? {
        airline: bestCashFlight.legs?.[0]?.airline || "the airline",
        cashPrice: bestCashFlight.price ?? displayCashPrice ?? null,
        // NEVER fall back to the verdict booking_link here — that is the AWARD
        // program's link (qantas.com / aircanada.com), and on a pay_cash verdict
        // it sent users to a site that cannot sell the cash fare. With null,
        // MultiHandoffGrid resolves the cash carrier's own site, then the
        // route-resolved Google Flights fallback.
        bookingUrl: bestCashFlight.booking_url ?? null,
      }
    : null;
  // Raw origin/destination are the user's metro CSV ("SFO,OAK,SJC"); the
  // booking section needs the single IATA the verdict actually picked.
  const firstCsv = (csv: string | undefined | null) =>
    (csv || "").split(",")[0]?.trim() || "";
  const displayOrigin =
    recommendation === "pay_cash"
      ? bestCashFlight?.legs?.[0]?.departure_iata || firstCsv(origin) || origin
      : bestOutbound?.origin_airport || firstCsv(origin) || origin;
  const displayDestination =
    recommendation === "pay_cash"
      ? bestCashFlight?.legs?.[bestCashFlight.legs.length - 1]?.arrival_iata ||
        firstCsv(destination) ||
        destination
      : bestOutbound?.destination_airport ||
        firstCsv(destination) ||
        destination;
  const routeLabel = isRoundtrip
    ? `${displayOrigin} ⇄ ${displayDestination}`
    : `${displayOrigin} → ${displayDestination}`;
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

  // Empty wallet onboarding state: logged-in user with zero programs AND
  // zero cards gets a graceful "set up your wallet" prompt above the cash
  // flights. Force cash-only legs here since the verdict may be use_points
  // (award legs would mislabel the FlightSection).
  if (userPrograms.length === 0 && userCards.length === 0) {
    const cashOutbound = buildOutboundLeg({
      recommendation: "pay_cash",
      bestOutbound,
      bestCashFlight,
      origin,
      destination,
      departDate,
      winningDate,
    });
    const cashInbound = buildInboundLeg({
      recommendation: "pay_cash",
      isRoundtrip: Boolean(isRoundtrip),
      bestOutbound,
      bestReturn,
      bestCashFlight,
      origin,
      destination,
      returnDate,
      winningReturnDate,
    });
    return (
      <div className="flex flex-col gap-5">
        <EmptyWalletCTA />
        <FlightSection
          recommendation="pay_cash"
          isRoundtrip={Boolean(isRoundtrip)}
          outbound={cashOutbound}
          inbound={cashInbound}
        />
      </div>
    );
  }

  // Partial-data branch. The backend marks degraded verdicts with
  // recommendation === "wait" rather than synthesizing a confident
  // answer. data_quality tells us which input was missing so we can
  // route to the most useful surface instead of showing a generic
  // error. Closes the SEA-TYO 2027-04-20 repro where past-horizon
  // cash searches collapsed onto ErrorStateCard.

  if (recommendation === "wait") {
    switch (verdict.data_quality) {
      case "missing_both_horizon":
        return (
          <ErrorStateCard
            headline="We could not pull data for this date"
            message="Cash and award pricing are both unavailable for this trip. Try a closer date — most providers don't publish data more than 10–11 months out."
            ctaText="Try a different date"
            onCta={onTryDifferentDate}
          />
        );
      case "missing_both_upstream":
        return (
          <ErrorStateCard
            headline="We couldn't reach pricing for this date right now"
            message="Cash and award pricing both came back empty. Try again, a nearby date, or a different cabin."
            ctaText="Try a different date"
            onCta={onTryDifferentDate}
          />
        );
      case "missing_cash_horizon":
        return (
          <PartialDataCard
            verdict={verdict}
            variant="missing_cash_horizon"
            onTryDifferentDate={onTryDifferentDate}
          />
        );
      case "missing_cash_upstream":
        return (
          <PartialDataCard
            verdict={verdict}
            variant="missing_cash_upstream"
            onTryDifferentDate={onTryDifferentDate}
          />
        );
      case "missing_awards":
        // Backend should send recommendation="pay_cash" in this case;
        // fall through to the normal render so the user still sees
        // the cash details we have.
        break;
      default:
        return (
          <PartialDataCard
            verdict={verdict}
            variant="defensive"
            onTryDifferentDate={onTryDifferentDate}
          />
        );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`${theme === "light" ? "mtw-light font-mtw " : ""}rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl md:p-6 flex flex-col`}>

            {/* Header */}
            <VerdictTopRow
              recommendationHeadline={recommendationHeadline}
              confidence={confidence}
              speaking={speaking}
              onListenToggle={speak}
              verdictId={verdictId}
            />

            <div
              data-testid="verdict-reasoning-block"
              role="region"
              aria-label="Verdict reasoning"
            >
              <p className="mt-3 max-w-4xl text-base font-medium leading-7 text-slate-300">
                {mainExplanation}
              </p>
              {displayCashPrice != null && (
                <p
                  data-testid="verdict-cash-flights"
                  className="mt-3 text-base font-semibold text-white"
                >
                  {fmtMoney(displayCashPrice, 0)}
                  {(() => {
                    const out = (bestCashFlight?.legs ?? [])
                      .map((l) => l.flight_number)
                      .filter(Boolean)
                      .join(", ");
                    const back = (bestCashFlight?.return_flight?.legs ?? [])
                      .map((l) => l.flight_number)
                      .filter(Boolean)
                      .join(", ");
                    if (!out && !back) return null;
                    return (
                      <span className="font-normal text-slate-300">
                        {out ? ` · ${out} out` : ""}
                        {back ? ` · ${back} back` : ""}
                      </span>
                    );
                  })()}
                </p>
              )}
              <p data-testid="verdict-flight-line" className="mt-1 text-sm text-slate-400">
                {routeLabel} · {bestDate}
                {isRoundtrip && bestReturnDate ? ` – ${bestReturnDate}` : ""} · {travelersLabel}
              </p>
              {searchedRangeCopy && hasBetterDate && (
                <div
                  data-testid="best-date-callout-prominent"
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 md:max-w-3xl"
                >
                  <Calendar className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-emerald-100">Better dates found</p>
                    <p className="text-xs leading-relaxed text-emerald-200/90">{searchedRangeCopy}</p>
                  </div>
                </div>
              )}
              {searchedRangeCopy && !hasBetterDate && (
                <p
                  data-testid="best-date-callout-subtle"
                  className="mt-3 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200"
                >
                  {searchedRangeCopy}
                </p>
              )}

              {honestyLine && (
                <p
                  data-testid="verdict-honesty-line"
                  className="mt-4 text-base font-medium text-slate-300"
                >
                  {honestyLine}
                </p>
              )}

              {/* Ownership fork (b2 "you have enough" / b3 "you're short") — the
                  wallet personalization the landing page sells. Was hosted inside
                  CuratedOptions and silently lost when the card v3 removed the
                  best-of-3 list (#227); re-mounted standalone. */}
              {verdict.ownership?.applicable ? (
                <OwnershipFork
                  ownership={verdict.ownership}
                  searchId={searchId ?? null}
                  verdictId={verdictId ?? null}
                />
              ) : null}

            </div>

            {(
              <>
                <FlightSection
                  recommendation={recommendation}
                  isRoundtrip={Boolean(isRoundtrip)}
                  outbound={outboundLeg}
                  inbound={inboundLeg}
                  onLoadReturnDetails={lazyReturnLoader}
                />
                {recommendation === "use_points" ? (
                  <HowToBook
                    legs={[
                      ...(handoffPrograms[0]
                        ? [{
                            legLabel: "Outbound" as const,
                            program: handoffPrograms[0].program,
                            points: handoffPrograms[0].points,
                            taxes: handoffPrograms[0].taxes,
                            date: bestDate,
                          }]
                        : []),
                      ...(isRoundtrip && returnHandoffPrograms[0]
                        ? [{
                            legLabel: "Return" as const,
                            program: returnHandoffPrograms[0].program,
                            points: returnHandoffPrograms[0].points,
                            taxes: returnHandoffPrograms[0].taxes,
                            date: bestReturnDate,
                          }]
                        : []),
                    ]}
                    verifyNote={(() => {
                      // Derived from the SAME wallet-fit selection as the
                      // displayed legs — the engine winner can be a different
                      // program, and 'Verify on Aeroplan' next to Virgin
                      // Atlantic legs sends the user to the wrong site.
                      const names = Array.from(
                        new Set(
                          [handoffPrograms[0]?.program, isRoundtrip ? returnHandoffPrograms[0]?.program : null]
                            .filter((p): p is string => Boolean(p))
                            .map((p) => getProgramHandoffInfo(p).displayName)
                        )
                      );
                      if (names.length === 0) return verdict.booking_note ?? null;
                      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
                      return `Verify the award on ${list}'s site before you transfer any points.`;
                    })()}
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

            {/* Footer controls — full app only */}
            {onAskZoe && (
              <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const cashStr = displayCashPrice != null ? fmtMoney(Math.round(displayCashPrice), 0) : null;
                    const ptsStr = displayPoints != null ? `${Number(displayPoints).toLocaleString()} points` : null;
                    const progStr = winner?.program ? winner.program.replace(/_/g, " ") : null;
                    const cppStr = metrics.cpp != null ? `${metrics.cpp.toFixed(2)} cents per point` : null;
                    const savingsStr = displaySavings != null ? `saving roughly ${fmtMoney(Math.round(displaySavings), 0)}` : null;
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
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                >
                  Ask Zoe <Sparkles className="h-4 w-4" />
                </button>
              </div>
            )}



            {recommendation !== "use_points" && verdict.booking_note && (
              <p className="mt-4 text-xs text-slate-500">{verdict.booking_note}</p>
            )}
          </div>

    </div>
  );
}
