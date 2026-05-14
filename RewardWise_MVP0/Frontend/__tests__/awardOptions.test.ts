import { describe, it, expect } from "vitest";
import { dedupeByProgram } from "../utils/awardOptions";

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
