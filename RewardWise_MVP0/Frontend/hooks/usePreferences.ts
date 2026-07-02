/** @format */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { createClient } from "@/utils/supabase/client";

export type TripType = "roundtrip" | "oneway";
export type Cabin = "economy" | "premium_economy" | "business" | "first";

export interface SearchDefaults {
	cabin: Cabin;
	travelers: number;
	trip_type: TripType;
}

/** Hardcoded fallback — identical to the pre-8b search-pill defaults. Used when a
 *  user has no prefs row yet OR the read fails / the column isn't there yet. */
export const HARDCODED_SEARCH_DEFAULTS: SearchDefaults = {
	cabin: "economy",
	travelers: 1,
	trip_type: "roundtrip",
};

const CABINS: Cabin[] = ["economy", "premium_economy", "business", "first"];

/** Coerce arbitrary stored JSON into a valid SearchDefaults (never throws). */
export function normalizeSearchDefaults(raw: unknown): SearchDefaults {
	const sd = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Partial<
		Record<keyof SearchDefaults, unknown>
	>;
	const cabin = CABINS.includes(sd.cabin as Cabin) ? (sd.cabin as Cabin) : HARDCODED_SEARCH_DEFAULTS.cabin;
	const tripType = sd.trip_type === "oneway" || sd.trip_type === "roundtrip"
		? (sd.trip_type as TripType)
		: HARDCODED_SEARCH_DEFAULTS.trip_type;
	// Mirror the backend validator (validators.py): travelers must be 1–9. Clamp
	// so a stored/edited value can never produce a 422 when it seeds the pill.
	const nRaw = Number(sd.travelers);
	const travelers = Number.isFinite(nRaw) ? Math.min(9, Math.max(1, Math.trunc(nRaw))) : HARDCODED_SEARCH_DEFAULTS.travelers;
	return { cabin, travelers, trip_type: tripType };
}

/**
 * Server-persisted user preferences (profiles.prefs jsonb). Reads on mount,
 * writes on save. DEFENSIVE by design: any read error (incl. the column not yet
 * existing during the migration deploy window) falls back to the hardcoded
 * defaults and never throws — Preferences degrades, it doesn't break.
 */
export function usePreferences() {
	const { user } = useAuth();
	const supabase = useMemo(() => createClient(), []);

	const [searchDefaults, setSearchDefaults] = useState<SearchDefaults>(HARDCODED_SEARCH_DEFAULTS);
	const [loading, setLoading] = useState(true);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		if (!user) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const { data, error } = await supabase
					.from("profiles")
					.select("prefs")
					.eq("user_id", user.id)
					.maybeSingle();
				if (cancelled) return;
				if (error) throw error;
				const sd = (data?.prefs as { search_defaults?: unknown } | null)?.search_defaults;
				setSearchDefaults(sd ? normalizeSearchDefaults(sd) : HARDCODED_SEARCH_DEFAULTS);
			} catch {
				// Fallback — never surface a hard error for a convenience feature
				// (also covers the brief post-merge window before the column exists).
				if (!cancelled) setSearchDefaults(HARDCODED_SEARCH_DEFAULTS);
			} finally {
				if (!cancelled) {
					setLoading(false);
					setLoaded(true);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [user, supabase]);

	/** Persist search defaults, merge-preserving any other keys in prefs. Returns
	 *  an error string on failure (the caller shows it), null on success. */
	const saveSearchDefaults = useCallback(
		async (next: SearchDefaults): Promise<string | null> => {
			if (!user) return "Not signed in.";
			const clean = normalizeSearchDefaults(next);
			// Read-modify-write so we don't clobber future prefs keys.
			const { data: existing } = await supabase
				.from("profiles")
				.select("prefs")
				.eq("user_id", user.id)
				.maybeSingle();
			const mergedPrefs = { ...(existing?.prefs as object | null), search_defaults: clean };
			const { error } = await supabase
				.from("profiles")
				.update({ prefs: mergedPrefs })
				.eq("user_id", user.id);
			if (error) return error.message || "Failed to save preferences.";
			setSearchDefaults(clean);
			return null;
		},
		[user, supabase],
	);

	return { searchDefaults, loading, loaded, saveSearchDefaults };
}
