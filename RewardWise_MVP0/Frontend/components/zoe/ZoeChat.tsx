/** @format */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthProvider";
import ReactMarkdown from "react-markdown";
import {
	Check,
	Edit3,
	Loader2,
	Maximize2,
	MessageCircle,
	Mic,
	MicOff,
	Minimize2,
	MoreHorizontal,
	Plus,
	Send,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export interface Message {
	role: "user" | "assistant";
	content: string;
	prefilled?: boolean; // marks assistant messages that triggered a form fill
}

interface Conversation {
	id: string;
	title: string;
	updated_at: string;
}

interface ZoeChatProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	verdictContext?: string | null;  // injected when user clicks "Ask Zoe" on verdict card
	onFillSearch?: (data: {
		origin?: string;
		destination?: string;
		date?: string;
		return_date?: string;
		travelers?: number;
		cabin?: string;
		tripType?: string;
	}) => void;
}

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

const WELCOME_MESSAGE = "Hey! I'm Zoe. Tell me about the trip you're thinking about — I'll help you plan it and fill in the search form when you're ready.";

export default function ZoeChat({ isOpen, setIsOpen, onFillSearch, verdictContext }: ZoeChatProps) {
	const { user } = useAuth();
	const { cards } = useWallet();

	const [expanded, setExpanded] = useState(false);
	const [showNudge, setShowNudge] = useState(true);

	// Current chat state
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const [conversationId, setConversationId] = useState<string | null>(null);

	// Sidebar state
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [loadingConvs, setLoadingConvs] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);

	// Rename state
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);

	// Voice
	const [listening, setListening] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const pressingRef = useRef(false);

	const inputRef = useRef<HTMLInputElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typing]);

	// Welcome message on fresh open (no verdict context)
	useEffect(() => {
		if (isOpen && messages.length === 0 && !conversationId && !verdictContext) {
			setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		}
	}, [isOpen, messages.length, conversationId, verdictContext]);

	// When user clicks "Ask Zoe" on a verdict card, inject context immediately.
	// Fires whenever verdictContext changes to non-null — even if chat was already open.
	useEffect(() => {
		if (!verdictContext) return;
		setConversationId(null); // fresh conversation
		setMessages([{
			role: "assistant",
			content: `I can see the result from your search. ${verdictContext} What would you like to know about it?`,
		}]);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [verdictContext]);

	useEffect(() => {
		if (isOpen) {
			setShowNudge(false);
			setTimeout(() => inputRef.current?.focus(), 100);
		}
	}, [isOpen]);

	useEffect(() => {
		const t = setTimeout(() => setShowNudge(false), 12000);
		return () => clearTimeout(t);
	}, []);

	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	// Close menu when clicking outside
	useEffect(() => {
		if (!openMenuId) return;
		const handler = () => setOpenMenuId(null);
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [openMenuId]);

	// Focus rename input when it appears
	useEffect(() => {
		if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 50);
	}, [renamingId]);

	// ── Sidebar: load conversations ──────────────────────────────────────────
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
		if (error || !data) return;
		setConversationId(data.id);
		setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		setInput("");
		loadConversations();
	};

	// ── Load past conversation ────────────────────────────────────────────────
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
		} catch {
			setMessages([{ role: "assistant", content: "Couldn't load this conversation. Try again." }]);
		} finally {
			setLoadingMessages(false);
		}
	};

	// ── Delete conversation ───────────────────────────────────────────────────
	const deleteConversation = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setOpenMenuId(null);
		const { error } = await supabase
			.from("zoe_conversations")
			.delete()
			.eq("id", id);
		if (error) { console.error("Delete failed:", error); return; }
		// If we deleted the active conversation, reset chat
		if (conversationId === id) {
			setConversationId(null);
			setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		}
		setConversations(prev => prev.filter(c => c.id !== id));
	};

	// ── Rename conversation ───────────────────────────────────────────────────
	const startRename = (conv: Conversation, e: React.MouseEvent) => {
		e.stopPropagation();
		setOpenMenuId(null);
		setRenamingId(conv.id);
		setRenameValue(conv.title);
	};

	const commitRename = async (id: string) => {
		const trimmed = renameValue.trim();
		if (!trimmed) { setRenamingId(null); return; }
		const { error } = await supabase
			.from("zoe_conversations")
			.update({ title: trimmed })
			.eq("id", id);
		if (!error) {
			setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed } : c));
		}
		setRenamingId(null);
	};

	// ── Send message ──────────────────────────────────────────────────────────
	const sendText = async (text: string) => {
		if (typing || !text.trim()) return;
		const trimmed = text.trim();

		// Create conversation in DB on first message if needed
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
					wallet: (cards || []).map((c: any) => ({
						program: c.program_name,
						points: c.points_balance,
					})),
				}),
			});
			const data = await res.json();
			const reply = data.message || "Something went wrong — try again.";
			const prefill = data.prefill || null;

			// Add reply to chat, marking it if it triggered a prefill
			setMessages(prev => [...prev, {
				role: "assistant",
				content: reply,
				prefilled: !!prefill,
			}]);

			// Pre-fill the search form if Zoe extracted trip info
			if (prefill && onFillSearch) {
				onFillSearch({
					origin: prefill.origin,
					destination: prefill.destination,
					date: prefill.date,
					return_date: prefill.return_date,
					travelers: prefill.travelers,
					cabin: prefill.cabin,
					tripType: prefill.tripType,
				});
			}

			// Refresh sidebar title after first message
			if (expanded) loadConversations();
		} catch {
			setMessages(prev => [...prev, { role: "assistant", content: "Network error — please try again." }]);
		} finally {
			setTyping(false);
		}
	};

	// ── Voice ─────────────────────────────────────────────────────────────────
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

	// ─── Closed state ─────────────────────────────────────────────────────────
	if (!isOpen) {
		return (
			<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
				{showNudge && (
					<div className="max-w-[240px] rounded-2xl border border-emerald-400/15 bg-slate-900/95 px-4 py-3 shadow-2xl">
						<p className="text-sm font-semibold text-white">Meet Zoe</p>
						<p className="mt-1 text-xs leading-5 text-slate-400">
							Chat about your trip — she'll fill in the search form when you're ready.
						</p>
					</div>
				)}
				<button
					onClick={() => setIsOpen(true)}
					className="flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 px-7 py-4 text-white shadow-2xl transition-all hover:scale-[1.02]"
				>
					<MessageCircle className="h-6 w-6" />
					<span className="text-base font-bold">Ask Zoe ✨</span>
				</button>
			</div>
		);
	}

	// ── Message bubble ────────────────────────────────────────────────────────
	const renderMessage = (msg: Message, i: number, compact: boolean) => (
		<div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
			{msg.role === "assistant" && !compact && (
				<div className="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
					<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
				</div>
			)}
			<div className={`${compact ? "max-w-[88%]" : "max-w-[78%]"} ${
				msg.role === "user"
					? "rounded-2xl bg-emerald-500 px-4 py-3 text-white"
					: "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-200"
			}`}>
				{msg.role === "user" ? (
					<p className={`leading-6 ${compact ? "text-sm" : ""}`}>{msg.content}</p>
				) : (
					<>
						<ReactMarkdown
							components={{
								p: ({ ...props }) => <p className={`mb-1.5 last:mb-0 leading-6 ${compact ? "text-sm" : "leading-7"}`} {...props} />,
								strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
								ul: ({ ...props }) => <ul className="my-2 ml-4 list-disc space-y-1" {...props} />,
								li: ({ ...props }) => <li className="text-slate-200" {...props} />,
							}}
						>
							{msg.content}
						</ReactMarkdown>
						{msg.prefilled && (
							<div className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1.5">
								<Check className="h-3 w-3 text-emerald-300 flex-shrink-0" />
								<span className="text-xs text-emerald-200 font-medium">Search form filled — hit Search when ready</span>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);

	// ── Input bar ─────────────────────────────────────────────────────────────
	const renderInput = (compact: boolean) => (
		<div className={`border-t border-white/10 p-${compact ? "3" : "4"}`}>
			<div className={`flex gap-2 ${!compact ? "mx-auto max-w-2xl" : ""}`}>
				<button
					onMouseDown={startListening}
					onMouseUp={stopListening}
					onMouseLeave={() => listening && stopListening()}
					onTouchStart={startListening}
					onTouchEnd={stopListening}
					className={`flex-shrink-0 rounded-xl border px-3 py-${compact ? "2" : "3"} transition ${
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
					placeholder={listening ? "Listening…" : "Tell Zoe about your trip…"}
					className={`flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-${compact ? "3" : "5"} py-${compact ? "2" : "3"} text-${compact ? "sm" : "base"} text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
				/>
				<button
					onClick={() => void sendText(input)}
					disabled={!input.trim() || typing}
					className={`flex-shrink-0 rounded-xl bg-emerald-500 px-${compact ? "3" : "4"} py-${compact ? "2" : "3"} text-white transition hover:bg-emerald-400 disabled:bg-slate-700`}
				>
					<Send className="h-4 w-4" />
				</button>
			</div>
			<p className={`mt-2 text-center text-[11px] text-slate-600 ${!compact ? "mx-auto max-w-2xl" : ""}`}>
				{compact
					? <><button onClick={() => setExpanded(true)} className="text-emerald-600 hover:text-emerald-400">Expand</button> for full view · Hold mic to speak</>
					: "Hold mic to speak · Zoe fills the search form as you plan"}
			</p>
		</div>
	);

	// ─── Compact popup ────────────────────────────────────────────────────────
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
						<button onClick={() => setExpanded(true)} title="Expand" className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
							<Maximize2 className="h-4 w-4" />
						</button>
						<button onClick={() => setIsOpen(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto px-4 py-4">
					<div className="space-y-4">
						{messages.map((msg, i) => renderMessage(msg, i, true))}
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

				{renderInput(true)}
			</div>
		);
	}

	// ─── Expanded view with sidebar ───────────────────────────────────────────
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="flex h-[85vh] w-[88vw] max-w-[1200px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">

				{/* ── Sidebar ── */}
				<div className="flex w-[260px] flex-shrink-0 flex-col border-r border-white/10 bg-slate-950">
					<div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/15">
								<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
							</div>
							<span className="font-semibold text-white">Zoe</span>
						</div>
						<button onClick={startNewConversation} title="New conversation" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
							<Edit3 className="h-4 w-4" />
						</button>
					</div>

					<div className="px-3 pt-3">
						<button
							onClick={startNewConversation}
							className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
						>
							<Plus className="h-4 w-4" />
							New conversation
						</button>
					</div>

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
									<div
										key={conv.id}
										className={`group relative flex items-center rounded-xl transition ${
											conversationId === conv.id
												? "bg-white/[0.08]"
												: "hover:bg-white/[0.04]"
										}`}
									>
										{renamingId === conv.id ? (
											<div className="flex flex-1 items-center gap-1 px-3 py-2">
												<input
													ref={renameInputRef}
													value={renameValue}
													onChange={e => setRenameValue(e.target.value)}
													onKeyDown={e => {
														if (e.key === "Enter") void commitRename(conv.id);
														if (e.key === "Escape") setRenamingId(null);
													}}
													onBlur={() => void commitRename(conv.id)}
													className="flex-1 rounded-lg border border-emerald-500/40 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none"
												/>
											</div>
										) : (
											<button
												onClick={() => loadConversation(conv)}
												className="flex-1 min-w-0 px-3 py-2.5 text-left"
											>
												<p className={`truncate text-sm font-medium leading-snug ${
													conversationId === conv.id ? "text-white" : "text-slate-400"
												}`}>{conv.title}</p>
												<p className="mt-0.5 text-[11px] text-slate-600">{timeAgo(conv.updated_at)}</p>
											</button>
										)}

										{/* Context menu trigger */}
										{renamingId !== conv.id && (
											<div className="relative flex-shrink-0 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													onClick={e => {
														e.stopPropagation();
														setOpenMenuId(openMenuId === conv.id ? null : conv.id);
													}}
													className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
												>
													<MoreHorizontal className="h-3.5 w-3.5" />
												</button>

												{openMenuId === conv.id && (
													<div className="absolute right-0 top-8 z-10 min-w-[120px] rounded-xl border border-white/10 bg-slate-900 py-1 shadow-2xl">
														<button
															onClick={e => startRename(conv, e)}
															className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
														>
															<Edit3 className="h-3.5 w-3.5" />
															Rename
														</button>
														<button
															onClick={e => void deleteConversation(conv.id, e)}
															className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10"
														>
															<Trash2 className="h-3.5 w-3.5" />
															Delete
														</button>
													</div>
												)}
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* ── Main chat ── */}
				<div className="flex flex-1 flex-col">
					<div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
						<div>
							<p className="font-semibold text-white">
								{conversations.find(c => c.id === conversationId)?.title || "Zoe"}
							</p>
							<p className="text-xs text-emerald-300">Your travel agent</p>
						</div>
						<div className="flex items-center gap-2">
							<button onClick={() => setExpanded(false)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white" title="Compact view">
								<Minimize2 className="h-5 w-5" />
							</button>
							<button onClick={() => { setIsOpen(false); setExpanded(false); }} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
								<X className="h-5 w-5" />
							</button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto px-6 py-6">
						{loadingMessages ? (
							<div className="flex h-full items-center justify-center">
								<Loader2 className="h-5 w-5 animate-spin text-slate-500" />
							</div>
						) : (
							<div className="mx-auto max-w-2xl space-y-5">
								{messages.map((msg, i) => renderMessage(msg, i, false))}
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

					{renderInput(false)}
				</div>
			</div>
		</div>
	);
}
