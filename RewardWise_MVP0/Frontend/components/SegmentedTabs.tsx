/** @format */
"use client";

/**
 * Light segmented control matching the 8a design language (pill container,
 * emerald active pill). Used for the History sub-tabs; generic enough to reuse.
 *
 * Controlled: parent owns the active key. `role=tablist` / `role=tab` with
 * `aria-selected` so it's announced as tabs. Each tab carries a data-testid
 * (`tab-<key>`) for smokes.
 */
export type SegmentedTab = { key: string; label: string };

export default function SegmentedTabs({
	tabs,
	active,
	onChange,
	ariaLabel,
}: {
	tabs: SegmentedTab[];
	active: string;
	onChange: (key: string) => void;
	ariaLabel?: string;
}) {
	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className="font-mtw inline-flex items-center gap-1 rounded-mtw-pill border border-mtw-border bg-white p-1 shadow-mtw-ambient"
		>
			{tabs.map((tab) => {
				const selected = tab.key === active;
				return (
					<button
						key={tab.key}
						type="button"
						role="tab"
						aria-selected={selected}
						data-testid={`tab-${tab.key}`}
						onClick={() => onChange(tab.key)}
						className={`rounded-mtw-pill px-4 py-1.5 text-mtw-small font-semibold transition-colors ${
							selected
								? "bg-mtw-emerald text-white"
								: "text-mtw-muted hover:text-mtw-ink"
						}`}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
