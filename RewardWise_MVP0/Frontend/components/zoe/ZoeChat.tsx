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
	Volume2,
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
	/** Called when Zoe fills the form AND is ready to search — auto-triggers search */
	onAutoSearch?: () => void;
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
		case "speaking":  return "I hear you…";
		case "processing": return "Thinking…";
		case "responding": return "Speaking…";
		default: return "Your travel agent";
	}
}

export default function ZoeChat({
	isOpen,
	setIsOpen,
	onFillSearch,
	onAutoSearch,
	verdictContext,
}: ZoeChatProps) {
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
	/** Whether the Listen audio is playing for the latest verdict */
	const [isListening, setIsListening] = useState(false);
	const listenUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

	const inputRef = useRef<HTMLInputElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const dragStartYRef = useRef<number | null>(null);

	

	// ── NVIDIA Voice Mode ─────────────────────────────────────────────────────
	// ALL mic logic lives here — the old startListening/stopListening is removed.
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
			// ✅ FIXED — parse it first
if (prefillRaw && onFillSearch) {
    let prefill: any = null;
    try { prefill = typeof prefillRaw === "string" ? JSON.parse(prefillRaw) : prefillRaw; } catch { prefill = null; }
    if (prefill) {
        onFillSearch({
            origin: prefill.origin,
            destination: prefill.destination,
            date: prefill.date,
            return_date: prefill.return_date,
            travelers: prefill.travelers,
            cabin: prefill.cabin,
            tripType: prefill.tripType,
        });
        if (prefill.origin && prefill.destination && prefill.date && onAutoSearch) {
            setTimeout(() => onAutoSearch(), 400);
        }
    }
}
		},
		onError: (msg) => {
			setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
		},
	});

	// ── Scroll ────────────────────────────────────────────────────────────────
	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typing]);

	// ── Welcome message ───────────────────────────────────────────────────────
	useEffect(() => {
		if (isOpen && messages.length === 0 && !conversationId && !verdictContext) {
			setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
		}
	}, [isOpen, messages.length, conversationId, verdictContext]);

	// ── Verdict context injection ─────────────────────────────────────────────
	useEffect(() => {
		if (!verdictContext) return;
		setConversationId(null);
		setMessages([{
			role: "assistant",
			content: `I can see the result from your search. ${verdictContext} What would you like to know about it?`,
		}]);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [verdictContext]);

	// ── Focus / keyboard ──────────────────────────────────────────────────────
	useEffect(() => {
		if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
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
		return () => { window.speechSynthesis?.cancel(); };
	}, []);

	// ── Close menu outside click ──────────────────────────────────────────────
	useEffect(() => {
		if (!openMenuId) return;
		const handler = () => setOpenMenuId(null);
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [openMenuId]);

	useEffect(() => {
		if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 50);
	}, [renamingId]);

	// ── Drag handle (mobile) ──────────────────────────────────────────────────
	const handleDragHandleTouchStart = (e: React.TouchEvent) => {
		dragStartYRef.current = e.touches[0].clientY;
	};
	const handleDragHandleTouchEnd = (e: React.TouchEvent) => {
		if (dragStartYRef.current === null) return;
		const deltaY = e.changedTouches[0].clientY - dragStartYRef.current;
		dragStartYRef.current = null;
		if (deltaY > 60) setIsOpen(false);
	};

	// ── Sidebar conversations ─────────────────────────────────────────────────
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
					verdict_context: verdictContext || null,
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

				// ── Auto-trigger search when Zoe has all required fields ──────
				// Ticket: "User has to click on search flights — shouldn't Zoe do it?"
				if (prefill.origin && prefill.destination && prefill.date && onAutoSearch) {
					setTimeout(() => onAutoSearch(), 500);
				}
			}

			if (expanded) loadConversations();
		} catch {
			setMessages(prev => [...prev, { role: "assistant", content: "Network error — please try again." }]);
		} finally {
			setTyping(false);
		}
	};

	// ── Listen button (verdict audio) ─────────────────────────────────────────
	// Ticket: "Reposition Listen control above verdict headline"
	// The Listen button is rendered ABOVE the verdict message content (see renderMessage).
	const handleListen = (content: string) => {
		if (isListening) {
			window.speechSynthesis?.cancel();
			setIsListening(false);
			return;
		}
		const utterance = new SpeechSynthesisUtterance(content.replace(/[*_#`>~\[\]()]/g, ""));
		utterance.onend = () => setIsListening(false);
		utterance.onerror = () => setIsListening(false);
		listenUtteranceRef.current = utterance;
		window.speechSynthesis?.speak(utterance);
		setIsListening(true);
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
	const renderMessage = (msg: Message, i: number, compact: boolean) => {
		const isAssistant = msg.role === "assistant";
		const isPrefilled = isAssistant && !!msg.prefilled;

		return (
			<div key={i} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
				{isAssistant && !compact && (
					<div className="mr-3 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
						<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
					</div>
				)}
<div className={`max-w-[85%] break-words ${compact ? "max-w-full" : ""}`}>					{/* ── Listen button ABOVE content (Ticket: reposition above headline) ── */}
					{isAssistant && isPrefilled && (
						<button
							onClick={() => handleListen(msg.content)}
							aria-label="Listen"
							className="mb-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
						>
							<Volume2 className="h-3 w-3" />
							{isListening ? "Stop" : "Listen"}
						</button>
					)}
					<div
						className={`rounded-2xl border px-4 ${compact ? "py-2" : "py-3"} ${
							isAssistant
								? isPrefilled
									? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
									: "border-white/10 bg-white/[0.04] text-slate-200"
								: "border-blue-500/30 bg-blue-500/15 text-white"
						} text-sm leading-relaxed`}
					>
						{isAssistant ? (
							<ReactMarkdown
								components={{
									p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
									strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
								}}
							>
								{msg.content}
							</ReactMarkdown>
						) : (
							<span>{msg.content}</span>
						)}
					</div>
				</div>
			</div>
		);
	};

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

	// ── Voice orb (full voice mode panel) ────────────────────────────────────
	const renderVoiceOrb = () => {
		const orbColor =
			voiceState === "speaking"   ? "bg-rose-500/20 ring-4 ring-rose-400/30" :
			voiceState === "responding" ? "bg-emerald-500/20 ring-4 ring-emerald-400/30 animate-pulse" :
			voiceState === "processing" ? "bg-amber-500/20 ring-4 ring-amber-400/30" :
			"bg-white/5 ring-1 ring-white/10 animate-pulse";

		return (
			<div className="flex flex-col items-center justify-center gap-3 border-t border-white/10 py-5">
				<div className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${orbColor}`}>
					{voiceState === "processing" ? (
						<span className="block h-6 w-6 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
					) : (
						<Sparkles className={`h-7 w-7 ${
							voiceState === "responding" ? "text-emerald-300" :
							voiceState === "speaking"   ? "text-rose-300" : "text-slate-400"
						}`} />
					)}
				</div>
				<p className="text-sm text-slate-400">{voiceStatusLabel(voiceState)}</p>
				{liveTranscript && (
					<p className="max-w-[85%] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs text-slate-300">
						Heard: "{liveTranscript}"
					</p>
				)}
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
				{/* Mic — uses useZoeVoice exclusively. Clicking toggles voice mode. */}
				<button
					onClick={toggleVoiceMode}
					title={voiceMode ? "Exit voice mode" : "Start voice conversation"}
					className={`flex flex-shrink-0 items-center justify-center rounded-xl border px-3 ${compact ? "py-2" : "py-3"} transition ${
						voiceMode
							? voiceState === "speaking"   ? "animate-pulse border-rose-400/50 bg-rose-500/10 text-rose-300"
							: voiceState === "responding" ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
							: voiceState === "processing" ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
							: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
							: "border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300"
					}`}
					aria-label={voiceMode ? "Exit voice mode" : "Start voice conversation"}
				>
					{voiceMode
						? voiceState === "processing"
							? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							: voiceState === "speaking" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />
						: <Radio className="h-4 w-4" />
					}
				</button>

				<input
					ref={inputRef}
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => { if (e.key === "Enter") void sendText(input); }}
					placeholder={
						voiceState === "speaking"   ? "I hear you…" :
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
				{voiceMode ? "Voice mode active — just talk · text still works too" : "Tap the mic icon to have a voice conversation with Zoe"}
			</p>
		</div>
	);

	// ── Header ────────────────────────────────────────────────────────────────
	// Ticket: "Zoe close and expand buttons not visible at 90%/100% zoom"
	// Fixed: Use flex-shrink-0 on button container + min-w-0 on title to prevent overflow.
	const renderHeader = (compact: boolean) => (
		<div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
			<div className="flex min-w-0 items-center gap-3">
				<div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
					voiceState === "responding" ? "animate-pulse border-emerald-400/40 bg-emerald-500/25" :
					voiceState === "speaking"   ? "animate-pulse border-rose-400/30 bg-rose-500/15" :
					"border-emerald-400/20 bg-emerald-500/15"
				}`}>
					<Sparkles className={`h-4 w-4 transition-colors ${
						voiceState === "responding" ? "text-emerald-300" :
						voiceState === "speaking"   ? "text-rose-300" : "text-emerald-300"
					}`} />
				</div>
				<div className="min-w-0">
					<p className="truncate font-semibold leading-none text-white">Zoe</p>
					<p className="mt-0.5 truncate text-[11px] text-emerald-300">{voiceStatusLabel(voiceState)}</p>
				</div>
			</div>

			{/* Button row — flex-shrink-0 ensures buttons NEVER get pushed out at any zoom level */}
			<div className="flex flex-shrink-0 items-center gap-1 pl-2">
				<button
					onClick={toggleVoiceMode}
					title={voiceMode ? "Exit voice mode" : "Start voice conversation"}
					className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${
						voiceMode ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400 hover:text-slate-200"
					}`}
					aria-label={voiceMode ? "Exit voice mode" : "Start voice conversation"}
				>
					<Radio className="h-4 w-4" />
				</button>
				{compact && (
					<button
						onClick={() => setExpanded(true)}
						className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
						aria-label="Expand"
						title="Expand"
					>
						<Maximize2 className="h-4 w-4" />
					</button>
				)}
				{!compact && (
					<button
						onClick={() => setExpanded(false)}
						className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
						aria-label="Collapse"
						title="Collapse"
					>
						<Minimize2 className="h-4 w-4" />
					</button>
				)}
				<button
					onClick={() => { setIsOpen(false); setExpanded(false); }}
					className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
					aria-label="Close Zoe"
					title="Close"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);

	// ── Compact panel ─────────────────────────────────────────────────────────
	if (!expanded) {
		return (
			<div
				className="fixed bottom-6 right-6 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl"
				style={{ maxHeight: "min(520px, calc(100dvh - 5rem))" }}
			>
				<div
					className="flex justify-center py-2 sm:hidden"
					onTouchStart={handleDragHandleTouchStart}
					onTouchEnd={handleDragHandleTouchEnd}
				>
					<div className="h-1 w-10 rounded-full bg-white/20" />
				</div>

				{renderHeader(true)}

				{voiceMode ? (
					renderVoiceOrb()
				) : (
					<div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
						{messages.map((msg, i) => renderMessage(msg, i, true))}
						{typing && renderTypingDots(false)}
						<div ref={endRef} />
					</div>
				)}

				{renderInput(true)}
			</div>
		);
	}

	// ── Expanded panel (with sidebar) ─────────────────────────────────────────
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:items-center sm:justify-center sm:p-6">
			<div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-white/10 bg-[#0f1117] shadow-2xl sm:h-[min(700px,90dvh)] sm:w-[min(900px,95vw)] sm:rounded-2xl">
				{renderHeader(false)}

				<div className="flex flex-1 overflow-hidden">
					{/* Sidebar */}
					<div className="hidden w-64 flex-shrink-0 flex-col border-r border-white/10 sm:flex">
						<div className="flex items-center justify-between px-4 py-3">
							<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conversations</span>
							<button
								onClick={startNewConversation}
								className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-white"
								title="New conversation"
							>
								<Plus className="h-3.5 w-3.5" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto">
							{loadingConvs ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-4 w-4 animate-spin text-slate-500" />
								</div>
							) : conversations.length === 0 ? (
								<p className="px-4 py-3 text-xs text-slate-600">No conversations yet</p>
							) : (
								conversations.map(conv => (
									<div
										key={conv.id}
										onClick={() => loadConversation(conv)}
										className={`group relative flex cursor-pointer items-center gap-2 px-4 py-2.5 hover:bg-white/[0.04] ${
											conv.id === conversationId ? "bg-white/[0.06]" : ""
										}`}
									>
										{renamingId === conv.id ? (
											<input
												ref={renameInputRef}
												value={renameValue}
												onChange={e => setRenameValue(e.target.value)}
												onBlur={() => commitRename(conv.id)}
												onKeyDown={e => {
													if (e.key === "Enter") commitRename(conv.id);
													if (e.key === "Escape") setRenamingId(null);
												}}
												onClick={e => e.stopPropagation()}
												className="flex-1 rounded border border-emerald-500/50 bg-transparent px-1 py-0.5 text-xs text-white outline-none"
											/>
										) : (
											<>
												<span className="flex-1 truncate text-xs text-slate-300">{conv.title}</span>
												<span className="flex-shrink-0 text-[10px] text-slate-600">{timeAgo(conv.updated_at)}</span>
												<button
													onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === conv.id ? null : conv.id); }}
													className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition"
												>
													<MoreHorizontal className="h-3.5 w-3.5 text-slate-500" />
												</button>
											</>
										)}
										{openMenuId === conv.id && (
											<div className="absolute right-2 top-8 z-10 rounded-lg border border-white/10 bg-[#1a1d27] py-1 shadow-xl">
												<button onClick={e => startRename(conv, e)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">
													<Edit3 className="h-3 w-3" /> Rename
												</button>
												<button onClick={e => deleteConversation(conv.id, e)} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-white/[0.06]">
													<Trash2 className="h-3 w-3" /> Delete
												</button>
											</div>
										)}
									</div>
								))
							)}
						</div>
					</div>

					{/* Main chat area */}
					<div className="flex flex-1 flex-col overflow-hidden">
						{voiceMode ? (
							renderVoiceOrb()
						) : (
							<div className="flex-1 space-y-4 overflow-y-auto p-6">
								{loadingMessages ? (
									<div className="flex items-center justify-center py-12">
										<Loader2 className="h-5 w-5 animate-spin text-slate-500" />
									</div>
								) : (
									messages.map((msg, i) => renderMessage(msg, i, false))
								)}
								{typing && renderTypingDots(true)}
								<div ref={endRef} />
							</div>
						)}
						{renderInput(false)}
					</div>
				</div>
			</div>
		</div>
	);
}
