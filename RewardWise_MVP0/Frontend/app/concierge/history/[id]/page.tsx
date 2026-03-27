/** @format */
"use client";

import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import {
	orderDisplayId,
	statusUi,
	tierLabel,
	turnaroundLabel,
} from "@/utils/concierge-display";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Detail = {
	id: string;
	tier: string;
	status: string;
	origin: string;
	destination: string;
	departure_date: string;
	return_date: string | null;
	trip_type: string | null;
	passengers: number | null;
	cabin: string | null;
	budget_cash: number | null;
	notes: string | null;
	quoted_price: number | null;
	currency: string | null;
	sla_hours: number | null;
	constraints: Record<string, unknown> | null;
	created_at: string;
};

function formatDate(d: string | null | undefined) {
	if (!d) return "—";
	return new Date(d).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function cabinLabel(cabin?: string | null) {
	if (!cabin) return "—";
	const labels: Record<string, string> = {
		economy: "Economy",
		premium: "Premium Economy",
		business: "Business",
		first: "First",
	};
	return labels[cabin] ?? cabin;
}

export default function ConciergeRequestDetailPage() {
	const router = useRouter();
	const params = useParams();
	const idRaw = params?.id;
	const requestId = typeof idRaw === "string" ? idRaw : Array.isArray(idRaw) ? idRaw[0] : "";

	const { user, loading: authLoading } = useAuth();
	const supabase = createClient();

	const [row, setRow] = useState<Detail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (authLoading || !requestId) return;
		if (!user) {
			setRow(null);
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
					"id, tier, status, origin, destination, departure_date, return_date, trip_type, passengers, cabin, budget_cash, notes, quoted_price, currency, sla_hours, constraints, created_at",
				)
				.eq("id", requestId)
				.eq("user_id", user.id)
				.single();

			if (cancelled) return;
			setLoading(false);

			if (qErr || !data) {
				setError("We could not find this request or you do not have access.");
				setRow(null);
				return;
			}

			const constraints =
				data.constraints &&
				typeof data.constraints === "object" &&
				!Array.isArray(data.constraints)
					? (data.constraints as Record<string, unknown>)
					: null;

			setRow({
				...(data as Omit<Detail, "constraints">),
				constraints,
			});
		})();

		return () => {
			cancelled = true;
		};
	}, [authLoading, user, supabase, requestId]);

	const st = row ? statusUi(row.status) : null;
	const price =
		row?.quoted_price != null
			? `${row.currency ?? "USD"} $${Number(row.quoted_price).toFixed(0)}`
			: "—";

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />
			<div className="relative z-10">
				<main className="max-w-2xl mx-auto px-6 py-8">
					<button
						type="button"
						onClick={() => router.push("/concierge/history")}
						className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm"
					>
						<ArrowLeft className="w-4 h-4" />
						All requests
					</button>

					{authLoading || loading ? (
						<div className="flex justify-center items-center gap-2 text-gray-400 py-12">
							<Loader2 className="w-5 h-5 animate-spin" />
							Loading…
						</div>
					) : !user ? (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 text-center">
							<p className="text-gray-400 mb-4">Sign in to view this request.</p>
							<button
								type="button"
								onClick={() => router.push("/login")}
								className="bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-6 rounded-lg text-sm"
							>
								Go to login
							</button>
						</div>
					) : error || !row ? (
						<p className="text-red-400 text-sm">{error || "Request not found."}</p>
					) : (
						<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 shadow-2xl space-y-6">
							<div>
								<p className="text-gray-400 text-sm font-mono mb-1">
									{orderDisplayId(row)}
								</p>
								<h1 className="text-2xl font-bold text-white">
									{row.origin} → {row.destination}
								</h1>
								<p className="text-emerald-300/90 text-sm mt-1">{tierLabel(row.tier)}</p>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
								<div className="bg-gray-800/50 rounded-lg p-3">
									<p className="text-gray-500 text-xs uppercase tracking-wide">Status</p>
									<p className={`font-medium ${st?.cls ?? ""}`}>{st?.text}</p>
								</div>
								<div className="bg-gray-800/50 rounded-lg p-3">
									<p className="text-gray-500 text-xs uppercase tracking-wide">Price</p>
									<p className="text-emerald-400 font-medium">{price}</p>
								</div>
								<div className="bg-gray-800/50 rounded-lg p-3">
									<p className="text-gray-500 text-xs uppercase tracking-wide">
										Turnaround
									</p>
									<p className="text-white">{turnaroundLabel(row.sla_hours, row.tier)}</p>
								</div>
								<div className="bg-gray-800/50 rounded-lg p-3">
									<p className="text-gray-500 text-xs uppercase tracking-wide">Submitted</p>
									<p className="text-white">{formatDate(row.created_at)}</p>
								</div>
							</div>

							<div className="border-t border-gray-700/60 pt-4 space-y-3 text-sm">
								<h2 className="text-emerald-400 font-medium text-sm">Trip details</h2>
								<dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-300">
									<div>
										<dt className="text-gray-500 text-xs">Departure</dt>
										<dd>{formatDate(row.departure_date)}</dd>
									</div>
									<div>
										<dt className="text-gray-500 text-xs">Return</dt>
										<dd>
											{row.trip_type === "roundtrip"
												? formatDate(row.return_date)
												: "One way"}
										</dd>
									</div>
									<div>
										<dt className="text-gray-500 text-xs">Trip type</dt>
										<dd className="capitalize">{row.trip_type ?? "—"}</dd>
									</div>
									<div>
										<dt className="text-gray-500 text-xs">Travelers</dt>
										<dd>{row.passengers ?? "—"}</dd>
									</div>
									<div>
										<dt className="text-gray-500 text-xs">Cabin</dt>
										<dd>{cabinLabel(row.cabin)}</dd>
									</div>
									<div>
										<dt className="text-gray-500 text-xs">Budget (cash)</dt>
										<dd>
											{row.budget_cash != null
												? `${row.currency ?? "USD"} $${row.budget_cash}`
												: "—"}
										</dd>
									</div>
								</dl>
							</div>

							{(row.notes ||
								(typeof row.constraints?.flexibility === "string" &&
									row.constraints.flexibility.length > 0)) && (
								<div className="border-t border-gray-700/60 pt-4 space-y-2">
									<h2 className="text-emerald-400 font-medium text-sm">
										Your preferences &amp; notes
									</h2>
									{typeof row.constraints?.flexibility === "string" && (
										<p className="text-gray-300 text-sm">
											<span className="text-gray-500">Flexibility: </span>
											<span className="capitalize">
												{String(row.constraints.flexibility)}
											</span>
										</p>
									)}
									{row.notes ? (
										<p className="text-gray-200 text-sm whitespace-pre-wrap rounded-lg bg-gray-800/40 p-3">
											{row.notes}
										</p>
									) : (
										!row.constraints?.flexibility && (
											<p className="text-gray-500 text-sm">No extra notes.</p>
										)
									)}
								</div>
							)}
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
