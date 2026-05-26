/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

import EmptyWalletCTA from "../components/verdict/EmptyWalletCTA";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  routerMock.push.mockReset();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("EmptyWalletCTA", () => {
  it("renders headline + body + CTA button with stable testids", () => {
    act(() => {
      root.render(<EmptyWalletCTA />);
    });
    const card = container.querySelector('[data-testid="empty-wallet-cta"]');
    expect(card, "card root should render").not.toBeNull();
    expect(card?.textContent).toContain("Add a card or program to get your full verdict");
    expect(card?.textContent).toContain("at least one credit card or loyalty program");
    const button = container.querySelector('[data-testid="empty-wallet-cta-button"]') as HTMLButtonElement | null;
    expect(button, "CTA button should render").not.toBeNull();
    expect(button?.textContent).toContain("Set up your wallet");
  });

  it("default CTA routes to /wallet-setup", () => {
    act(() => {
      root.render(<EmptyWalletCTA />);
    });
    const button = container.querySelector('[data-testid="empty-wallet-cta-button"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith("/wallet-setup");
  });

  it("onCta override takes precedence over router.push", () => {
    const onCta = vi.fn();
    act(() => {
      root.render(<EmptyWalletCTA onCta={onCta} />);
    });
    const button = container.querySelector('[data-testid="empty-wallet-cta-button"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });
    expect(onCta).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
