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
        userPrograms={["aeroplan"]}
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
  it("missing_cash_horizon → PartialDataCard with horizon copy", () => {
    renderCard(buildVerdict({ data_quality: "missing_cash_horizon" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(
      card,
      "PartialDataCard should render for missing_cash_horizon",
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-horizon"]',
      ),
    ).not.toBeNull();
    // The upstream copy MUST NOT render on this branch.
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-upstream"]',
      ),
    ).toBeNull();
  });

  it("missing_cash_upstream → PartialDataCard with upstream copy (NOT horizon lie)", () => {
    // Bug repro: pre-fix this routed to the legacy "missing_cash" variant
    // and rendered the "~10 months out" copy even when the depart date was
    // inside the horizon. The whole point of PR-α.
    renderCard(buildVerdict({ data_quality: "missing_cash_upstream" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-upstream"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-horizon"]',
      ),
    ).toBeNull();
    expect(card?.textContent).not.toContain("~10 months out");
    expect(card?.textContent).toContain("temporarily unavailable");
  });

  it("missing_cash_horizon card renders winner program and verify CTA", () => {
    renderCard(buildVerdict({ data_quality: "missing_cash_horizon" }));
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

  it("missing_both_horizon → ErrorStateCard with horizon-aware copy", () => {
    const onTry = vi.fn();
    renderCard(buildVerdict({ data_quality: "missing_both_horizon" }), onTry);
    expect(
      container.querySelector('[data-testid="partial-data-card"]'),
    ).toBeNull();
    expect(container.textContent).toContain("Try a different date");
    expect(container.textContent).toContain(
      "We could not pull data for this date",
    );
    expect(container.textContent).toContain(
      "most providers don't publish data more than 10–11 months out",
    );
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Try a different date"),
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onTry).toHaveBeenCalledTimes(1);
  });

  it("missing_both_upstream → upstream copy, NO horizon claim (BAY→SIN +6d audit)", () => {
    // BAY→SIN PE +6d (2026-05-30): pre-fix the UI rendered the horizon
    // sentence on a near-date double-failure, misattributing an upstream
    // outage to a provider horizon ~329 days out. The split puts honest copy
    // on the near-date path.
    const onTry = vi.fn();
    renderCard(buildVerdict({ data_quality: "missing_both_upstream" }), onTry);
    expect(
      container.querySelector('[data-testid="partial-data-card"]'),
    ).toBeNull();
    expect(container.textContent).toContain(
      "We couldn't reach pricing for this date right now",
    );
    expect(container.textContent).toContain(
      "Try again, a nearby date, or a different cabin",
    );
    // Falsifying assertion: the horizon sentence must NOT appear here.
    expect(container.textContent).not.toContain("10–11 months out");
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Try a different date"),
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onTry).toHaveBeenCalledTimes(1);
  });

  it("legacy 'missing_both' literal → defensive PartialDataCard (rename guard)", () => {
    // After this PR the bare 'missing_both' string is no longer emitted by the
    // backend. If any stale client receives it, route to defensive — never the
    // horizon copy, which was the original lie.
    renderCard(buildVerdict({ data_quality: "missing_both" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card).not.toBeNull();
    expect(container.textContent).not.toContain("10–11 months out");
  });

  it("legacy 'missing_cash' literal → defensive variant (rename guard)", () => {
    // After PR-α the bare 'missing_cash' string is no longer emitted by the
    // backend. If any stale client receives it, route to defensive — never
    // the horizon copy, which would be the original lie.
    renderCard(buildVerdict({ data_quality: "missing_cash" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-horizon"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-upstream"]',
      ),
    ).toBeNull();
    expect(container.textContent).toContain("Limited data for this comparison");
  });

  it("unknown data_quality → defensive PartialDataCard (no cash subtext)", () => {
    renderCard(buildVerdict({ data_quality: "something_else" }));
    const card = container.querySelector('[data-testid="partial-data-card"]');
    expect(card, "defensive variant still renders the card").not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-horizon"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector(
        '[data-testid="partial-data-cash-subtext-upstream"]',
      ),
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

  it("missing_cash_upstream CTA fires the onTryDifferentDate handler from VerdictCard", () => {
    const onTry = vi.fn();
    renderCard(buildVerdict({ data_quality: "missing_cash_upstream" }), onTry);
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
