/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alertState: {
    watchlist: [] as unknown[],
    notifications: [] as unknown[],
    unreadCount: 0,
    loading: false,
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(async () => undefined),
    isWatching: vi.fn(() => false),
    markNotificationRead: vi.fn(),
    markAllRead: vi.fn(),
    clearNotification: vi.fn(),
  },
}));

vi.mock("@/context/AlertContext", () => ({
  useAlerts: () => mocks.alertState,
}));

// Stub child components so this test only exercises VerdictCard's own rendering.
vi.mock("@/components/verdict/VerdictTopRow", () => ({
  default: ({ recommendationHeadline }: { recommendationHeadline: string }) => (
    <div data-testid="verdict-top-row">
      <p>{recommendationHeadline}</p>
      <button data-testid="listen-btn">Listen</button>
      <button data-testid="helpful-btn">Helpful</button>
      <button data-testid="needs-work-btn">Needs work</button>
    </div>
  ),
}));

vi.mock("@/components/verdict/FlightSection", () => ({
  __esModule: true,
  default: () => <div data-testid="flight-section-stub">FLIGHT DETAILS</div>,
}));

vi.mock("@/components/verdict/AwardDetailsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="award-details-stub" />,
}));

vi.mock("@/components/verdict/MultiHandoffGrid", () => ({
  __esModule: true,
  default: () => <div data-testid="multi-handoff-stub" />,
}));

vi.mock("@/components/verdict/ErrorStateCard", () => ({
  __esModule: true,
  default: () => <div data-testid="error-state-stub" />,
}));

import VerdictCard from "../components/VerdictCard";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const EXPLANATION = "Award redemption is stronger than cash on this route right now.";
const REASONING_COPY =
  "The award option is stronger than the cash fare right now, so using points protects cash.";

const baseVerdict = {
  verdict: "Use points",
  recommendation: "use_points" as "use_points" | "pay_cash" | "wait",
  winner: {
    program: "United",
    points: 35000,
    taxes: 5.6,
    cpp: 1.8,
    direct: true,
  },
  pay_cash: false,
  confidence: "high" as const,
  confidence_reason: REASONING_COPY,
  explanation: EXPLANATION,
  booking_note: "Confirm taxes at booking.",
  booking_link: {
    seats_aero_link: null,
    airline_link: null,
    preferred: "none" as const,
  },
  metrics: {
    cash_price: 800,
    points_cost: 35000,
    taxes: 5.6,
    estimated_savings: 200,
  },
};

function renderCard(verdictOverrides: Partial<typeof baseVerdict> = {}) {
  act(() => {
    root.render(
      <VerdictCard
        verdict={{ ...baseVerdict, ...verdictOverrides }}
        cashPrice={800}
        origin="SFO"
        destination="NRT"
        departDate="2026-06-15"
        travelers={1}
        userPrograms={["united"]}
      />
    );
  });
}

describe("VerdictCard — surface cleanup contract", () => {
  it("renders the reasoning block unconditionally (no toggle gate)", () => {
    renderCard();
    const block = container.querySelector('[data-testid="verdict-reasoning-block"]');
    expect(block, "verdict-reasoning-block must be present in the DOM").not.toBeNull();
    expect(container.textContent).toContain(EXPLANATION);
    expect(container.textContent).toContain("Cash fare");
    expect(container.textContent).toContain("Best award");
    expect(container.textContent).toContain("Savings");
  });

  it("does not render a reasoning toggle button", () => {
    renderCard();
    const buttons = Array.from(container.querySelectorAll("button"));
    const hideToggle = buttons.find((b) => b.textContent?.includes("Hide reasoning"));
    const showToggle = buttons.find((b) => b.textContent?.includes("See how Zoe decided"));
    expect(hideToggle, "no Hide reasoning toggle should exist").toBeUndefined();
    expect(showToggle, "no See how Zoe decided toggle should exist").toBeUndefined();
  });

  it("does not render the MISSING DATA card even when missing_sources is populated", () => {
    renderCard({ missing_sources: ["taxes", "operating_airline"] } as Partial<typeof baseVerdict>);
    expect(container.textContent).not.toContain("Missing data");
    expect(container.textContent).not.toContain("We could not fully verify");
  });

  it("does not render the HowToBookSection (component removed)", () => {
    renderCard();
    // The HowToBookSection rendered an "How to book" uppercase eyebrow header.
    expect(container.textContent).not.toContain("How to book");
    // And no stub should be present since the import was removed from VerdictCard.
    expect(container.querySelector('[data-testid="how-to-book-stub"]')).toBeNull();
  });
});

