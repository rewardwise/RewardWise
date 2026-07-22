/** @format */
"use client";

import { useEffect, useState } from "react";

// Fired keys live at module scope so re-mounts of the same verdict (tab
// switches, parent re-renders) never replay the burst — once per verdict id.
const firedKeys = new Set<string>();

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
const PIECES = 24;

/**
 * Brief celebratory burst when a verdict lands — the card-side match for
 * Zoe's 🎉 copy. Skipped entirely under prefers-reduced-motion, fires once
 * per fireKey, and cleans itself out of the DOM after the animation.
 */
export default function ConfettiBurst({ fireKey }: { fireKey: string | null | undefined }) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!fireKey || firedKeys.has(fireKey)) return;
		if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
			firedKeys.add(fireKey); // respect the preference AND never re-check this key
			return;
		}
		firedKeys.add(fireKey);
		setVisible(true);
		const t = setTimeout(() => setVisible(false), 1600);
		return () => clearTimeout(t);
	}, [fireKey]);

	if (!visible) return null;
	return (
		<div
			aria-hidden="true"
			data-testid="confetti-burst"
			className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 overflow-visible"
		>
			{Array.from({ length: PIECES }, (_, i) => (
				<span
					key={i}
					className="mtw-confetti"
					style={{
						left: `${(i * 41) % 100}%`,
						animationDelay: `${(i % 6) * 70}ms`,
						backgroundColor: COLORS[i % COLORS.length],
					}}
				/>
			))}
		</div>
	);
}
