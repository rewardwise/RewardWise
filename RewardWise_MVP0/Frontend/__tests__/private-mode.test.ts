/** @format */
// Five guardrails on the private-mode delete gate, each pinned.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	PRIVATE_MODE_CUTOFF_ISO,
	getServerInviteAllowlist,
	isExemptFromPrivateGate,
} from "../utils/auth/private-mode";

afterEach(() => {
	vi.unstubAllEnvs();
});

const AFTER = "2026-08-01T00:00:00Z";
const BEFORE = "2026-07-01T00:00:00Z";

describe("private-mode gate — five guardrails", () => {
	it("G1: invited_at exempts unconditionally (no allowlist sync needed)", () => {
		expect(
			isExemptFromPrivateGate({ email: "newinvitee@example.com", created_at: AFTER, invited_at: AFTER }),
		).toBe(true);
	});

	it("G2: linking-safe grandfather — earliest identity predates cutoff", () => {
		// Returning user whose brand-new Google identity linked onto an old account:
		// user.created_at is old; a fresh identity rides along.
		expect(
			isExemptFromPrivateGate({
				email: "old-user@example.com",
				created_at: BEFORE,
				identities: [{ created_at: AFTER }],
			}),
		).toBe(true);
		// Defensive inverse: even if a provider reported a rewritten created_at,
		// ANY pre-cutoff identity grandfathers.
		expect(
			isExemptFromPrivateGate({
				email: "old-user@example.com",
				created_at: AFTER,
				identities: [{ created_at: BEFORE }, { created_at: AFTER }],
			}),
		).toBe(true);
	});

	it("G3: allowlist reads server-only INTERNAL_EMAILS, never NEXT_PUBLIC", () => {
		vi.stubEnv("INTERNAL_EMAILS", "server-only@example.com");
		vi.stubEnv("NEXT_PUBLIC_INTERNAL_EMAILS", "leaked@example.com");
		const list = getServerInviteAllowlist();
		expect(list).toContain("server-only@example.com");
		expect(list).not.toContain("leaked@example.com");
	});

	it("built-in owners always allowlisted", () => {
		expect(isExemptFromPrivateGate({ email: "sarabjit.nagi@gmail.com", created_at: AFTER })).toBe(true);
		expect(isExemptFromPrivateGate({ email: "MyTravelWalletAI@gmail.com", created_at: AFTER })).toBe(true);
	});

	it("G5: cutoff (2026-07-27) exceeds the verified newest existing account (2026-07-21)", () => {
		expect(new Date(PRIVATE_MODE_CUTOFF_ISO).getTime()).toBeGreaterThan(
			new Date("2026-07-21T07:15:28Z").getTime(),
		);
		// The existing non-allowlisted smoke-style account passes untouched.
		expect(
			isExemptFromPrivateGate({ email: "smoke-test@mytravelwallet.ai", created_at: "2026-07-21T07:15:27Z" }),
		).toBe(true);
	});

	it("blocks: fresh, uninvited, non-allowlisted account", () => {
		expect(
			isExemptFromPrivateGate({ email: "stranger@example.com", created_at: AFTER, identities: [{ created_at: AFTER }] }),
		).toBe(false);
	});

	it("fails closed on null/empty user", () => {
		expect(isExemptFromPrivateGate(null)).toBe(false);
		expect(isExemptFromPrivateGate({ email: "x@example.com" })).toBe(false);
	});
});
