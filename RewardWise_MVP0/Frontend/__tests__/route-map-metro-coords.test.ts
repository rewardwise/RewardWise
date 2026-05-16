/** @format */

import { describe, it, expect } from "vitest";
import { getAirportCoordinate } from "../data/airportCoordinates";

// Approximate-equality helper for lat/lng comparisons. We do not want to
// hard-code a coordinate-table value here because the table can be updated
// independently. Asserting a bounding box keeps the test robust to small
// upstream data refinements while still catching a regression to the wrong
// metro / wrong continent.
function inBox(
  value: number,
  min: number,
  max: number,
): boolean {
  return value >= min && value <= max;
}

describe("getAirportCoordinate: metro CSV resolution (Option A first-matching-airport)", () => {
  it("origin metro CSV BAY (SFO,OAK,SJC) resolves to a Bay Area coordinate", () => {
    const coord = getAirportCoordinate("SFO,OAK,SJC");
    expect(coord, "BAY metro CSV must not fall through to undefined").toBeDefined();
    // SFO sits at roughly (37.62, -122.38). Assert a generous Bay Area box.
    expect(inBox(coord!.latitude, 37.0, 38.5)).toBe(true);
    expect(inBox(coord!.longitude, -123.5, -121.5)).toBe(true);
  });

  it("destination metro CSV TYO (NRT,HND) resolves to a Tokyo-area coordinate", () => {
    const coord = getAirportCoordinate("NRT,HND");
    expect(coord, "TYO metro CSV must not fall through to undefined").toBeDefined();
    // NRT sits at roughly (35.77, 140.39). Box covers NRT and HND both.
    expect(inBox(coord!.latitude, 35.0, 36.5)).toBe(true);
    expect(inBox(coord!.longitude, 139.0, 141.0)).toBe(true);
  });

  it("destination metro CSV BAY (SFO,OAK,SJC) resolves to a Bay Area coordinate", () => {
    // Destination side of the bug used the LAX fallback (33.94, -118.4) which
    // sat in Southern California. Verify the new logic does not regress that.
    const coord = getAirportCoordinate("SFO,OAK,SJC");
    expect(coord).toBeDefined();
    expect(inBox(coord!.latitude, 37.0, 38.5)).toBe(true);
    expect(inBox(coord!.longitude, -123.5, -121.5)).toBe(true);
  });

  it("single-airport input HND is unchanged by the metro CSV path", () => {
    const coord = getAirportCoordinate("HND");
    expect(coord, "single IATA must continue to resolve").toBeDefined();
    // HND at Haneda, Tokyo bay.
    expect(inBox(coord!.latitude, 35.0, 36.0)).toBe(true);
    expect(inBox(coord!.longitude, 139.0, 140.5)).toBe(true);
  });

  it("first-matching-airport refinement: skips unknown IATA codes inside the CSV and picks the next match", () => {
    // ZZZ is not an entry in the coord table. The metro CSV "ZZZ,NRT" should
    // skip past ZZZ and resolve to NRT rather than returning undefined.
    const coord = getAirportCoordinate("ZZZ,NRT");
    expect(coord, "must skip unknown leading code and match the next valid one").toBeDefined();
    expect(inBox(coord!.latitude, 35.0, 36.5)).toBe(true);
    expect(inBox(coord!.longitude, 139.0, 141.0)).toBe(true);
  });

  it("malformed input falls back gracefully without crashing", () => {
    expect(getAirportCoordinate(undefined)).toBeUndefined();
    expect(getAirportCoordinate(null)).toBeUndefined();
    expect(getAirportCoordinate("")).toBeUndefined();
    // All unknown codes in the CSV must return undefined (no fallback hit on
    // an arbitrary stale value).
    expect(getAirportCoordinate("ZZZ,QQQ")).toBeUndefined();
    expect(getAirportCoordinate(",,,")).toBeUndefined();
    // Whitespace-only also returns undefined.
    expect(getAirportCoordinate("   ")).toBeUndefined();
  });
});
