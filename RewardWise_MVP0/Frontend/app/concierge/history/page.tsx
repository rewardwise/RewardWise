/** @format */
"use client";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import {
	orderDisplayId,
	statusUi,
	tierLabel,
} from "@/utils/concierge-display";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Row = {
	id: string;
	tier: string;
	status: string;
	origin: string;
	destination: string;
	departure_date: string;
	quoted_price: number | null;
	currency: string | null;
	sla_hours: number | null;
	created_at: string;
};

function ConciergeHistoryInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const highlightId = searchParams.get("highlight");
	const { user, loading: authLoading } = useAuth();
	const supabase = createClient();

	const [rows, setRows] = useState<Row[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (authLoading) return;
		if (!user) {
			setRows([]);
			setLoading(false);
			return;
		}

		let cancelled = false;
		(async () => {
			setLoading(true);
			setError("");
			const { data, error: qErr } = await supabase
				.from("travel_requests")
				.select(
					"id, tier, status, origin, destination, departure_date, quoted_price, currency, sla_hours, created_at",
				)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (cancelled) return;
			setLoading(false);
			if (qErr) {
				setError(qErr.message || "Could not load concierge history.");
				setRows([]);
				return;
			}
			setRows((data ?? []) as Row[]);
		})();

		return () => {
			cancelled = true;
		};
	}, [authLoading, user, supabase]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />
			<div className="relative z-10">
				<main className="max-w-2xl mx-auto px-6 py-8">
					<button
						type="button"
						onClick={() => router.push("/concierge")}
						className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Concierge
					</button>

					<div className="flex items-center gap-3 mb-6">
						<div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
							<ClipboardList className="w-6 h-6 text-emerald-400" />
						</div>
						<div>
							<h1 className="text-3xl font-bold text-white drop-shadow-lg">
								Your concierge requests
							</h1>
							<p className="text-gray-200 text-sm">
								Subscribed trips — open one for full details and status.
							</p>
						</div>
					</div>

					{authLoading || loading ? (
						<div className="flex justify-center items-center gap-2 text-gray-400 py-12">
							<Loader2 className="w-5 h-5 animate-spin" />
							Loading history…
						</div>
					) : !user ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 text-center">
							<p className="text-gray-400 mb-4">You need an active team session to see your requests.</p>
							<button
								type="button"
								onClick={() => router.push("/")}
								className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-6 rounded-lg text-sm"
							>
								Back to Home
							</button>
						</div>
					) : error ? (
						<p className="text-red-400 text-sm">{error}</p>
					) : rows.length === 0 ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 text-center text-gray-400 text-sm">
							No concierge requests yet. Start one from Standard or Premium.
						</div>
					) : (
						<ul className="space-y-3">
							{rows.map((r) => {
								const st = statusUi(r.status);
								const hl = highlightId === r.id;
								return (
									<li key={r.id}>
										<Link
											href={`/concierge/history/${encodeURIComponent(r.id)}`}
											className={`flex items-center justify-between w-full bg-gray-900/90 backdrop-blur rounded-xl p-4 border transition-colors hover:bg-gray-800/90 text-left ${
												hl
													? "border-emerald-500/60 ring-2 ring-emerald-500/30"
													: "border-gray-700/50"
											}`}
										>
											<div className="min-w-0 pr-3">
												<p className="text-white font-medium truncate">
													{r.origin} → {r.destination}
												</p>
												<p className="text-gray-400 text-sm font-mono">
													{orderDisplayId(r)} · {tierLabel(r.tier)}
												</p>
												<p className={`text-sm mt-1 ${st.cls}`}>{st.text}</p>
											</div>
											<ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
										</Link>
									</li>
								);
							})}
						</ul>
					)}
				</main>
			</div>
		</div>
	);
}

export default function ConciergeHistoryPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 flex items-center justify-center text-gray-400 gap-2">
					<Loader2 className="w-5 h-5 animate-spin" />
					Loading…
				</div>
			}
		>
			<ConciergeHistoryInner />
		</Suspense>
	);
}
