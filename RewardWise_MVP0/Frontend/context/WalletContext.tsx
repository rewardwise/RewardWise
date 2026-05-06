/** @format */
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthProvider";
import { PROGRAM_ALIASES } from "@/utils/programAliases";

export interface WalletCard {
  id: string;
  card_name: string;
  reward_program_id: string;
  points_balance: number;
  program_name?: string; // joined from reward_programs
}

interface WalletContextType {
  cards: WalletCard[];
  loading: boolean;
  hasWallet: boolean;
  userPrograms: string[]; // lowercase program names user owns, e.g. ["united", "aeroplan"]
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const refreshWallet = async () => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("cards")
      .select("id, card_name, reward_program_id, points_balance, reward_programs(name)")
      .eq("user_id", user.id);

    if (!error && data) {
      setCards(
        data.map((row: any) => ({
          id: row.id,
          card_name: row.card_name,
          reward_program_id: row.reward_program_id,
          points_balance: row.points_balance,
          program_name: row.reward_programs?.name ?? "",
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshWallet();
  }, [user]);

  // The programs the user actually owns (card program names)
  const ownedProgramNames = cards.map((c) => c.program_name ?? "");

  // Derive which seats.aero sources the user can redeem for
  const userPrograms = Object.entries(PROGRAM_ALIASES)
    .filter(([, aliases]) => aliases.some((a) => ownedProgramNames.includes(a)))
    .map(([source]) => source.toLowerCase());

  return (
    <WalletContext.Provider
      value={{
        cards,
        loading,
        hasWallet: cards.length > 0,
        userPrograms,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}