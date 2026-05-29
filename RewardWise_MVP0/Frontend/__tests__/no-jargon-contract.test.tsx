/** @format */
/** @vitest-environment node */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Source-level contract: forbidden tokens must not appear in user-facing pages.
// Runtime correctness for the same denylist is covered by the
// pr-cleanup-dead-pages.spec.ts Playwright smoke. This source-level check
// blocks regressions that re-introduce dev jargon or stale brand copy.

const FRONTEND_ROOT = join(__dirname, "..");

const TARGETS: Array<{ path: string; label: string }> = [
  { path: "app/history/page.tsx", label: "/history" },
  { path: "app/profile/page.tsx", label: "/profile" },
  { path: "app/forgot-password/page.tsx", label: "/forgot-password" },
  { path: "app/reset-password/page.tsx", label: "/reset-password" },
  { path: "components/TopNav.tsx", label: "TopNav" },
  { path: "app/about/page.tsx", label: "/about" },
  { path: "app/concierge/page.tsx", label: "/concierge" },
];

const DENYLIST = [
  "RewardWise",
  "auth profile",
  "approved team",
  "approved tester",
  "Beta access is limited",
  "database migration",
  // Substantiation guard — no unsourced dollar claims or fabricated testimonials
  // on user-facing pages. Removed in cleanup PR; re-adding requires real data.
  "$150+",
  "thousands of dollars",
  "Avg savings",
  "$2,400+",
  "$800+",
  "$3,200",
  "Sarah K.",
];

describe("no-jargon contract — user-facing surfaces", () => {
  for (const { path, label } of TARGETS) {
    describe(label, () => {
      const source = readFileSync(join(FRONTEND_ROOT, path), "utf8");

      for (const phrase of DENYLIST) {
        it(`does not contain "${phrase}"`, () => {
          expect(source.includes(phrase)).toBe(false);
        });
      }
    });
  }

  it("/history does not render the CPP label", () => {
    const source = readFileSync(
      join(FRONTEND_ROOT, "app/history/page.tsx"),
      "utf8",
    );
    // Only flag standalone CPP tokens — identifier names like
    // selectedTrip.calculatedCpp would be a substring match but render
    // as nothing user-facing.
    const matches = source.match(/(^|[^\w])CPP([^\w]|$)/g);
    expect(matches, "CPP should not appear as a standalone token in /history").toBeNull();
  });
});
