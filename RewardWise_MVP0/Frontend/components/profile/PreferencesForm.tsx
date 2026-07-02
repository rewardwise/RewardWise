/** @format */
"use client";

import { useEffect, useState } from "react";
import { usePreferences, type SearchDefaults, type Cabin, type TripType } from "@/hooks/usePreferences";
import { trackAnalyticsEvent } from "@/utils/analytics/client";
import { Loader2, Check } from "lucide-react";

const CABIN_OPTIONS: { value: Cabin; label: string }[] = [
	{ value: "economy", label: "Economy" },
	{ value: "premium_economy", label: "Premium Economy" },
	{ value: "business", label: "Business" },
	{ value: "first", label: "First" },
];
const TRIP_OPTIONS: { value: TripType; label: string }[] = [
	{ value: "roundtrip", label: "Round trip" },
	{ value: "oneway", label: "One way" },
];

const selectCls =
	"w-full rounded-mtw border border-mtw-border bg-white px-3 py-2 text-mtw-small text-mtw-ink outline-none focus:border-mtw-emerald";

export default function PreferencesForm() {
	const { searchDefaults, loading, loaded, saveSearchDefaults } = usePreferences();
	const [form, setForm] = useState<SearchDefaults>(searchDefaults);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState("");

	// Sync the form once the server read settles (or when defaults change).
	useEffect(() => {
		if (loaded) setForm(searchDefaults);
	}, [loaded, searchDefaults]);

	const set = <K extends keyof SearchDefaults>(k: K, v: SearchDefaults[K]) => {
		setForm((prev) => ({ ...prev, [k]: v }));
		setSaved(false);
	};

	const save = async () => {
		setSaving(true);
		setError("");
		setSaved(false);
		const before = searchDefaults;
		const err = await saveSearchDefaults(form);
		setSaving(false);
		if (err) {
			setError(err);
			return;
		}
		// One analytics event per CHANGED field (so a 2-field submit fires twice).
		(["cabin", "travelers", "trip_type"] as const).forEach((field) => {
			if (before[field] !== form[field]) {
				trackAnalyticsEvent("preferences_updated", {
					event_type: "preferences",
					metadata: { field, value_before: before[field], value_after: form[field] },
				});
			}
		});
		setSaved(true);
	};

	const card = "rounded-2xl border border-mtw-border bg-white shadow-mtw-ambient";

	return (
		<div className="font-mtw space-y-4">
			<div>
				<h2 className="text-mtw-title font-semibold text-mtw-ink">Preferences</h2>
				<p className="text-mtw-small text-mtw-muted">Defaults for new searches — the search form starts here next time.</p>
			</div>

			<div className={`p-5 ${card}`} data-testid="preferences-form">
				<p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-mtw-muted">Search defaults</p>
				{loading ? (
					<Loader2 className="h-5 w-5 animate-spin text-mtw-emerald" />
				) : (
					<div className="grid gap-4 sm:grid-cols-3">
						<label className="block">
							<span className="mb-1 block text-xs font-medium text-mtw-muted">Cabin</span>
							<select
								data-testid="pref-cabin"
								value={form.cabin}
								onChange={(e) => set("cabin", e.target.value as Cabin)}
								className={selectCls}
							>
								{CABIN_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-xs font-medium text-mtw-muted">Travelers</span>
							<select
								data-testid="pref-travelers"
								value={form.travelers}
								onChange={(e) => set("travelers", Number(e.target.value))}
								className={selectCls}
							>
								{Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</label>
						<label className="block">
							<span className="mb-1 block text-xs font-medium text-mtw-muted">Trip type</span>
							<select
								data-testid="pref-trip-type"
								value={form.trip_type}
								onChange={(e) => set("trip_type", e.target.value as TripType)}
								className={selectCls}
							>
								{TRIP_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>
					</div>
				)}

				<div className="mt-5 flex items-center gap-3">
					<button
						type="button"
						onClick={save}
						disabled={saving || loading}
						data-testid="pref-save"
						className="inline-flex items-center gap-1.5 rounded-mtw bg-mtw-emerald px-4 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						Save preferences
					</button>
					{saved && (
						<span data-testid="pref-saved" className="inline-flex items-center gap-1 text-mtw-small text-mtw-emerald">
							<Check className="h-4 w-4" /> Saved
						</span>
					)}
					{error && <span className="text-mtw-small text-red-600">{error}</span>}
				</div>
			</div>
		</div>
	);
}
