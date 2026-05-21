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
    expect(container.textContent).toContain("Value preserved");
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

// Bug B (ClickUp 86b9vjxgb): the Use Points verdict headline used to render
// "Use Points · Save $X" using estimated_savings, which is unreliable while
// Ankur's P0 cash-benchmark inflation (86b9twp77) is open. The headline now
// anchors on the cash fare baseline instead, formatted as
// "Use Points · Cash fare $X".
describe("VerdictCard — Use Points headline shows cash fare baseline (Bug B)", () => {
  // Query the headline <p> directly inside the VerdictTopRow stub, not the
  // whole stub div, so adjacent button labels (Listen / Helpful / Needs work)
  // do not bleed into the headline assertion.
  function headlineText(): string {
    const topRow = container.querySelector('[data-testid="verdict-top-row"]');
    const headline = topRow?.querySelector("p");
    return headline?.textContent?.trim() ?? "";
  }

  it("use_points headline includes the Cash fare label and the cash baseline amount", () => {
    renderCard({ metrics: { cash_price: 737, points_cost: 35000, taxes: 5.6, estimated_savings: 200 } });
    const headline = headlineText();
    expect(headline).toContain("Use Points");
    expect(headline).toContain("Cash fare $737");
    // The old "Save $X" framing must be gone from the headline entirely.
    // Stricter than "Save $" so any "Save" anywhere in the headline fails.
    expect(headline).not.toContain("Save");
  });

  it("pay_cash headline is unchanged (no Cash fare label on this branch)", () => {
    renderCard({
      recommendation: "pay_cash" as const,
      pay_cash: true,
      metrics: { cash_price: 169, points_cost: 35000, taxes: 5.6, estimated_savings: 200 },
    });
    const headline = headlineText();
    expect(headline).toContain("Pay Cash");
    expect(headline).toContain("$169");
    // Pay Cash branch deliberately keeps the original framing.
    expect(headline).not.toContain("Cash fare");
  });

  it("use_points headline renders bare when cash price is missing (no null/undefined leak)", () => {
    // Null out every source of displayCashPrice in production:
    //   metrics.cash_price ?? cashPrice ?? bestCashFlight?.price ?? null
    // 1. metrics.cash_price = null (explicit)
    // 2. cashPrice prop = undefined (omitted)
    // 3. flights = [] (omitted, prop default at VerdictCard.tsx:314)
    act(() => {
      root.render(
        <VerdictCard
          verdict={{
            ...baseVerdict,
            metrics: { cash_price: null as unknown as number, points_cost: 35000, taxes: 5.6 },
          }}
          cashPrice={null}
          origin="SFO"
          destination="NRT"
          departDate="2026-06-15"
          travelers={1}
        />
      );
    });
    const headline = headlineText();
    // Headline is literally "Use Points" with nothing after it.
    expect(headline).toBe("Use Points");
    expect(headline).not.toMatch(/null|undefined|NaN/);
    expect(headline).not.toContain("Cash fare");
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
