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
import { trackAnalyticsEvent } from "@/utils/analytics/client";

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
				trackAnalyticsEvent("auth_state_changed", {
					event_type: "auth",
					metadata: { event: _event, has_session: Boolean(session) },
				});
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
		const startedAt = Date.now();
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${window.location.origin}/auth/callback`,
			},
		});

		trackAnalyticsEvent(error ? "auth_signup_failed" : "auth_signup_submitted", {
			event_type: "auth",
			latency_ms: Date.now() - startedAt,
			metadata: { method: "email", error_message: error?.message || null },
		});

		return { error };
	};

	const signInWithEmail = async (email: string, password: string) => {
		const startedAt = Date.now();
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		trackAnalyticsEvent(error ? "auth_login_failed" : "auth_login_completed", {
			event_type: "auth",
			latency_ms: Date.now() - startedAt,
			metadata: { method: "email", error_message: error?.message || null },
		});

		return { error };
	};

	const signInWithGoogle = async () => {
		trackAnalyticsEvent("auth_google_started", {
			event_type: "auth",
			metadata: { method: "google" },
		});
		await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
			},
		});
	};

	const signOut = async () => {
		trackAnalyticsEvent("auth_logout_started", { event_type: "auth" });
		await supabase.auth.signOut();
		trackAnalyticsEvent("auth_logout_completed", { event_type: "auth" });
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
