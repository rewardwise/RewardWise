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
	Mic,
	MicOff,
	Minimize2,
	MoreHorizontal,
	Plus,
	Radio,
	Send,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useZoeVoice, VoiceState } from "@/hooks/useZoeVoice";

const supabase = createClient();

export interface Message {
	role: "user" | "assistant";
	content: string;
	prefilled?: boolean;
}

interface Conversation {
	id: string;
	title: string;
	updated_at: string;
}

interface ZoeChatProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	verdictContext?: string | null;
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

const WELCOME_MESSAGE =
	"Hey! I'm Zoe. Tell me about the trip you're thinking about — I'll help you plan it and fill in the search form when you're ready.";

function voiceStatusLabel(state: VoiceState): string {
	switch (state) {
		case "listening": return "Listening…";
		case "speaking": return "I hear you…";
		case "processing": return "Thinking…";
		case "responding": return "Speaking…";
		default: return "Your travel agent";
	}
}

export default function ZoeChat({ isOpen, setIsOpen, onFillSearch, verdictContext }: ZoeChatProps) {
	const { user } = useAuth();
	const { cards } = useWallet();

	const [expanded, setExpanded] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [loadingConvs, setLoadingConvs] = useState(false);
	const [loadingMessages, setLoadingMessages] = useState(false);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);

	const inputRef = useRef<HTMLInputElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const dragStartYRef = useRef<number | null>(null);

	// ── NVIDIA Voice Mode ─────────────────────────────────────────────────────
	const { voiceMode, voiceState, liveTranscript, toggleVoiceMode, interrupt } = useZoeVoice({
		conversationId,
		history: messages.map((m) => ({ role: m.role, content: m.content })),
		onTurn: ({ transcript, reply, prefill: prefillRaw }) => {
			if (transcript) {
				setMessages((prev) => [...prev, { role: "user", content: transcript }]);
			}
			if (reply) {
				setMessages((prev) => [
					...prev,
					{ role: "assistant", content: reply, prefilled: !!prefillRaw },
				]);
			}
			if (prefillRaw && onFillSearch) {
				try { onFillSearch(JSON.parse(prefillRaw)); } catch { /* not a prefill */ }
			}
			if (expanded) loadConversations();
		},
		onError: (msg) => {
			setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
		},
	});

	// ── Drag handle ───────────────────────────────────────────────────────────
	const handleDragHandleTouchStart = (e: React.TouchEvent) => {
		dragStartYRef.current = e.touches[0].clientY;
	};
	const handleDragHandleTouchEnd = (e: React.TouchEvent) => {
		if (dragStartYRef.current === null) return;
		const deltaY = e.changedTouches[0].clientY - dragStartYRef.current;
		dragStartYRef.current = null;
		if (deltaY > 60) setIsOpen(false);
	};

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typing]);

	useEffect(() => {
		if (isOpen && messages.length === 0 && !conversationId && !verdictContext) {
			setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		}
	}, [isOpen, messages.length, conversationId, verdictContext]);

	useEffect(() => {
		if (!verdictContext) return;
		setConversationId(null);
		setMessages([{
			role: "assistant",
			content: `I can see the result from your search. ${verdictContext} What would you like to know about it?`,
		}]);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [verdictContext]);

	useEffect(() => {
		if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
		        fetch("/api/zoe-warm", { method: "GET", cache: "no-store" }).catch(() => {});
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") { setIsOpen(false); setExpanded(false); }
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, setIsOpen]);

	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	useEffect(() => {
		if (!openMenuId) return;
		const handler = () => setOpenMenuId(null);
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [openMenuId]);

	useEffect(() => {
		if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 50);
	}, [renamingId]);

	// ── Sidebar ───────────────────────────────────────────────────────────────
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

	const deleteConversation = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setOpenMenuId(null);
		const { error } = await supabase.from("zoe_conversations").delete().eq("id", id);
		if (error) { console.error("Delete failed:", error); return; }
		if (conversationId === id) {
			setConversationId(null);
			setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		}
		setConversations(prev => prev.filter(c => c.id !== id));
	};

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

	// ── Send text message ─────────────────────────────────────────────────────
	const sendText = async (text: string) => {
		if (typing || !text.trim()) return;
		const trimmed = text.trim();

		setMessages(prev => [...prev, { role: "user", content: trimmed }]);
		setInput("");
		setTyping(true);

		let convId = conversationId;
		if (!convId && user) {
			const { data, error } = await supabase
				.from("zoe_conversations")
				.insert({ user_id: user.id, title: "New conversation" })
				.select("id")
				.single();
			if (!error && data) { convId = data.id; setConversationId(convId); }
		}

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

			setMessages(prev => [...prev, { role: "assistant", content: reply, prefilled: !!prefill }]);

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
			if (expanded) loadConversations();
		} catch {
			setMessages(prev => [...prev, { role: "assistant", content: "Network error — please try again." }]);
		} finally {
			setTyping(false);
		}
	};

	// ── Closed FAB ────────────────────────────────────────────────────────────
	if (!isOpen) {
		return (
			<button
				onClick={() => setIsOpen(true)}
				aria-label="Open Zoe"
				className="animate-zoe-pulse fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl transition-colors hover:bg-emerald-600"
			>
				<Sparkles className="h-6 w-6" />
			</button>
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

	// ── Voice mode overlay ────────────────────────────────────────────────────
	const renderVoiceOverlay = () => {
		if (!voiceMode) return null;

		const orbColor =
			voiceState === "speaking" ? "bg-rose-500/20 ring-4 ring-rose-400/50 animate-pulse" :
			voiceState === "responding" ? "bg-emerald-500/20 ring-4 ring-emerald-400/50 animate-pulse" :
			voiceState === "processing" ? "bg-amber-500/20 ring-4 ring-amber-400/30" :
			"bg-white/5 ring-1 ring-white/10 animate-pulse";

		const iconColor =
			voiceState === "speaking" ? "text-rose-300" :
			voiceState === "responding" ? "text-emerald-300" :
			voiceState === "processing" ? "text-amber-300" :
			"text-slate-400";

		return (
			<div className="flex flex-col items-center justify-center gap-3 border-t border-white/10 py-5">
				{/* Animated orb */}
				<div className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${orbColor}`}>
					{voiceState === "processing" ? (
						<span className="block h-6 w-6 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
					) : (
						<Sparkles className={`h-7 w-7 transition-colors ${iconColor}`} />
					)}
				</div>

				{/* Status */}
				<p className="text-sm text-slate-400">{voiceStatusLabel(voiceState)}</p>

				{liveTranscript && (
					<p className="max-w-[85%] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs text-slate-300">
						Heard: “{liveTranscript}”
					</p>
				)}

				{/* Interrupt button — only show when Zoe is speaking */}
				{voiceState === "responding" && (
					<button
						onClick={interrupt}
						className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
					>
						Interrupt
					</button>
				)}

				<p className="text-[11px] text-slate-600">
					{voiceState === "responding" ? "Tap interrupt or just start talking" : "Just talk — Zoe listens automatically"}
				</p>
			</div>
		);
	};

	// ── Input bar ─────────────────────────────────────────────────────────────
	const renderInput = (compact: boolean) => (
		<div className={`border-t border-white/10 ${compact ? "p-3" : "p-4"}`}>
			<div className={`flex gap-2 ${!compact ? "mx-auto max-w-2xl" : ""}`}>
				{/* Mic indicator — shows state in voice mode, non-interactive */}
				{voiceMode ? (
					<div className={`flex flex-shrink-0 items-center justify-center rounded-xl border px-3 ${compact ? "py-2" : "py-3"} ${
						voiceState === "speaking"
							? "animate-pulse border-rose-400/50 bg-rose-500/10 text-rose-300"
							: voiceState === "responding"
							? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
							: voiceState === "processing"
							? "border-amber-400/50 bg-amber-500/10 text-amber-300"
							: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
					}`}>
						{voiceState === "processing" ? (
							<span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : voiceState === "speaking" ? (
							<MicOff className="h-4 w-4" />
						) : (
							<Mic className="h-4 w-4" />
						)}
					</div>
				) : null}

				<input
					ref={inputRef}
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => { if (e.key === "Enter") void sendText(input); }}
					placeholder={
						voiceState === "speaking" ? "I hear you…" :
						voiceState === "responding" ? "Zoe is speaking…" :
						voiceState === "processing" ? "Thinking…" :
						voiceMode ? "Or type here…" :
						"Tell Zoe about your trip…"
					}
					className={`flex-1 rounded-xl border border-white/10 bg-white/[0.03] ${compact ? "px-3 py-2 text-sm" : "px-5 py-3 text-base"} text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500`}
				/>
				<button
					onClick={() => void sendText(input)}
					disabled={!input.trim() || typing}
					className={`flex-shrink-0 rounded-xl bg-emerald-500 ${compact ? "px-3 py-2" : "px-4 py-3"} text-white transition hover:bg-emerald-400 disabled:bg-slate-700`}
				>
					<Send className="h-4 w-4" />
				</button>
			</div>
			<p className={`mt-2 text-center text-[11px] text-slate-600 ${!compact ? "mx-auto max-w-2xl" : ""}`}>
				{compact ? (
					<>
						<button onClick={() => setExpanded(true)} className="hidden sm:inline text-emerald-600 hover:text-emerald-400">Expand</button>
						<span className="hidden sm:inline"> for full view · </span>
						{voiceMode ? "Voice mode active — just talk" : "Tap the 📡 icon to talk with Zoe"}
					</>
				) : (
					voiceMode ? "Voice mode active — just talk · text still works too" : "Tap the 📡 icon to have a natural voice conversation with Zoe"
				)}
			</p>
		</div>
	);

	// ── Header (shared) ───────────────────────────────────────────────────────
	const renderHeader = (compact: boolean) => (
		<div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
			<div className="flex items-center gap-3">
				<div className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ${
					voiceState === "responding"
						? "animate-pulse border-emerald-400/40 bg-emerald-500/25"
						: voiceState === "speaking"
						? "animate-pulse border-rose-400/30 bg-rose-500/15"
						: "border-emerald-400/20 bg-emerald-500/15"
				}`}>
					<Sparkles className={`h-4 w-4 transition-colors ${
						voiceState === "responding" ? "text-emerald-300" :
						voiceState === "speaking" ? "text-rose-300" :
						"text-emerald-300"
					}`} />
				</div>
				<div>
					<p className="font-semibold text-white leading-none">Zoe</p>
					<p className="text-[11px] mt-0.5 text-emerald-300">{voiceStatusLabel(voiceState)}</p>
				</div>
			</div>
			<div className="flex items-center gap-1">
				{/* Voice toggle */}
				<button
					onClick={toggleVoiceMode}
					title={voiceMode ? "Exit voice mode" : "Start voice conversation"}
					className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
						voiceMode ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400 hover:text-slate-200"
					}`}
				>
					<Radio className="h-4 w-4" />
				</button>
				{compact && (
					<button
						onClick={() => setExpanded(true)}
						className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
						title="Expand"
					>
						<Maximize2 className="h-4 w-4" />
					</button>
				)}
				<button
					onClick={() => { setIsOpen(false); setExpanded(false); }}
					className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);

	// ── Typing dots ───────────────────────────────────────────────────────────
	const renderTypingDots = (withAvatar: boolean) => (
		<div className="flex justify-start">
			{withAvatar && (
				<div className="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
					<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
				</div>
			)}
			<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
				<div className="flex gap-1">
					<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
					<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
					<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
				</div>
			</div>
		</div>
	);

	// ── Compact popup ─────────────────────────────────────────────────────────
	if (!expanded) {
		return (
			<>
				<div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:hidden" aria-hidden="true" />
				<div
					role="dialog"
					aria-modal="true"
					aria-label="Zoe chat"
					className="fixed z-50 flex flex-col border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur inset-x-0 bottom-0 h-[75vh] rounded-t-3xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[390px] sm:rounded-3xl"
				>
					<div onTouchStart={handleDragHandleTouchStart} onTouchEnd={handleDragHandleTouchEnd} className="flex justify-center pt-2 pb-1 sm:hidden touch-none" aria-hidden="true">
						<div className="h-1 w-12 rounded-full bg-white/20" />
					</div>

					{renderHeader(true)}

					<div className="flex-1 overflow-y-auto px-4 py-4">
						<div className="space-y-3">
							{messages.map((m, i) => renderMessage(m, i, true))}
							{typing && renderTypingDots(false)}
							<div ref={endRef} />
						</div>
					</div>

					{renderVoiceOverlay()}
					{renderInput(true)}
				</div>
			</>
		);
	}

	// ── Expanded view ─────────────────────────────────────────────────────────
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="flex h-[85vh] w-[88vw] max-w-[1200px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">

				{/* Sidebar */}
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
						<button onClick={startNewConversation} className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
							<Plus className="h-4 w-4" />
							New conversation
						</button>
					</div>

					<div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
						{loadingConvs ? (
							<div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
						) : conversations.length === 0 ? (
							<p className="px-2 py-4 text-xs text-slate-600">No conversations yet.</p>
						) : (
							<div className="space-y-0.5">
								{conversations.map(conv => (
									<div key={conv.id} className={`group relative flex items-center rounded-xl transition ${conversationId === conv.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
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
											<button onClick={() => loadConversation(conv)} className="flex-1 min-w-0 px-3 py-2.5 text-left">
												<p className={`truncate text-sm font-medium leading-snug ${conversationId === conv.id ? "text-white" : "text-slate-400"}`}>{conv.title}</p>
												<p className="mt-0.5 text-[11px] text-slate-600">{timeAgo(conv.updated_at)}</p>
											</button>
										)}
										{renamingId !== conv.id && (
											<div className="relative flex-shrink-0 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === conv.id ? null : conv.id); }}
													className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.08] hover:text-slate-300"
												>
													<MoreHorizontal className="h-3.5 w-3.5" />
												</button>
												{openMenuId === conv.id && (
													<div className="absolute right-0 top-8 z-10 min-w-[120px] rounded-xl border border-white/10 bg-slate-900 py-1 shadow-2xl">
														<button onClick={e => startRename(conv, e)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white">
															<Edit3 className="h-3.5 w-3.5" /> Rename
														</button>
														<button onClick={e => void deleteConversation(conv.id, e)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10">
															<Trash2 className="h-3.5 w-3.5" /> Delete
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

				{/* Main chat */}
				<div className="flex flex-1 flex-col">
					<div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
						<div>
							<p className="font-semibold text-white">{conversations.find(c => c.id === conversationId)?.title || "Zoe"}</p>
							<p className="text-xs text-emerald-300">{voiceStatusLabel(voiceState)}</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={toggleVoiceMode}
								title={voiceMode ? "Exit voice mode" : "Start voice conversation"}
								className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
									voiceMode ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
								}`}
							>
								<Radio className="h-4 w-4" />
							</button>
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
							<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
						) : (
							<div className="mx-auto max-w-2xl space-y-4">
								{messages.map((m, i) => renderMessage(m, i, false))}
								{typing && renderTypingDots(true)}
								<div ref={endRef} />
							</div>
						)}
					</div>

					{renderVoiceOverlay()}
					{renderInput(false)}
				</div>
			</div>
		</div>
	);
}
