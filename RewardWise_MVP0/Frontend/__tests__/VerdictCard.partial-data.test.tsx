/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Verdict } from "../types/verdict";

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

// Stub the heavy children that would otherwise pull in DOM-only deps.
// Leave PartialDataCard + ErrorStateCard real so we can verify which
// branch of the data_quality switch actually rendered.
vi.mock("@/components/verdict/VerdictTopRow", () => ({
  __esModule: true,
  default: () => <div data-testid="verdict-top-row" />,
}));

vi.mock("@/components/verdict/FlightSection", () => ({
  __esModule: true,
  default: () => <div data-testid="flight-section-stub" />,
}));

vi.mock("@/components/verdict/AwardDetailsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="award-details-stub" />,
}));

vi.mock("@/components/verdict/MultiHandoffGrid", () => ({
  __esModule: true,
  default: () => <div data-testid="multi-handoff-stub" />,
}));

vi.mock("@/components/verdict/WalletFramingPreview", () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-framing-stub" />,
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
  vi.clearAllMocks();
});

function buildVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    verdict: "Wait",
    recommendation: "wait",
    explanation:
      "Award seats are available via Aeroplan but live cash pricing is unavailable for this date.",
    winner: {
      program: "aeroplan",
      points: 75000,
      taxes: 120,
      cpp: null,
      direct: true,
    },
    pay_cash: false,
    confidence: "medium",
    booking_note: "",
    booking_link: {
      seats_aero_link: "https://seats.aero/search?route=SEA-NRT",
      airline_link: "https://aircanada.com/aeroplan/redeem",
      preferred: "airline",
    },
    ...overrides,
  };
}

function renderCard(verdict: Verdict, onTryDifferentDate?: () => void) {
  act(() => {
    root.render(
      <VerdictCard
        verdict={verdict}
        cashPrice={null}
        origin="SEA"
        destination="NRT"
        departDate="2027-04-20"
        travelers={1}
        onTryDifferentDate={onTryDifferentDate}
      />,
    );
  });
}

// PR 5 closes the SEA-TYO 2027-04-20 repro. The backend marks degraded
// verdicts with recommendation="wait" + a data_quality discriminator;
// VerdictCard now routes each case to a partial-data surface instead of
// the generic "We could not pull the latest data" ErrorStateCard.
describe("VerdictCard — wait-branch routing by data_quality", () => {
  it("missing_cash → PartialDataCard with missing_cash variant", () => {
    renderCard(buildVerdict({ data_quality: "missing_cash" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card, "PartialDataCard should render for missing_cash").not.toBeNull();
    // missing_cash variant carries the cash-horizon subtext.
    expect(
      container.querySelector('[data-testid="partial-data-cash-subtext"]'),
    ).not.toBeNull();
  });

  it("missing_cash card renders winner program and verify CTA", () => {
    renderCard(buildVerdict({ data_quality: "missing_cash" }));
    const winner = container.querySelector(
      '[data-testid="partial-data-winner"]',
    );
    expect(winner, "winner block should render").not.toBeNull();
    expect(winner?.textContent).toContain("Aeroplan");
    const verifyCta = container.querySelector(
      '[data-testid="partial-data-verify-cta"]',
    );
    expect(verifyCta, "verify CTA should render").not.toBeNull();
  });

  it("missing_both → ErrorStateCard with 'Try a different date' CTA", () => {
    const onTry = vi.fn();
    renderCard(buildVerdict({ data_quality: "missing_both" }), onTry);
    // The partial-data card must NOT render on this branch.
    expect(
      container.querySelector('[data-testid="partial-data-card"]'),
    ).toBeNull();
    expect(container.textContent).toContain("Try a different date");
    expect(container.textContent).toContain(
      "We could not pull data for this date",
    );
    // Clicking the CTA invokes the parent handler, not window.reload.
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Try a different date"),
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onTry).toHaveBeenCalledTimes(1);
  });

  it("unknown data_quality → defensive PartialDataCard (no cash subtext)", () => {
    renderCard(buildVerdict({ data_quality: "something_else" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card, "defensive variant still renders the card").not.toBeNull();
    expect(
      container.querySelector('[data-testid="partial-data-cash-subtext"]'),
    ).toBeNull();
    expect(container.textContent).toContain("Limited data for this comparison");
  });

  it("missing data_quality entirely → defensive PartialDataCard", () => {
    // Backend may omit data_quality on legacy degraded verdicts.
    renderCard(buildVerdict());
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card).not.toBeNull();
    expect(container.textContent).toContain("Limited data for this comparison");
  });

  it("missing_awards falls through to the full verdict render (no partial card, no error card)", () => {
    // missing_awards means we still have cash data; backend should send
    // recommendation="pay_cash". Defensive guard: if it leaks through as
    // wait, the switch falls through and the normal render takes over.
    renderCard(buildVerdict({ data_quality: "missing_awards" }));
    expect(
      container.querySelector('[data-testid="partial-data-card"]'),
    ).toBeNull();
    // The normal render mounts VerdictTopRow.
    expect(
      container.querySelector('[data-testid="verdict-top-row"]'),
    ).not.toBeNull();
  });

  it("missing_cash CTA fires the onTryDifferentDate handler from VerdictCard", () => {
    const onTry = vi.fn();
    renderCard(buildVerdict({ data_quality: "missing_cash" }), onTry);
    const retryButton = container.querySelector(
      '[data-testid="partial-data-retry-date-cta"]',
    ) as HTMLButtonElement | null;
    expect(retryButton).not.toBeNull();
    act(() => {
      retryButton?.click();
    });
    expect(onTry).toHaveBeenCalledTimes(1);
  });
});
