import { describe, it, expect } from "vitest";
import { dedupeByProgram, filterByDate } from "../utils/awardOptions";

type Opt = {
  program: string;
  points: number;
  direct?: boolean;
  trips?: Array<{ stops?: number }>;
};

const mk = (program: string, points: number, extra: Partial<Opt> = {}): Opt => ({
  program,
  points,
  ...extra,
});

describe("dedupeByProgram", () => {
  it("returns empty array when input is empty", () => {
    expect(dedupeByProgram([])).toEqual([]);
  });

  it("passes a single entry through unchanged", () => {
    const opts = [mk("United", 35000)];
    expect(dedupeByProgram(opts)).toEqual(opts);
  });

  it("collapses multiple entries for the same program to the lowest-points entry", () => {
    const opts = [
      mk("Aeroplan", 67400),
      mk("Aeroplan", 55000),
      mk("Aeroplan", 63200),
      mk("Aeroplan", 54600),
      mk("Aeroplan", 66700),
    ];
    const result = dedupeByProgram(opts);
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(54600);
  });

  it("preserves one entry per program when mixed, picking the cheapest of each", () => {
    const opts = [
      mk("United", 35000),
      mk("Delta", 60000),
      mk("United", 28000),
      mk("Delta", 45000),
      mk("Etihad", 43002),
    ];
    const result = dedupeByProgram(opts);
    expect(result).toHaveLength(3);
    const byProgram = Object.fromEntries(result.map((r) => [r.program, r.points]));
    expect(byProgram).toEqual({ United: 28000, Delta: 45000, Etihad: 43002 });
  });

  it("collapses byte-for-byte duplicates to a single entry", () => {
    const dup = mk("Etihad", 43002, { direct: false });
    const result = dedupeByProgram([dup, dup, dup, dup, dup, dup]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(dup);
  });

  it("tiebreaks equal points on fewer stops, preferring nonstop over 1 stop over 2 stops", () => {
    const twoStops = mk("United", 35000, { trips: [{ stops: 2 }] });
    const oneStop = mk("United", 35000, { trips: [{ stops: 1 }] });
    const nonstop = mk("United", 35000, { trips: [{ stops: 0 }] });
    const result = dedupeByProgram([twoStops, oneStop, nonstop]);
    expect(result).toHaveLength(1);
    expect(result[0].trips?.[0]?.stops).toBe(0);
  });

  it("uses direct=true as a 0-stops fallback when trips are not hydrated", () => {
    const unknownStops = mk("United", 35000);
    const directFlag = mk("United", 35000, { direct: true });
    const result = dedupeByProgram([unknownStops, directFlag]);
    expect(result).toHaveLength(1);
    expect(result[0].direct).toBe(true);
  });

  it("treats program keys case-insensitively", () => {
    const opts = [mk("UNITED", 35000), mk("united", 28000), mk("United", 30000)];
    const result = dedupeByProgram(opts);
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(28000);
  });
});

// ---------------------------------------------------------------------------
// filterByDate — pin the option list to winning_date BEFORE dedupe so
// flex-search multi-date options don't pollute the verdict surface with
// trips on a date the user didn't book (ticket 86ba4t6f1).
// ---------------------------------------------------------------------------

type DatedOpt = { program: string; points: number; date?: string };

const dated = (program: string, points: number, date?: string): DatedOpt => ({
  program,
  points,
  ...(date !== undefined && { date }),
});

describe("filterByDate", () => {
  it("passes the list through when date is null/undefined (rigid search)", () => {
    const opts = [dated("United", 35000, "2026-09-15"), dated("Delta", 60000, "2026-09-18")];
    expect(filterByDate(opts, null)).toEqual(opts);
    expect(filterByDate(opts, undefined)).toEqual(opts);
  });

  it("filters multi-date options down to the winning date", () => {
    const opts = [
      dated("United", 35000, "2026-09-14"),
      dated("United", 28000, "2026-09-16"),
      dated("Delta", 60000, "2026-09-14"),
      dated("Delta", 45000, "2026-09-16"),
      dated("Aeroplan", 55000, "2026-09-18"),
    ];
    const result = filterByDate(opts, "2026-09-16");
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.program)).toEqual(["United", "Delta"]);
    expect(result.every((o) => o.date === "2026-09-16")).toBe(true);
  });

  it("defensive fallback: when no option matches the date, return the original list", () => {
    // Malformed response (winning_date doesn't appear in any option) — render
    // SOMETHING rather than empty so the user still sees a flight.
    const opts = [dated("United", 35000, "2026-09-14"), dated("Delta", 60000, "2026-09-18")];
    const result = filterByDate(opts, "2026-12-25");
    expect(result).toEqual(opts);
  });

  it("integrates with dedupeByProgram: filter first, then collapse to one per program", () => {
    // Anshu repro: flex ±7 returns United on three dates. Backend says
    // winning_date=2026-09-16. Pre-fix: dedupe picks cheapest (28000, but
    // that's on 09-14, NOT the winning date) → Flight Details renders
    // trips on 09-14 while the verdict banner says "Better dates found
    // 2026-09-16". Post-fix: filterByDate pins to 09-16 first, dedupe
    // then sees only the 09-16 entry.
    const opts = [
      dated("United", 28000, "2026-09-14"),
      dated("United", 32000, "2026-09-16"),
      dated("United", 35000, "2026-09-18"),
    ];
    const filtered = filterByDate(opts, "2026-09-16");
    const result = dedupeByProgram(filtered);
    expect(result).toHaveLength(1);
    expect(result[0].points).toBe(32000);
    expect(result[0].date).toBe("2026-09-16");
  });
});
