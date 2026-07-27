/** @format */
import { describe, expect, it } from "vitest";
import { getProgramHandoffInfo, unitedAwardDeepLink } from "../utils/airlines";

const TRIP = {
	origin: "SEA", destination: "DEN",
	departDate: "2026-09-21", returnDate: "2026-09-25",
	travelers: 1, cabin: "economy",
};

describe("United award deep link (#8 — dead template now wired)", () => {
	it("builds the verified fsr template with route/dates/pax + award mode", () => {
		const url = unitedAwardDeepLink(TRIP)!;
		expect(url).toContain("united.com/en/us/fsr/choose-flights");
		expect(url).toContain("f=SEA");
		expect(url).toContain("t=DEN");
		expect(url).toContain("d=2026-09-21");
		expect(url).toContain("r=2026-09-25");
		expect(url).toContain("px=1");
		expect(url).toContain("sc=economy");
		expect(url).toContain("tqp=A");
	});

	it("getProgramHandoffInfo uses the deep link for united WITH trip context", () => {
		const { url } = getProgramHandoffInfo("united", TRIP);
		expect(url).toContain("fsr/choose-flights?");
	});

	it("without trip context united falls back to the homepage (unchanged)", () => {
		expect(getProgramHandoffInfo("united").url).toBe("https://www.united.com");
	});

	it("other programs stay on homepages even with trip context", () => {
		expect(getProgramHandoffInfo("alaska", TRIP).url).toContain("alaskaair.com");
		expect(getProgramHandoffInfo("delta", TRIP).url).toBe("https://www.delta.com");
	});

	it("incomplete trip context -> no deep link", () => {
		expect(unitedAwardDeepLink({ origin: "SEA" })).toBeNull();
	});
});
