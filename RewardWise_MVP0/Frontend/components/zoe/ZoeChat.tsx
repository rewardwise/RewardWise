/** @format */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthProvider";
import ReactMarkdown from "react-markdown";
import {
	Edit3,
	Loader2,
	Maximize2,
	MessageCircle,
	Mic,
	MicOff,
	Minimize2,
	Plus,
	Send,
	Sparkles,
	X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Message {
	role: "user" | "assistant";
	content: string;
}

interface Conversation {
	id: string;
	title: string;
	updated_at: string;
}

interface ZoeChatProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
	const { data } = await supabase.auth.getSession();
	const token = data?.session?.access_token;
	return {
		"Content-Type": "application/json",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const WELCOME_MESSAGE = "Hey! I'm Zoe. I can help you figure out where to go, whether your points are worth using, what to do at a destination, or just think through your next trip. What's on your mind?";

// ─── Component ───────────────────────────────────────────────────────────────

export default function ZoeChat({ isOpen, setIsOpen }: ZoeChatProps) {
	const { user } = useAuth();
	const { cards } = useWallet();

	const [expanded, setExpanded] = useState(false);
	const [showNudge, setShowNudge] = useState(true);

	// Current chat
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const [conversationId, setConversationId] = useState<string | null>(null);

	// Sidebar
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [loadingConvs, setLoadingConvs] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);

	// Voice
	const [listening, setListening] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const pressingRef = useRef(false);

	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);

	// ── Scroll to bottom ──────────────────────────────────────────────────────
	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typing]);

	// ── Hide nudge after 12s ──────────────────────────────────────────────────
	useEffect(() => {
		const t = setTimeout(() => setShowNudge(false), 12000);
		return () => clearTimeout(t);
	}, []);

	// ── Focus input on open ───────────────────────────────────────────────────
	useEffect(() => {
		if (isOpen) {
			setShowNudge(false);
			setTimeout(() => inputRef.current?.focus(), 100);
		}
	}, [isOpen]);

	// ── Welcome message on first open ─────────────────────────────────────────
	useEffect(() => {
		if (isOpen && messages.length === 0 && !conversationId) {
			setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		}
	}, [isOpen, messages.length, conversationId]);

	// ── Load conversations when expanded ─────────────────────────────────────
	const loadConversations = useCallback(async () => {
		if (!user) return;
		setLoadingConvs(true);
		try {
			const { data } = await supabase
				.from("zoe_conversations")
				.select("id, title, updated_at")
				.eq("user_id", user.id)
				.order("updated_at", { ascending: false })
				.limit(50);
			setConversations(data || []);
		} catch (e) {
			console.error("Failed to load conversations:", e);
		} finally {
			setLoadingConvs(false);
		}
	}, [user]);

	useEffect(() => {
		if (expanded && user) loadConversations();
	}, [expanded, user, loadConversations]);

	// ── New conversation ──────────────────────────────────────────────────────
	const startNewConversation = async () => {
		if (!user) return;
		const { data, error } = await supabase
			.from("zoe_conversations")
			.insert({ user_id: user.id, title: "New conversation" })
			.select("id")
			.single();

		if (error || !data) {
			console.error("Failed to create conversation:", error);
			return;
		}

		setConversationId(data.id);
		setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		setInput("");
		// Refresh sidebar
		loadConversations();
	};

	// ── Load a past conversation ──────────────────────────────────────────────
	const loadConversation = async (conv: Conversation) => {
		setLoadingMessages(true);
		setConversationId(conv.id);
		setMessages([]);

		try {
			const headers = await getAuthHeaders();
			const res = await fetch(`/api/zoe?conversation_id=${conv.id}`, { headers });
			const data = await res.json();
			const loaded: Message[] = (data.messages || []).map((m: any) => ({
				role: m.role,
				content: m.content,
			}));
			setMessages(loaded.length > 0 ? loaded : [{ role: "assistant", content: WELCOME_MESSAGE }]);
		} catch (e) {
			console.error("Failed to load messages:", e);
			setMessages([{ role: "assistant", content: "Couldn't load this conversation. Try again." }]);
		} finally {
			setLoadingMessages(false);
		}
	};

	// ── Send message ──────────────────────────────────────────────────────────
	const sendText = async (text: string) => {
		if (typing || !text.trim()) return;
		const trimmed = text.trim();

		// Create conversation in DB on first real message if not already created
		let convId = conversationId;
		if (!convId && user) {
			const { data, error } = await supabase
				.from("zoe_conversations")
				.insert({ user_id: user.id, title: "New conversation" })
				.select("id")
				.single();
			if (!error && data) {
				convId = data.id;
				setConversationId(convId);
			}
		}

		setMessages(prev => [...prev, { role: "user", content: trimmed }]);
		setInput("");
		setTyping(true);

		try {
			const headers = await getAuthHeaders();
			const res = await fetch("/api/zoe", {
				method: "POST",
				headers,
				body: JSON.stringify({
					message: trimmed,
					history: messages,
					conversation_id: convId,
					wallet: (cards || []).map((c: any) => ({ program: c.program_name, points: c.points_balance })),
				}),
			});
			const data = await res.json();
			const reply = data.message || "Something went wrong — try again.";
			setMessages(prev => [...prev, { role: "assistant", content: reply }]);

			// Refresh sidebar title after first message
			if (expanded) loadConversations();
		} catch {
			setMessages(prev => [...prev, { role: "assistant", content: "Network error — please try again." }]);
		} finally {
			setTyping(false);
		}
	};

	// ── Voice input ───────────────────────────────────────────────────────────
	const startListening = () => {
		if (typing || listening) return;
		try {
			const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
			if (!SpeechRecognitionAPI) return;
			pressingRef.current = true;
			const recognition = new SpeechRecognitionAPI();
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.lang = "en-US";
			recognition.onresult = (e) => {
				setInput(Array.from(e.results).map(r => r[0].transcript).join("").trim());
			};
			recognition.onerror = () => { setListening(false); pressingRef.current = false; };
			recognition.onend = () => {
				setListening(false);
				if (pressingRef.current) {
					try { recognition.start(); setListening(true); } catch { setListening(false); }
				}
			};
			recognitionRef.current = recognition;
			recognition.start();
			setListening(true);
		} catch { setListening(false); pressingRef.current = false; }
	};

	const stopListening = () => {
		pressingRef.current = false;
		recognitionRef.current?.stop();
		setListening(false);
	};

	// ─── Floating button (closed state) ──────────────────────────────────────
	if (!isOpen) {
		return (
			<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
				{showNudge && (
					<div className="max-w-[240px] rounded-2xl border border-emerald-400/15 bg-slate-900/95 px-4 py-3 shadow-2xl">
						<p className="text-sm font-semibold text-white">Meet Zoe</p>
						<p className="mt-1 text-xs leading-5 text-slate-400">Your travel agent — airports, points strategy, destination tips, and more.</p>
					</div>
				)}
				<button
					onClick={() => setIsOpen(true)}
					className="flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 px-7 py-4 text-white shadow-2xl transition-all hover:scale-[1.02] hover:shadow-emerald-500/20"
				>
					<MessageCircle className="h-6 w-6" />
					<span className="text-base font-bold">Ask Zoe ✨</span>
				</button>
			</div>
		);
	}

	// ─── Compact popup (not expanded) ────────────────────────────────────────
	if (!expanded) {
		return (
			<div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[390px] flex-col rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
							<Sparkles className="h-4 w-4 text-emerald-300" />
						</div>
						<div>
							<p className="font-semibold leading-none text-white">Zoe</p>
							<p className="mt-0.5 text-xs text-emerald-300">Your travel agent</p>
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						<button
							onClick={() => setExpanded(true)}
							title="Expand"
							className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
						>
							<Maximize2 className="h-4 w-4" />
						</button>
						<button
							onClick={() => setIsOpen(false)}
							className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto px-4 py-4">
					<div className="space-y-4">
						{messages.map((msg, i) => (
							<div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
								<div className={`max-w-[88%] ${
									msg.role === "user"
										? "rounded-2xl bg-emerald-500 px-4 py-3 text-white"
										: "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-200"
								}`}>
									{msg.role === "user" ? (
										<p className="leading-6 text-sm">{msg.content}</p>
									) : (
										<ReactMarkdown
											components={{
												p: ({ ...props }) => <p className="mb-1.5 last:mb-0 text-sm leading-6" {...props} />,
												strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
											}}
										>
											{msg.content}
										</ReactMarkdown>
									)}
								</div>
							</div>
						))}
						{typing && (
							<div className="flex justify-start">
								<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
									<div className="flex gap-1 items-center">
										<div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
										<div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
										<div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
									</div>
								</div>
							</div>
						)}
						<div ref={endRef} />
					</div>
				</div>

				{/* Input */}
				<div className="border-t border-white/10 p-3">
					<div className="flex gap-2">
						<button
							onMouseDown={startListening}
							onMouseUp={stopListening}
							onMouseLeave={() => listening && stopListening()}
							onTouchStart={startListening}
							onTouchEnd={stopListening}
							className={`flex-shrink-0 rounded-xl border px-3 py-2.5 transition ${
								listening
									? "border-rose-400 bg-rose-500/20 text-rose-200"
									: "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
							}`}
						>
							{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
						</button>
						<input
							ref={inputRef}
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => { if (e.key === "Enter") void sendText(input); }}
							placeholder="Ask Zoe anything…"
							className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
						<button
							onClick={() => void sendText(input)}
							disabled={!input.trim() || typing}
							className="flex-shrink-0 rounded-xl bg-emerald-500 px-3 py-2.5 text-white transition hover:bg-emerald-400 disabled:bg-slate-700"
						>
							<Send className="h-4 w-4" />
						</button>
					</div>
					<p className="mt-2 text-center text-[11px] text-slate-600">
						Hold mic to speak · <button onClick={() => setExpanded(true)} className="text-emerald-600 hover:text-emerald-400">Expand for full view</button>
					</p>
				</div>
			</div>
		);
	}

	// ─── Expanded full-screen view with sidebar ───────────────────────────────
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="flex h-[85vh] w-[88vw] max-w-[1200px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">

				{/* ── Sidebar ── */}
				<div className="flex w-[260px] flex-shrink-0 flex-col border-r border-white/10 bg-slate-950">
					{/* Sidebar header */}
					<div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/15">
								<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
							</div>
							<span className="font-semibold text-white">Zoe</span>
						</div>
						<button
							onClick={startNewConversation}
							title="New conversation"
							className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
						>
							<Edit3 className="h-4 w-4" />
						</button>
					</div>

					{/* New chat button */}
					<div className="px-3 pt-3">
						<button
							onClick={startNewConversation}
							className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
						>
							<Plus className="h-4 w-4" />
							New conversation
						</button>
					</div>

					{/* Conversation list */}
					<div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
						{loadingConvs ? (
							<div className="flex justify-center py-6">
								<Loader2 className="h-4 w-4 animate-spin text-slate-500" />
							</div>
						) : conversations.length === 0 ? (
							<p className="px-2 py-4 text-xs text-slate-600">No conversations yet.</p>
						) : (
							<div className="space-y-0.5">
								{conversations.map(conv => (
									<button
										key={conv.id}
										onClick={() => loadConversation(conv)}
										className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06] ${
											conversationId === conv.id ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-slate-200"
										}`}
									>
										<p className="truncate text-sm font-medium leading-snug">{conv.title}</p>
										<p className="mt-0.5 text-[11px] text-slate-600">{timeAgo(conv.updated_at)}</p>
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				{/* ── Main chat area ── */}
				<div className="flex flex-1 flex-col">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
						<div>
							<p className="font-semibold text-white">
								{conversations.find(c => c.id === conversationId)?.title || "Zoe"}
							</p>
							<p className="text-xs text-emerald-300">Your travel agent</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setExpanded(false)}
								className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
								title="Compact view"
							>
								<Minimize2 className="h-5 w-5" />
							</button>
							<button
								onClick={() => { setIsOpen(false); setExpanded(false); }}
								className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
							>
								<X className="h-5 w-5" />
							</button>
						</div>
					</div>

					{/* Messages */}
					<div className="flex-1 overflow-y-auto px-6 py-6">
						{loadingMessages ? (
							<div className="flex h-full items-center justify-center">
								<Loader2 className="h-5 w-5 animate-spin text-slate-500" />
							</div>
						) : (
							<div className="mx-auto max-w-2xl space-y-5">
								{messages.map((msg, i) => (
									<div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
										{msg.role === "assistant" && (
											<div className="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
												<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
											</div>
										)}
										<div className={`max-w-[78%] ${
											msg.role === "user"
												? "rounded-2xl bg-emerald-500 px-5 py-3.5 text-white"
												: "rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-slate-200"
										}`}>
											{msg.role === "user" ? (
												<p className="leading-7">{msg.content}</p>
											) : (
												<ReactMarkdown
													components={{
														p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-7" {...props} />,
														strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
														ul: ({ ...props }) => <ul className="my-2 ml-4 list-disc space-y-1" {...props} />,
														ol: ({ ...props }) => <ol className="my-2 ml-4 list-decimal space-y-1" {...props} />,
														li: ({ ...props }) => <li className="text-slate-200" {...props} />,
													}}
												>
													{msg.content}
												</ReactMarkdown>
											)}
										</div>
									</div>
								))}
								{typing && (
									<div className="flex justify-start">
										<div className="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
											<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
										</div>
										<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
											<div className="flex gap-1.5 items-center">
												<div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
												<div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
												<div className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
											</div>
										</div>
									</div>
								)}
								<div ref={endRef} />
							</div>
						)}
					</div>

					{/* Input */}
					<div className="border-t border-white/10 px-6 py-4">
						<div className="mx-auto max-w-2xl flex gap-3">
							<button
								onMouseDown={startListening}
								onMouseUp={stopListening}
								onMouseLeave={() => listening && stopListening()}
								onTouchStart={startListening}
								onTouchEnd={stopListening}
								className={`flex-shrink-0 rounded-2xl border px-4 py-3 transition ${
									listening
										? "border-rose-400 bg-rose-500/20 text-rose-200"
										: "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
								}`}
							>
								{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
							</button>
							<input
								ref={inputRef}
								value={input}
								onChange={e => setInput(e.target.value)}
								onKeyDown={e => { if (e.key === "Enter") void sendText(input); }}
								placeholder={listening ? "Listening…" : "Ask Zoe anything…"}
								className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
							/>
							<button
								onClick={() => void sendText(input)}
								disabled={!input.trim() || typing}
								className="flex-shrink-0 rounded-2xl bg-emerald-500 px-5 py-3 text-white transition hover:bg-emerald-400 disabled:bg-slate-700"
							>
								<Send className="h-5 w-5" />
							</button>
						</div>
						<p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-slate-600">
							Hold mic to speak · Zoe uses your wallet and search history to personalize answers
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
