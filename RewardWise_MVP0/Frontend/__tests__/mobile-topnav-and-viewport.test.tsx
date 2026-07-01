/** @format */
/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  pathname: "/home",
  alertState: {
    notifications: [] as unknown[],
    unreadCount: 0,
    markNotificationRead: vi.fn(),
    markAllRead: vi.fn(),
  },
  authState: { user: { id: "user-1", email: "test@example.com" } as unknown, signOut: vi.fn() },
  walletState: {
    cards: [
      { id: "c1", card_name: "Amex", reward_program_id: "amex", points_balance: 80000, program_name: "Amex Membership Rewards" },
    ],
    hasWallet: true,
    loading: false,
    userPrograms: ["amex"],
    refreshWallet: vi.fn(),
  },
  paymentNotifs: [
    {
      id: "pn-1",
      type: "payment_failed",
      title: "Payment failed",
      message: "Your last payment did not go through.",
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  usePathname: () => mocks.pathname,
}));

vi.mock("@/context/AlertContext", () => ({
  useAlerts: () => mocks.alertState,
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/context/WalletContext", () => ({
  useWallet: () => mocks.walletState,
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (table: string) => {
      if (table === "payment_notifications") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn(async () => ({ data: mocks.paymentNotifs, error: null })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
        return query;
      }
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      };
      return query;
    },
  }),
}));

import TopNav from "../components/TopNav";
import PaymentNotificationBanner from "../components/PaymentNotificationBanner";

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

describe("TopNav — redesign nav model (avatar menu, no hamburger/bell)", () => {
  it("renders the account avatar menu button, not a hamburger or bell", () => {
    act(() => {
      root.render(<TopNav />);
    });
    const avatar = container.querySelector('button[data-testid="avatar-menu-button"]');
    expect(avatar, "avatar menu button must be in DOM").not.toBeNull();
    expect(avatar?.getAttribute("aria-label")).toBe("Account menu");
    // The old dark-nav hamburger + bell are gone.
    expect(container.querySelector('button[aria-label="Open navigation menu"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Alerts"]')).toBeNull();
  });

  it("opens the account menu with Profile / History / Sign out", () => {
    act(() => {
      root.render(<TopNav />);
    });
    expect(container.querySelector('[data-testid="avatar-menu"]'), "menu closed initially").toBeNull();
    const avatar = container.querySelector('button[data-testid="avatar-menu-button"]') as HTMLButtonElement;
    act(() => {
      avatar.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const menu = container.querySelector('[data-testid="avatar-menu"]');
    expect(menu, "menu opens on click").not.toBeNull();
    const text = menu?.textContent ?? "";
    expect(text).toContain("Profile");
    expect(text).toContain("History");
    expect(text).toContain("Sign out");
  });

  it("wallet pill is desktop-only (hidden until sm) and shows the balance", () => {
    act(() => {
      root.render(<TopNav />);
    });
    const pill = container.querySelector('[data-testid="nav-wallet-pill"]');
    expect(pill, "wallet pill must be in DOM").not.toBeNull();
    // Hidden on mobile, shown at sm+ via CSS (single source of truth for the fold).
    expect(pill?.className).toContain("hidden");
    expect(pill?.className).toContain("sm:inline-flex");
    expect(pill?.textContent).toContain("80k Amex");
  });
});

describe("PaymentNotificationBanner — responsive max-width (86b9rprq0 'i' button candidate)", () => {
  it("uses a viewport-bounded max-width on mobile and max-w-sm on desktop", async () => {
    await act(async () => {
      root.render(<PaymentNotificationBanner />);
    });
    // Let the async useEffect populate notifications and re-render.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const wrapper = container.querySelector("div.fixed");
    expect(wrapper, "banner wrapper must be in DOM after notifications load").not.toBeNull();
    const cls = wrapper?.className ?? "";
    expect(cls).toContain("max-w-[calc(100vw-2rem)]");
    expect(cls).toContain("sm:max-w-sm");
    // The old unbounded `max-w-sm` (without the responsive prefix) must be gone.
    expect(cls).not.toMatch(/(^|\s)max-w-sm(\s|$)/);
  });
});

describe("layout.tsx viewport meta — explicit maximumScale (86b9rprqc)", () => {
  it("exports viewport with maximumScale set to 5", () => {
    const layoutPath = resolve(__dirname, "../app/layout.tsx");
    const src = readFileSync(layoutPath, "utf8");
    // Match the line `maximumScale: 5,` inside the viewport export.
    expect(src).toMatch(/export const viewport: Viewport = \{[\s\S]*?maximumScale:\s*5[\s\S]*?\};/);
  });

  it("still declares width and initialScale (regression guard)", () => {
    const layoutPath = resolve(__dirname, "../app/layout.tsx");
    const src = readFileSync(layoutPath, "utf8");
    expect(src).toMatch(/width:\s*"device-width"/);
    expect(src).toMatch(/initialScale:\s*1/);
  });
});
