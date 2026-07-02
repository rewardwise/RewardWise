/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted state shared between mock factories and assertions.
const mocks = vi.hoisted(() => ({
  cards: [
    {
      id: "card-chase",
      card_name: "Chase Sapphire Preferred",
      points_balance: 50000,
      reward_programs: { name: "Chase Ultimate Rewards" },
    },
    {
      id: "card-united",
      card_name: "United Explorer",
      points_balance: 30000,
      reward_programs: { name: "United MileagePlus" },
    },
  ],
  updateCalls: [] as Array<{ data: Record<string, unknown>; idArg: string }>,
  insertCalls: [] as Array<{ rows: Record<string, unknown>[] }>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
    checkPortfolio: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/components/TropicalBackground", () => ({
  __esModule: true,
  default: () => null,
}));

// Minimal Supabase chain mock. Only covers the four call shapes the page
// uses: select+eq, select+in, update+eq, insert, delete+eq.
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => Promise.resolve({ data: mocks.cards, error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
      update: (data: Record<string, unknown>) => ({
        eq: (_col: string, idVal: string) => {
          mocks.updateCalls.push({ data, idArg: idVal });
          return Promise.resolve({ error: null });
        },
      }),
      insert: (rows: Record<string, unknown>[]) => {
        mocks.insertCalls.push({ rows });
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));

import WalletSetupPage from "../app/wallet-setup/page";
import { isAbsurdBalance, isOverflowBalance } from "../utils/walletSanity";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.updateCalls = [];
  mocks.insertCalls = [];
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

// Render the wallet page and flush the supabase load-portfolio microtasks
// until the portfolio view is in the DOM.
async function renderPage() {
  await act(async () => {
    root.render(<WalletSetupPage />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// Drive a controlled input the way React expects: set value via the native
// HTMLInputElement setter (bypassing React's value-tracker short-circuit),
// then dispatch an "input" event for React's synthetic onChange to pick up.
function setInputValue(input: HTMLInputElement, value: string) {
  const proto = window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    setInputValue(input, value);
  });
}

async function clickButton(btn: HTMLElement) {
  await act(async () => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("wallet input formatting: Bug 1 live commas", () => {
  it("test_comma_formatting_displays_on_six_digit_input", async () => {
    await renderPage();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-chase"]'
    );
    expect(input, "portfolio editor input must mount for card-chase").not.toBeNull();
    await typeInto(input!, "100000");
    expect(input!.value).toBe("100,000");
  });
});

describe("wallet input formatting: Bug 2 zero balance confirmation", () => {
  it("test_zero_balance_save_triggers_confirmation_modal", async () => {
    await renderPage();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-chase"]'
    )!;
    await typeInto(input, "0");

    const save = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-card-chase"]'
    )!;
    await clickButton(save);

    const modal = container.querySelector('[data-testid="wallet-confirmation-modal"]');
    expect(modal, "modal must mount when a zero balance save is initiated").not.toBeNull();
    expect(
      modal!.querySelector('[data-testid="wallet-confirm-zero-section"]'),
      "Zero balance section must render"
    ).not.toBeNull();
    expect(
      modal!.querySelector('[data-testid="wallet-confirm-absurd-section"]'),
      "Higher than typical section must NOT render for a zero-only save"
    ).toBeNull();
  });

  it("test_zero_confirmation_cancel_returns_to_edit_does_not_save", async () => {
    await renderPage();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-chase"]'
    )!;
    await typeInto(input, "0");

    const save = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-card-chase"]'
    )!;
    await clickButton(save);

    const cancel = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-confirm-cancel"]'
    )!;
    await clickButton(cancel);

    expect(
      container.querySelector('[data-testid="wallet-confirmation-modal"]'),
      "modal must dismiss on Cancel"
    ).toBeNull();
    expect(mocks.updateCalls.length, "supabase.update must NOT be called on Cancel").toBe(0);
  });

  it("test_zero_confirmation_yes_proceeds_with_save", async () => {
    await renderPage();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-chase"]'
    )!;
    await typeInto(input, "0");

    const save = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-card-chase"]'
    )!;
    await clickButton(save);

    const confirmBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-confirm-confirm"]'
    )!;
    await clickButton(confirmBtn);

    expect(
      container.querySelector('[data-testid="wallet-confirmation-modal"]'),
      "modal must dismiss on Confirm"
    ).toBeNull();
    expect(mocks.updateCalls.length, "supabase.update must be called once").toBe(1);
    expect(mocks.updateCalls[0].data).toEqual({ points_balance: 0 });
    expect(mocks.updateCalls[0].idArg).toBe("card-chase");
  });
});

