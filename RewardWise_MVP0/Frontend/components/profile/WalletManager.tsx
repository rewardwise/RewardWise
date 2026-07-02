/** @format */
"use client";

import { useMemo, useState } from "react";
import { useWallet, type WalletCard } from "@/context/WalletContext";
import { useWalletCrud } from "@/hooks/useWalletCrud";
import { AVAILABLE_CARDS } from "@/data/cards";
import { formatBalance, shortProgramName } from "@/utils/walletSummary";
import { formatNumberInputProps } from "@/utils/format";
import { Plus, Pencil, Trash2, Check, X, Loader2, Wallet } from "lucide-react";

function addedLabel(iso?: string): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return `Added ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

const inputCls =
	"w-full rounded-mtw border border-mtw-border bg-white px-3 py-2 text-mtw-small text-mtw-ink outline-none placeholder:text-mtw-muted focus:border-mtw-emerald";

export default function WalletManager() {
	const { cards, loading, hasWallet } = useWallet();
	const { addProgram, editBalance, removeProgram } = useWalletCrud();

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editVal, setEditVal] = useState<number>(0);
	const [rowError, setRowError] = useState<string>("");
	const [busyId, setBusyId] = useState<string | null>(null);

	const [confirmDelete, setConfirmDelete] = useState<WalletCard | null>(null);
	const [deleting, setDeleting] = useState(false);

	const [showAdd, setShowAdd] = useState(false);
	const [addCardId, setAddCardId] = useState("");
	const [addBal, setAddBal] = useState<number>(0);
	const [addError, setAddError] = useState("");
	const [adding, setAdding] = useState(false);

	// Sort newest-first so freshly-added rows surface; stable for the dupe case.
	const sorted = useMemo(
		() => [...cards].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
		[cards],
	);

	const startEdit = (c: WalletCard) => {
		setEditingId(c.id);
		setEditVal(c.points_balance);
		setRowError("");
	};

	const saveEdit = async (c: WalletCard) => {
		setBusyId(c.id);
		setRowError("");
		const res = await editBalance({ cardId: c.id, program: c.program_name ?? "", balance: editVal });
		setBusyId(null);
		if (!res.ok) {
			setRowError(res.error ?? "Could not save.");
			return;
		}
		setEditingId(null);
	};

	const doDelete = async () => {
		if (!confirmDelete) return;
		setDeleting(true);
		await removeProgram({
			cardId: confirmDelete.id,
			program: confirmDelete.program_name ?? "",
			balanceAtRemoval: confirmDelete.points_balance,
		});
		setDeleting(false);
		setConfirmDelete(null);
	};

	const submitAdd = async () => {
		const card = AVAILABLE_CARDS.find((c) => c.id === addCardId);
		if (!card) {
			setAddError("Pick a program to add.");
			return;
		}
		setAdding(true);
		setAddError("");
		const res = await addProgram({ cardName: card.name, program: card.program, balance: addBal });
		setAdding(false);
		if (!res.ok) {
			setAddError(res.error ?? "Could not add.");
			return;
		}
		setShowAdd(false);
		setAddCardId("");
		setAddBal(0);
	};

	const card = "rounded-2xl border border-mtw-border bg-white shadow-mtw-ambient";

	return (
		<div className="font-mtw space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-mtw-title font-semibold text-mtw-ink">Wallet</h2>
					<p className="text-mtw-small text-mtw-muted">Your programs and balances power every verdict.</p>
				</div>
				{hasWallet && !showAdd && (
					<button
						type="button"
						onClick={() => setShowAdd(true)}
						data-testid="wallet-add-open"
						className="inline-flex items-center gap-1.5 rounded-mtw bg-mtw-emerald px-3 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
					>
						<Plus className="h-4 w-4" /> Add program
					</button>
				)}
			</div>

			{/* Add form */}
			{showAdd && (
				<div className={`p-4 ${card}`} data-testid="wallet-add-form">
					<div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start">
						<div>
							<label className="mb-1 block text-xs font-medium text-mtw-muted">Program</label>
							<select
								value={addCardId}
								onChange={(e) => setAddCardId(e.target.value)}
								data-testid="wallet-add-select"
								className={inputCls}
							>
								<option value="">Select a card / program…</option>
								{AVAILABLE_CARDS.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name} · {shortProgramName(c.program)}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="mb-1 block text-xs font-medium text-mtw-muted">Balance</label>
							<input
								{...formatNumberInputProps({ value: addBal, onValueChange: setAddBal })}
								data-testid="wallet-add-balance"
								inputMode="numeric"
								placeholder="Total points, e.g. 250000 for 250K"
								className={`${inputCls} sm:w-56`}
							/>
						</div>
						<div className="flex items-end gap-2">
							<button
								type="button"
								onClick={submitAdd}
								disabled={adding}
								data-testid="wallet-add-submit"
								className="rounded-mtw bg-mtw-emerald px-3 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowAdd(false);
									setAddError("");
								}}
								className="rounded-mtw border border-mtw-border px-3 py-2 text-mtw-small text-mtw-muted hover:text-mtw-ink"
							>
								Cancel
							</button>
						</div>
					</div>
					{addError && <p className="mt-2 text-mtw-small text-red-600">{addError}</p>}
				</div>
			)}

			{/* List / empty state */}
			{loading ? (
				<div className={`p-8 text-center ${card}`}>
					<Loader2 className="mx-auto h-6 w-6 animate-spin text-mtw-emerald" />
				</div>
			) : !hasWallet ? (
				<div className={`p-10 text-center ${card}`} data-testid="wallet-empty">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
						<Wallet className="h-7 w-7 text-mtw-emerald" />
					</div>
					<h3 className="mt-5 text-mtw-title font-semibold text-mtw-ink">Connect your wallet for personalized verdicts</h3>
					<p className="mx-auto mt-2 max-w-md text-mtw-small leading-6 text-mtw-muted">
						Add the programs you earn points in and Zoe will tell you when they beat cash.
					</p>
					{!showAdd && (
						<button
							type="button"
							onClick={() => setShowAdd(true)}
							data-testid="wallet-add-open-empty"
							className="mt-6 inline-flex items-center gap-1.5 rounded-mtw bg-mtw-emerald px-4 py-3 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
						>
							<Plus className="h-4 w-4" /> Add program
						</button>
					)}
				</div>
			) : (
				<div className={`divide-y divide-mtw-border overflow-hidden ${card}`} data-testid="wallet-list">
					{sorted.map((c) => {
						const isEditing = editingId === c.id;
						return (
							<div key={c.id} data-testid={`wallet-row-${c.id}`} className="flex flex-wrap items-center gap-3 p-4">
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-mtw-ink">{c.program_name || "Points"}</p>
									<p className="truncate text-xs text-mtw-muted">
										{c.card_name}
										{c.created_at ? ` · ${addedLabel(c.created_at)}` : ""}
									</p>
								</div>

								{isEditing ? (
									<div className="flex items-center gap-2">
										<input
											{...formatNumberInputProps({ value: editVal, onValueChange: setEditVal })}
											inputMode="numeric"
											data-testid={`wallet-edit-input-${c.id}`}
											className={`${inputCls} w-40`}
											autoFocus
										/>
										<button
											type="button"
											onClick={() => saveEdit(c)}
											disabled={busyId === c.id}
											data-testid={`wallet-edit-save-${c.id}`}
											aria-label="Save balance"
											className="rounded-mtw bg-mtw-emerald p-2 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
										>
											{busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
										</button>
										<button
											type="button"
											onClick={() => {
												setEditingId(null);
												setRowError("");
											}}
											aria-label="Cancel edit"
											className="rounded-mtw border border-mtw-border p-2 text-mtw-muted hover:text-mtw-ink"
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								) : (
									<>
										<span data-testid={`wallet-balance-${c.id}`} className="text-mtw-body font-semibold text-mtw-ink">
											{formatBalance(c.points_balance)}
										</span>
										<div className="flex items-center gap-1">
											<button
												type="button"
												onClick={() => startEdit(c)}
												data-testid={`wallet-edit-${c.id}`}
												aria-label="Edit balance"
												className="rounded-mtw border border-mtw-border p-2 text-mtw-muted transition-colors hover:bg-mtw-surface hover:text-mtw-ink"
											>
												<Pencil className="h-4 w-4" />
											</button>
											<button
												type="button"
												onClick={() => setConfirmDelete(c)}
												data-testid={`wallet-delete-${c.id}`}
												aria-label="Remove program"
												className="rounded-mtw border border-mtw-border p-2 text-mtw-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									</>
								)}

								{isEditing && rowError && (
									<p className="w-full text-mtw-small text-red-600">{rowError}</p>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Delete confirmation modal */}
			{confirmDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
					<div className={`font-mtw w-full max-w-md p-6 ${card}`} data-testid="wallet-delete-modal">
						<h3 className="text-mtw-title font-semibold text-mtw-ink">
							Remove {confirmDelete.program_name || "this program"} from wallet?
						</h3>
						<p className="mt-2 text-mtw-small leading-6 text-mtw-muted">
							Your verdicts will no longer include {confirmDelete.program_name || "these"} points. This removes the{" "}
							<span className="font-medium text-mtw-ink">{confirmDelete.card_name}</span> row
							{confirmDelete.created_at ? ` (${addedLabel(confirmDelete.created_at).toLowerCase()})` : ""} and can&apos;t be undone.
						</p>
						<div className="mt-6 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmDelete(null)}
								className="rounded-mtw border border-mtw-border px-4 py-2 text-mtw-small text-mtw-ink hover:bg-mtw-surface"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={doDelete}
								disabled={deleting}
								data-testid="wallet-delete-confirm"
								className="inline-flex items-center gap-1.5 rounded-mtw bg-red-600 px-4 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
