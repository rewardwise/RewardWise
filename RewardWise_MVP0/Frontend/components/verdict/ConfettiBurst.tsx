/** @format */
"use client";

import { useEffect, useState } from "react";

// Fired keys live at module scope so re-mounts of the same verdict (tab
// switches, parent re-renders) never replay the burst — once per verdict id.
const firedKeys = new Set<string>();

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];
// Three bursts over ~3.5s (delays 0 / 1.6s / 3.2s), 40 pieces each.
const WAVES = [0, 1600, 3200];
const PIECES_PER_WAVE = 40;

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
		const t = setTimeout(() => setVisible(false), 5200);
		return () => clearTimeout(t);
	}, [fireKey]);

	if (!visible) return null;
	return (
		<div
			aria-hidden="true"
			data-testid="confetti-burst"
			className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 overflow-visible"
		>
			{WAVES.flatMap((waveDelay, w) =>
				Array.from({ length: PIECES_PER_WAVE }, (_, i) => (
					<span
						key={`${w}-${i}`}
						className="mtw-confetti"
						style={{
							left: `${(i * 41 + w * 13) % 100}%`,
							animationDelay: `${waveDelay + (i % 8) * 70}ms`,
							backgroundColor: COLORS[(i + w) % COLORS.length],
						}}
					/>
				)),
			)}
		</div>
	);
}
