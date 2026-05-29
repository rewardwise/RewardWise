/** @format */
/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

beforeEach(() => {
  mockRedirect.mockClear();
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
});
