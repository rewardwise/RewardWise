/** @format */
"use client";

import { AlertTriangle } from "lucide-react";
import { isPastCashHorizon } from "@/utils/dateInput";

type Props = {
	date: string | undefined;
};

// Inline alert shown below a date picker when the selected date is past
// the cash-fare horizon (FlightAPI/SerpAPI ~329d) but inside the award
// horizon (seats.aero 360d). The downstream search will still run; the
// verdict will degrade to awards-only (PR 5). The warning is purely
// informational — it does not gate submission.
//
// The outer aria-live wrapper is always mounted so screen readers
// register the polite region before its contents toggle. Without the
// stable host, NVDA / VoiceOver may miss the announcement when the
// element first enters the DOM.
export default function CashHorizonWarning({ date }: Props) {
	const show = Boolean(date) && isPastCashHorizon(date as string);

	return (
		<div aria-live="polite" role="status" className="mt-2">
			{show && (
				<div
					data-testid="cash-horizon-warning"
					className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs text-amber-200 sm:text-sm"
				>
					<AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
					<span className="leading-snug">
						Cash pricing isn&apos;t typically available this far out.
						We&apos;ll show award options only for this date.
					</span>
				</div>
			)}
		</div>
	);
}
