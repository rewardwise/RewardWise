/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { zoeWelcomeGuest } from "@/utils/zoeNarration";
import { trackAnalyticsEvent } from "@/utils/analytics/client";

/**
 * Guest (logged-out) Zoe FAB for the landing (8c).
 *
 * The full conversational Zoe (`/api/zoe`) is auth-gated — it returns 401 for
 * guests — and in the authoritative prototype the conversational overlay is a
 * POST-login step (flow 03 → 04), not something the guest verdict (02) exposes.
 * So this FAB is deterministic-only: it renders `zoeWelcomeGuest()` (a stable
 * lead + two canned chips whose replies are templated, no LLM/backend) and
 * routes "ask anything" to sign-in. No live text input means no 401 and nothing
 * dishonest about what a guest can actually do here.
 */
export default function GuestZoeFab() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const welcome = zoeWelcomeGuest();
	const [thread, setThread] = useState<{ role: "zoe" | "you"; text: string }[]>([]);

	const openPanel = () => {
		setOpen(true);
		trackAnalyticsEvent("guest_zoe_opened", {
			event_type: "zoe",
			metadata: { surface: "landing" },
		});
	};

	const onChip = (chip: { id: string; label: string; reply: string }) => {
		setThread((prev) => [
			...prev,
			{ role: "you", text: chip.label },
			{ role: "zoe", text: chip.reply },
		]);
		trackAnalyticsEvent("guest_zoe_chip", {
			event_type: "zoe",
			metadata: { chip: chip.id, surface: "landing" },
		});
	};

	const toSignup = () => {
		trackAnalyticsEvent("guest_zoe_signin_cta", {
			event_type: "zoe",
			metadata: { surface: "landing" },
		});
		router.push("/signup?returnTo=%2Fhome");
	};

	if (!open) {
		return (
			<button
				type="button"
				data-testid="guest-zoe-fab"
				aria-label="Ask Zoe"
				onClick={openPanel}
				className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-mtw-emerald text-white shadow-mtw-ambient transition-transform hover:scale-105"
			>
				<MessageCircle className="h-6 w-6" />
				<span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-white" />
			</button>
		);
	}

	return (
		<div
			data-testid="guest-zoe-panel"
			className="font-mtw fixed bottom-6 right-6 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-mtw-lg border border-mtw-border bg-white shadow-mtw-ambient"
		>
			<div className="flex items-center justify-between border-b border-mtw-border px-4 py-3">
				<div className="flex items-center gap-2">
					<span className="flex h-7 w-7 items-center justify-center rounded-full bg-mtw-emerald text-white">
						<MessageCircle className="h-4 w-4" />
					</span>
					<span className="text-mtw-small font-semibold text-mtw-ink">Zoe</span>
				</div>
				<button
					type="button"
					aria-label="Close"
					onClick={() => setOpen(false)}
					className="text-mtw-muted hover:text-mtw-ink"
				>
					<X className="h-5 w-5" />
				</button>
			</div>

			<div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-4">
				<p className="text-mtw-small leading-6 text-mtw-ink">{welcome.lead}</p>
				{thread.map((m, i) => (
					<p
						key={i}
						className={
							m.role === "you"
								? "ml-auto w-fit max-w-[85%] rounded-mtw bg-mtw-emerald/10 px-3 py-2 text-mtw-small text-mtw-ink"
								: "w-fit max-w-[90%] text-mtw-small leading-6 text-mtw-muted"
						}
					>
						{m.text}
					</p>
				))}
			</div>

			<div className="space-y-2 border-t border-mtw-border px-4 py-3">
				<div className="flex flex-wrap gap-2">
					{welcome.chips.map((chip) => (
						<button
							key={chip.id}
							type="button"
							data-testid={`guest-zoe-chip-${chip.id}`}
							onClick={() => onChip(chip)}
							className="rounded-mtw-pill border border-mtw-border px-3 py-1.5 text-mtw-small font-medium text-mtw-ink transition-colors hover:bg-mtw-surface"
						>
							{chip.label}
						</button>
					))}
				</div>
				<button
					type="button"
					data-testid="guest-zoe-signin"
					onClick={toSignup}
					className="w-full rounded-mtw bg-mtw-emerald px-4 py-2 text-mtw-small font-semibold text-white transition-opacity hover:opacity-90"
				>
					Sign in to ask Zoe anything
				</button>
			</div>
		</div>
	);
}
