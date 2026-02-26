"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasCards: boolean | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  checkPortfolio: () => Promise<void>;

  subscription: string;
  setSubscription: (value: string) => void;
  searchCount: number;
  setSearchCount: (value: number) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCards, setHasCards] = useState<boolean | null>(null);
  const [subscription, setSubscription] = useState("free");
  const [searchCount, setSearchCount] = useState(0);
  const supabase = createClient();

  const checkPortfolio = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      setHasCards(null);
      return;
    }
    const { count } = await supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUser.id);
    setHasCards((count ?? 0) > 0);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkPortfolio();
      } else {
        setHasCards(null);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // Check portfolio on initial load when user exists
  useEffect(() => {
    if (user) {
      checkPortfolio();
    }
  }, [user]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setHasCards(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        hasCards,
        signInWithGoogle,
        signOut,
        checkPortfolio,
        subscription,
        setSubscription,
        searchCount,
        setSearchCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
