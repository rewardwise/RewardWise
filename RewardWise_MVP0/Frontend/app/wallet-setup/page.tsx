/** @format */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Check,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { AVAILABLE_CARDS } from "@/data/cards";
import {
  fmtMoney,
  formatPointsForDisplay,
  parsePointsInput,
  validatePoints,
} from "@/utils/format";

type SavedCard = {
  id: string;
  card_name: string;
  program: string;
  points_balance: number;
  logo: string;
};

type ViewMode = "loading" | "portfolio" | "add-cards";
type FlashType = "success" | "warning" | "error";

export default function WalletSetupPage() {
  const router = useRouter();
  const { user, checkPortfolio } = useAuth();
  // stable client ref - created once, never changes
  const supabase = useRef(createClient()).current;

  // core state
  const [viewMode, setViewMode] = useState<ViewMode>("loading");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; type: FlashType } | null>(null);

  // portfolio editing state
  const [editBalances, setEditBalances] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // add-cards state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"card" | "airline">("card");
  const [selectedNewCards, setSelectedNewCards] = useState<string[]>([]);
  const [newBalances, setNewBalances] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);

  // derived totals
  const totalPoints = savedCards.reduce((s, c) => s + (c.points_balance || 0), 0);
  const totalValue = Math.round(totalPoints * 0.015);

  // cards already in wallet - filtered out of the picker so no duplicates
  const existingNames = new Set(savedCards.map((c) => c.card_name));
  const q = searchTerm.toLowerCase();
  const matchesQuery = (c: { name: string; program: string }) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.program.toLowerCase().includes(q);
  const visibleCards = AVAILABLE_CARDS.filter(
    (c) => c.category === "card" && !existingNames.has(c.name) && matchesQuery(c)
  );
  const visibleAirlines = AVAILABLE_CARDS.filter(
    (c) => c.category === "airline" && !existingNames.has(c.name) && matchesQuery(c)
  );
  const visibleItems = activeTab === "card" ? visibleCards : visibleAirlines;
  const activeTabLabel = activeTab === "card" ? "Credit Cards" : "Airline Programs";

  // ── load portfolio (called once on mount, and after mutations) ─────────
  async function loadPortfolio(userId: string) {
    const { data, error } = await supabase
      .from("cards")
      .select(`id, card_name, points_balance, reward_programs(name)`)
      .eq("user_id", userId);

    if (error) {
      setError(error.message);
      setViewMode("add-cards");
      return;
    }

    const mapped: SavedCard[] = (data ?? []).map((c: any) => ({
      id: c.id,
      card_name: c.card_name,
      program: c.reward_programs?.name ?? "",
      points_balance: c.points_balance ?? 0,
      logo: AVAILABLE_CARDS.find((a) => a.name === c.card_name)?.logo ?? "💳",
    }));

    setSavedCards(mapped);

    // seed balance inputs with current values
    const balMap: Record<string, number> = {};
    mapped.forEach((c) => (balMap[c.id] = c.points_balance));
    setEditBalances(balMap);

    setViewMode(mapped.length > 0 ? "portfolio" : "add-cards");
  }

  // fire once when user is available - guarded by loaded ref so it never
  // runs twice even if AuthProvider causes a second render
  const loaded = useRef(false);
  useEffect(() => {
    if (!user || loaded.current) return;
    loaded.current = true;
    loadPortfolio(user.id);
  }, [user]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyIds.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyIds]);

  // ── update a single card's balance ─────────────────────────────────────
  async function handleUpdateBalance(cardId: string) {
    const newBal = editBalances[cardId];
    if (newBal === undefined) return;

    const validation = validatePoints(newBal);
    if (!validation.ok) {
      setRowErrors((prev) => ({ ...prev, [cardId]: validation.reason || "Invalid value" }));
      return;
    }

    setSavingId(cardId);
    setError(null);

    const { error } = await supabase
      .from("cards")
      .update({ points_balance: newBal })
      .eq("id", cardId);

    setSavingId(null);
    if (error) { setError(error.message); return; }

    setSavedCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, points_balance: newBal } : c))
    );
    clearDirty(cardId);
    clearRowError(cardId);
    flash("Balance updated", "success");
  }

  // ── save all dirty rows in parallel ────────────────────────────────────
  async function handleSaveAll() {
    if (dirtyIds.size === 0 || savingAll) return;

    const dirtyArray = Array.from(dirtyIds);
    const validationErrors: Record<string, string> = {};

    for (const cardId of dirtyArray) {
      const newBal = editBalances[cardId];
      if (newBal === undefined) continue;
      const validation = validatePoints(newBal);
      if (!validation.ok) {
        validationErrors[cardId] = validation.reason || "Invalid value";
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setRowErrors((prev) => ({ ...prev, ...validationErrors }));
      flash(
        `${Object.keys(validationErrors).length} row${
          Object.keys(validationErrors).length !== 1 ? "s" : ""
        } have errors. Fix and try again.`,
        "error"
      );
      return;
    }

    setSavingAll(true);
    setError(null);

    const results = await Promise.allSettled(
      dirtyArray.map(async (cardId) => {
        const newBal = editBalances[cardId];
        const { error } = await supabase
          .from("cards")
          .update({ points_balance: newBal })
          .eq("id", cardId);
        if (error) throw new Error(error.message);
        return { cardId, newBal };
      })
    );

    const succeeded: { cardId: string; newBal: number }[] = [];
    const failed: { cardId: string; reason: string }[] = [];

    results.forEach((result, idx) => {
      const cardId = dirtyArray[idx];
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        const reason =
          result.reason instanceof Error ? result.reason.message : "Save failed";
        failed.push({ cardId, reason });
      }
    });

    if (succeeded.length > 0) {
      setSavedCards((prev) =>
        prev.map((c) => {
          const hit = succeeded.find((s) => s.cardId === c.id);
          return hit ? { ...c, points_balance: hit.newBal } : c;
        })
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        succeeded.forEach(({ cardId }) => next.delete(cardId));
        return next;
      });
      setRowErrors((prev) => {
        const next = { ...prev };
        succeeded.forEach(({ cardId }) => delete next[cardId]);
        return next;
      });
    }

    if (failed.length > 0) {
      setRowErrors((prev) => {
        const next = { ...prev };
        failed.forEach(({ cardId, reason }) => { next[cardId] = reason; });
        return next;
      });
    }

    setSavingAll(false);

    if (failed.length === 0) {
      flash(`Saved ${succeeded.length}`, "success");
    } else if (succeeded.length === 0) {
      flash(`All ${failed.length} saves failed`, "error");
    } else {
      flash(
        `Saved ${succeeded.length} of ${succeeded.length + failed.length}. See highlighted rows.`,
        "warning"
      );
    }
  }

  // ── delete a card ───────────────────────────────────────────────────────
  async function handleDelete(cardId: string) {
    setDeletingId(cardId);
    setError(null);

    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    setDeletingId(null);
    if (error) { setError(error.message); return; }

    const updated = savedCards.filter((c) => c.id !== cardId);
    setSavedCards(updated);
    await checkPortfolio();

    if (updated.length === 0) setViewMode("add-cards");
  }

  // ── add new cards ───────────────────────────────────────────────────────
  async function handleAddCards() {
    if (!user || selectedNewCards.length === 0) return;
    setAdding(true);
    setError(null);

    const selectedData = selectedNewCards.map(
      (id) => AVAILABLE_CARDS.find((c) => c.id === id)!
    );
    const programNames = [...new Set(selectedData.map((c) => c.program))];

    const { data: programs, error: programError } = await supabase
      .from("reward_programs")
      .select("id, name")
      .in("name", programNames);

    if (programError) { setError(programError.message); setAdding(false); return; }

    const programMap = new Map((programs ?? []).map((p: any) => [p.name, p.id]));

    const toInsert = selectedData.map((card) => {
      const raw = newBalances[card.id];
      const safeBal = raw === undefined || Number.isNaN(raw) || raw < 0 ? 0 : raw;
      return {
        user_id: user.id,
        card_name: card.name,
        reward_program_id: programMap.get(card.program),
        points_balance: safeBal,
      };
    });

    const currentExistingNames = new Set(savedCards.map((c) => c.card_name));
    const toInsertFiltered = toInsert.filter(
      (item) => !currentExistingNames.has(item.card_name)
    );
    const skippedCount = toInsert.length - toInsertFiltered.length;

    if (toInsertFiltered.length === 0) {
      setAdding(false);
      flash("All selected cards are already in your wallet", "warning");
      return;
    }

    const { error: insertError } = await supabase.from("cards").insert(toInsertFiltered);
    if (insertError) {
      setAdding(false);
      if ((insertError as { code?: string }).code === "23505") {
        flash("One or more cards are already in your wallet", "warning");
      } else {
        setError(insertError.message);
      }
      return;
    }

    await loadPortfolio(user.id);
    await checkPortfolio();
    setSelectedNewCards([]);
    setNewBalances({});
    setSearchTerm("");
    setAdding(false);
    if (skippedCount > 0) {
      flash(
        `Added ${toInsertFiltered.length} of ${toInsert.length}. ${skippedCount} already in wallet.`,
        "warning"
      );
    } else {
      flash(
        `${toInsertFiltered.length} card${toInsertFiltered.length !== 1 ? "s" : ""} added`,
        "success"
      );
    }
  }

  function toggleNewCard(cardId: string) {
    if (selectedNewCards.length >= 10 && !selectedNewCards.includes(cardId)) return;
    setSelectedNewCards((prev) =>
      prev.includes(cardId) ? prev.filter((c) => c !== cardId) : [...prev, cardId]
    );
  }

  function flash(text: string, type: FlashType = "success") {
    setFlashMsg({ text, type });
    setTimeout(() => setFlashMsg(null), 3000);
  }

  function markDirty(cardId: string, newValue: number, savedValue: number) {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      if (newValue !== savedValue) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  }

  function clearDirty(cardId: string) {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  }

  function clearRowError(cardId: string) {
    setRowErrors((prev) => {
      if (!(cardId in prev)) return prev;
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  }

  // ── LOADING ─────────────────────────────────────────────────────────────
  if (viewMode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-cyan-950">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen">
      <TropicalBackground />

      <main className="relative w-full max-w-2xl mx-auto px-6 py-10 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">
              {viewMode === "portfolio" ? "My Wallet" : "Set Up Wallet"}
            </h1>
            {viewMode === "portfolio" && (
              <p className="text-gray-400 text-sm mt-1">
                {savedCards.length} card{savedCards.length !== 1 ? "s" : ""} ·{" "}
                {totalPoints.toLocaleString()} pts · ~${totalValue.toLocaleString()}
              </p>
            )}
          </div>

          {viewMode === "portfolio" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAll}
                disabled={dirtyIds.size === 0 || savingAll}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                {savingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                Save All{dirtyIds.size > 0 ? ` (${dirtyIds.size})` : ""}
              </button>
              <button
                onClick={() => { setViewMode("add-cards"); setSearchTerm(""); setActiveTab("card"); }}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Add to Wallet
              </button>
            </div>
          )}

          {viewMode === "add-cards" && savedCards.length > 0 && (
            <button
              onClick={() => setViewMode("portfolio")}
              className="flex items-center gap-2 border border-gray-600 text-gray-300 hover:bg-gray-800/50 text-sm px-4 py-2 rounded-lg transition-all"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>

        {/* Feedback banners */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {flashMsg && (
          <div
            className={
              flashMsg.type === "success"
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                : flashMsg.type === "warning"
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                : "bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
            }
          >
            <CheckCircle2 className="w-4 h-4" /> {flashMsg.text}
          </div>
        )}

        {/* ══════════════════════════════════
            PORTFOLIO VIEW
        ══════════════════════════════════ */}
        {viewMode === "portfolio" && (
          <>
            <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl space-y-3">
              <h2 className="text-base font-semibold text-white mb-1">Your Wallet</h2>

              {savedCards.map((card) => (
                <div key={card.id} className="bg-gray-800/60 rounded-lg p-4 space-y-3">
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{card.logo}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{card.card_name}</p>
                        <p className="text-gray-500 text-xs">{card.program}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(card.id)}
                      disabled={deletingId === card.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded disabled:opacity-50"
                      title="Remove card"
                    >
                      {deletingId === card.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Inline balance editor */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        focusedId === card.id
                          ? Number.isNaN(editBalances[card.id])
                            ? ""
                            : String(editBalances[card.id] ?? card.points_balance)
                          : formatPointsForDisplay(
                              editBalances[card.id] ?? card.points_balance
                            )
                      }
                      onFocus={() => setFocusedId(card.id)}
                      onBlur={() => {
                        setFocusedId(null);
                        const current = editBalances[card.id];
                        if (current === undefined || Number.isNaN(current)) {
                          setEditBalances((prev) => {
                            const next = { ...prev };
                            delete next[card.id];
                            return next;
                          });
                          clearDirty(card.id);
                          clearRowError(card.id);
                        }
                      }}
                      onChange={(e) => {
                        const parsed = parsePointsInput(e.target.value);
                        setEditBalances((prev) => ({ ...prev, [card.id]: parsed }));
                        markDirty(card.id, parsed, card.points_balance);
                        clearRowError(card.id);
                      }}
                      className={`min-w-0 flex-1 bg-gray-900 border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 ${
                        rowErrors[card.id]
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-700 focus:ring-emerald-500"
                      }`}
                      placeholder="Points balance"
                    />
                    <span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-2 rounded whitespace-nowrap">
                      ~${Math.round(
                        (Number.isNaN(editBalances[card.id])
                          ? card.points_balance
                          : editBalances[card.id] ?? card.points_balance) * 0.015
                      ).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleUpdateBalance(card.id)}
                      disabled={savingId === card.id}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all"
                    >
                      {savingId === card.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><Pencil className="w-3 h-3" /> Save</>}
                    </button>
                  </div>
                  {rowErrors[card.id] && (
                    <p className="text-xs text-red-400 mt-1">{rowErrors[card.id]}</p>
                  )}
                </div>
              ))}

              {/* Totals */}
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mt-1">
                <span className="text-emerald-400 font-semibold">Total</span>
                <div className="text-right">
                  <p className="text-white font-bold">{totalPoints.toLocaleString()} pts</p>
                  <p className="text-emerald-400 text-sm font-semibold">
                    ~${totalValue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/profile")}
                className="flex-1 border border-gray-600 text-white py-3 rounded-lg hover:bg-gray-800/50 text-sm transition-all"
              >
                ← Back to Profile
              </button>
              <button
                onClick={() => router.push("/home")}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Search className="w-4 h-4" /> Search Flights
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════
            ADD CARDS VIEW
        ══════════════════════════════════ */}
        {viewMode === "add-cards" && (
          <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Add to your wallet</h2>
              <p className="text-gray-400 text-sm mt-1">
                Pick the cards or programs that hold your points. Items already in your wallet are hidden.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search across cards and programs…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Tab strip */}
            <div className="flex gap-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
                  activeTab === "card"
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                💳 Credit Cards
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-700/60 text-gray-300">
                  {visibleCards.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("airline")}
                className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
                  activeTab === "airline"
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                ✈️ Airline Programs
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-700/60 text-gray-300">
                  {visibleAirlines.length}
                </span>
              </button>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">{selectedNewCards.length} selected</span>
              {selectedNewCards.length >= 10 && (
                <span className="text-amber-400">Maximum reached</span>
              )}
            </div>

            {/* Picker list (active tab) */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {visibleItems.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  {searchTerm
                    ? `No matches in ${activeTabLabel} for "${searchTerm}". Try the other tab.`
                    : "No items available — everything in this category is already in your wallet."}
                </p>
              ) : (
                visibleItems.map((card) => {
                  const isSelected = selectedNewCards.includes(card.id);
                  const bal = newBalances[card.id] || 0;
                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleNewCard(card.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500"
                          : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{card.logo}</span>
                          <div>
                            <p className="text-white text-sm font-medium">{card.name}</p>
                            <p className="text-gray-500 text-xs">{card.program}</p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-gray-600"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          className="mt-3 flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              focusedId === `add:${card.id}`
                                ? newBalances[card.id] === undefined ||
                                  Number.isNaN(newBalances[card.id])
                                  ? ""
                                  : String(newBalances[card.id])
                                : newBalances[card.id] === undefined ||
                                  Number.isNaN(newBalances[card.id])
                                ? ""
                                : formatPointsForDisplay(newBalances[card.id])
                            }
                            onFocus={() => setFocusedId(`add:${card.id}`)}
                            onBlur={() => {
                              setFocusedId(null);
                              const current = newBalances[card.id];
                              if (current !== undefined && Number.isNaN(current)) {
                                setNewBalances((prev) => {
                                  const next = { ...prev };
                                  delete next[card.id];
                                  return next;
                                });
                              }
                            }}
                            onChange={(e) => {
                              const parsed = parsePointsInput(e.target.value);
                              setNewBalances((prev) => ({ ...prev, [card.id]: parsed }));
                            }}
                            placeholder="Points balance"
                            className="min-w-0 flex-1 bg-gray-900 border border-gray-700 rounded py-2 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {bal > 0 && (
                            <span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded flex-shrink-0">
                              ~{fmtMoney(bal * 0.015)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {savedCards.length > 0 ? (
                <button
                  onClick={() => setViewMode("portfolio")}
                  className="flex-1 border border-gray-600 text-white py-3 rounded-lg hover:bg-gray-800/50 text-sm transition-all"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => router.push("/home")}
                  className="flex-1 border border-gray-600 text-white py-3 rounded-lg hover:bg-gray-800/50 text-sm transition-all"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={handleAddCards}
                disabled={selectedNewCards.length === 0 || adding}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-all"
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                {adding
                  ? "Saving..."
                  : selectedNewCards.length > 0
                  ? `Add ${selectedNewCards.length} to Wallet`
                  : "Add to Wallet"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}