// Phase 3 redesign: headline leads with dollar savings on use_points
// ("Use points — Save ~$X") and the cash amount on pay_cash ("Pay cash — $X"),
// both rounded to 0 decimals. The honesty sub-line ("{N} pts instead of $X
// cash") sits inside the reasoning block, not the headline. Cash fare is now
// a metrics-tile label, not a headline label. Replaces the prior Bug B
// "Use Points · Cash fare $X" contract.
describe("VerdictCard — headline leads with dollar savings (Phase 3 redesign)", () => {
  // Query the headline <p> directly inside the VerdictTopRow stub, not the
  // whole stub div, so adjacent button labels (Listen / Helpful / Needs work)
  // do not bleed into the headline assertion.
  function headlineText(): string {
    const topRow = container.querySelector('[data-testid="verdict-top-row"]');
    const headline = topRow?.querySelector("p");
    return headline?.textContent?.trim() ?? "";
  }

  it("use_points headline leads with the dollar savings amount, rounded", () => {
    renderCard({ metrics: { cash_price: 737, points_cost: 35000, taxes: 5.6, estimated_savings: 200 } });
    const headline = headlineText();
    expect(headline).toContain("Use points");
    expect(headline).toContain("Save ~$200");
    // Phase 3 moved the cash-fare baseline out of the headline into the
    // metrics tile so the hero stays one short, scannable line.
    expect(headline).not.toContain("Cash fare");
  });

  it("pay_cash headline shows the cash amount with the em dash separator", () => {
    renderCard({
      recommendation: "pay_cash" as const,
      pay_cash: true,
      metrics: { cash_price: 169, points_cost: 35000, taxes: 5.6, estimated_savings: 200 },
    });
    const headline = headlineText();
    expect(headline).toContain("Pay cash");
    expect(headline).toContain("$169");
    // Cash fare label belongs to the metrics tile, not the pay_cash headline.
    expect(headline).not.toContain("Cash fare");
  });

  it("use_points headline falls back to bare 'Use points' when savings is missing", () => {
    // Null out every source of displaySavings:
    //   metrics.estimated_savings is the only path. cash_price=null also
    //   guarantees the honesty line gate fails downstream — keep both null
    //   so the headline-only contract is unambiguous.
    act(() => {
      root.render(
        <VerdictCard
          verdict={{
            ...baseVerdict,
            metrics: {
              cash_price: null as unknown as number,
              points_cost: 35000,
              taxes: 5.6,
              estimated_savings: null as unknown as number,
            },
          }}
          cashPrice={null}
          origin="SFO"
          destination="NRT"
          departDate="2026-06-15"
          travelers={1}
          userPrograms={["united"]}
        />
      );
    });
    const headline = headlineText();
    expect(headline).toBe("Use points");
    expect(headline).not.toMatch(/null|undefined|NaN/);
    expect(headline).not.toContain("Cash fare");
    expect(headline).not.toContain("Save");
  });
});

