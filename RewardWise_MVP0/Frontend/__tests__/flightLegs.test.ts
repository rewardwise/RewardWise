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
