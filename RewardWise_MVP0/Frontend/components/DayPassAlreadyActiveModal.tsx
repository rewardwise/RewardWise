/** @format */
"use client";

import { Loader2, X } from "lucide-react";

export type DayPassAlreadyActiveDetails = {
	hasActiveDayPass: boolean;
	dayPassRemainingHours: number;
	dayPassExpiresAt: string | null;
	hasActiveSubscription: boolean;
	upsell: "monthly" | null;
};

type Props = {
	open: boolean;
	details: DayPassAlreadyActiveDetails | null;
	upgradeLoading: boolean;
	onUpgradeToMonthly: () => void;
	onDismiss: () => void;
};

export default function DayPassAlreadyActiveModal({
	open,
	details,
	upgradeLoading,
	onUpgradeToMonthly,
	onDismiss,
}: Props) {
	if (!open || !details) return null;

	const remainingHours = Math.max(0, details.dayPassRemainingHours);
	const hourLabel = remainingHours === 1 ? "hour" : "hours";

	const title = details.hasActiveSubscription
		? "You already have Monthly access"
		: "Your Day Pass is still active";

	const body = details.hasActiveSubscription
		? "Your Monthly subscription already covers full access to Verdict Search and Zoe. You don't need a Day Pass right now."
		: `You have about ${remainingHours} ${hourLabel} left on your current Day Pass. Buying another would not give you more time — it would replace what's left with a fresh 24 hours. Most people who hit this want Monthly instead.`;

	const showUpgrade = details.upsell === "monthly";

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="day-pass-active-title"
			data-testid="day-pass-already-active-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		>
			<div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
				<button
					type="button"
					aria-label="Close"
					onClick={onDismiss}
					className="absolute right-4 top-4 text-stone-400 hover:text-stone-700"
				>
					<X className="h-5 w-5" />
				</button>
				<h2
					id="day-pass-active-title"
					className="text-xl font-bold text-stone-900 mb-3"
				>
					{title}
				</h2>
				<p className="text-stone-700 text-sm leading-relaxed mb-6">{body}</p>

				<div className="flex flex-col gap-3">
					{showUpgrade && (
						<button
							type="button"
							data-testid="upgrade-to-monthly"
							onClick={onUpgradeToMonthly}
							disabled={upgradeLoading}
							className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
						>
							{upgradeLoading ? (
								<>
									<Loader2 className="h-5 w-5 animate-spin" />
									Opening checkout...
								</>
							) : (
								"Upgrade to Monthly ($3.99/mo)"
							)}
						</button>
					)}
					<button
						type="button"
						data-testid="dismiss-modal"
						onClick={onDismiss}
						className="w-full border border-stone-300 text-stone-700 font-semibold py-3 rounded-lg hover:bg-stone-50"
					>
						{showUpgrade ? "Not now" : "Got it"}
					</button>
				</div>
			</div>
		</div>
	);
}
