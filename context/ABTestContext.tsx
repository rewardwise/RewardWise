/** @format */

"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";

/* DEFINE TYPE */
type ABTestContextType = {
	delayedSignup: boolean;
};

/* CONTEXT */
const ABTestContext = createContext<ABTestContextType | null>(null);

export function ABTestProvider({ children }: { children: ReactNode }) {
	/*
		Deterministic Variant Assignment

		Later this becomes:
		• userId hashing
		• cookie-based experiments
		• remote feature flags
	*/

	const delayedSignup = useMemo(() => {
		return true; // ← single source of truth
	}, []);

	return (
		<ABTestContext.Provider value={{ delayedSignup }}>
			{children}
		</ABTestContext.Provider>
	);
}

export function useABTest() {
	const context = useContext(ABTestContext);

	if (!context) {
		throw new Error("useABTest must be used within ABTestProvider");
	}

	return context;
}
