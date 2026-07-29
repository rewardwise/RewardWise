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

	it("date-only update that jumps PAST the return holds and asks (was the P0 422)", () => {
		// Depart moves to the 20th but the form's return stays the 14th —
		// pre-fix this auto-ran and the engine's raw validation error rendered.
		const ex = extractTripParams("what about the 20th instead?", TODAY, {
			origin: "DEN", destination: "AUS", date: "2026-09-10", return_date: "2026-09-14",
		});
		expect(planTripFill(ex, { origin: "DEN", destination: "AUS", date: "2026-09-10", return_date: "2026-09-14" }))
			.toEqual({ willAutorun: false, missing: ["return_before_depart"] });
	});

	it("merges with the existing form: date-only update that stays valid autoruns", () => {
		const ex = extractTripParams("what about the 12th instead?", TODAY, {
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

// ── Merged trip-type completeness (2026-07-29 recording incident) ───────────
// "Tokyo to Sea, Mar 23, 1 traveler" on the DEFAULT round-trip form: the fill
// has no return date, so the search must HOLD and ask — the old plan judged
// only the fill's tripType (undefined), promised "running it now", and home's
// autorun then refused. The ack lied; nothing ever ran.

describe("planTripFill — form trip-type awareness", () => {
	const RT_FORM = { origin: null, destination: null, date: null, return_date: null, tripType: "roundtrip" as const };

	it("the incident message on a round-trip form holds and asks for the return date", () => {
		const ex = extractTripParams("Tokyo to Sea, Mar 23, 1 traveler", TODAY, RT_FORM);
		expect(ex?.origin).toBe("NRT,HND");
		expect(ex?.destination).toBe("SEA");
		expect(planTripFill(ex, RT_FORM)).toEqual({ willAutorun: false, missing: ["return_date"] });
	});

	it("same fill on a one-way form autoruns", () => {
		const ow = { ...RT_FORM, tripType: "oneway" as const };
		const ex = extractTripParams("Tokyo to Sea, Mar 23, 1 traveler", TODAY, ow);
		expect(planTripFill(ex, ow)).toEqual({ willAutorun: true, missing: [] });
	});

	it("replying 'one way' converts the trip and completes the run", () => {
		// After the hold, the honest user answer may be "one way" — that must
		// be a valid fill (previously discarded: tripType alone wasn't a signal).
		const current = { origin: "NRT,HND", destination: "SEA", date: "2027-03-23", return_date: null, tripType: "roundtrip" as const };
		const ex = extractTripParams("one way", TODAY, current);
		expect(ex?.tripType).toBe("oneway");
		expect(planTripFill(ex, current)).toEqual({ willAutorun: true, missing: [] });
	});

	it("stating a return date also completes the run", () => {
		const current = { origin: "NRT,HND", destination: "SEA", date: "2027-03-23", return_date: null, tripType: "roundtrip" as const };
		const ex = extractTripParams("coming back Mar 30", TODAY, current);
		expect(ex?.return_date).toBe("2027-03-30");
		expect(planTripFill(ex, current)).toEqual({ willAutorun: true, missing: [] });
	});
});
