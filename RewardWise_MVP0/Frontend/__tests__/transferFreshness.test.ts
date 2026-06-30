/** @format */
import { describe, expect, it } from "vitest";
import { transferFreshness } from "../utils/transferFreshness";

const AS_OF = "2026-05-14";

describe("transferFreshness TTL bands", () => {
	it("under 30 days → fresh, no disclaimer", () => {
		const f = transferFreshness(AS_OF, new Date("2026-05-20T00:00:00Z")); // 6 days
		expect(f.band).toBe("fresh");
		expect(f.label).toBeNull();
		expect(f.dateLabel).toBe("May 14, 2026");
	});

	it("exactly 30 days → stale (gray verify)", () => {
		const f = transferFreshness(AS_OF, new Date("2026-06-13T00:00:00Z")); // 30 days
		expect(f.band).toBe("stale");
		expect(f.label).toContain("as of May 14, 2026");
		expect(f.label).toContain("verify before transferring");
		expect(f.label).not.toContain("out of date");
	});

	it("30–90 days → stale", () => {
		const f = transferFreshness(AS_OF, new Date("2026-06-30T00:00:00Z")); // 47 days
		expect(f.band).toBe("stale");
	});

	it("over 90 days → warn (orange, likely out of date)", () => {
		const f = transferFreshness(AS_OF, new Date("2026-09-01T00:00:00Z")); // 110 days
		expect(f.band).toBe("warn");
		expect(f.label).toContain("likely out of date as of May 14, 2026");
	});

	it("exactly 90 days → still stale (boundary)", () => {
		const f = transferFreshness(AS_OF, new Date("2026-08-12T00:00:00Z")); // 90 days
		expect(f.band).toBe("stale");
	});

	it("missing or invalid as_of → fresh, no disclaimer", () => {
		expect(transferFreshness(null).band).toBe("fresh");
		expect(transferFreshness(undefined).label).toBeNull();
		expect(transferFreshness("not-a-date").band).toBe("fresh");
	});
});
