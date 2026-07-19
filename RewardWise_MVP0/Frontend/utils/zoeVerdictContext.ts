/** @format */
/**
 * Build the verdict context string sent to Zoe with every chat turn while a
 * verdict is on screen — so Zoe answers FROM the engine's live numbers instead
 * of fabricating costs (fiduciary acceptance bar).
 *
 * Number-basis rules (the old Ask-Zoe string mixed these on one screen):
 *  - Headline cash + points figures come from verdict.metrics — matched-scope
 *    GRAND TOTAL (both legs when a matched return exists, all travelers).
 *  - Per-program options are per-LEG data and are labeled "outbound leg only"
 *    so the model can never present them as trip totals.
 *  - No estimated_savings on pay_cash verdicts (it describes the rejected
 *    option and ≈ the full fare — misleading).
 */

interface AwardOptionLite {
	program?: string | null;
	points?: number | null;
	taxes?: number | null;
}

export interface ZoeContextInput {
	origin: string;
	destination: string;
	date: string;
	return_date?: string | null;
	is_roundtrip?: boolean;
	travelers?: number;
	cabin?: string;
	cash_price?: number | null;
	award_options?: AwardOptionLite[];
	verdict: {
		recommendation?: "use_points" | "pay_cash" | "wait";
		pay_cash?: boolean;
		confidence?: string;
		metrics?: {
			cash_price?: number | null;
			points_cost?: number | null;
			taxes?: number | null;
			cpp?: number | null;
			estimated_savings?: number | null;
		};
		winner?: { program?: string | null } | null;
	};
}

const money = (n: number | null | undefined) =>
	n == null ? null : `$${Math.round(n).toLocaleString()}`;
const pts = (n: number | null | undefined) =>
	n == null ? null : `${Math.round(n).toLocaleString()} points`;

export function buildZoeVerdictContext(r: ZoeContextInput): string {
	const v = r.verdict;
	const m = v.metrics ?? {};
	const rec =
		v.recommendation ?? (v.pay_cash ? "pay_cash" : "use_points");
	const recLabel =
		rec === "pay_cash" ? "Pay cash" : rec === "use_points" ? "Use points" : "Wait";

	const trip = `${r.origin} ${r.is_roundtrip ? "round trip to" : "one way to"} ${r.destination}, departing ${r.date}${
		r.return_date ? `, returning ${r.return_date}` : ""
	}, ${r.travelers ?? 1} traveler(s), ${r.cabin ?? "economy"}.`;

	const cash = money(m.cash_price ?? r.cash_price);
	const totalPts = pts(m.points_cost);
	const totalTaxes = money(m.taxes);
	const cpp = m.cpp != null ? `${m.cpp.toFixed(2)} cents per point` : null;

	const lines: string[] = [
		`Trip: ${trip}`,
		`Engine verdict: ${recLabel}${v.confidence ? ` (${v.confidence} confidence)` : ""}.`,
	];
	if (cash) lines.push(`Live TOTAL cash fare for the whole trip: ${cash}.`);
	if (totalPts) {
		lines.push(
			`Best award TOTAL for the whole trip: ${totalPts}${totalTaxes ? ` + ${totalTaxes} taxes` : ""}${
				v.winner?.program ? ` via ${v.winner.program.replace(/_/g, " ")}` : ""
			}${cpp ? ` (≈${cpp})` : ""}.`
		);
	}

	const opts = (r.award_options ?? [])
		.filter((o) => o.program && o.points != null)
		.slice(0, 3)
		.map(
			(o) =>
				`${(o.program as string).replace(/_/g, " ")}: ${pts(o.points)}${
					o.taxes != null ? ` + ${money(o.taxes)} taxes` : ""
				}`
		);
	if (opts.length > 0) {
		lines.push(`Per-program award options (OUTBOUND LEG ONLY, not trip totals): ${opts.join("; ")}.`);
	}

	// use_points is the only verdict where a savings framing is honest.
	if (rec === "use_points" && m.estimated_savings != null) {
		lines.push(`Booking on points would avoid about ${money(m.estimated_savings)} of cash outlay.`);
	}

	return lines.join("\n");
}
