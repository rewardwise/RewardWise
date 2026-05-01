/** @format */

"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

type PageInsight = { page: string; visits: number; exits: number; avgSeconds: number; totalMinutes: number; lastSeen: string };
type SessionPath = { sessionId: string; user: string; startedAt: string; durationSeconds: number; path: string[]; pageViews: number; zoeMessages: number; searches: number };
type ZoeConversation = { id: string; user: string; startedAt: string; messages: number; responses: number; lastMessage: string; lastResponse: string; searchesTriggered: number };
type SearchInsight = { id: string; time: string; user: string; route: string; trip: string; cabin: string; travelers: string; verdict: string; price: string; source: string };
type CountRow = { name: string; value: number };

type Props = {
	error: string | null;
	filters: { days: number; selectedUser: string; selectedUserLabel: string };
	stats: {
		activeUsers: number;
		sessions: number;
		pageViews: number;
		totalPageSeconds: number;
		avgPageSeconds: number;
		searches: number;
		zoeUses: number;
		zoeMessages: number;
		zoeConversations: number;
		avgMessagesPerZoeChat: number;
		verdicts: number;
		errors: number;
	};
	options: { users: { userId: string; email: string }[] };
	charts: {
		activityData: { day: string; pageViews: number; pageMinutes: number; searches: number; zoeMessages: number; zoeUses: number }[];
		pageVisits: CountRow[];
		pageTime: CountRow[];
		topRoutes: CountRow[];
		zoeBreakdown: CountRow[];
		verdicts: CountRow[];
	};
	tables: {
		pages: PageInsight[];
		sessionPaths: SessionPath[];
		zoeConversations: ZoeConversation[];
		recentSearches: SearchInsight[];
	};
};

const COLORS = ["#2563eb", "#0f766e", "#9333ea", "#f59e0b", "#dc2626", "#64748b"];

function num(value: number, digits = 0) {
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function humanDuration(totalSeconds: number) {
	if (!totalSeconds) return "0s";
	if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.round(totalSeconds % 60);
	if (minutes < 60) return `${minutes}m ${seconds}s`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function pathLabel(path: string[]) {
	if (!path.length) return "No path captured";
	return path.join(" → ");
}

function maxValue(rows: CountRow[]) {
	return Math.max(...rows.map((row) => row.value), 1);
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
			<p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
			<p className="mt-2 text-sm text-slate-500">{detail}</p>
		</div>
	);
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
	return (
		<section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="mb-4">
				<h2 className="text-base font-semibold text-slate-950">{title}</h2>
				<p className="mt-1 text-sm text-slate-500">{subtitle}</p>
			</div>
			<div className="h-72 min-w-0">{children}</div>
		</section>
	);
}

function ScrollCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
	return (
		<section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="mb-4">
				<h2 className="text-base font-semibold text-slate-950">{title}</h2>
				<p className="mt-1 text-sm text-slate-500">{subtitle}</p>
			</div>
			<div className="max-h-80 space-y-3 overflow-y-auto pr-2">{children}</div>
		</section>
	);
}

function EmptyState({ label = "No data yet" }: { label?: string }) {
	return <div className="flex min-h-48 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">{label}</div>;
}