// Ticket 86b9v4aft: every use_points verdict should explain WHY points won.
// Two surface elements between mainExplanation and the metrics box (the
// original "Point value" 4th tile was dropped in Phase 3 — raw ¢/pt as a
// stand-alone metric is the jargon-pattern the redesign removed; ¢/pt now
// only appears inline on the tier badge):
//   - tier badge ("Premium value · 2.40¢/pt" / "Solid value · 1.60¢/pt" /
//     "Marginal value · 1.30¢/pt") with color matching the verdict tier
//   - tier_explanation paragraph (verbatim from BE)
// Both gate on verdict_tier + metrics.cpp + recommendation==use_points.
describe("VerdictCard — verdict tier explanation surface (use_points)", () => {
  const STRONG_COPY =
    "This is one of the best uses of your points for this trip — strong value, book if you're ready.";
  const SOLID_COPY =
    "Your points stretch further than cash here, but it's not a top-tier redemption. Worth doing if you want to preserve cash.";
  const MARGINAL_COPY =
    "Barely better than cash. Consider waiting for a stronger date or comparing other routes.";

  function renderTier(tier: "premium" | "solid" | "marginal", cpp: number, copy: string) {
    renderCard({
      verdict_tier: tier,
      tier_explanation: copy,
      metrics: { cash_price: 800, points_cost: 35000, taxes: 5.6, estimated_savings: 200, cpp },
    } as Partial<typeof baseVerdict>);
  }

  it("strong (premium): badge + threshold line render with emerald tone", () => {
    renderTier("premium", 2.4, STRONG_COPY);
    const badge = container.querySelector('[data-testid="verdict-tier-badge"]');
    expect(badge, "tier badge must render for premium").not.toBeNull();
    expect(badge?.getAttribute("data-tier")).toBe("premium");
    expect(badge?.textContent).toContain("Premium value");
    expect(badge?.textContent).toContain("2.40¢/pt");
    expect(badge?.className).toContain("emerald");

    const line = container.querySelector('[data-testid="verdict-tier-explanation"]');
    expect(line?.textContent).toBe(STRONG_COPY);
  });

  it("solid: badge renders with amber tone and exact solid copy", () => {
    renderTier("solid", 1.6, SOLID_COPY);
    const badge = container.querySelector('[data-testid="verdict-tier-badge"]');
    expect(badge?.getAttribute("data-tier")).toBe("solid");
    expect(badge?.textContent).toContain("Solid value");
    expect(badge?.textContent).toContain("1.60¢/pt");
    expect(badge?.className).toContain("amber");

    const line = container.querySelector('[data-testid="verdict-tier-explanation"]');
    expect(line?.textContent).toBe(SOLID_COPY);
  });

  it("marginal: badge renders with slate tone and exact marginal copy", () => {
    // Marginal tier (1.25-1.49 cpp) does not currently fire for use_points in
    // production (cpp 1.25-1.49 routes to pay_cash branch). Tested here to
    // lock the wiring in case the BE bands are ever loosened.
    renderTier("marginal", 1.3, MARGINAL_COPY);
    const badge = container.querySelector('[data-testid="verdict-tier-badge"]');
    expect(badge?.getAttribute("data-tier")).toBe("marginal");
    expect(badge?.textContent).toContain("Marginal value");
    expect(badge?.textContent).toContain("1.30¢/pt");
    expect(badge?.className).toContain("slate");

    const line = container.querySelector('[data-testid="verdict-tier-explanation"]');
    expect(line?.textContent).toBe(MARGINAL_COPY);
  });

  it("does not render tier surface when verdict_tier is null", () => {
    renderCard({
      metrics: { cash_price: 800, points_cost: 35000, taxes: 5.6, estimated_savings: 200, cpp: 2.4 },
    } as Partial<typeof baseVerdict>);
    expect(container.querySelector('[data-testid="verdict-tier-badge"]')).toBeNull();
    expect(container.querySelector('[data-testid="verdict-tier-explanation"]')).toBeNull();
  });

  it("does not render tier surface on pay_cash even if tier fields are set", () => {
    renderCard({
      recommendation: "pay_cash",
      pay_cash: true,
      verdict_tier: "marginal",
      tier_explanation: MARGINAL_COPY,
      metrics: { cash_price: 169, points_cost: 35000, taxes: 5.6, estimated_savings: 50, cpp: 1.3 },
    } as Partial<typeof baseVerdict>);
    expect(container.querySelector('[data-testid="verdict-tier-badge"]')).toBeNull();
    expect(container.querySelector('[data-testid="verdict-tier-explanation"]')).toBeNull();
  });

  it("tier explanation copy contains no compound jargon", () => {
    // ELI5 ribbon: forbid the phrases that would signal the jargon mode.
    // The bare word "redemption" is permitted (e.g. "top-tier redemption").
    const forbidden = /redemption rate|cents per point|\bcpp\b/i;
    expect(STRONG_COPY).not.toMatch(forbidden);
    expect(SOLID_COPY).not.toMatch(forbidden);
    expect(MARGINAL_COPY).not.toMatch(forbidden);
  });
});

// Ticket 86ba11m1f: guest landing-page verdicts default to "pay_cash" because
// no wallet info is available. Add a "Why cash?" explainer + static wallet
// examples to convert guests to signup. Gated on publicPreview && pay_cash.
describe("VerdictCard — guest wallet-framing preview gating", () => {
  function renderWithProps(props: {
    publicPreview?: boolean;
    recommendation: "use_points" | "pay_cash" | "wait";
    onPublicPreviewSignup?: () => void;
  }) {
    act(() => {
      root.render(
        <VerdictCard
          verdict={{
            ...baseVerdict,
            recommendation: props.recommendation,
            pay_cash: props.recommendation === "pay_cash",
          }}
          cashPrice={800}
          origin="SFO"
          destination="NRT"
          departDate="2026-06-15"
          travelers={1}
          userPrograms={["united"]}
          publicPreview={props.publicPreview}
          onPublicPreviewSignup={props.onPublicPreviewSignup}
        />
      );
    });
  }

  it("guest (publicPreview) + pay_cash: 'Why cash?' framing is visible", () => {
    renderWithProps({ publicPreview: true, recommendation: "pay_cash" });
    expect(container.textContent).toContain("Why cash?");
  });

  it("guest (publicPreview) + use_points: framing is hidden (verdict already has a wallet-y answer)", () => {
    renderWithProps({ publicPreview: true, recommendation: "use_points" });
    expect(container.textContent).not.toContain("Why cash?");
  });

  it("authenticated user (no publicPreview) + pay_cash: framing is hidden (regression guard)", () => {
    renderWithProps({ publicPreview: false, recommendation: "pay_cash" });
    expect(container.textContent).not.toContain("Why cash?");
  });

  it("signup handler from VerdictCard reaches the framing CTA", () => {
    const onSignup = vi.fn();
    renderWithProps({
      publicPreview: true,
      recommendation: "pay_cash",
      onPublicPreviewSignup: onSignup,
    });
    // Open the expander to reveal the inline CTA.
    const header = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Why cash?"),
    );
    expect(header).toBeTruthy();
    if (header) {
      act(() => {
        header.click();
      });
    }
    const ctaButton = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Sign up to unlock wallet-aware verdicts"),
    );
    expect(ctaButton).toBeTruthy();
    if (ctaButton) {
      act(() => {
        ctaButton.click();
      });
    }
    expect(onSignup).toHaveBeenCalledTimes(1);
  });
});
