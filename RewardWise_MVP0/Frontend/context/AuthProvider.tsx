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

type AuthContextType = {
	user: User | null;
	session: Session | null;
	loading: boolean;
	hasCards: boolean | null;

	signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
	signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
	signInWithGoogle: () => Promise<void>;
	signOut: () => Promise<void>;

	checkPortfolio: () => Promise<void>;

	subscription: string;
	setSubscription: (value: string) => void;

	searchCount: number;
	setSearchCount: (value: number) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [hasCards, setHasCards] = useState<boolean | null>(null);
	const [subscription, setSubscription] = useState("free");
	const [searchCount, setSearchCount] = useState(0);

	const supabase = createClient();

	const checkSubscription = useCallback(
		async (userId: string) => {
			const { data } = await supabase
				.from("subscriptions")
				.select("status")
				.eq("user_id", userId)
				.eq("status", "active")
				.single();

			setSubscription(data ? "pro" : "free");
		},
		[supabase],
	);

	const checkPortfolio = useCallback(async () => {
		const {
			data: { user: currentUser },
		} = await supabase.auth.getUser();

		if (!currentUser) {
			setHasCards(null);
			return;
		}

		const { data } = await supabase
			.from("cards")
			.select("id")
			.eq("user_id", currentUser.id)
			.limit(1);

		setHasCards((data?.length ?? 0) > 0);
	}, [supabase]);

	useEffect(() => {
		const loadSession = async () => {
			const { data } = await supabase.auth.getSession();
			const sess = data.session;

			setSession(sess);
			setUser(sess?.user ?? null);
			setLoading(false);

			if (sess?.user) {
				checkSubscription(sess.user.id);
			}
		};

		loadSession();

		const { data: listener } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				setSession(session);
				setUser(session?.user ?? null);
				setLoading(false);

				if (session?.user) {
					checkPortfolio();
					checkSubscription(session.user.id);
				} else {
					setHasCards(null);
					setSubscription("free");
				}
			},
		);

		return () => {
			listener.subscription.unsubscribe();
		};
	}, [supabase, checkPortfolio, checkSubscription]);

	useEffect(() => {
		if (user) checkPortfolio();
	}, [user, checkPortfolio]);

	const signUpWithEmail = async (email: string, password: string) => {
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${window.location.origin}/auth/callback`,
			},
		});

		return { error };
	};

	const signInWithEmail = async (email: string, password: string) => {
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		return { error };
	};

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
		setSubscription("free");
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				session,
				loading,
				hasCards,

				signUpWithEmail,
				signInWithEmail,
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
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
