/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WalletFramingPreview from "../components/verdict/WalletFramingPreview";

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

function render(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

function clickToggle() {
  const button = container.querySelector(
    'button[aria-expanded]',
  ) as HTMLButtonElement | null;
  if (!button) throw new Error("disclosure button not found");
  act(() => {
    button.click();
  });
}

describe("WalletFramingPreview", () => {
  it("renders collapsed by default with the 'Why cash?' header visible", () => {
    render(<WalletFramingPreview />);
    expect(container.textContent).toContain("Why cash?");
    expect(container.textContent).not.toContain("Chase Ultimate Rewards");
    const button = container.querySelector("button[aria-expanded]");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands to show the three wallet examples + business-class teaser", () => {
    render(<WalletFramingPreview />);
    clickToggle();
    const text = container.textContent || "";
    expect(text).toContain("Chase Ultimate Rewards");
    expect(text).toContain("Amex Membership Rewards");
    expect(text).toContain("Capital One Miles");
    expect(text).toContain("Aeroplan");
    expect(text).toContain("Flying Blue");
    expect(text).toContain("British Airways Avios");
    expect(text).toContain("business-class");
    expect(text).toContain("$2,170");
  });

  it("savings math is internally consistent: cash − points×$0.01 − taxes", () => {
    render(<WalletFramingPreview />);
    clickToggle();
    const text = container.textContent || "";
    // Cash baseline $800 long-haul economy is the anchor stated in the UI.
    expect(text).toContain("$800");
    // Chase UR row: 35,000 pts × $0.01 = $350 cash baseline; $800 − $350 − $80 = $370.
    expect(text).toContain("35,000 pts + $80");
    expect(text).toContain("Saves ~$370");
    // Amex MR row: 50,000 pts × $0.01 = $500; $800 − $500 − $90 = $210.
    expect(text).toContain("50,000 pts + $90");
    expect(text).toContain("Saves ~$210");
    // Cap1 row: 30,000 pts × $0.01 = $300; $800 − $300 − $55 = $445.
    expect(text).toContain("30,000 pts + $55");
    expect(text).toContain("Saves ~$445");
  });

  it("renders the signup CTA when onSignup is provided and invokes it on click", () => {
    const onSignup = vi.fn();
    render(<WalletFramingPreview onSignup={onSignup} />);
    clickToggle();
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

  it("omits the signup CTA when onSignup is not provided", () => {
    render(<WalletFramingPreview />);
    clickToggle();
    const ctaButton = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent || "").includes("Sign up to unlock"),
    );
    expect(ctaButton).toBeUndefined();
  });

  it("collapses again on second click (toggle behavior)", () => {
    render(<WalletFramingPreview />);
    clickToggle();
    expect(container.textContent).toContain("Chase Ultimate Rewards");
    clickToggle();
    expect(container.textContent).not.toContain("Chase Ultimate Rewards");
  });
});
