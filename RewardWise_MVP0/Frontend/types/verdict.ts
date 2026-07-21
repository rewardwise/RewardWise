/** @format */

export type Confidence = "high" | "medium" | "low";

export type Recommendation = "use_points" | "pay_cash" | "wait";

export type VerdictTier = "premium" | "solid" | "marginal" | "pay_cash" | "wait";

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

export type ForkReason =
	| "owned_sufficient"
	| "short_buy_worth_it"
	| "short_buy_not_worth_it"
	| "short_cant_buy"
	// 8c: guest (logged-out) verdict — no wallet context; the fork invites a
	// wallet connect instead of comparing owned balances.
	| "logged_out";

export interface ReachablePartner {
	sourceCard: string;
	short: string;
	ratio: string;
	converted: number;
	native: boolean;
}

/** Per-request ownership fork from the backend (see ownership.py). */
export interface Ownership {
	applicable: boolean;
	program: string;
	program_label: string | null;
	points_needed: number;
	owned_balance: number;
	shortfall: number;
	can_afford: boolean;
	reachable_partners: ReachablePartner[];
	buyable: boolean;
	buy_rate_cpp: number | null;
	redemption_cpp: number | null;
	buy_gap_cost: number | null;
	buy_gap_worth_it: boolean;
	fork_recommendation: "use_points" | "pay_cash";
	fork_reason: ForkReason;
	transfers_as_of: string | null;
}

export interface Verdict {
	verdict: string;
	verdict_label?: string;
	recommendation?: Recommendation;
	headline?: string;
	explanation?: string;
	winner: VerdictWinner | null;
	/** Engine's return-leg pick (step c single selector); card consumes it. */
	return_winner?: (VerdictWinner & { points?: number | null; taxes?: number | null }) | null;
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
		points_cost_per_traveler?: number | null;
		taxes?: number | null;
		estimated_savings?: number | null;
		cpp?: number | null;
		travelers?: number | null;
	};
	next_step?: NextStep | null;
	verdict_tier?: VerdictTier | null;
	tier_explanation?: string | null;
	/** Per-request, wallet-aware. Null when not a use_points verdict. */
	ownership?: Ownership | null;
}
