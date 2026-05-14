/** @format */

import type { FlightLeg } from "@/components/verdict/FlightSection";

// Derivation logic extracted from VerdictCard.tsx. Two bug fixes folded in:
//
//   Bug 2 (return leg missing on round-trip use_points):
//     When isRoundtrip is true but rawReturnAwardOptions is empty, seats.aero
//     sometimes returns the return leg as the second entry in
//     bestOutbound.trips. Fall back to trips[1] instead of returning null.
//
//   Bug 3 (FlightSection missing on use_points when trips is empty):
//     When seats.aero /trips hydration is skipped or returns no detail,
//     bestOutbound.trips is empty. We previously returned null. Now we
//     synthesize a single summary segment from the top-level award fields
//     (airlines, origin_airport, destination_airport, date) and mark the leg
//     data_quality: "summary" so FlightSection can render a disclaimer.

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

function synthesizeSummarySegment(award: AwardOptionLike): AwardSegmentLike | null {
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

export function buildOutboundLeg(args: BuildLegArgs): FlightLeg | null {
  const { recommendation, bestOutbound, bestCashFlight } = args;

  if (recommendation === "wait") return null;

  if (recommendation === "use_points" && bestOutbound) {
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
    const summary = synthesizeSummarySegment(bestOutbound);
    if (summary) {
      return {
        label: "Outbound",
        segments: [summary],
        data_quality: "summary",
      };
    }
    return null;
  }

  if (recommendation === "pay_cash" && bestCashFlight) {
    const segments = cashLegsToSegments(bestCashFlight.legs);
    if (segments.length === 0) return null;
    return {
      label: "Outbound",
      segments,
      total_duration: bestCashFlight.total_duration,
      data_quality: "detailed",
    };
  }

  return null;
}

export function buildInboundLeg(args: BuildLegArgs): FlightLeg | null {
  const { recommendation, isRoundtrip, bestOutbound, bestReturn, bestCashFlight } = args;

  if (!isRoundtrip) return null;

  if (recommendation === "use_points") {
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
    // Bug 2 fallback: seats.aero round-trip awards sometimes pack the return
    // into bestOutbound.trips[1] rather than a separate bestReturn.
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
    return null;
  }

  if (recommendation === "pay_cash" && bestCashFlight?.return_flight) {
    const ret = bestCashFlight.return_flight;
    const segments = cashLegsToSegments(ret.legs);
    if (segments.length === 0) return null;
    return {
      label: "Return",
      segments,
      total_duration: ret.total_duration,
      data_quality: "detailed",
    };
  }

  return null;
}
