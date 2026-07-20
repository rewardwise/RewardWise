/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getProgramHandoffInfo } from "@/utils/airlines";
import { transferFreshness, type Freshness } from "@/utils/transferFreshness";
import { trackAnalyticsEvent } from "@/utils/analytics/client";
import type { Ownership, ReachablePartner } from "@/types/verdict";

interface OwnershipForkProps {
	ownership: Ownership;
	searchId?: string | null;
	verdictId?: string | null;
}

function fmtPts(n: number): string {
	return n.toLocaleString();
}
function fmtMoney(n: number): string {
	return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

function PartnerList({
	partners,
	fresh,
	heading,
}: {
	partners: ReachablePartner[];
	fresh: Freshness;
	heading?: string;
}) {
	return (
		<div className="mt-3">
			{heading ? <p className="text-mtw-label uppercase text-mtw-muted">{heading}</p> : null}
			<ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-mtw-small text-mtw-ink">
				{partners.map((p) => (
					<li key={p.sourceCard}>
						{p.short}{" "}
						<span className="text-mtw-muted">
							({p.ratio}
							{p.native ? " · in your account" : ""})
						</span>
					</li>
				))}
			</ul>
			{fresh.label ? (
				<p
					data-testid="freshness"
					data-band={fresh.band}
					className={`mt-2 text-xs ${fresh.band === "warn" ? "font-medium text-orange-600" : "text-mtw-muted"}`}
				>
					{fresh.label}
				</p>
			) : null}
		</div>
	);
}

export default function OwnershipFork({ ownership, searchId, verdictId }: OwnershipForkProps) {
	const o = ownership;
	const router = useRouter();
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		trackAnalyticsEvent("ownership_fork_shown", {
			event_type: "ownership",
			metadata: {
				fork_reason: o.fork_reason,
				fork_recommendation: o.fork_recommendation,
				program: o.program,
				points_needed: o.points_needed,
				owned_balance: o.owned_balance,
				shortfall: o.shortfall,
				buyable: o.buyable,
				buy_gap_cost: o.buy_gap_cost,
				redemption_cpp: o.redemption_cpp,
				can_afford: o.can_afford,
				logged_in: o.fork_reason !== "logged_out",
				search_id: searchId ?? null,
				verdict_id: verdictId ?? null,
			},
		});
		// Re-fire only when the underlying fork facts change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [o.fork_reason, o.program, o.shortfall, searchId, verdictId]);

	const onCta = (cta: string) => {
		trackAnalyticsEvent("ownership_fork_cta_click", {
			event_type: "ownership",
			metadata: {
				cta,
				fork_reason: o.fork_reason,
				program: o.program,
				search_id: searchId ?? null,
				verdict_id: verdictId ?? null,
			},
		});
	};

	const label = o.program_label || o.program;
	const fresh = transferFreshness(o.transfers_as_of);
	const partners = o.reachable_partners ?? [];
	const { url } = getProgramHandoffInfo(o.program);
	const hasHref = url !== "#";

	// ── b2: owned_sufficient ────────────────────────────────────────────────
	if (o.can_afford) {
		const top = partners.find((p) => !p.native) ?? partners[0];
		return (
			<section
				data-testid="ownership-fork"
				data-fork="owned_sufficient"
				className="font-mtw mt-4 rounded-mtw-lg border border-mtw-emerald/40 bg-mtw-emerald/[0.06] p-4"
			>
				<p className="text-mtw-small font-semibold text-mtw-emerald">✓ You can book this</p>
				<p className="mt-1 text-mtw-body text-mtw-ink">
					{top && !top.native ? (
						<>
							Transfer <b>{fmtPts(o.points_needed)} pts</b> from your{" "}
							<b>{fmtPts(o.owned_balance)}</b> via {top.short} ({top.ratio}) → {label}.
						</>
					) : (
						<>
							Book with <b>{fmtPts(o.points_needed)} pts</b> from your{" "}
							<b>{fmtPts(o.owned_balance)}</b> {label}.
						</>
					)}
				</p>
				{partners.length > 0 ? <PartnerList partners={partners} fresh={fresh} /> : null}
				{hasHref ? (
					<a
						data-testid="fork-cta"
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						onClick={() => onCta("book_points")}
						className="bg-mtw-emerald text-mtw-on-emerald mt-3 inline-flex items-center gap-2 rounded-mtw px-4 py-2 text-mtw-small font-semibold"
					>
						Book with points <ExternalLink className="h-4 w-4" aria-hidden="true" />
					</a>
				) : null}
							{(o as any).scope === "outbound_only" ? (
					<p data-testid="fork-return-cash-note" className="mt-2 text-mtw-small text-mtw-muted">
						No award space for the return leg — it stays a cash purchase (roughly
						half the round-trip fare; one-way fares are often higher).
					</p>
				) : null}
			</section>
		);
	}

	// ── b3: short (worth_it / not_worth_it / cant_buy) → pay cash ────────────
	const reason =
		o.fork_reason === "short_buy_worth_it"
			? `You could buy the ${fmtPts(o.shortfall)}-pt gap (≈${o.buy_gap_cost != null ? fmtMoney(o.buy_gap_cost) : "—"}), but airline buy-prices swing a lot — pay cash here and keep your points.`
			: o.fork_reason === "short_cant_buy"
				? `These points can't be bought to close the gap — pay cash and keep what you have.`
				: `Buying the ${fmtPts(o.shortfall)}-pt gap would cost more than you'd save versus cash — pay cash and keep your points.`;

	return (
		<section
			data-testid="ownership-fork"
			data-fork={o.fork_reason}
			className="font-mtw mt-4 rounded-mtw-lg border border-amber-300 bg-amber-50 p-4"
		>
			<p className="text-mtw-small font-semibold text-amber-700">
				Points win on value — but you&apos;re short
			</p>
			<p className="mt-1 text-mtw-body text-mtw-ink">
				You&apos;re <b>{fmtPts(o.shortfall)} pts</b> short for {label} (need{" "}
				{fmtPts(o.points_needed)}, you can reach {fmtPts(o.owned_balance)}).
			</p>
			<p className="mt-1 text-mtw-small text-mtw-muted">{reason}</p>
			{partners.length > 0 ? (
				<PartnerList partners={partners} fresh={fresh} heading="How your points reach this program" />
			) : null}
		</section>
	);
}
