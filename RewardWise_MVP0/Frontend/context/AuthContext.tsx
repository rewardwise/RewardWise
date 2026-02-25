/** @format */

"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/* DEFINE TYPE */
type AuthContextType = {
	user: { email: string; name: string } | null;
	isAuthenticated: boolean;
	login: (email: string) => void;
	logout: () => void;

	subscription: string;
	setSubscription: (value: string) => void;

	searchCount: number;
	setSearchCount: (value: number) => void;
};

/* TYPED CONTEXT */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<{ email: string; name: string } | null>(
		null,
	);
	const [subscription, setSubscription] = useState("free");
	const [searchCount, setSearchCount] = useState(0);

	const login = (email: string) => {
		setUser({ email, name: email.split("@")[0] });
	};

	const logout = () => {
		setUser(null);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isAuthenticated: !!user,
				login,
				logout,

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
		throw new Error("useAuth must be used within AuthProvider");
	}

	return context;
}
