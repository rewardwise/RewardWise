/** @format */
"use client";

import { AlertTriangle, Calendar, ExternalLink } from "lucide-react";
import type { Verdict } from "@/types/verdict";

export type PartialDataVariant =
	| "missing_cash_horizon"
	| "missing_cash_upstream"
	| "defensive";

type Props = {
	verdict: Verdict;
	onTryDifferentDate?: () => void;
	variant?: PartialDataVariant;
};

const HEADLINES: Record<PartialDataVariant, string> = {
	missing_cash_horizon: "Award seats available · Cash data unavailable",
	missing_cash_upstream: "Award seats available · Cash data unavailable",
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
// (variant="missing_cash_horizon" or "missing_cash_upstream") or when
// overall data quality is low (variant="defensive"). Does NOT gate
// booking — users can verify the winning program directly.
//
// Cause-aware subtext: horizon variant says cash data isn't typically
// available that far out (true at >329 days); upstream variant says
// pricing is temporarily unavailable (true when the cash provider chain
// failed within the horizon — quota, timeout, route gap). The legacy
// single "missing_cash" variant rendered the horizon copy for both
// causes, which lied to users searching trips inside the horizon.
export default function PartialDataCard({
	verdict,
	onTryDifferentDate,
	variant = "missing_cash_horizon",
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
					{variant === "missing_cash_horizon" ? (
						<p
							data-testid="partial-data-cash-subtext-horizon"
							className="mt-2 text-sm leading-6 text-slate-400"
						>
							Live cash pricing isn&apos;t typically available more than
							~10 months out, so we can&apos;t compare cash vs points
							for this trip.
						</p>
					) : null}
					{variant === "missing_cash_upstream" ? (
						<p
							data-testid="partial-data-cash-subtext-upstream"
							className="mt-2 text-sm leading-6 text-slate-400"
						>
							Cash pricing for this trip is temporarily unavailable. Try
							again in a few minutes, or pick a different date or route.
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
							? `${winner.points.toLocaleString()} points (outbound, per traveler)`
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
