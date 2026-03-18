/** @format */
"use client";

import { useState } from "react";
import { ExternalLink, Search, Sparkles, Zap, PlaneTakeoff, PlaneLanding, Bell, Check } from "lucide-react";
import { useAlerts } from "@/context/AlertContext";

// ─── TYPES ────────────────────────────────────────────────────────────────────

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
  winner: VerdictWinner | null;
  pay_cash: boolean;
  confidence: "high" | "medium" | "low";
  booking_note: string;
  booking_link: BookingLink;
}

// SerpAPI leg (one segment of a cash flight)
interface CashLeg {
  flight_number?: string;
  airline?: string;
  airline_logo?: string;
  airplane?: string;
  travel_class?: string;
  legroom?: string;
  duration?: number;           // minutes
  departure_airport?: string;
  departure_iata?: string;
  departure_time?: string;     // "2026-04-20 06:00"
  arrival_airport?: string;
  arrival_iata?: string;
  arrival_time?: string;
  overnight?: boolean;
  often_delayed?: boolean;
}

// SerpAPI parsed flight (from _parse_flight)
interface CashReturnFlight {
  departure_airport?: string;
  departure_iata?: string;
  departure_time?: string;
  arrival_airport?: string;
  arrival_iata?: string;
  arrival_time?: string;
  total_duration?: number;
  stops?: number;
  legs?: CashLeg[];
}

interface CashFlight {
  price?: number;
  total_duration?: number;     // outbound minutes
  stops?: number;
  departure_airport?: string;
  departure_iata?: string;
  departure_time?: string;
  arrival_airport?: string;
  arrival_iata?: string;
  arrival_time?: string;
  legs?: CashLeg[];
  return_flight?: CashReturnFlight | null;
}

