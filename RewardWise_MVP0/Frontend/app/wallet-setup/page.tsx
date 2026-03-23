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

type SavedCard = {
  id: string;
  card_name: string;
  program: string;
  points_balance: number;
  logo: string;
};

type ViewMode = "loading" | "portfolio" | "add-cards";

export default function WalletSetupPage() {
  const router = useRouter();
  const { user, checkPortfolio } = useAuth();
  // stable client ref — created once, never changes
  const supabase = useRef(createClient()).current;

  // core state
  const [viewMode, setViewMode] = useState<ViewMode>("loading");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // portfolio editing state
  const [editBalances, setEditBalances] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // add-cards state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNewCards, setSelectedNewCards] = useState<string[]>([]);
  const [newBalances, setNewBalances] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);

  // derived totals
  const totalPoints = savedCards.reduce((s, c) => s + (c.points_balance || 0), 0);
  const totalValue = Math.round(totalPoints * 0.015);

  // cards already in wallet — filtered out of the picker so no duplicates
  const existingNames = new Set(savedCards.map((c) => c.card_name));
  const filteredCards = AVAILABLE_CARDS.filter(
    (c) =>
      !existingNames.has(c.name) &&
      (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.program.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  // fire once when user is available — guarded by loaded ref so it never
  // runs twice even if AuthProvider causes a second render
  const loaded = useRef(false);
  useEffect(() => {
    if (!user || loaded.current) return;
    loaded.current = true;
    loadPortfolio(user.id);
  }, [user]);

  // ── update a single card's balance ─────────────────────────────────────
  async function handleUpdateBalance(cardId: string) {
    setSavingId(cardId);
    setError(null);
    const newBal = editBalances[cardId] ?? 0;

    const { error } = await supabase
      .from("cards")
      .update({ points_balance: newBal })
      .eq("id", cardId);

    setSavingId(null);
    if (error) { setError(error.message); return; }

    setSavedCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, points_balance: newBal } : c))
    );
    flash("Balance updated ✓");
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

    const toInsert = selectedData.map((card) => ({
      user_id: user.id,
      card_name: card.name,
      reward_program_id: programMap.get(card.program),
      points_balance: newBalances[card.id] || 0,
    }));

    const { error: insertError } = await supabase.from("cards").insert(toInsert);
    if (insertError) { setError(insertError.message); setAdding(false); return; }

    await loadPortfolio(user.id);
    await checkPortfolio();
    setSelectedNewCards([]);
    setNewBalances({});
    setSearchTerm("");
    setAdding(false);
    flash(`${toInsert.length} card${toInsert.length !== 1 ? "s" : ""} added ✓`);
  }

  function toggleNewCard(cardId: string) {
    if (selectedNewCards.length >= 10 && !selectedNewCards.includes(cardId)) return;
    setSelectedNewCards((prev) =>
      prev.includes(cardId) ? prev.filter((c) => c !== cardId) : [...prev, cardId]
    );
  }

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
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
            <button
              onClick={() => { setViewMode("add-cards"); setSearchTerm(""); }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" /> Add Cards
            </button>
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
        {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {/* ══════════════════════════════════
            PORTFOLIO VIEW
        ══════════════════════════════════ */}
        {viewMode === "portfolio" && (
          <>
            <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl space-y-3">
              <h2 className="text-base font-semibold text-white mb-1">Your Cards</h2>

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
                      type="number"
                      min={0}
                      value={editBalances[card.id] ?? card.points_balance}
                      onChange={(e) =>
                        setEditBalances((prev) => ({
                          ...prev,
                          [card.id]: Number(e.target.value),
                        }))
                      }
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Points balance"
                    />
                    <span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-2 rounded whitespace-nowrap">
                      ~${Math.round(
                        (editBalances[card.id] ?? card.points_balance) * 0.015
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
              <h2 className="text-lg font-semibold text-white">
                {savedCards.length === 0 ? "Select your Cards" : "Add More Cards"}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {savedCards.length === 0
                  ? "Add your credit cards and loyalty programs to get personalized verdicts."
                  : "Cards already in your wallet are hidden below."}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search cards or programs..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">{selectedNewCards.length} selected</span>
              {selectedNewCards.length >= 10 && (
                <span className="text-amber-400">Maximum reached</span>
              )}
            </div>

            {/* Card picker grid */}
            <div className="grid md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {filteredCards.length === 0 ? (
                <p className="text-gray-500 text-sm col-span-2 text-center py-8">
                  {existingNames.size > 0
                    ? "You've already added all available cards!"
                    : "No cards match your search."}
                </p>
              ) : (
                filteredCards.map((card) => {
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
                            type="number"
                            min={0}
                            value={newBalances[card.id] || ""}
                            onChange={(e) =>
                              setNewBalances((prev) => ({
                                ...prev,
                                [card.id]: Number(e.target.value),
                              }))
                            }
                            placeholder="Points balance"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded py-2 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {bal > 0 && (
                            <span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded flex-shrink-0">
                              ~${(bal * 0.015).toFixed(0)}
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
                  : `Add${selectedNewCards.length > 0 ? ` ${selectedNewCards.length}` : ""} Card${selectedNewCards.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}