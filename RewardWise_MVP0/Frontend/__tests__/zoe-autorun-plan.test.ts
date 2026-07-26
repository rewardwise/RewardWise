/** @format */
// planTripFill drives BOTH the auto-run decision copy (backend ack) and the
// voice form fields. Completeness is judged on the MERGED state (fill + what
// the form already holds), mirroring home's handleFillSearch.
import { describe, expect, it } from "vitest";
import { extractTripParams, planTripFill } from "../utils/tripExtract";

const TODAY = new Date(2026, 6, 26);

describe("planTripFill — auto-run completeness", () => {
	it("full trip statement -> willAutorun, nothing missing", () => {
		const ex = extractTripParams("fly from Denver to Austin September 10 to 14", TODAY);
		expect(planTripFill(ex, null)).toEqual({ willAutorun: true, missing: [] });
	});

	it("destination-only -> no autorun, missing origin+date", () => {
		const ex = extractTripParams("I want to fly to Tokyo", TODAY);
		expect(planTripFill(ex, null)).toEqual({ willAutorun: false, missing: ["origin", "date"] });
	});

	it("merges with the existing form: date-only update on a complete form autoruns", () => {
		const ex = extractTripParams("what about the 20th instead?", TODAY, {
			origin: "DEN", destination: "AUS", date: "2026-09-10", return_date: "2026-09-14",
		});
		expect(planTripFill(ex, { origin: "DEN", destination: "AUS", date: "2026-09-10", return_date: "2026-09-14" }))
			.toEqual({ willAutorun: true, missing: [] });
	});

	it("roundtrip statement without return date in form context -> return_date missing", () => {
		expect(planTripFill(
			{ origin: "DEN", destination: "AUS", date: "2026-09-10", tripType: "roundtrip" },
			null,
		)).toEqual({ willAutorun: false, missing: ["return_date"] });
	});

	it("null extraction (non-trip message) never autoruns", () => {
		expect(planTripFill(null, { origin: "DEN", destination: "AUS", date: "2026-09-10" }))
			.toEqual({ willAutorun: false, missing: [] });
	});
});
