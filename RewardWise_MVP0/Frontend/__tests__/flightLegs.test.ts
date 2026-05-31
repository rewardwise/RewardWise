/** @format */

import { describe, it, expect } from "vitest";
import { buildOutboundLeg, buildInboundLeg } from "../utils/flightLegs";

const seg = (overrides: Record<string, unknown> = {}) => ({
  flight_number: "UA837",
  origin: "SFO",
  destination: "NRT",
  departs_at: "2026-06-15T10:30:00",
  arrives_at: "2026-06-16T14:45:00",
  ...overrides,
});

const trip = (overrides: Record<string, unknown> = {}) => ({
  total_duration: 690,
  segments: [seg()],
  ...overrides,
});

const award = (overrides: Record<string, unknown> = {}) => ({
  program: "United",
  points: 35000,
  taxes: 5.6,
  cpp: 1.8,
  direct: true,
  remaining_seats: 4,
  airlines: "United",
  trips: [trip()],
  ...overrides,
});

describe("buildOutboundLeg", () => {
  it("returns null when recommendation is wait", () => {
    expect(
      buildOutboundLeg({ recommendation: "wait", bestOutbound: award() })
    ).toBeNull();
  });

  it("builds outbound from trips[0].segments on use_points (existing path)", () => {
    const result = buildOutboundLeg({
      recommendation: "use_points",
      bestOutbound: award(),
    });
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Outbound");
    expect(result!.data_quality).toBe("detailed");
    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0].departs_at).toBe("2026-06-15T10:30:00");
    expect(result!.total_duration).toBe(690);
  });

  it("synthesizes a summary segment from realistic top-level fields when trips is empty (use_points fallback)", () => {
    // Backend reality (Backend/app/services/seats_service.py:152-179, Backend/app/api/search.py:197-212):
    // when seats.aero /trips hydration is skipped or returns no detail, AwardOption only
    // carries airlines + direct + origin_airport + destination_airport + date.
    // No per-segment timestamps or flight numbers exist at top level.
    const result = buildOutboundLeg({
      recommendation: "use_points",
      bestOutbound: award({
        trips: [],
        airlines: "Aeroplan",
        direct: true,
        origin_airport: "YVR",
        destination_airport: "FRA",
        date: "2026-07-01",
      } as Record<string, unknown>),
    });
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Outbound");
    expect(result!.data_quality).toBe("summary");
    expect(result!.segments.length).toBeGreaterThan(0);
    expect(result!.segments[0].carrier).toBe("Aeroplan");
    expect(result!.segments[0].origin).toBe("YVR");
    expect(result!.segments[0].destination).toBe("FRA");
    expect(result!.segments[0].departs_at).toBe("2026-07-01");
  });
});

describe("buildInboundLeg", () => {
  it("returns null when isRoundtrip is false", () => {
    expect(
      buildInboundLeg({
        recommendation: "use_points",
        isRoundtrip: false,
        bestOutbound: award(),
        bestReturn: award({ program: "United" }),
      })
    ).toBeNull();
  });

  it("builds inbound from bestReturn.trips[0] when bestReturn is present (existing path)", () => {
    const result = buildInboundLeg({
      recommendation: "use_points",
      isRoundtrip: true,
      bestOutbound: award(),
      bestReturn: award({
        trips: [
          trip({
            segments: [seg({ origin: "NRT", destination: "SFO", departs_at: "2026-06-22T16:00:00" })],
            total_duration: 600,
          }),
        ],
      }),
    });
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Return");
    expect(result!.segments[0].origin).toBe("NRT");
    expect(result!.segments[0].departs_at).toBe("2026-06-22T16:00:00");
  });

  it("falls back to bestOutbound.trips[1] when bestReturn is null but outbound carries a return trip", () => {
    const result = buildInboundLeg({
      recommendation: "use_points",
      isRoundtrip: true,
      bestOutbound: award({
        trips: [
          trip(),
          trip({
            segments: [seg({ origin: "NRT", destination: "SFO", departs_at: "2026-06-22T16:00:00" })],
            total_duration: 600,
          }),
        ],
      }),
      bestReturn: null,
    });
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Return");
    expect(result!.segments[0].origin).toBe("NRT");
    expect(result!.segments[0].departs_at).toBe("2026-06-22T16:00:00");
  });
});

