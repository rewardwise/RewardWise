/** @format */
"use client";

import { AlertTriangle, Calendar, ExternalLink } from "lucide-react";

type Confidence = "high" | "medium" | "low";

// TODO(pr-5): consolidate with VerdictCard.tsx by extracting
// `Verdict`, `VerdictWinner`, `BookingLink` to `types/verdict.ts` and
// importing from both surfaces. Kept inline here to keep PR 4
// additive-only (zero touch on VerdictCard).
interface VerdictWinner {
	program: string | null;
	points: number | null;
	taxes: number | null;
	cpp: number | null;
	direct: boolean | null;
}

interface BookingLink {
	seats_aero_link: string | null;
	airline_link: string | null;
	preferred: "seats_aero" | "airline" | "none";
}

export interface PartialDataVerdict {
	verdict: string;
	verdict_label?: string;
	recommendation?: "use_points" | "pay_cash" | "wait";
	headline?: string;
	explanation?: string;
	winner: VerdictWinner | null;
	pay_cash: boolean;
	confidence: Confidence;
	booking_link?: BookingLink;
}

export type PartialDataVariant = "missing_cash" | "defensive";

type Props = {
	verdict: PartialDataVerdict;
	onTryDifferentDate?: () => void;
	variant?: PartialDataVariant;
};

const HEADLINES: Record<PartialDataVariant, string> = {
	missing_cash: "Award seats available · Cash data unavailable",
	defensive: "Limited data for this comparison",
};

// Mirrors AwardDetailsSection.fmtProgram so program names render
// consistently across surfaces ("flyingblue" → "Flying Blue", etc.).
// Third duplicate of this helper — follow-up ticket to extract to
// utils/program.ts once VerdictCard's copy is also touched.
function fmtProgram(s?: string | null) {
	const raw = (s || "").replace(/_/g, " ").trim();
	if (!raw) return "";
	const normalized = raw.toLowerCase();
	const special: Record<string, string> = {
		flyingblue: "Flying Blue",
		"flying blue": "Flying Blue",
		virginatlantic: "Virgin Atlantic",
		"virgin atlantic": "Virgin Atlantic",
		"american airlines": "American Airlines",
		"british airways": "British Airways",
	};
	if (special[normalized]) return special[normalized];
	return raw
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

// Card shown when we have an award verdict but cash data is missing
// (variant="missing_cash") or when overall data quality is low
// (variant="defensive"). Does NOT gate booking — users can verify the
// winning program directly. PR 5 wires this into VerdictCard's
// recommendation === "wait" branch so users hitting dates past the
// cash horizon stop landing on the generic ErrorStateCard.
//
// Layout: CTA row stacks vertically on mobile (default) and goes
// side-by-side from the Tailwind sm: breakpoint (640px) upward. The
// spec calls out 375px (iPhone SE) and 1440px (laptop) reference
// widths — both are satisfied by `flex-col sm:flex-row`.
//
// When variant="defensive" + no winner + no booking link, the only
// remaining action is "Try a different date". Callers MUST pass
// `onTryDifferentDate` to avoid a dead-end card; VerdictCard will
// always wire it when this lands in PR 5.
export default function PartialDataCard({
	verdict,
	onTryDifferentDate,
	variant = "missing_cash",
}: Props) {
	const headline = HEADLINES[variant];
	const explanation = verdict.explanation ?? "";
	const winner = verdict.winner;
	const winnerProgram = fmtProgram(winner?.program);
	// airline_link preferred when present, fall back to seats.aero.
	// Optional-chain because the backend has historically omitted the
	// booking_link object on degraded verdicts; matches VerdictCard's
	// defensive access pattern.
	const verifyHref =
		verdict.booking_link?.airline_link ||
		verdict.booking_link?.seats_aero_link ||
		null;
	const showVerifyCta = Boolean(verifyHref && winnerProgram);

	return (
		<div
			role="region"
			aria-label={headline}
			data-testid="partial-data-card"
			className="rounded-3xl border border-amber-400/30 bg-slate-950/95 p-6 shadow-2xl md:p-8"
		>
			<div className="flex items-start gap-3">
				<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/15">
					<AlertTriangle className="h-4 w-4 text-amber-300" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">
						Partial data
					</p>
					<h2 className="mt-1 text-xl font-extrabold tracking-tight text-white md:text-2xl">
						{headline}
					</h2>
					{explanation ? (
						<p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
							{explanation}
						</p>
					) : null}
					{variant === "missing_cash" ? (
						<p
							data-testid="partial-data-cash-subtext"
							className="mt-2 text-sm leading-6 text-slate-400"
						>
							Live cash pricing isn&apos;t typically available more than
							~10 months out, so we can&apos;t compare cash vs points
							for this trip.
						</p>
					) : null}
				</div>
			</div>

			{winner && winnerProgram ? (
				<div
					data-testid="partial-data-winner"
					className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
				>
					<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
						Award booking
					</p>
					<p className="mt-1 text-base font-bold text-white">
						{winnerProgram}
					</p>
					<p className="mt-1 text-sm text-slate-300">
						{winner.points != null
							? `${winner.points.toLocaleString()} points`
							: "Points TBD"}
						{winner.taxes != null && winner.taxes > 0
							? ` plus $${winner.taxes.toFixed(0)} in taxes`
							: ""}
					</p>
				</div>
			) : null}

			<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
				{showVerifyCta && verifyHref ? (
					<a
						href={verifyHref}
						target="_blank"
						rel="noopener noreferrer"
						data-testid="partial-data-verify-cta"
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
					>
						<ExternalLink className="h-4 w-4" />
						Verify on {winnerProgram}
					</a>
				) : null}
				{onTryDifferentDate ? (
					<button
						type="button"
						onClick={onTryDifferentDate}
						data-testid="partial-data-retry-date-cta"
						className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]"
					>
						<Calendar className="h-4 w-4" />
						Try a different date
					</button>
				) : null}
			</div>
		</div>
	);
}
