/** @format */

"use client";

import type { ReactNode } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
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
type TimelineItem = { id: string; time: string; user: string; title: string; detail: string; page: string; kind: "page" | "time" | "zoe" | "search" | "verdict" | "feedback" | "error" };
type CountRow = { name: string; value: number };

type Props = {
	error: string | null;
	filters: { days: number; selectedUser: string };
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
		timeline: TimelineItem[];
	};
};

const COLORS = ["#2563eb", "#0f766e", "#9333ea", "#ea580c", "#dc2626", "#475569", "#0891b2"];

function num(value: number) {
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function humanDuration(totalSeconds: number) {
	if (!totalSeconds) return "0s";
	if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.round(totalSeconds % 60);
	if (minutes < 60) return `${minutes}m ${seconds}s`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
		<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="mb-4">
				<h2 className="text-base font-semibold text-slate-950">{title}</h2>
				<p className="mt-1 text-sm text-slate-500">{subtitle}</p>
			</div>
			<div className="h-72 min-w-0">{children}</div>
		</section>
	);
}

function EmptyChart({ label = "No data yet" }: { label?: string }) {
	return <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">{label}</div>;
}

function pathLabel(path: string[]) {
	if (!path.length) return "No page path captured";
	return path.join(" → ");
}

function timelineTone(kind: TimelineItem["kind"]) {
	const tones: Record<TimelineItem["kind"], string> = {
		page: "bg-blue-50 text-blue-700 ring-blue-100",
		time: "bg-slate-100 text-slate-700 ring-slate-200",
		zoe: "bg-violet-50 text-violet-700 ring-violet-100",
		search: "bg-emerald-50 text-emerald-700 ring-emerald-100",
		verdict: "bg-amber-50 text-amber-700 ring-amber-100",
		feedback: "bg-cyan-50 text-cyan-700 ring-cyan-100",
		error: "bg-red-50 text-red-700 ring-red-100",
	};
	return tones[kind];
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
							Only useful product behavior is shown here: pages visited, time spent, route paths, searches, verdicts, and Zoe usage.
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
					<StatCard label="Zoe usage" value={stats.zoeUses} detail={`${stats.zoeMessages} messages • ${num(stats.avgMessagesPerZoeChat)} msgs/chat`} />
					<StatCard label="Core outcomes" value={stats.searches} detail={`${stats.verdicts} verdicts • ${stats.errors} important errors`} />
				</div>

				<div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
					<ChartCard title="Activity over time" subtitle="Page views, time spent, searches, and Zoe messages.">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={charts.activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
								<defs>
									<linearGradient id="pageViews" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.24}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
									<linearGradient id="zoeMessages" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9333ea" stopOpacity={0.22}/><stop offset="95%" stopColor="#9333ea" stopOpacity={0}/></linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
								<XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
								<YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
								<Tooltip />
								<Area type="monotone" dataKey="pageViews" name="Page views" stroke="#2563eb" fill="url(#pageViews)" strokeWidth={2} />
								<Area type="monotone" dataKey="zoeMessages" name="Zoe messages" stroke="#9333ea" fill="url(#zoeMessages)" strokeWidth={2} />
								<Line type="monotone" dataKey="searches" name="Searches" stroke="#0f766e" strokeWidth={2} dot={false} />
							</AreaChart>
						</ResponsiveContainer>
					</ChartCard>

					<ChartCard title="Zoe usage" subtitle="How often Zoe is opened and how many chats/messages happen.">
						{charts.zoeBreakdown.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie data={charts.zoeBreakdown} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
										{charts.zoeBreakdown.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						) : <EmptyChart label="No Zoe usage yet" />}
					</ChartCard>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<ChartCard title="Pages visited" subtitle="Which pages testers actually visit.">
						{charts.pageVisits.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={charts.pageVisits} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
									<XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
									<YAxis dataKey="name" type="category" width={96} tick={{ fontSize: 11 }} stroke="#64748b" />
									<Tooltip />
									<Bar dataKey="value" name="Visits" radius={[0, 8, 8, 0]} fill="#2563eb" />
								</BarChart>
							</ResponsiveContainer>
						) : <EmptyChart />}
					</ChartCard>

					<ChartCard title="Time spent by page" subtitle="Average seconds spent before leaving each page.">
						{charts.pageTime.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={charts.pageTime} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
									<XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
									<YAxis dataKey="name" type="category" width={96} tick={{ fontSize: 11 }} stroke="#64748b" />
									<Tooltip formatter={(value) => [`${value}s`, "Avg time"]} />
									<Bar dataKey="value" name="Avg seconds" radius={[0, 8, 8, 0]} fill="#0f766e" />
								</BarChart>
							</ResponsiveContainer>
						) : <EmptyChart />}
					</ChartCard>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<ChartCard title="Route demand" subtitle="Most searched origin → destination pairs.">
						{charts.topRoutes.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={charts.topRoutes} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
									<XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
									<YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
									<Tooltip />
									<Bar dataKey="value" name="Searches" radius={[8, 8, 0, 0]} fill="#0f766e" />
								</BarChart>
							</ResponsiveContainer>
						) : <EmptyChart label="No searches yet" />}
					</ChartCard>

					<ChartCard title="Verdicts" subtitle="Distribution of verdict recommendations seen by testers.">
						{charts.verdicts.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie data={charts.verdicts} dataKey="value" nameKey="name" outerRadius={100} label>
										{charts.verdicts.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						) : <EmptyChart label="No verdicts yet" />}
					</ChartCard>
				</div>

				<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="mb-5 flex flex-col gap-1">
						<h2 className="text-base font-semibold text-slate-950">Pages and time spent</h2>
						<p className="text-sm text-slate-500">Clean page-level view: visits, average time, total time, and last seen.</p>
					</div>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{tables.pages.map((page) => (
							<div key={page.page} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
								<div className="flex items-start justify-between gap-3">
									<p className="truncate font-medium text-slate-950">{page.page}</p>
									<span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">{page.visits} visits</span>
								</div>
								<div className="mt-4 grid grid-cols-3 gap-2 text-sm">
									<div><p className="text-slate-400">Avg</p><p className="font-semibold">{humanDuration(page.avgSeconds)}</p></div>
									<div><p className="text-slate-400">Total</p><p className="font-semibold">{page.totalMinutes}m</p></div>
									<div><p className="text-slate-400">Exits</p><p className="font-semibold">{page.exits}</p></div>
								</div>
							</div>
						))}
						{!tables.pages.length ? <p className="text-sm text-slate-400">No page visits yet.</p> : null}
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
						<h2 className="text-base font-semibold text-slate-950">Route paths</h2>
						<p className="mt-1 text-sm text-slate-500">Session-level page journeys, without click noise.</p>
						<div className="mt-5 space-y-3">
							{tables.sessionPaths.slice(0, 10).map((session) => (
								<div key={session.sessionId} className="rounded-2xl border border-slate-100 p-4">
									<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
										<span>{session.user}</span>
										<span>{humanDuration(session.durationSeconds)} • {session.pageViews} page views</span>
									</div>
									<p className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">{pathLabel(session.path)}</p>
									<p className="mt-2 text-xs text-slate-400">{session.searches} searches • {session.zoeMessages} Zoe messages</p>
								</div>
							))}
							{!tables.sessionPaths.length ? <p className="text-sm text-slate-400">No route paths yet.</p> : null}
						</div>
					</div>

					<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
						<h2 className="text-base font-semibold text-slate-950">Zoe chats</h2>
						<p className="mt-1 text-sm text-slate-500">How many chats happened, how many messages per chat, and what users asked.</p>
						<div className="mt-5 space-y-3">
							{tables.zoeConversations.slice(0, 10).map((chat) => (
								<div key={chat.id} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="text-sm font-medium text-slate-950">{chat.user}</p>
										<span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">{chat.messages} messages</span>
									</div>
									<p className="mt-3 text-sm text-slate-700">User: “{chat.lastMessage}”</p>
									{chat.lastResponse !== "-" ? <p className="mt-2 text-sm text-slate-500">Zoe: “{chat.lastResponse}”</p> : null}
									<p className="mt-3 text-xs text-slate-400">{chat.responses} responses • {chat.searchesTriggered} searches triggered</p>
								</div>
							))}
							{!tables.zoeConversations.length ? <p className="text-sm text-slate-400">No Zoe chats yet.</p> : null}
						</div>
					</div>
				</section>

				<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-base font-semibold text-slate-950">Recent searches</h2>
					<p className="mt-1 text-sm text-slate-500">Routes, trip shape, cabin, source, price, and verdict.</p>
					<div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{tables.recentSearches.map((search) => (
							<div key={search.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
								<p className="text-sm font-semibold text-slate-950">{search.route}</p>
								<p className="mt-2 text-sm text-slate-500">{search.trip} • {search.cabin} • {search.travelers} traveler(s)</p>
								<p className="mt-3 text-xs text-slate-400">{search.price} • {search.verdict} • {search.source} • {search.time}</p>
							</div>
						))}
						{!tables.recentSearches.length ? <p className="text-sm text-slate-400">No searches yet.</p> : null}
					</div>
				</section>

				<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-base font-semibold text-slate-950">Useful timeline</h2>
					<p className="mt-1 text-sm text-slate-500">Only meaningful product events: page visits, time spent, Zoe, searches, verdicts, feedback, and important errors.</p>
					<div className="mt-5 space-y-3">
						{tables.timeline.slice(0, 80).map((item) => (
							<div key={item.id} className="flex gap-3 rounded-2xl border border-slate-100 p-4">
								<div className={`mt-1 h-3 w-3 flex-none rounded-full ring-4 ${timelineTone(item.kind)}`} />
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="font-medium text-slate-950">{item.title}</p>
										<p className="text-xs text-slate-400">{item.time}</p>
									</div>
									<p className="mt-1 break-words text-sm text-slate-500">{item.detail}</p>
									<p className="mt-2 text-xs text-slate-400">{item.user} • {item.page}</p>
								</div>
							</div>
						))}
						{!tables.timeline.length ? <p className="text-sm text-slate-400">No useful events yet.</p> : null}
					</div>
				</section>

				<div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
					Tracking on admin pages is disabled. This dashboard intentionally hides tab visibility, auth-refresh spam, form focus spam, scroll milestones, raw coordinates, and raw request metadata.
				</div>
			</main>
		</div>
	);
}