function CountList({
	rows,
	label,
	valueFormatter = (value) => String(value),
}: {
	rows: CountRow[];
	label: string;
	valueFormatter?: (value: number) => string;
}) {
	const largest = maxValue(rows);

	if (!rows.length) return <EmptyState />;

	return (
		<>
			{rows.map((row, index) => (
				<div key={`${row.name}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="break-words text-sm font-semibold text-slate-950">{row.name}</p>
							<p className="mt-1 text-xs text-slate-500">{label}</p>
						</div>
						<span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
							{valueFormatter(row.value)}
						</span>
					</div>
					<div className="mt-3 h-2 rounded-full bg-white ring-1 ring-slate-100">
						<div
							className="h-2 rounded-full bg-blue-600"
							style={{ width: `${Math.max(6, Math.round((row.value / largest) * 100))}%` }}
						/>
					</div>
				</div>
			))}
		</>
	);
}

function PageDetailList({ pages }: { pages: PageInsight[] }) {
	if (!pages.length) return <EmptyState label="No page visits yet." />;

	return (
		<>
			{pages.map((page) => (
				<div key={page.page} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
					<div className="flex items-start justify-between gap-3">
						<p className="min-w-0 break-words text-sm font-semibold text-slate-950">{page.page}</p>
						<span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
							{page.visits} visits
						</span>
					</div>
					<div className="mt-4 grid grid-cols-3 gap-2 text-sm">
						<div>
							<p className="text-xs text-slate-400">Avg time</p>
							<p className="font-semibold text-slate-900">{humanDuration(page.avgSeconds)}</p>
						</div>
						<div>
							<p className="text-xs text-slate-400">Total time</p>
							<p className="font-semibold text-slate-900">{page.totalMinutes}m</p>
						</div>
						<div>
							<p className="text-xs text-slate-400">Exits</p>
							<p className="font-semibold text-slate-900">{page.exits}</p>
						</div>
					</div>
				</div>
			))}
		</>
	);
}

function AskAnalyticsPanel({ filters }: { filters: Props["filters"] }) {
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const scopeLabel = filters.selectedUser ? filters.selectedUserLabel : "All users";
	const starterPrompts = filters.selectedUser
		? ["Summarize this user's behavior", "What pages did this user spend the most time on?", "How did this user use Zoe?", "Did this user search any routes?"]
		: ["Summarize product usage", "Which pages are most visited?", "How are testers using Zoe?", "What routes are most popular?"];

	async function askAnalytics(nextQuestion?: string) {
		const prompt = (nextQuestion ?? question).trim();
		if (!prompt || loading) return;
		setQuestion(prompt);
		setLoading(true);
		setError("");
		try {
			const response = await fetch("/api/admin/analytics/ask", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question: prompt, days: filters.days, selectedUser: filters.selectedUser }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(data?.error || "Analytics AI failed");
			setAnswer(data.answer || "No answer returned.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Analytics copilot</p>
					<h2 className="mt-2 text-xl font-semibold text-slate-950">Ask the data in normal English</h2>
					<p className="mt-1 text-sm text-slate-500">
						Current scope: <span className="font-medium text-slate-800">{scopeLabel}</span> over the last {filters.days} days.
					</p>
				</div>
				<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">read-only analytics_events access</span>
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				{starterPrompts.map((prompt) => (
					<button
						key={prompt}
						type="button"
						onClick={() => askAnalytics(prompt)}
						className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
					>
						{prompt}
					</button>
				))}
			</div>

			<form
				className="mt-4 flex flex-col gap-3 md:flex-row"
				onSubmit={(event) => {
					event.preventDefault();
					askAnalytics();
				}}
			>
				<input
					value={question}
					onChange={(event) => setQuestion(event.target.value)}
					placeholder={filters.selectedUser ? "Ask about this user's pages, Zoe usage, searches, or drop-offs..." : "Ask about all users, pages, Zoe usage, routes, or drop-offs..."}
					className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
				/>
				<button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>
					{loading ? "Thinking..." : "Ask"}
				</button>
			</form>

			{error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
			{answer ? (
				<div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm leading-6 text-slate-800 whitespace-pre-wrap">
					{answer}
				</div>
			) : null}
		</section>
	);
}

export default function AnalyticsChartsDashboard({ error, filters, stats, options, charts, tables }: Props) {
	return (
		<div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Admin only</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Product usage analytics</h1>
						<p className="mt-2 max-w-2xl text-sm text-slate-500">
							A clean executive view of tester behavior. Use the copilot for deeper journeys, Zoe prompts, and session-level questions.
						</p>
					</div>

					<form className="flex flex-wrap items-center gap-3">
						<select name="days" defaultValue={String(filters.days)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
							<option value="7">Last 7 days</option>
							<option value="14">Last 14 days</option>
							<option value="30">Last 30 days</option>
							<option value="90">Last 90 days</option>
						</select>
						<select name="user" defaultValue={filters.selectedUser} className="max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
							<option value="">All users</option>
							{options.users.map((user) => (
								<option key={user.userId} value={user.userId}>{user.email}</option>
							))}
						</select>
						<button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">Apply</button>
					</form>
				</div>
			</header>

			<main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
				{error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Analytics query error: {error}</div> : null}

				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<StatCard label="Users / sessions" value={`${stats.activeUsers} / ${stats.sessions}`} detail="Active testers and sessions in this filter" />
					<StatCard label="Pages visited" value={stats.pageViews} detail={`${humanDuration(stats.avgPageSeconds)} avg time per page`} />
					<StatCard label="Zoe usage" value={stats.zoeUses} detail={`${stats.zoeMessages} messages • ${num(stats.avgMessagesPerZoeChat, 1)} msgs/chat`} />
					<StatCard label="Searches / verdicts" value={`${stats.searches} / ${stats.verdicts}`} detail={`${stats.errors} important errors`} />
				</div>

				<div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
					<ChartCard title="Activity over time" subtitle="Page views, searches, and Zoe messages by day.">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={charts.activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
								<defs>
									<linearGradient id="pageViews" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.22}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
									<linearGradient id="zoeMessages" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9333ea" stopOpacity={0.20}/><stop offset="95%" stopColor="#9333ea" stopOpacity={0}/></linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
								<XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
								<YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
								<Tooltip />
								<Area type="monotone" dataKey="pageViews" name="Page views" stroke="#2563eb" fill="url(#pageViews)" strokeWidth={2} />
								<Area type="monotone" dataKey="zoeMessages" name="Zoe messages" stroke="#9333ea" fill="url(#zoeMessages)" strokeWidth={2} />
								<Area type="monotone" dataKey="searches" name="Searches" stroke="#0f766e" fill="#0f766e22" strokeWidth={2} />
							</AreaChart>
						</ResponsiveContainer>
					</ChartCard>

					<ChartCard title="Zoe usage" subtitle="Opens, conversations, and messages sent to Zoe.">
						{charts.zoeBreakdown.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie data={charts.zoeBreakdown} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
										{charts.zoeBreakdown.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						) : <EmptyState label="No Zoe usage yet" />}
					</ChartCard>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<ScrollCard title="Most visited pages" subtitle="Plain-English page names, ranked by visits. Scroll to see every page.">
						<CountList rows={charts.pageVisits} label="page visits" valueFormatter={(value) => `${value} visits`} />
					</ScrollCard>

					<ScrollCard title="Time spent by page" subtitle="Average time before testers leave or navigate away. Scroll to see every page.">
						<CountList rows={charts.pageTime} label="average time on page" valueFormatter={(value) => humanDuration(value)} />
					</ScrollCard>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<ScrollCard title="Popular routes" subtitle="Most searched origin and destination pairs with full airport names and IATA codes.">
						<CountList rows={charts.topRoutes} label="route searches" valueFormatter={(value) => `${value} searches`} />
					</ScrollCard>

					<ScrollCard title="Verdicts viewed" subtitle="Recommendations testers actually saw. Scroll if more verdict types are captured.">
						<CountList rows={charts.verdicts} label="verdict views" valueFormatter={(value) => `${value} views`} />
					</ScrollCard>
				</div>

				<AskAnalyticsPanel filters={filters} />

				<div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
					Tracking on admin pages is disabled. Deep dives like full user journeys, Zoe prompt details, recent searches, and drop-off explanations now live in the Analytics Copilot.
				</div>
			</main>
		</div>
	);
}
