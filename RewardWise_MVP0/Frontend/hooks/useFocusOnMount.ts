/** @format */

"use client";

import { useEffect, useRef } from "react";

export function useFocusOnMount() {
	const ref = useRef<any>(null);

	useEffect(() => {
		if (ref.current) ref.current.focus();
	}, []);

	return ref;
}
