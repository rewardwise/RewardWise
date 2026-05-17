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
  authState: { user: { id: "user-1" } as unknown },
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

describe("TopNav — mobile labels under hamburger and bell (86b9rprq0)", () => {
  it("renders a visible Menu label under the hamburger button on mobile", () => {
    act(() => {
      root.render(<TopNav />);
    });
    const hamburger = container.querySelector(
      'button[aria-label="Open navigation menu"]'
    );
    expect(hamburger, "hamburger button must be in DOM").not.toBeNull();
    expect(hamburger?.textContent).toContain("Menu");
  });

  it("renders a visible Alerts label under the bell button on mobile", () => {
    act(() => {
      root.render(<TopNav />);
    });
    const bell = container.querySelector('button[aria-label="Alerts"]');
    expect(bell, "bell button must be in DOM").not.toBeNull();
    // The "Alerts" label has class `sm:hidden` so it is in the DOM but hidden
    // on desktop via CSS. The presence-in-DOM assertion is the testable layer.
    expect(bell?.textContent).toContain("Alerts");
  });

  it("Alerts label uses sm:hidden so it is mobile-only at the CSS layer", () => {
    act(() => {
      root.render(<TopNav />);
    });
    const bell = container.querySelector('button[aria-label="Alerts"]');
    const alertsSpan = Array.from(bell?.querySelectorAll("span") ?? []).find(
      (s) => s.textContent === "Alerts"
    );
    expect(alertsSpan, "Alerts label span must exist").toBeDefined();
    expect(alertsSpan?.className).toContain("sm:hidden");
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
