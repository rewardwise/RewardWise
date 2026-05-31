/** @format */

import type { FlightLeg } from "@/components/verdict/FlightSection";

// 5-tier synthesis chain for outbound + inbound flight legs. Both builders
// route through shared synthesize* helpers so an asymmetric fallback gap
// cannot recur (the root cause of ticket 86ba2ze48: inbound previously had
// no summary tier, so production round-trips with empty trips[] hid the
// return leg entirely while outbound still rendered via summary fallback).
//
//   Tier 1: detailed segments from trips[0] (use_points) or legs (pay_cash)
//   Tier 2: outbound-only fallback to bestOutbound.trips[1] for seats.aero
//           combined round-trip awards (inbound use_points only)
//   Tier 3: synthesize a single summary segment from the award object's
//           top-level fields (airlines, origin_airport, destination_airport,
//           date) when trips is empty (use_points only)
//   Tier 4: synthesize from search params (date + origin/destination) when
//           no award object is available at all but the search range is known.
//           Pay-cash skips Tier 2/3 (no award object) and falls from Tier 1
//           straight to Tier 4 when legs / return_flight.legs is empty.
//   Tier 5: null (truly no data, leg omitted)

interface AwardSegmentLike {
  flight_number?: string;
  carrier?: string;
  origin?: string;
  destination?: string;
  departs_at?: string;
  arrives_at?: string;
  duration?: number;
}

interface AwardTripLike {
  total_duration?: number;
  segments?: AwardSegmentLike[];
}

export interface AwardOptionLike {
  program?: string;
  airlines?: string;
  direct?: boolean;
  origin_airport?: string;
  destination_airport?: string;
  date?: string;
  trips?: AwardTripLike[];
}

interface CashLegLike {
  flight_number?: string;
  airline?: string;
  departure_iata?: string;
  arrival_iata?: string;
  departure_time?: string;
  arrival_time?: string;
  duration?: number;
}

export interface CashFlightLike {
  total_duration?: number;
  legs?: CashLegLike[];
  return_flight?: {
    total_duration?: number;
    legs?: CashLegLike[];
  } | null;
}

export interface BuildLegArgs {
  recommendation: "use_points" | "pay_cash" | "wait";
  bestOutbound?: AwardOptionLike | null;
  bestReturn?: AwardOptionLike | null;
  bestCashFlight?: CashFlightLike | null;
  isRoundtrip?: boolean;
  origin?: string | null;
  destination?: string | null;
  departDate?: string | null;
  winningDate?: string | null;
  returnDate?: string | null;
  winningReturnDate?: string | null;
}

function awardTripToSegments(
  trip: AwardTripLike | undefined,
  airlines: string | undefined
): AwardSegmentLike[] {
  return (trip?.segments ?? []).map((s) => ({
    flight_number: s.flight_number,
    carrier: airlines,
    origin: s.origin,
    destination: s.destination,
    departs_at: s.departs_at,
    arrives_at: s.arrives_at,
  }));
}

function cashLegsToSegments(legs: CashLegLike[] | undefined): AwardSegmentLike[] {
  return (legs ?? []).map((leg) => ({
    flight_number: leg.flight_number,
    carrier: leg.airline,
    origin: leg.departure_iata,
    destination: leg.arrival_iata,
    departs_at: leg.departure_time,
    arrives_at: leg.arrival_time,
    duration: leg.duration,
  }));
}

// Return the input only if it's a single 3-letter IATA. Metro CSVs
// ("SFO,OAK,SJC") and other non-IATA shapes return undefined so the leg
// renders the em-dash placeholder rather than dumping CSV / garbage into
// the airport span. Used for safe search-param backfill on the cash-flight
// Tier 1 path when the normalizer's place lookup couldn't resolve an IATA.
function singleIataOrUndefined(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return /^[A-Z]{3}$/.test(value) ? value : undefined;
}

// Backfill missing endpoint IATAs on a cash-flight Tier 1 segment list
// from the search-param IATA. Only the leg's first.origin and
// last.destination are eligible (those are the booking endpoints by
// construction — FlightAPI returned a flight FROM searchOrigin TO
// searchDestination). Intermediate stops are left untouched.
//
// Why this exists: Skyscanner sometimes returns place records with no
// iata/iataCode/displayCode/code field. Pre-PR #174 the normalizer leaked
// the numeric place id (16216) as the IATA; PR #174 emits null instead.
// Without this backfill, null surfaces as "—" via FlightSection's
// {first?.origin || "—"} fallback, producing "— → —" on the leg-route
// span — graceful but uninformative when we know the search endpoints.
function backfillCashEndpoints(
  segments: AwardSegmentLike[],
  legOrigin: string | null | undefined,
  legDestination: string | null | undefined
): AwardSegmentLike[] {
  if (segments.length === 0) return segments;
  const originBackfill = singleIataOrUndefined(legOrigin);
  const destinationBackfill = singleIataOrUndefined(legDestination);
  const next = [...segments];
  if (!next[0].origin && originBackfill) {
    next[0] = { ...next[0], origin: originBackfill };
  }
  const lastIdx = next.length - 1;
  if (!next[lastIdx].destination && destinationBackfill) {
    next[lastIdx] = { ...next[lastIdx], destination: destinationBackfill };
  }
  return next;
}

// Tier 3 synthesis: build a single summary segment from an award object's
// top-level fields. Used when seats.aero /trips hydration was skipped and
// trips[].segments is empty but the award itself still carries
// airlines / origin_airport / destination_airport / date.
function synthesizeSegmentFromAward(
  award: AwardOptionLike | null | undefined
): AwardSegmentLike | null {
  if (!award) return null;
  const origin = award.origin_airport;
  const destination = award.destination_airport;
  if (!origin || !destination) return null;
  return {
    carrier: award.airlines,
    origin,
    destination,
    departs_at: award.date,
  };
}

