/** @format */

export type Confidence = "high" | "medium" | "low";

export type Recommendation = "use_points" | "pay_cash" | "wait";

export interface VerdictWinner {
	program: string | null;
	points: number | null;
	taxes: number | null;
	cpp: number | null;
	direct: boolean | null;
}

export interface BookingLink {
	seats_aero_link: string | null;
	airline_link: string | null;
	preferred: "seats_aero" | "airline" | "none";
}

export interface NextStep {
	type: string;
	label: string;
	prompt: string;
}

export interface Verdict {
	verdict: string;
	verdict_label?: string;
	recommendation?: Recommendation;
	headline?: string;
	explanation?: string;
	winner: VerdictWinner | null;
	pay_cash: boolean;
	confidence: Confidence;
	confidence_reason?: string;
	booking_note: string;
	// Optional because degraded "wait" verdicts can omit booking_link entirely;
	// VerdictCard + PartialDataCard already access it defensively with `?.`.
	booking_link?: BookingLink;
	data_quality?: string;
	missing_sources?: string[];
	safe_fallback_used?: boolean;
	metrics?: {
		cash_price?: number | null;
		points_cost?: number | null;
		taxes?: number | null;
		estimated_savings?: number | null;
	};
	next_step?: NextStep | null;
}