// seats.aero trip segment
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
  trip_ids?: string[];
  trips?: TripDetail[];
  source?: string;
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
  flights?: CashFlight[];      // SerpAPI flights — used when pay_cash=true
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildGoogleFlightsUrl(origin: string, destination: string, departDate: string, returnDate?: string | null, cabin?: string): string {
  const cabinStr = ({ economy: "economy", premium: "premium economy", business: "business", first: "first class" } as Record<string, string>)[cabin ?? "economy"] ?? "economy";
  const q = returnDate
    ? `Flights from ${origin} to ${destination} on ${departDate} returning ${returnDate} ${cabinStr}`
    : `Flights from ${origin} to ${destination} on ${departDate} ${cabinStr}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(t?: string) {
  // SerpAPI gives "2026-04-20 06:00" or ISO
  if (!t) return "";
  const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDuration(mins?: number) {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtProgram(s: string) {
  return s.split(/[\s_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function cabinLabel(c?: string) {
  return ({ economy: "Economy", premium: "Premium Economy", business: "Business", first: "First Class" } as Record<string, string>)[c ?? "economy"] ?? "Economy";
}

// ─── CASH FLIGHT LEG ROW (SerpAPI) ───────────────────────────────────────────

function CashLegRow({ flight, isReturn, label }: { flight: CashFlight | CashReturnFlight; isReturn?: boolean; label?: string }) {
  const Icon = isReturn ? PlaneLanding : PlaneTakeoff;
  const firstLeg = flight.legs?.[0];
  const lastLeg = flight.legs?.[flight.legs.length - 1];

  // Build airline name — could be multi-airline
  const airlines = [...new Set(flight.legs?.map((l) => l.airline).filter(Boolean))].join(", ");

  // Flight numbers
  const flightNums = flight.legs?.map((l) => l.flight_number).filter(Boolean).join(", ") ?? "";

  // Aircraft from first leg
  const aircraft = firstLeg?.airplane ?? "";

  const depTime = fmtTime(flight.departure_time ?? firstLeg?.departure_time);
  const arrTime = fmtTime(flight.arrival_time ?? lastLeg?.arrival_time);
  const depIata = flight.departure_iata ?? firstLeg?.departure_iata ?? "";
  const arrIata = flight.arrival_iata ?? lastLeg?.arrival_iata ?? "";

  return (
    <div className="py-4 border-b border-white/[0.06] last:border-0">
      <p className="text-[10px] font-bold uppercase mb-3" style={{ color: "#475569", letterSpacing: "0.12em" }}>
        {label ?? (isReturn ? "Return" : "Outbound")}
      </p>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <Icon className="w-4 h-4 text-indigo-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Airline + flight numbers */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm">{airlines || "—"}</p>
            {flightNums && (
              <span className="text-gray-500 text-xs font-mono">{flightNums}</span>
            )}
          </div>

          {/* Times + route */}
          {(depTime || depIata) && (
            <p className="text-sm font-medium mt-0.5" style={{ color: "#94a3b8" }}>
              {depIata && arrIata ? `${depIata} → ${arrIata}` : ""}
              {depTime && arrTime ? `  ·  ${depTime} – ${arrTime}` : ""}
            </p>
          )}

          {/* Duration · stops · aircraft */}
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            {fmtDuration(flight.total_duration)}
            {flight.stops !== undefined && (
              <> · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}</>
            )}
            {aircraft && <> · {aircraft}</>}
          </p>

          {/* Per-leg breakdown for connecting */}
          {(flight.legs?.length ?? 0) > 1 && (
            <div className="mt-2 space-y-0.5 pl-2 border-l border-white/[0.08]">
              {flight.legs!.map((leg, i) => (
                <p key={i} className="text-[10px]" style={{ color: "#334155" }}>
                  {leg.flight_number ?? "—"}
                  {leg.departure_iata && leg.arrival_iata ? ` · ${leg.departure_iata} → ${leg.arrival_iata}` : ""}
                  {leg.airplane ? ` · ${leg.airplane}` : ""}
                  {leg.departure_time ? `  ${fmtTime(leg.departure_time)}` : ""}
                  {leg.overnight ? " 🌙" : ""}
                </p>
              ))}
            </div>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="inline-flex items-center text-[10px] rounded-full px-2 py-0.5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
              Google Flights
            </span>
            {firstLeg?.legroom && (
              <span className="inline-flex items-center text-[10px] rounded-full px-2 py-0.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                {firstLeg.legroom}
              </span>
            )}
          </div>
        </div>

        {/* Price shown in footer, not here */}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── AWARD LEG ROW (seats.aero) ──────────────────────────────────────────────

function AwardLegRow({ direction, option, cabin, travelers, isReturn }: {
  direction: string;
  option: AwardOption;
  cabin?: string;
  travelers: number;
  isReturn?: boolean;
}) {
  const pts = option.points * travelers;
  const trip = option.trips?.[0] ?? null;
  const segs = trip?.segments ?? [];
  const firstSeg = segs[0];
  const lastSeg = segs[segs.length - 1];
  const Icon = isReturn ? PlaneLanding : PlaneTakeoff;

  const flightNums = trip?.flight_numbers || segs.map((s) => s.flight_number).filter(Boolean).join(", ") || null;
  const aircraft = firstSeg?.aircraft_name ?? null;
  const departTime = fmtTime(trip?.departs_at ?? firstSeg?.departs_at);
  const arriveTime = fmtTime(trip?.arrives_at ?? lastSeg?.arrives_at);
  const stops = trip?.stops ?? (segs.length > 1 ? segs.length - 1 : option.direct ? 0 : null);
  const routeFrom = firstSeg?.origin ?? null;
  const routeTo = lastSeg?.destination ?? null;

  return (
    <div className="py-4 border-b border-white/[0.06] last:border-0">
      <p className="text-[10px] font-bold uppercase mb-3" style={{ color: "#475569", letterSpacing: "0.12em" }}>
        {direction}
      </p>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <Icon className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm">{fmtProgram(option.program)}</p>
            {flightNums && <span className="text-gray-500 text-xs font-mono">{flightNums}</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            {cabinLabel(cabin)} · {travelers} {travelers === 1 ? "passenger" : "passengers"}
            {stops !== null && <> · {stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}</>}
            {trip?.total_duration ? <> · {fmtDuration(trip.total_duration)}</> : null}
          </p>
          {(routeFrom || departTime) && (
            <p className="text-xs mt-0.5" style={{ color: "#334155" }}>
              {routeFrom && routeTo ? `${routeFrom} → ${routeTo}` : ""}
              {departTime && arriveTime ? `  ${departTime} – ${arriveTime}` : ""}
            </p>
          )}
          {aircraft && <p className="text-xs mt-0.5" style={{ color: "#334155" }}>{aircraft}</p>}
          {segs.length > 1 && (
            <div className="mt-2 space-y-0.5 pl-2 border-l border-white/[0.08]">
              {segs.map((seg, i) => (
                <p key={i} className="text-[10px]" style={{ color: "#334155" }}>
                  {seg.flight_number ?? "—"}
                  {seg.origin && seg.destination ? ` · ${seg.origin} → ${seg.destination}` : ""}
                  {seg.aircraft_name ? ` · ${seg.aircraft_name}` : ""}
                  {seg.departs_at ? `  ${fmtTime(seg.departs_at)}` : ""}
                </p>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {option.source === "seats.aero" && (
              <span className="inline-flex items-center text-[10px] rounded-full px-2 py-0.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                seats.aero
              </span>
            )}
            {option.airlines && option.airlines !== option.program && (
              <span className="inline-flex items-center text-[10px] rounded-full px-2 py-0.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
                {option.airlines}
              </span>
            )}
            {option.remaining_seats > 0 && option.remaining_seats <= 4 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                <Zap className="w-3 h-3" />
                {option.remaining_seats} seat{option.remaining_seats > 1 ? "s" : ""} left
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-sm" style={{ color: "#34d399" }}>{pts.toLocaleString()} pts</p>
          {option.taxes != null && option.taxes > 0 && (
            <p className="text-xs" style={{ color: "#475569" }}>+${option.taxes} fees</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

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
}: VerdictCardProps) {
  const { addToWatchlist, isWatching } = useAlerts();
  const alreadyWatching = isWatching(origin, destination, departDate);
  const [justAdded, setJustAdded] = useState(false);

  const handleSetAlert = () => {
    if (alreadyWatching || justAdded) return;
    const totalPts = !pay_cash && winner?.points ? winner.points * travelers : null;
    addToWatchlist({
      origin,
      destination,
      departDate,
      returnDate,
      cabin: cabin ?? "economy",
      travelers,
      isRoundtrip: isRoundtrip ?? false,
      cashPrice,
      pointsRequired: totalPts,
      program: winner?.program ?? null,
      verdict: pay_cash ? "cash" : "points",
    });
    setJustAdded(true);
  };

  const { winner, pay_cash, booking_link, confidence } = verdict;

  const bookingUrl =
    booking_link.preferred === "seats_aero" && booking_link.seats_aero_link
      ? booking_link.seats_aero_link
      : booking_link.airline_link ?? null;

  const googleFlightsUrl = buildGoogleFlightsUrl(origin, destination, departDate, returnDate, cabin);

  // Award path — best outbound matching winner's program
  const bestOutbound = !pay_cash && winner?.program
    ? (awardOptions.find((o) => o.program.toLowerCase() === winner.program!.toLowerCase()) ?? awardOptions[0])
    : awardOptions[0];
  const bestReturn = returnAwardOptions[0] ?? null;

  const outPts = bestOutbound ? bestOutbound.points * travelers : 0;
  const retPts = isRoundtrip && bestReturn ? bestReturn.points * travelers : 0;
  const totalPoints = outPts + retPts;

  const totalTaxes = (bestOutbound?.taxes ?? 0) + (isRoundtrip && bestReturn ? (bestReturn.taxes ?? 0) : 0);
  const savings = cashPrice != null && cashPrice > 0 ? Math.max(0, cashPrice - totalTaxes) : null;

  // Cash path — best SerpAPI flight (index 0 = cheapest)
  const bestCashFlight = flights[0] ?? null;

  const confidenceColor = { high: "#34d399", medium: "#fbbf24", low: "#6b7280" }[confidence] ?? "#6b7280";

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 25px 60px rgba(0,0,0,0.4)" }}>

      {/* ══ LEFT — Verdict ══ */}
      <div className="flex flex-col p-5 gap-4" style={{ background: "linear-gradient(150deg, #1e293b 0%, #0f172a 100%)" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" style={{ color: "#34d399" }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: "#34d399", letterSpacing: "0.14em" }}>The Verdict</span>
          </div>
          <span className="text-[10px] font-bold uppercase" style={{ color: confidenceColor, letterSpacing: "0.12em" }}>
            {confidence} confidence
          </span>
        </div>

        {/* Decision */}
        <div>
          <p className="text-4xl font-extrabold leading-none mb-2" style={{ color: pay_cash ? "#fbbf24" : "#ffffff" }}>
            {pay_cash ? "Pay Cash" : "Use Points"}
          </p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            {origin.toUpperCase()} → {destination.toUpperCase()}
            {isRoundtrip ? ` → ${origin.toUpperCase()} · Round trip` : " · One way"}
          </p>
          {!pay_cash && winner?.program && (
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
              {fmtProgram(winner.program)}
              {isRoundtrip && bestReturn && bestReturn.program !== winner.program ? ` → ${fmtProgram(bestReturn.program)}` : ""}
            </p>
          )}
        </div>

        {/* Gemini text */}
        <p className="text-sm leading-relaxed flex-1" style={{ color: "#cbd5e1" }}>{verdict.verdict}</p>

        {/* Stats */}
        {!pay_cash && totalPoints > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <p className="font-bold text-base leading-tight" style={{ color: "#fff" }}>{totalPoints.toLocaleString()}</p>
              <p className="text-[10px] mt-0.5 uppercase" style={{ color: "#64748b", letterSpacing: "0.08em" }}>Points</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <p className="font-bold text-base leading-tight" style={{ color: "#fff" }}>${cashPrice ?? "—"}</p>
              <p className="text-[10px] mt-0.5 uppercase" style={{ color: "#64748b", letterSpacing: "0.08em" }}>Cash</p>
            </div>
            {savings != null && savings > 0 && (
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <p className="font-bold text-base leading-tight" style={{ color: "#34d399" }}>~${savings.toLocaleString()}</p>
                <p className="text-[10px] mt-0.5 uppercase" style={{ color: "#64748b", letterSpacing: "0.08em" }}>Saved</p>
              </div>
            )}
          </div>
        ) : pay_cash && cashPrice ? (
          <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-3xl font-extrabold" style={{ color: "#fbbf24" }}>${cashPrice}</p>
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>best available cash fare</p>
          </div>
        ) : null}

        {/* Booking note */}
        {verdict.booking_note && (
          <p className="text-xs italic" style={{ color: "#475569" }}>{verdict.booking_note}</p>
        )}
      </div>

      {/* ══ RIGHT — Booking Summary ══ */}
      <div className="flex flex-col" style={{ background: "#0d1424", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Purple header */}
        <div className="px-5 py-5 text-center" style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #1e1b4b 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <p className="text-[10px] font-bold uppercase mb-2" style={{ color: "#a5b4fc", letterSpacing: "0.14em" }}>Booking Summary</p>
          <p className="text-white text-2xl font-extrabold tracking-tight">
            {origin.toUpperCase()} ↔ {destination.toUpperCase()}
          </p>
          <p className="text-xs mt-1" style={{ color: "#a5b4fc" }}>
            {formatDate(departDate)}{returnDate ? ` – ${formatDate(returnDate)}` : ""}
          </p>
        </div>

        {/* Legs */}
        <div className="px-5 flex-1">
          {pay_cash ? (
            // ── Cash path: SerpAPI flights ──
            bestCashFlight ? (
              <>
                <CashLegRow flight={bestCashFlight} label={isRoundtrip ? "Outbound" : "Flight"} isReturn={false} />
                {isRoundtrip && bestCashFlight.return_flight && (
                  <CashLegRow flight={bestCashFlight.return_flight} label="Return" isReturn={true} />
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>Cash beats points here</p>
                <p className="text-xs mt-1" style={{ color: "#475569" }}>Award rates don't offer enough value on this route.</p>
              </div>
            )
          ) : (
            // ── Award path: seats.aero ──
            bestOutbound ? (
              <>
                <AwardLegRow
                  direction={isRoundtrip ? "Outbound" : "Flight"}
                  option={bestOutbound}
                  cabin={cabin}
                  travelers={travelers}
                  isReturn={false}
                />
                {isRoundtrip && bestReturn && (
                  <AwardLegRow
                    direction="Return"
                    option={bestReturn}
                    cabin={cabin}
                    travelers={travelers}
                    isReturn={true}
                  />
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>No award space found</p>
                <p className="text-xs mt-1" style={{ color: "#475569" }}>Try different dates or cabin class.</p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {!pay_cash && totalPoints > 0 ? (
            <>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: "#64748b", letterSpacing: "0.12em" }}>Points Required</p>
                  <p className="text-2xl font-extrabold" style={{ color: "#fff" }}>{totalPoints.toLocaleString()} pts</p>
                  {travelers > 1 && (
                    <p className="text-xs" style={{ color: "#475569" }}>{travelers} travelers · {(totalPoints / travelers).toLocaleString()} ea</p>
                  )}
                </div>
                {savings != null && savings > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: "#64748b", letterSpacing: "0.12em" }}>You Save</p>
                    <p className="text-2xl font-extrabold" style={{ color: "#34d399" }}>~${savings.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {bookingUrl ? (
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full text-sm font-bold py-3.5 rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: "linear-gradient(90deg, #10b981, #059669)", color: "#fff" }}>
                  Book This Flight <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <a href={googleFlightsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full text-sm font-bold py-3.5 rounded-xl transition-all hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #10b981, #059669)", color: "#fff" }}>
                  <Search className="w-4 h-4" /> Search Google Flights
                </a>
              )}
              <p className="text-[10px] text-center mt-2" style={{ color: "#334155" }}>⚠ Verify availability before transferring points</p>
              <button
                onClick={handleSetAlert}
                disabled={alreadyWatching || justAdded}
                className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-3 rounded-xl transition-all mt-2"
                style={{
                  background: alreadyWatching || justAdded ? "rgba(255,255,255,0.05)" : "rgba(251,191,36,0.1)",
                  border: `1px solid ${alreadyWatching || justAdded ? "rgba(255,255,255,0.1)" : "rgba(251,191,36,0.3)"}`,
                  color: alreadyWatching || justAdded ? "#64748b" : "#fbbf24",
                  cursor: alreadyWatching || justAdded ? "default" : "pointer",
                }}
              >
                {alreadyWatching || justAdded ? (
                  <><Check className="w-4 h-4" /> Alert Set</>
                ) : (
                  <><Bell className="w-4 h-4" /> Set Alert for This Route</>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase mb-0.5" style={{ color: "#64748b", letterSpacing: "0.12em" }}>Best Cash Price</p>
                <p className="text-2xl font-extrabold" style={{ color: "#fbbf24" }}>${cashPrice ?? "—"}</p>
              </div>
              <a href={googleFlightsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full text-sm font-bold py-3.5 rounded-xl transition-all hover:brightness-110"
                style={{ background: "linear-gradient(90deg, #10b981, #059669)", color: "#fff" }}>
                Find Cash Fares <Search className="w-4 h-4" />
              </a>
              <button
                onClick={handleSetAlert}
                disabled={alreadyWatching || justAdded}
                className="flex items-center justify-center gap-2 w-full text-sm font-semibold py-3 rounded-xl transition-all mt-2"
                style={{
                  background: alreadyWatching || justAdded ? "rgba(255,255,255,0.05)" : "rgba(251,191,36,0.1)",
                  border: `1px solid ${alreadyWatching || justAdded ? "rgba(255,255,255,0.1)" : "rgba(251,191,36,0.3)"}`,
                  color: alreadyWatching || justAdded ? "#64748b" : "#fbbf24",
                  cursor: alreadyWatching || justAdded ? "default" : "pointer",
                }}
              >
                {alreadyWatching || justAdded ? (
                  <><Check className="w-4 h-4" /> Alert Set</>
                ) : (
                  <><Bell className="w-4 h-4" /> Set Alert for This Route</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}