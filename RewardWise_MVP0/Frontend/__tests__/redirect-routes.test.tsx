/** @format */
/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`PERMANENT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  permanentRedirect: mockPermanentRedirect,
}));

beforeEach(() => {
  mockRedirect.mockClear();
  mockPermanentRedirect.mockClear();
});

describe("dead-route redirects", () => {
  it("/settings → /profile", async () => {
    const mod = await import("../app/settings/page");
    expect(() => mod.default()).toThrow("REDIRECT:/profile");
    expect(mockRedirect).toHaveBeenCalledWith("/profile");
  });

  it("/circle → /", async () => {
    const mod = await import("../app/circle/page");
    expect(() => mod.default()).toThrow("REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("/transfer-optimizer → /", async () => {
    const mod = await import("../app/transfer-optimizer/page");
    expect(() => mod.default()).toThrow("REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("/dashboard → /", async () => {
    const mod = await import("../app/dashboard/page");
    expect(() => mod.default()).toThrow("REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("/trips → /history?tab=booked (permanent, 8b fold)", async () => {
    const mod = await import("../app/trips/page");
    expect(() => mod.default()).toThrow("PERMANENT_REDIRECT:/history?tab=booked");
    expect(mockPermanentRedirect).toHaveBeenCalledWith("/history?tab=booked");
  });
});
