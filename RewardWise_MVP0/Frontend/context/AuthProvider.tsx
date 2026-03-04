/** @format */

"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

//  TYPES
type AuthContextType = {
	user: User | null;
	session: Session | null;
	loading: boolean;
	hasCards: boolean | null;

	signInWithGoogle: () => Promise<void>;
	signOut: () => Promise<void>;
	checkPortfolio: () => Promise<void>;
	signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
	// App-level state
	subscription: string;
	setSubscription: (value: string) => void;

	searchCount: number;
	setSearchCount: (value: number) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// PROVIDER
export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [hasCards, setHasCards] = useState<boolean | null>(null);
	const [subscription, setSubscription] = useState("free");
	const [searchCount, setSearchCount] = useState(0);
	const supabase = createClient();

	const checkPortfolio = useCallback(async () => {
		const {
			data: { user: currentUser },
		} = await supabase.auth.getUser();

		if (!currentUser) {
			setHasCards(null);
			return;
		}

		const { count } = await supabase
			.from("cards")
			.select("*", { count: "exact", head: true })
			.eq("user_id", currentUser.id);

		setHasCards((count ?? 0) > 0);
	}, [supabase]);

	// INITIAL SESSION LOAD
	useEffect(() => {
		const loadSession = async () => {
			const { data, error } = await supabase.auth.getSession();

			if (error) {
				setLoading(false);
				return;
			}

			const session = data.session;

			setSession(session);
			setUser(session?.user ?? null);
			setLoading(false);
		};

		loadSession();

		const { data: listener } = supabase.auth.onAuthStateChange(
			(_event: string, session: Session | null) => {
				setSession(session);
				setUser(session?.user ?? null);
				setLoading(false);

				if (session?.user) {
					checkPortfolio();
				} else {
					setHasCards(null);
				}
			},
		);

		return () => {
			listener.subscription.unsubscribe();
		};
	}, [supabase, checkPortfolio]);

	// RE-CHECK PORTFOLIO IF USER CHANGES
	useEffect(() => {
		if (user) {
			checkPortfolio();
		}
	}, [user, checkPortfolio]);

	// AUTH METHODS
	const signInWithGoogle = async () => {
		await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
			},
		});
	};
	const signInWithEmail = async (email: string, password: string) => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		return { error };
	};
	const signOut = async () => {
		await supabase.auth.signOut();
		setHasCards(null);
	};

	// CONTEXT VALUE
	return (
		<AuthContext.Provider
			value={{
				user,
				session,
				loading,
				hasCards,
				signInWithGoogle,
				signInWithEmail,
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

// HOOK
export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