// Regression coverage for the bug CONTRACT 8 caught on prod: Skyscanner returned
// a place record with no iata/iataCode/displayCode/code, the normalizer (post-PR
// #174) emits null for that endpoint instead of leaking the numeric place id,
// and the FE must render a READABLE airport on the leg-route span — not an
// em-dash and not "undefined". The Tier 1 cash-flight backfill below uses the
// search-param IATA when (and only when) it is a single 3-letter IATA.
describe("pay_cash endpoint backfill (PR #174 — readable fallback for null normalizer IATA)", () => {
  const cashLeg = (overrides: Record<string, unknown> = {}) => ({
    flight_number: "UA1",
    airline: "United",
    departure_iata: "SFO",
    arrival_iata: "SIN",
    departure_time: "2026-11-25T07:00:00",
    arrival_time: "2026-11-26T15:00:00",
    duration: 980,
    ...overrides,
  });

  const cashFlight = (overrides: Record<string, unknown> = {}) => ({
    total_duration: 980,
    legs: [cashLeg()],
    ...overrides,
  });

  it("backfills the outbound first.origin from a single-IATA search param when the normalizer dropped it", () => {
    const result = buildOutboundLeg({
      recommendation: "pay_cash",
      bestCashFlight: cashFlight({
        legs: [cashLeg({ departure_iata: undefined })],
      }),
      origin: "SFO",
      destination: "SIN",
    });
    expect(result).not.toBeNull();
    expect(result!.data_quality).toBe("detailed");
    expect(result!.segments[0].origin).toBe("SFO");
    expect(result!.segments[0].destination).toBe("SIN");
  });

  it("backfills the outbound last.destination from a single-IATA search param when the normalizer dropped it", () => {
    const result = buildOutboundLeg({
      recommendation: "pay_cash",
      bestCashFlight: cashFlight({
        legs: [cashLeg({ arrival_iata: undefined })],
      }),
      origin: "SFO",
      destination: "SIN",
    });
    expect(result).not.toBeNull();
    expect(result!.segments[0].origin).toBe("SFO");
    expect(result!.segments[0].destination).toBe("SIN");
  });

  it("does NOT backfill from a metro-CSV search param (SFO,OAK,SJC is not a valid IATA)", () => {
    const result = buildOutboundLeg({
      recommendation: "pay_cash",
      bestCashFlight: cashFlight({
        legs: [cashLeg({ departure_iata: undefined })],
      }),
      origin: "SFO,OAK,SJC",
      destination: "SIN",
    });
    expect(result).not.toBeNull();
    expect(result!.segments[0].origin).toBeUndefined();
    expect(result!.segments[0].destination).toBe("SIN");
  });

  it("does NOT overwrite an existing IATA on the outbound segment", () => {
    const result = buildOutboundLeg({
      recommendation: "pay_cash",
      bestCashFlight: cashFlight({
        legs: [cashLeg({ departure_iata: "EWR" })],
      }),
      origin: "SFO",
      destination: "SIN",
    });
    expect(result).not.toBeNull();
    expect(result!.segments[0].origin).toBe("EWR");
  });

  it("swaps the search params on the return leg backfill (return flies destination → origin)", () => {
    const result = buildInboundLeg({
      recommendation: "pay_cash",
      isRoundtrip: true,
      bestCashFlight: cashFlight({
        legs: [cashLeg()],
        return_flight: {
          total_duration: 990,
          legs: [
            cashLeg({
              departure_iata: undefined,
              arrival_iata: undefined,
              departure_time: "2026-12-02T22:00:00",
              arrival_time: "2026-12-03T22:00:00",
            }),
          ],
        },
      }),
      origin: "SFO",
      destination: "SIN",
    });
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Return");
    expect(result!.segments[0].origin).toBe("SIN");
    expect(result!.segments[0].destination).toBe("SFO");
  });

  it("falls through to Tier 4 search-param synthesis when bestCashFlight has no legs at all", () => {
    const result = buildOutboundLeg({
      recommendation: "pay_cash",
      bestCashFlight: cashFlight({ legs: [] }),
      origin: "SFO",
      destination: "SIN",
      departDate: "2026-11-25",
    });
    expect(result).not.toBeNull();
    expect(result!.data_quality).toBe("summary");
    expect(result!.segments[0].origin).toBe("SFO");
    expect(result!.segments[0].destination).toBe("SIN");
  });
});
