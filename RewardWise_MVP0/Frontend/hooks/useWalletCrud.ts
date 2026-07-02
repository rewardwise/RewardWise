/** @format */
"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletContext";
import { createClient } from "@/utils/supabase/client";
import { validatePoints } from "@/utils/format";
import { trackAnalyticsEvent } from "@/utils/analytics/client";

export interface WalletCrudResult {
	ok: boolean;
	error?: string;
}

/**
 * Add / edit-balance / delete for wallet program rows (the `cards` table), sharing
 * the SAME data source as the nav wallet pill and the b2 ownership fork.
 *
 * Every mutation `await`s the Supabase call then calls `refreshWallet()` so the
 * nav pill (and any verdict) re-render in the same session — the standalone
 * /wallet-setup page skips refreshWallet, which is why its edits didn't propagate.
 * Balance inputs go through validatePoints (50M cap, 8a-hotfix-2); a rejected
 * value fires `wallet_balance_rejected` (NOT a fake success event).
 */
export function useWalletCrud() {
	const { user } = useAuth();
	const { cards, refreshWallet } = useWallet();
	const supabase = useMemo(() => createClient(), []);

	const addProgram = useCallback(
		async (opts: { cardName: string; program: string; balance: number }): Promise<WalletCrudResult> => {
			if (!user) return { ok: false, error: "Not signed in." };
			const v = validatePoints(opts.balance);
			if (!v.ok) {
				trackAnalyticsEvent("wallet_balance_rejected", {
					event_type: "wallet",
					metadata: { attempted_value: opts.balance, program: opts.program, reason: v.reason, surface: "profile_add" },
				});
				return { ok: false, error: v.reason };
			}
			const { data: programs } = await supabase
				.from("reward_programs")
				.select("id, name")
				.eq("name", opts.program);
			const programId = programs?.[0]?.id;
			if (!programId) return { ok: false, error: `Unknown program: ${opts.program}` };
			const { error } = await supabase.from("cards").insert({
				user_id: user.id,
				card_name: opts.cardName,
				reward_program_id: programId,
				points_balance: opts.balance,
			});
			if (error) {
				return {
					ok: false,
					error: (error as { code?: string }).code === "23505" ? "That card is already in your wallet." : error.message,
				};
			}
			await refreshWallet();
			trackAnalyticsEvent("wallet_program_added", {
				event_type: "wallet",
				metadata: { program: opts.program, balance: opts.balance },
			});
			return { ok: true };
		},
		[user, supabase, refreshWallet],
	);

	const editBalance = useCallback(
		async (opts: { cardId: string; program: string; balance: number }): Promise<WalletCrudResult> => {
			if (!user) return { ok: false, error: "Not signed in." };
			const v = validatePoints(opts.balance);
			if (!v.ok) {
				trackAnalyticsEvent("wallet_balance_rejected", {
					event_type: "wallet",
					metadata: { attempted_value: opts.balance, program: opts.program, reason: v.reason, surface: "profile_edit" },
				});
				return { ok: false, error: v.reason };
			}
			const before = cards.find((c) => c.id === opts.cardId)?.points_balance ?? null;
			const { error } = await supabase.from("cards").update({ points_balance: opts.balance }).eq("id", opts.cardId);
			if (error) return { ok: false, error: error.message };
			await refreshWallet();
			trackAnalyticsEvent("wallet_program_edited", {
				event_type: "wallet",
				metadata: { program: opts.program, balance_before: before, balance_after: opts.balance },
			});
			return { ok: true };
		},
		[user, supabase, refreshWallet, cards],
	);

	const removeProgram = useCallback(
		async (opts: { cardId: string; program: string; balanceAtRemoval: number }): Promise<WalletCrudResult> => {
			if (!user) return { ok: false, error: "Not signed in." };
			// Hard delete — removes the cards row, no history, no undo (matrix signed-off).
			const { error } = await supabase.from("cards").delete().eq("id", opts.cardId);
			if (error) return { ok: false, error: error.message };
			await refreshWallet();
			trackAnalyticsEvent("wallet_program_removed", {
				event_type: "wallet",
				metadata: { program: opts.program, balance_at_removal: opts.balanceAtRemoval },
			});
			return { ok: true };
		},
		[user, supabase, refreshWallet],
	);

	return { addProgram, editBalance, removeProgram };
}
