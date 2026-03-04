/** @format */

"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/* DEFINE TYPE */
type SearchFillContextType = {
	searchFill: any;
	setSearchFill: (value: any) => void;
	pendingSearch: any;
	setPendingSearch: (value: any) => void;
};

/* TYPED CONTEXT */
const SearchFillContext = createContext<SearchFillContextType | undefined>(
	undefined,
);

export function SearchFillProvider({ children }: { children: ReactNode }) {
	const [searchFill, setSearchFill] = useState<any>(null);
	const [pendingSearch, setPendingSearch] = useState<any>(null);

	return (
		<SearchFillContext.Provider
			value={{
				searchFill,
				setSearchFill,
				pendingSearch,
				setPendingSearch,
			}}
		>
			{children}
		</SearchFillContext.Provider>
	);
}

export function useSearchFill() {
	const context = useContext(SearchFillContext);

	if (!context) {
		throw new Error("useSearchFill must be used within SearchFillProvider");
	}

	return context;
}
