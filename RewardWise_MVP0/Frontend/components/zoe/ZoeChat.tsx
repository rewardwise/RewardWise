/** @format */

"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import ReactMarkdown from "react-markdown";
import {
	MessageCircle,
	Sparkles,
	Minimize2,
	Maximize2,
	X,
	Zap,
	Loader2,
	Mic,
	MicOff,
	Send,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

async function getAuthHeaders(): Promise<Record<string, string>> {
	const { data } = await supabase.auth.getSession();
	const token = data?.session?.access_token;
	return {
		"Content-Type": "application/json",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickSearch {
	label: string;
	data: {
		origin: string;
		destination: string;
		cabin: string;
		travelers: string;
		dates: string;
		programs: string[];
	};
}

interface DestSuggestion {
	emoji: string;
	label: string;
	query: string;
}

interface MessageAction {
	label: string;
	handler: () => void;
}

export interface Message {
	role: "user" | "assistant" | "steps";
	content: string;
	action?: MessageAction | null;
	suggestions?: DestSuggestion[] | null;
	dropdown?: {
		type:
			| "origin"
			| "destination"
			| "travelers"
			| "tripType"
			| "cabin"
			| "date"
			| "returnDate";
		options: string[];
	} | null;
}

interface FillData {
	origin?: string;
	destination?: string;
	date?: string;
	cabin?: string;
	travelers?: number;
	return_date?: string;
	tripType?: "oneway" | "roundtrip";
}

interface ZoeChatProps {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	onFillSearch?: (data: FillData) => void;
	onTriggerSearch?: () => void;
	currentPage?: string;
	messages: Message[];
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	isAuthenticated?: boolean;
	cards?: any[];
}

function mapUIToDropdown(ui: any) {
	if (!ui || !ui.input_type) return null;
	return {
		type: ui.input_type,
		options: ui.options || [],
	};
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ZoeChat({
	isOpen,
	setIsOpen,
	onFillSearch,
	onTriggerSearch,
	currentPage,
	messages,
	setMessages,
	isAuthenticated = false,
}: ZoeChatProps) {
	const [showChips, setShowChips] = useState(true);
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const [listening, setListening] = useState(false);
	const [nudgeVisible, setNudgeVisible] = useState(true);
	const [expanded, setExpanded] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const { cards } = useWallet();
	const recognitionRef = useRef<SpeechRecognition | null>(null);

	// Plain object preserves snake_case keys from backend (e.g. return_date)
	const [selected, setSelected] = useState<Record<string, any>>({});

	const LABEL_MAP: Record<string, string> = {
		origin: "From",
		destination: "To",
		tripType: "Trip",
		date: "Departure",
		returnDate: "Return",
		return_date: "Return",
		travelers: "Travelers",
		cabin: "Cabin",
	};

	useEffect(() => {
		if (isOpen && inputRef.current) inputRef.current.focus();
	}, [isOpen]);

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		if (isOpen) setNudgeVisible(false);
		const timer = setTimeout(() => setNudgeVisible(false), 12000);
		return () => clearTimeout(timer);
	}, [isOpen]);

	// -------------------------------------------------------------------------
	// Speech recognition
	// -------------------------------------------------------------------------
	const startListening = () => {
		try {
			const SpeechRecognitionAPI =
				window.SpeechRecognition || window.webkitSpeechRecognition;

			if (!SpeechRecognitionAPI) {
				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content:
							"Speech recognition isn't available in this browser. Try Chrome on desktop. On iOS, please type instead.",
					},
				]);
				return;
			}

			const recognition = new SpeechRecognitionAPI();
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.lang = "en-US";
			recognition.maxAlternatives = 1;

			recognition.onresult = (event) => {
				const transcript = Array.from(event.results)
					.map((r) => r[0].transcript)
					.join("");
				setInput(transcript);
				if (event.results[0].isFinal) {
					setTimeout(() => sendText(transcript), 100);
				}
			};

			recognition.onerror = (e) => {
				console.warn("Speech error:", e.error);
				if (e.error === "not-allowed") {
					setListening(false);
					setMessages((prev) => [
						...prev,
						{
							role: "assistant",
							content:
								"Microphone access was denied. Allow it in browser settings and try again.",
						},
					]);
				}
			};

			recognition.onend = () => {
				if (listening) recognition.start();
			};

			recognitionRef.current = recognition;
			recognition.start();
			setListening(true);
		} catch (err) {
			console.error("Speech recognition error:", err);
			setListening(false);
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content:
						"Speech recognition isn't supported on this device. Please type instead.",
				},
			]);
		}
	};

	const stopListening = () => {
		recognitionRef.current?.stop();
		setListening(false);
	};

	// -------------------------------------------------------------------------
	// Shared: apply backend response to state + UI
	// -------------------------------------------------------------------------
	const applyBackendResponse = (data: any) => {
		if (data.params) {
			// Merge — never lose existing slots
			setSelected((prev) => ({ ...prev, ...data.params }));
			// Sync the search form
			onFillSearch?.(data.params);
		}

		// Show Zoe's reply in chat first
		setMessages((prev) => [
			...prev,
			{
				role: "assistant",
				content: data.message || "Something went wrong",
				dropdown: mapUIToDropdown(data.dropdown),
			},
		]);

		// Delay search trigger by one tick so React can flush the onFillSearch
		// state update before the form validation runs.
		// Without this delay, onTriggerSearch fires before return_date is in the
		// form state and "Please select a return date" fires incorrectly.
		if (data.type === "search_result") {
			setTimeout(() => onTriggerSearch?.(), 50);
		}
	};

	// -------------------------------------------------------------------------
	// Dropdown selection
	// -------------------------------------------------------------------------
	const handleDropdownSelect = async (type: string, value: string) => {
		if (typing || !value) return;

		setMessages((prev) => [
			...prev.map((m) =>
				m.dropdown ? { ...m, dropdown: null, action: null } : m,
			),
			{
				role: "user",
				content: `${LABEL_MAP[type] || type}: ${value}`,
			},
		]);
		setTyping(true);

		const headers = await getAuthHeaders();
		const res = await fetch("/api/zoe", {
			method: "POST",
			headers,
			body: JSON.stringify({
				message: value,
				slot: type,
				slots: selected,
				history: messages,
				wallet: (cards || []).map((c: any) => ({
					program: c.program_name,
					points: c.points_balance,
				})),
			}),
		});

		if (!res.ok) {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Server error. Please try again." },
			]);
			setTyping(false);
			return;
		}

		let data;
		try {
			data = await res.json();
		} catch {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: "Something went wrong. Please try again.",
				},
			]);
			setTyping(false);
			return;
		}

		applyBackendResponse(data);
		setTyping(false);
	};

	// -------------------------------------------------------------------------
	// Send text message
	// -------------------------------------------------------------------------
	const sendText = async (text: string) => {
		if (typing) return;

		setMessages((prev) => [...prev, { role: "user", content: text }]);
		setInput("");
		setShowChips(false);
		setTyping(true);

		let res;
		try {
			const headers = await getAuthHeaders();
			res = await fetch("/api/zoe", {
				method: "POST",
				headers,
				body: JSON.stringify({
					message: text,
					slot: null,
					slots: selected,
					history: messages,
					wallet: (cards || []).map((c: any) => ({
						program: c.program_name,
						points: c.points_balance,
					})),
				}),
			});
		} catch {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Network error. Check connection." },
			]);
			setTyping(false);
			return;
		}

		if (!res.ok) {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Server error. Please try again." },
			]);
			setTyping(false);
			return;
		}

		let data;
		try {
			data = await res.json();
		} catch {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Invalid server response." },
			]);
			setTyping(false);
			return;
		}

		applyBackendResponse(data);
		setTyping(false);
	};

	const send = () => {
		if (typing || !input.trim()) return;
		sendText(input.trim());
	};

	useEffect(() => {
		if (isOpen && messages.length === 0) {
			sendText("start");
		}
	}, [isOpen]);

	// -------------------------------------------------------------------------
	// Closed state (FAB)
	// -------------------------------------------------------------------------
	if (!isOpen) {
		return (
			<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
				{nudgeVisible && (
					<div className="bg-gray-900/95 border border-blue-500/40 rounded-xl px-4 py-3 shadow-xl max-w-[240px] animate-fade-in">
						<p className="text-white text-sm font-medium">
							👋 Hey! I&apos;m Zoe
						</p>
						<p className="text-gray-400 text-xs mt-1">
							Your points are probably worth more than you think. Let me prove
							it! ✈️
						</p>
						<div className="absolute -bottom-2 right-8 w-4 h-4 bg-gray-900/95 border-r border-b border-blue-500/40 transform rotate-45" />
					</div>
				)}
				<button
					onClick={() => setIsOpen(true)}
					className="relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-full flex items-center gap-4 px-10 py-5 shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 transition-all duration-300 hover:scale-105 group"
				>
					<div
						className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping"
						style={{ animationDuration: "2s" }}
					/>
					<MessageCircle className="w-9 h-9 text-white" />
					<span className="text-white font-bold text-xl tracking-wide">
						Ask Zoe ✨
					</span>
					<span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
				</button>
			</div>
		);
	}

	// -------------------------------------------------------------------------
	// Open state
	// -------------------------------------------------------------------------
	return (
		<div
			className={`fixed z-50 flex flex-col bg-gray-900/95 backdrop-blur shadow-2xl border border-gray-700 transition-all duration-300 ${
				expanded
					? "top-1/2 left-1/2 w-[1100px] h-[700px] -translate-x-1/2 -translate-y-1/2 rounded-2xl"
					: "bottom-6 right-6 w-[360px] h-[500px] sm:w-[380px] sm:h-[500px] rounded-2xl"
			}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-gray-700">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
						<Sparkles className="w-5 h-5 text-emerald-400" />
					</div>
					<div>
						<p className="text-white font-medium">Zoe</p>
						<p className="text-emerald-400 text-xs">AI Travel Assistant</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setExpanded(!expanded)}
						className="text-gray-400 hover:text-white transition-colors"
						title={expanded ? "Minimize" : "Expand"}
					>
						{expanded ? (
							<Minimize2 className="w-5 h-5" />
						) : (
							<Maximize2 className="w-5 h-5" />
						)}
					</button>
					<button
						onClick={() => {
							setIsOpen(false);
							setExpanded(false);
						}}
						className="text-gray-400 hover:text-white"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className={`${expanded ? "max-w-2xl mx-auto" : ""} space-y-3`}>
					{messages.map((msg, i) => (
						<div
							key={i}
							className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
						>
							<div
								className={`${expanded ? "max-w-[70%]" : "max-w-[85%]"} rounded-2xl px-4 py-2.5 ${
									msg.role === "user"
										? "bg-emerald-500 text-white"
										: msg.role === "steps"
											? "bg-transparent text-emerald-400 text-sm space-y-1"
											: "bg-gray-800 text-gray-200"
								} ${expanded ? "text-base" : ""}`}
							>
								<ReactMarkdown
									components={{
										p: ({ ...props }) => (
											<p className="mb-2 leading-relaxed" {...props} />
										),
										li: ({ ...props }) => (
											<li className="ml-4 list-disc" {...props} />
										),
										strong: ({ ...props }) => (
											<strong className="font-semibold text-white" {...props} />
										),
										h3: ({ ...props }) => (
											<h3 className="font-semibold mt-2 mb-1" {...props} />
										),
									}}
								>
									{msg.content || ""}
								</ReactMarkdown>
							</div>

							{msg.action && (
								<button
									onClick={() => {
										msg.action!.handler();
										setMessages((prev) =>
											prev.map((m, idx) =>
												idx === i ? { ...m, action: null } : m,
											),
										);
									}}
									className="mt-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 px-6 rounded-xl flex items-center gap-2 text-sm transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
								>
									<Zap className="w-4 h-4" /> {msg.action.label}
								</button>
							)}

							{msg.suggestions && (
								<div
									className={`mt-2 flex flex-wrap gap-2 ${
										expanded ? "max-w-[70%]" : "max-w-[85%]"
									}`}
								>
									{msg.suggestions.map((s, si) => (
										<button
											key={si}
											onClick={() => sendText(s.query)}
											className="bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-all hover:scale-105"
										>
											{s.emoji} {s.label}
										</button>
									))}
								</div>
							)}

							{/* Dropdown options rendered inline */}
							{msg.dropdown && (
								<div className="mt-2 flex flex-wrap gap-2">
									{msg.dropdown.options.map((opt) => (
										<button
											key={opt}
											onClick={() =>
												handleDropdownSelect(msg.dropdown!.type, opt)
											}
											className="bg-gray-700 hover:bg-emerald-500/20 border border-gray-600 hover:border-emerald-500/50 text-gray-200 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-all"
										>
											{opt}
										</button>
									))}
								</div>
							)}
						</div>
					))}

					{typing && (
						<div className="flex justify-start">
							<div className="bg-gray-800 rounded-2xl px-4 py-2">
								<Loader2 className="w-4 h-4 animate-spin text-gray-400" />
							</div>
						</div>
					)}

					<div ref={endRef} />
				</div>
			</div>

			{/* Input bar */}
			<div className="p-4 border-t border-gray-700">
				<div className={`flex gap-2 ${expanded ? "max-w-2xl mx-auto" : ""}`}>
					<button
						onClick={listening ? stopListening : startListening}
						className={`p-2 rounded-xl transition-colors flex-shrink-0 ${
							listening
								? "bg-red-500 text-white animate-pulse"
								: "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
						}`}
						aria-label={listening ? "Stop recording" : "Voice input"}
					>
						{listening ? (
							<MicOff className="w-5 h-5" />
						) : (
							<Mic className="w-5 h-5" />
						)}
					</button>
					<input
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") send();
						}}
						placeholder={
							listening ? "Listening..." : "Tell me where you want to fly..."
						}
						className="flex-1 bg-gray-800 border border-gray-700 rounded-xl py-2 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					<button
						onClick={send}
						disabled={!input.trim()}
						className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white p-2 rounded-xl flex-shrink-0"
					>
						<Send className="w-5 h-5" />
					</button>
				</div>
			</div>
		</div>
	);
}
