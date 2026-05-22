import { describe, it, expect } from "vitest";
import { searchAirports } from "../components/airports";

describe("searchAirports — token-AND matching", () => {
  it('"New Delhi" returns DEL as the top hit', () => {
    const results = searchAirports("New Delhi");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("DEL");
  });

  it('"Los Angeles" returns LAX as the top hit', () => {
    const results = searchAirports("Los Angeles");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("LAX");
  });

  it('"Hong Kong" returns HKG as the top hit', () => {
    const results = searchAirports("Hong Kong");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("HKG");
  });

  it('"NEW DELHI" (uppercase) returns DEL as the top hit', () => {
    const results = searchAirports("NEW DELHI");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("DEL");
  });

  it('"DEL" (backwards compat: exact-code tier wins)', () => {
    const results = searchAirports("DEL");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("DEL");
  });

  it('"delhi india" (token-AND across city + country)', () => {
    const results = searchAirports("delhi india");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].code).toBe("DEL");
  });
});