// Tier 4 synthesis: build a single segment purely from search params when
// no award object is available. Carrier shows as a generic placeholder so
// the user still sees the route + date even when the upstream provider
// returned no structured option for this leg.
function synthesizeSegmentFromSearchParams(
  date: string | null | undefined,
  origin: string | null | undefined,
  destination: string | null | undefined,
  placeholderCarrier: string
): AwardSegmentLike | null {
  if (!date || !origin || !destination) return null;
  return {
    carrier: placeholderCarrier,
    origin,
    destination,
    departs_at: date,
  };
}

export function buildOutboundLeg(args: BuildLegArgs): FlightLeg | null {
  const { recommendation, bestOutbound, bestCashFlight, origin, destination, departDate, winningDate } = args;

  if (recommendation === "wait") return null;

  if (recommendation === "use_points") {
    // Tier 1: detailed segments from bestOutbound.trips[0]
    if (bestOutbound) {
      const trip = bestOutbound.trips?.[0];
      const segments = awardTripToSegments(trip, bestOutbound.airlines);
      if (segments.length > 0) {
        return {
          label: "Outbound",
          segments,
          total_duration: trip?.total_duration,
          data_quality: "detailed",
        };
      }
    }
    // Tier 3: synthesize from bestOutbound top-level fields
    const fromAward = synthesizeSegmentFromAward(bestOutbound);
    if (fromAward) {
      return {
        label: "Outbound",
        segments: [fromAward],
        data_quality: "summary",
      };
    }
    // Tier 4: synthesize from search params
    const fromParams = synthesizeSegmentFromSearchParams(
      winningDate ?? departDate,
      origin,
      destination,
      "Outbound flight"
    );
    if (fromParams) {
      return {
        label: "Outbound",
        segments: [fromParams],
        data_quality: "summary",
      };
    }
    return null;
  }

  if (recommendation === "pay_cash") {
    // Tier 1: detailed segments from bestCashFlight.legs
    if (bestCashFlight) {
      const rawSegments = cashLegsToSegments(bestCashFlight.legs);
      if (rawSegments.length > 0) {
        const segments = backfillCashEndpoints(rawSegments, origin, destination);
        return {
          label: "Outbound",
          segments,
          total_duration: bestCashFlight.total_duration,
          data_quality: "detailed",
        };
      }
    }
    // Tier 4: synthesize from search params (pay_cash has no award object for Tier 3)
    const fromParams = synthesizeSegmentFromSearchParams(
      winningDate ?? departDate,
      origin,
      destination,
      "Outbound flight"
    );
    if (fromParams) {
      return {
        label: "Outbound",
        segments: [fromParams],
        data_quality: "summary",
      };
    }
    return null;
  }

  return null;
}

export function buildInboundLeg(args: BuildLegArgs): FlightLeg | null {
  const {
    recommendation,
    isRoundtrip,
    bestOutbound,
    bestReturn,
    bestCashFlight,
    origin,
    destination,
    returnDate,
    winningReturnDate,
  } = args;

  if (!isRoundtrip) return null;

  if (recommendation === "use_points") {
    // Tier 1: detailed segments from bestReturn.trips[0]
    if (bestReturn) {
      const trip = bestReturn.trips?.[0];
      const segments = awardTripToSegments(trip, bestReturn.airlines);
      if (segments.length > 0) {
        return {
          label: "Return",
          segments,
          total_duration: trip?.total_duration,
          data_quality: "detailed",
        };
      }
    }
    // Tier 2: seats.aero combined round-trip awards sometimes pack the return
    // into bestOutbound.trips[1] rather than a separate bestReturn entry.
    if (bestOutbound) {
      const returnTrip = bestOutbound.trips?.[1];
      const segments = awardTripToSegments(returnTrip, bestOutbound.airlines);
      if (segments.length > 0) {
        return {
          label: "Return",
          segments,
          total_duration: returnTrip?.total_duration,
          data_quality: "detailed",
        };
      }
    }
    // Tier 3: synthesize from bestReturn top-level fields (matches outbound symmetry)
    const fromAward = synthesizeSegmentFromAward(bestReturn);
    if (fromAward) {
      return {
        label: "Return",
        segments: [fromAward],
        data_quality: "summary",
      };
    }
    // Tier 4: synthesize from search params (return = destination -> origin swap)
    const fromParams = synthesizeSegmentFromSearchParams(
      winningReturnDate ?? returnDate,
      destination,
      origin,
      "Return flight"
    );
    if (fromParams) {
      return {
        label: "Return",
        segments: [fromParams],
        data_quality: "summary",
      };
    }
    return null;
  }

  if (recommendation === "pay_cash") {
    // Tier 1: detailed segments from bestCashFlight.return_flight.legs
    if (bestCashFlight?.return_flight) {
      const ret = bestCashFlight.return_flight;
      const rawSegments = cashLegsToSegments(ret.legs);
      if (rawSegments.length > 0) {
        // Return leg flies destination → origin, so the endpoint backfill
        // swaps the search params (last.destination = searchOrigin).
        const segments = backfillCashEndpoints(rawSegments, destination, origin);
        return {
          label: "Return",
          segments,
          total_duration: ret.total_duration,
          data_quality: "detailed",
        };
      }
    }
    // Tier 4: synthesize from search params (pay_cash has no award object for Tier 3)
    const fromParams = synthesizeSegmentFromSearchParams(
      winningReturnDate ?? returnDate,
      destination,
      origin,
      "Return flight"
    );
    if (fromParams) {
      return {
        label: "Return",
        segments: [fromParams],
        data_quality: "summary",
      };
    }
    return null;
  }

  return null;
}
