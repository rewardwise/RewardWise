/** @format */

import { describe, expect, it } from "vitest";
import {
  PROGRAM_ALIASES,
} from "../utils/programAliases";
import {
  PROGRAM_DISPLAY_NAMES,
  PROGRAM_HOMEPAGE_URLS,
  getProgramHandoffInfo,
} from "../utils/airlines";

// Pre-fix bug (live in prod 2026-05-30, BAY→SIN audit): the booking section
// rendered the raw seats.aero program key (e.g. "singapore") as the program
// name AND fell through to a "Book directly on singapore" badge with no href.
// Root cause: PROGRAM_DISPLAY_NAMES + PROGRAM_HOMEPAGE_URLS only covered 10 of
// the ~24 keys backend emits via PROGRAM_ALIASES.

describe("getProgramHandoffInfo — every seats.aero source resolves cleanly", () => {
  it.each(Object.keys(PROGRAM_ALIASES))(
    "%s: display name is human-readable and URL is navigable (not '#', not raw key)",
    (key) => {
      const info = getProgramHandoffInfo(key);
      // Falsifying assertion #1: display name is NOT the raw lowercase slug.
      // "singapore" must NOT render as "singapore" in the UI.
      expect(
        info.displayName,
        `Program "${key}" must have a human-readable display name, not the raw slug`,
      ).not.toBe(key);
      expect(
        info.displayName.length,
        `Program "${key}" display name should be at least 2 chars`,
      ).toBeGreaterThan(1);
      // Falsifying assertion #2: URL is a real homepage, not "#".
      // The Bug D dead-CTA branch in MultiHandoffGrid fires on `url === "#"`.
      expect(
        info.url,
        `Program "${key}" must have a navigable URL, not "#"`,
      ).not.toBe("#");
      expect(info.url).toMatch(/^https:\/\//);
    },
  );

  it("singapore resolves to 'Singapore KrisFlyer' and singaporeair.com (BAY→SIN repro)", () => {
    const info = getProgramHandoffInfo("singapore");
    expect(info.displayName).toBe("Singapore KrisFlyer");
    expect(info.url).toContain("singaporeair.com");
  });

  it("cathay resolves to 'Cathay Pacific Asia Miles' and cathaypacific.com", () => {
    const info = getProgramHandoffInfo("cathay");
    expect(info.displayName).toBe("Cathay Pacific Asia Miles");
    expect(info.url).toContain("cathaypacific.com");
  });

  it("qatar resolves to 'Qatar Privilege Club' and qatarairways.com", () => {
    const info = getProgramHandoffInfo("qatar");
    expect(info.displayName).toBe("Qatar Privilege Club");
    expect(info.url).toContain("qatarairways.com");
  });

  it("turkish resolves to 'Turkish Miles&Smiles' and turkishairlines.com", () => {
    const info = getProgramHandoffInfo("turkish");
    expect(info.displayName).toBe("Turkish Miles&Smiles");
    expect(info.url).toContain("turkishairlines.com");
  });

  it("backend-canonical 'american' (not 'americanairlines') resolves to aa.com", () => {
    // Backend ships the key as "american"; pre-fix only "americanairlines"
    // was mapped, so backend-shipped verdicts fell through to "#".
    const info = getProgramHandoffInfo("american");
    expect(info.displayName).toBe("American Airlines");
    expect(info.url).toContain("aa.com");
  });

  it("backend-canonical 'british' (not 'britishairways') resolves to britishairways.com", () => {
    const info = getProgramHandoffInfo("british");
    expect(info.displayName).toBe("British Airways");
    expect(info.url).toContain("britishairways.com");
  });

  it("unknown key falls back to https://www.{slug}.com — never '#' so CTA stays clickable", () => {
    const info = getProgramHandoffInfo("some_brand_new_program");
    // Slug strips non-alphanumerics.
    expect(info.url).toBe("https://www.somebrandnewprogram.com");
    // Display name falls back to title-cased key, never the raw lowercase slug.
    expect(info.displayName).not.toBe("some_brand_new_program");
  });

  it("empty key still degrades safely to '#' (defensive only, never expected)", () => {
    const info = getProgramHandoffInfo("");
    expect(info.url).toBe("#");
  });

  it("PROGRAM_DISPLAY_NAMES covers every seats.aero source in PROGRAM_ALIASES", () => {
    const missing = Object.keys(PROGRAM_ALIASES).filter(
      (k) => !PROGRAM_DISPLAY_NAMES[k],
    );
    expect(
      missing,
      `Display name missing for backend program key(s): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("PROGRAM_HOMEPAGE_URLS covers every seats.aero source in PROGRAM_ALIASES", () => {
    const missing = Object.keys(PROGRAM_ALIASES).filter(
      (k) => !PROGRAM_HOMEPAGE_URLS[k],
    );
    expect(
      missing,
      `Homepage URL missing for backend program key(s): ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