describe("wallet input formatting: Bug 3 absurd value sanity check", () => {
  it("test_absurd_value_triggers_sanity_modal", async () => {
    await renderPage();
    // United MileagePlus ceiling = 2_000_000; 2.5M must trip it.
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-united"]'
    )!;
    await typeInto(input, "2500000");

    const save = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-card-united"]'
    )!;
    await clickButton(save);

    const modal = container.querySelector('[data-testid="wallet-confirmation-modal"]');
    expect(modal, "modal must mount when balance exceeds program ceiling").not.toBeNull();
    expect(
      modal!.querySelector('[data-testid="wallet-confirm-absurd-section"]'),
      "Higher than typical section must render"
    ).not.toBeNull();
    expect(
      modal!.querySelector('[data-testid="wallet-confirm-zero-section"]'),
      "Zero balance section must NOT render for an absurd-only save"
    ).toBeNull();
  });

  it("test_absurd_value_uses_correct_per_program_ceiling", () => {
    // United MileagePlus ceiling = 2_000_000
    expect(isAbsurdBalance("United MileagePlus", 1_500_000)).toBe(false);
    expect(isAbsurdBalance("United MileagePlus", 2_500_000)).toBe(true);
    // Marriott Bonvoy ceiling = 5_000_000
    expect(isAbsurdBalance("Marriott Bonvoy", 4_000_000)).toBe(false);
    expect(isAbsurdBalance("Marriott Bonvoy", 6_000_000)).toBe(true);
    // ANA Mileage Club ceiling = 1_000_000 (bumped from 500k per Addition 3)
    expect(isAbsurdBalance("ANA Mileage Club", 800_000)).toBe(false);
    expect(isAbsurdBalance("ANA Mileage Club", 1_500_000)).toBe(true);
  });

  it("test_sanity_modal_cancel_does_not_save", async () => {
    await renderPage();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-united"]'
    )!;
    await typeInto(input, "2500000");

    const save = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-card-united"]'
    )!;
    await clickButton(save);

    const cancel = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-confirm-cancel"]'
    )!;
    await clickButton(cancel);

    expect(
      container.querySelector('[data-testid="wallet-confirmation-modal"]'),
      "modal must dismiss on Cancel"
    ).toBeNull();
    expect(
      mocks.updateCalls.length,
      "supabase.update must NOT be called when sanity modal is cancelled"
    ).toBe(0);
  });
});

describe("wallet input formatting: combined zero + absurd modal", () => {
  it("test_combined_modal_when_both_zero_and_absurd_present", async () => {
    await renderPage();

    // Dirty card-chase to 0 and card-united to 2.5M (above 2M ceiling).
    const chaseInput = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-chase"]'
    )!;
    await typeInto(chaseInput, "0");
    const unitedInput = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-united"]'
    )!;
    await typeInto(unitedInput, "2500000");

    const saveAll = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-all"]'
    )!;
    expect(saveAll, "Save All button must mount").not.toBeNull();
    await clickButton(saveAll);

    const modal = container.querySelector('[data-testid="wallet-confirmation-modal"]');
    expect(modal, "combined modal must mount when both zero and absurd rows exist").not.toBeNull();
    expect(
      modal!.querySelector('[data-testid="wallet-confirm-zero-section"]'),
      "Zero balance section must render"
    ).not.toBeNull();
    expect(
      modal!.querySelector('[data-testid="wallet-confirm-absurd-section"]'),
      "Higher than typical section must render"
    ).not.toBeNull();

    // Single Cancel + single Confirm = 2 buttons total inside the modal.
    const modalButtons = modal!.querySelectorAll("button");
    expect(modalButtons.length, "modal exposes exactly Cancel + Confirm, nothing else").toBe(2);
    expect(modal!.querySelector('[data-testid="wallet-confirm-cancel"]')).not.toBeNull();
    expect(modal!.querySelector('[data-testid="wallet-confirm-confirm"]')).not.toBeNull();
  });
});

describe("wallet input formatting: int4 overflow guard", () => {
  it("test_overflow_balance_rejected_with_clear_error", async () => {
    await renderPage();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="wallet-balance-input-card-chase"]'
    )!;
    await typeInto(input, "5000000000");

    const save = container.querySelector<HTMLButtonElement>(
      '[data-testid="wallet-save-card-chase"]'
    )!;
    await clickButton(save);

    expect(
      container.querySelector('[data-testid="wallet-confirmation-modal"]'),
      "modal must NOT mount when balance overflows int4"
    ).toBeNull();
    expect(
      mocks.updateCalls.length,
      "supabase.update must NOT be called on overflow"
    ).toBe(0);

    const errorText = container.textContent ?? "";
    expect(
      errorText.includes("50,000,000"),
      "inline error must surface the 50M cap so the user knows the limit (8a-hotfix-2: hard cap now rejects before the int4 ceiling is ever reached)"
    ).toBe(true);
  });

  it("test_overflow_check_uses_int4_max_constant", () => {
    expect(isOverflowBalance(2_147_483_647)).toBe(false);
    expect(isOverflowBalance(2_147_483_648)).toBe(true);
    expect(isOverflowBalance(20_000_000_000)).toBe(true);
  });
});
