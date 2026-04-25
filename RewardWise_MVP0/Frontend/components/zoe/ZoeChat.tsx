/** @format */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import ReactMarkdown from "react-markdown";
import {
	Loader2,
	Maximize2,
	MessageCircle,
	Mic,
	MicOff,
	Minimize2,
	Send,
	Sparkles,
	ThumbsDown,
	ThumbsUp,
	Volume2,
	CheckCircle2,
	HelpCircle,
	VolumeX,
	X,
	ArrowRight,
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

interface DestSuggestion {
	emoji: string;
	label: string;
	query: string;
}

interface VerdictPayload {
	verdict?: string;
	verdict_label?: string;
	headline?: string;
	explanation?: string;
	confidence?: "high" | "medium" | "low";
	confidence_reason?: string;
	next_step?: {
		type: string;
		label: string;
		prompt: string;
	} | null;
}

export interface Message {
	role: "user" | "assistant" | "steps";
	content: string;
	suggestions?: DestSuggestion[] | null;
	verdict?: VerdictPayload | null;
	verdictId?: string | null;
	searchId?: string | null;
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

function titleCaseConfidence(value?: string) {
	if (!value) return "Medium";
	return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function cleanVerdictText(value?: string | null) {
	return (value || "")
		.replace(/\bVerdict:\s*[^\n]+/gi, "")
		.replace(/\bConfidence:\s*[^\n]+/gi, "")
		.replace(/\bNumbers:\s*[^\n]+/gi, "")
		.replace(/\bNext step:\s*[^\n]+/gi, "")
		.replace(/\s+/g, " ")
		.trim();
}

function getVerdictLabel(verdict?: VerdictPayload | null) {
	if (!verdict) return "Verdict";
	const raw = `${verdict.verdict_label || ""} ${verdict.verdict || ""}`.toLowerCase();
	if (raw.includes("pay cash")) return "Pay Cash";
	if (raw.includes("use points")) return "Use Points";
	if (raw.includes("wait")) return "Wait";
	return (verdict.verdict_label || verdict.verdict || "Verdict").trim();
}

function getVerdictExplanation(verdict?: VerdictPayload | null, fallback?: string) {
	const candidate = cleanVerdictText(verdict?.explanation || verdict?.headline || fallback || "");
	const label = getVerdictLabel(verdict).toLowerCase();
	if (!candidate) return "";
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return candidate
		.replace(new RegExp(`^${escapedLabel}[.:-\\s]+`, "i"), "")
		.replace(/^pay cash[.:-\s]+/i, "")
		.replace(/^use points[.:-\s]+/i, "")
		.replace(/^wait[.:-\s]+/i, "")
		.replace(/flyingblue/gi, "Flying Blue")
		.replace(/virginatlantic/gi, "Virgin Atlantic")
		.trim();
}

function buildSpeechText(message: Message) {
	if (!message.verdict) return message.content;
	const parts = [
		getVerdictLabel(message.verdict),
		getVerdictExplanation(message.verdict, message.content),
		message.verdict.confidence ? `${titleCaseConfidence(message.verdict.confidence)} confidence.` : "",
		message.verdict.confidence_reason || "",
		message.verdict.next_step?.label ? `Next step: ${message.verdict.next_step.label}.` : "",
	].filter(Boolean);
	return parts.join(" ");
}

function dedupeSuggestions(suggestions?: DestSuggestion[] | null, primaryLabel?: string | null) {
	const seen = new Set<string>();
	const blocked = (primaryLabel || "").trim().toLowerCase();
	return (suggestions || []).filter((suggestion) => {
		const key = suggestion.label.trim().toLowerCase();
		if (!key || key === blocked || seen.has(key)) return false;
		seen.add(key);
		return true;
	}).slice(0, 2);
}

function isAirportCode(value?: string) {
	return typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase()) && !["YES", "YEP", "YEA", "NOO"].includes(value.trim().toUpperCase());
}

function isCleanSearchSync(data: any) {
	const params = data?.params || {};
	if (data?.type !== "search_result") return false;
	return Boolean(isAirportCode(params.origin) && isAirportCode(params.destination));
}

function cleanInternalParams(params: any) {
	if (!params || typeof params !== "object") return {};
	const next = { ...params };
	for (const key of ["origin", "destination"]) {
		if (typeof next[key] === "string") {
			next[key] = next[key].trim().toUpperCase();
			if (["YES", "YEA", "YEP", "NO", "NOPE", "OK", "OKAY"].includes(next[key])) {
				delete next[key];
			}
		}
	}
	return next;
}

export default function ZoeChat({
	isOpen,
	setIsOpen,
	onFillSearch,
	onTriggerSearch,
	messages,
	setMessages,
}: ZoeChatProps) {
	const { cards } = useWallet();
	const [input, setInput] = useState("");
	const [typing, setTyping] = useState(false);
	const [listening, setListening] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [showNudge, setShowNudge] = useState(true);
	const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
	const [feedbackState, setFeedbackState] = useState<Record<number, { rating?: 1 | 5; open?: boolean; comment?: string; saved?: boolean; saving?: boolean; error?: string }>>({});
	const [messageFeedback, setMessageFeedback] = useState<Record<number, "up" | "down">>({});
	const [selected, setSelected] = useState<Record<string, any>>({});

	const inputRef = useRef<HTMLInputElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const pressingRef = useRef(false);

	useEffect(() => {
		if (isOpen) {
			setShowNudge(false);
			inputRef.current?.focus();
		}
	}, [isOpen]);

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, typing]);

	useEffect(() => {
		const timer = setTimeout(() => setShowNudge(false), 12000);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	const speakingAvailable = useMemo(() => typeof window !== "undefined" && "speechSynthesis" in window, []);

	useEffect(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

		const loadVoices = () => {
			window.speechSynthesis.getVoices();
		};

		loadVoices();
		window.speechSynthesis.onvoiceschanged = loadVoices;

		return () => {
			window.speechSynthesis.onvoiceschanged = null;
		};
	}, []);

	const startListening = () => {
		if (typing || listening) return;
		try {
			const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
			if (!SpeechRecognitionAPI) {
				setMessages((prev) => [...prev, { role: "assistant", content: "Speech recognition is not available in this browser. Please type instead." }]);
				return;
			}
			pressingRef.current = true;
			const recognition = new SpeechRecognitionAPI();
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.lang = "en-US";
			recognition.onresult = (event) => {
				const transcript = Array.from(event.results)
					.map((result) => result[0].transcript)
					.join("")
					.trim();
				setInput(transcript);
			};
			recognition.onerror = (event) => {
				setListening(false);
				pressingRef.current = false;
				if (event.error === "not-allowed") {
					setMessages((prev) => [...prev, { role: "assistant", content: "Microphone access was denied. Allow it in your browser settings and try again." }]);
				}
			};
			recognition.onend = () => {
				setListening(false);
				if (pressingRef.current) {
					try {
						recognition.start();
						setListening(true);
					} catch {
						setListening(false);
					}
				}
			};
			recognitionRef.current = recognition;
			recognition.start();
			setListening(true);
		} catch {
			setListening(false);
			pressingRef.current = false;
			setMessages((prev) => [...prev, { role: "assistant", content: "Speech recognition is not supported on this device. Please type instead." }]);
		}
	};

	const stopListening = () => {
		pressingRef.current = false;
		recognitionRef.current?.stop();
		setListening(false);
	};

	const getPreferredZoeVoice = () => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

		const voices = window.speechSynthesis.getVoices();
		const englishVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("en"));
		const preferredFemaleVoiceNames = [
			"zira",
			"jenny",
			"aria",
			"ava",
			"samantha",
			"victoria",
			"susan",
			"karen",
			"moira",
			"tessa",
			"serena",
			"hazel",
			"fiona",
			"allison",
			"joanna",
			"kendra",
			"kimberly",
			"salli",
			"female",
		];

		return (
			englishVoices.find((voice) =>
				preferredFemaleVoiceNames.some((name) => voice.name.toLowerCase().includes(name))
			) ||
			englishVoices.find((voice) => !/david|mark|daniel|alex|fred|tom|male/i.test(voice.name)) ||
			englishVoices[0] ||
			null
		);
	};

	const speakMessage = (index: number, message: Message) => {
		if (!speakingAvailable) return;
		if (speakingIndex === index) {
			window.speechSynthesis.cancel();
			setSpeakingIndex(null);
			return;
		}

		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(buildSpeechText(message).replace(/[*_#>`]/g, " "));
		const preferredVoice = getPreferredZoeVoice();

		if (preferredVoice) {
			utterance.voice = preferredVoice;
		}

		utterance.rate = 0.95;
		utterance.pitch = 1.02;
		utterance.volume = 1;

		utterance.onend = () => setSpeakingIndex(null);
		utterance.onerror = () => setSpeakingIndex(null);

		setSpeakingIndex(index);
		window.speechSynthesis.speak(utterance);
	};

	const applyBackendResponse = (data: any) => {
		if (data.params) {
			const cleanedParams = cleanInternalParams(data.params);
			setSelected((prev) => ({ ...prev, ...cleanedParams }));

			// Keep the home/search form clean. Intermediate Zoe state can include
			// confirmations, hints, and partial values, so only sync the form after
			// Zoe has produced a real validated search result. This prevents values
			// like "YES" from ever landing in FROM/TO fields.
			if (isCleanSearchSync(data)) {
				onFillSearch?.(cleanedParams);
			}
		}

		setMessages((prev) => [
			...prev,
			{
				role: "assistant",
				content: data.message || "Something went wrong.",
				suggestions: data.suggestions || null,
				verdict: data.data || null,
				searchId: data.search_id || data.search_data?.search_id || null,
				verdictId: data.verdict_id || data.search_data?.verdict_id || null,
			},
		]);

		if (data.type === "search_result") {
			setTimeout(() => onTriggerSearch?.(), 60);
		}
	};

	const sendText = async (text: string) => {
		if (typing || !text.trim()) return;
		setMessages((prev) => [...prev, { role: "user", content: text.trim() }]);
		setInput("");
		setTyping(true);
		try {
			const headers = await getAuthHeaders();
			const res = await fetch("/api/zoe", {
				method: "POST",
				headers,
				body: JSON.stringify({
					message: text.trim(),
					slots: selected,
					history: messages,
					wallet: (cards || []).map((card: any) => ({
						program: card.program_name,
						points: card.points_balance,
					})),
				}),
			});
			const data = await res.json();
			applyBackendResponse(data);
		} catch {
			setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
		} finally {
			setTyping(false);
		}
	};

	const submitFeedback = async (index: number) => {
		const state = feedbackState[index];
		const message = messages[index];
		if (!state?.rating || !message?.verdictId || state.saving) return;
		setFeedbackState((prev) => ({
			...prev,
			[index]: { ...prev[index], saving: true, error: "" },
		}));
		const { data: userData } = await supabase.auth.getUser();
		const userId = userData.user?.id;
		if (!userId) {
			setFeedbackState((prev) => ({
				...prev,
				[index]: { ...prev[index], saving: false, error: "Please log in again before submitting feedback." },
			}));
			return;
		}
		const payload = {
			verdict_id: message.verdictId,
			user_id: userId,
			rating: state.rating,
			comment: state.comment?.trim() || null,
			did_book: false,
			booking_method: null,
		};
		const { error } = await supabase.from("feedback").insert(payload);
		if (error) {
			setFeedbackState((prev) => ({
				...prev,
				[index]: { ...prev[index], saving: false, error: error.message || "Failed to save feedback." },
			}));
			return;
		}
		setFeedbackState((prev) => ({
			...prev,
			[index]: { ...prev[index], saving: false, saved: true, open: false },
		}));
	};

	useEffect(() => {
		if (isOpen && messages.length === 0) {
			void sendText("start");
		}
	}, [isOpen]);

	if (!isOpen) {
		return (
			<div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
				{showNudge && (
					<div className="relative max-w-[252px] rounded-2xl border border-emerald-400/15 bg-slate-900/95 px-4 py-3 shadow-2xl">
						<p className="text-white text-sm font-semibold">Meet Zoe</p>
						<p className="mt-1 text-xs leading-5 text-slate-400">
							A compact travel co-pilot for clear points-vs-cash calls, follow-up moves, and quick voice help.
						</p>
					</div>
				)}
				<button
					onClick={() => setIsOpen(true)}
					className="rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 px-8 py-4 text-white shadow-2xl transition-all hover:scale-[1.02] flex items-center gap-3"
				>
					<MessageCircle className="w-7 h-7" />
					<span className="font-bold text-lg">Ask Zoe ✨</span>
				</button>
			</div>
		);
	}

	return (
		<div
			className={`fixed z-50 flex flex-col border border-white/10 bg-slate-950/95 backdrop-blur shadow-2xl transition-all duration-300 ${
				expanded
					? "top-1/2 left-1/2 h-[720px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-3xl"
					: "bottom-6 right-6 h-[560px] w-[390px] rounded-3xl"
			}`}
		>
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/15">
						<Sparkles className="h-5 w-5 text-emerald-300" />
					</div>
					<div>
						<p className="font-semibold text-white">Zoe</p>
						<p className="text-xs text-emerald-300">Real numbers. Clear calls.</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button onClick={() => setExpanded((prev) => !prev)} className="text-slate-400 hover:text-white">
						{expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
					</button>
					<button
						onClick={() => {
							setIsOpen(false);
							setExpanded(false);
						}}
						className="text-slate-400 hover:text-white"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4">
				<div className={`${expanded ? "mx-auto max-w-3xl" : ""} space-y-4`}>
					{messages.map((msg, index) => {
						const feedback = feedbackState[index] || {};
						const hasVerdict = msg.role === "assistant" && !!msg.verdict;
						const verdictLabel = getVerdictLabel(msg.verdict);
						const explanation = getVerdictExplanation(msg.verdict, msg.content);
						const secondarySuggestions = dedupeSuggestions(msg.suggestions, msg.verdict?.next_step?.label || null);

						return (
							<div key={index} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
								{msg.role === "user" ? (
									<div className={`${expanded ? "max-w-[78%]" : "max-w-[88%]"} rounded-2xl bg-emerald-500 px-4 py-3 text-white`}>
										<p className="leading-7">{msg.content}</p>
									</div>
								) : hasVerdict ? (
									<div className={`${expanded ? "max-w-[76%]" : "max-w-[90%]"} w-full rounded-[22px] border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]`}>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">The call</p>
												<h3 className="mt-1 text-[18px] leading-tight font-extrabold tracking-tight text-white">{verdictLabel}</h3>
											</div>
											{msg.verdict?.confidence && (
												<span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
													msg.verdict.confidence === "high"
														? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
														: msg.verdict.confidence === "medium"
														? "border-amber-400/25 bg-amber-500/10 text-amber-200"
														: "border-slate-400/20 bg-slate-400/10 text-slate-200"
												}`}>
													{titleCaseConfidence(msg.verdict.confidence)}
												</span>
											)}
										</div>

										<p className="mt-2.5 text-[14px] leading-6 text-slate-100">{explanation}</p>

										{msg.verdict?.confidence_reason && (
											<div className="mt-3 flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
												<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
												<p className="text-[12px] leading-5 text-slate-300">{msg.verdict.confidence_reason}</p>
											</div>
										)}

										{msg.verdict?.next_step?.label && (
											<button
												onClick={() => void sendText(msg.verdict?.next_step?.prompt || msg.verdict?.next_step?.label || "")}
												className="mt-3 flex w-full items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-left transition hover:bg-emerald-500/15"
											>
												<div className="min-w-0">
													<p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Next step</p>
													<p className="mt-1 text-sm font-semibold text-white">{msg.verdict.next_step.label}</p>
												</div>
												<ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
											</button>
										)}

										<div className="mt-3 flex flex-wrap items-center gap-2">
											<button
												onClick={() => speakMessage(index, msg)}
												title={speakingIndex === index ? "Stop listening" : "Listen"}
												aria-label={speakingIndex === index ? "Stop listening" : "Listen to Zoe's response"}
												className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.06]"
												>
												{speakingIndex === index ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
												</button>
											{msg.verdictId && !feedback.saved && (
												<>
													<button onClick={() => setFeedbackState((prev) => ({ ...prev, [index]: { ...prev[index], rating: 5, open: true, comment: prev[index]?.comment || "" } }))} className={`rounded-xl border px-2.5 py-2 text-xs flex items-center gap-1.5 ${feedback.rating === 5 ? "border-emerald-400 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-slate-300"}`}>
														<ThumbsUp className="h-4 w-4" /> Helpful
													</button>
													<button onClick={() => setFeedbackState((prev) => ({ ...prev, [index]: { ...prev[index], rating: 1, open: true, comment: prev[index]?.comment || "" } }))} className={`rounded-xl border px-2.5 py-2 text-xs flex items-center gap-1.5 ${feedback.rating === 1 ? "border-rose-400 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/[0.03] text-slate-300"}`}>
														<ThumbsDown className="h-4 w-4" /> Needs work
													</button>
												</>
											)}
										</div>

										{msg.verdictId && feedback.open && !feedback.saved && (
											<div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
												<p className="mb-2 text-sm font-medium text-white">Optional comment</p>
												<textarea
													value={feedback.comment || ""}
													onChange={(e) => setFeedbackState((prev) => ({ ...prev, [index]: { ...prev[index], comment: e.target.value } }))}
													placeholder="Tell Zoe what should be better next time."
													className="min-h-[90px] w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500"
												/>
												<div className="mt-3 flex gap-2">
													<button onClick={() => void submitFeedback(index)} disabled={feedback.saving} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-slate-700">
														{feedback.saving ? "Saving…" : "Submit"}
													</button>
													<button onClick={() => setFeedbackState((prev) => ({ ...prev, [index]: { ...prev[index], open: false } }))} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">
														Cancel
													</button>
												</div>
												{feedback.error && <p className="mt-2 text-xs text-rose-300">{feedback.error}</p>}
											</div>
										)}

										{feedback.saved && <p className="mt-3 text-sm text-emerald-300">Thanks — your feedback was saved.</p>}

										{secondarySuggestions.length > 0 && (
											<div className="mt-3 flex flex-wrap gap-2">
												{secondarySuggestions.map((suggestion, suggestionIndex) => (
													<button key={`${index}-${suggestionIndex}`} onClick={() => void sendText(suggestion.query)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06]">
														{suggestion.emoji} {suggestion.label}
													</button>
												))}
											</div>
										)}
									</div>
								) : (
									<div className={`${expanded ? "max-w-[78%]" : "max-w-[88%]"} w-full`}>
										<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-200">
											<ReactMarkdown
												components={{
													p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-7" {...props} />,
													strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
												}}
											>
												{msg.content}
											</ReactMarkdown>
										</div>
										<div className="mt-2 flex flex-wrap gap-2">
											<button
												onClick={() => speakMessage(index, msg)}
												title={speakingIndex === index ? "Stop listening" : "Listen"}
												aria-label={speakingIndex === index ? "Stop listening" : "Listen to Zoe's response"}
												className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.06]"
												>
												{speakingIndex === index ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
												</button>
											<button
												onClick={() => setMessageFeedback((prev) => ({ ...prev, [index]: "up" }))}
												title="Helpful"
												aria-label="Mark Zoe's reply as helpful"
												className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
													messageFeedback[index] === "up"
														? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
														: "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
												}`}
											>
												<ThumbsUp className="h-4 w-4" />
											</button>
											<button
												onClick={() => setMessageFeedback((prev) => ({ ...prev, [index]: "down" }))}
												title="Not helpful"
												aria-label="Mark Zoe's reply as not helpful"
												className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
													messageFeedback[index] === "down"
														? "border-rose-400/60 bg-rose-500/15 text-rose-200"
														: "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
												}`}
											>
												<ThumbsDown className="h-4 w-4" />
											</button>
											<div className="group relative">
												<button
													type="button"
													title="About Zoe feedback"
													aria-label="About Zoe feedback"
													className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
												>
													<HelpCircle className="h-4 w-4" />
												</button>
												<div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-300 shadow-2xl group-hover:block">
													Zoe is still being improved by our developers. It can make mistakes or hallucinate, so your feedback helps us make it better.
												</div>
											</div>
											{/* {messageFeedback[index] && <span className="text-xs text-emerald-300">Sent</span>} */}
										</div>
										{msg.suggestions && msg.suggestions.length > 0 && (
											<div className="mt-3 flex flex-wrap gap-2">
												{dedupeSuggestions(msg.suggestions, null).map((suggestion, suggestionIndex) => (
													<button key={`${index}-${suggestionIndex}`} onClick={() => void sendText(suggestion.query)} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20">
														{suggestion.emoji} {suggestion.label}
													</button>
												))}
											</div>
										)}
									</div>
								)}
							</div>
						);
					})}

					{typing && (
						<div className="flex justify-start">
							<div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
								<Loader2 className="h-4 w-4 animate-spin text-slate-400" />
							</div>
						</div>
					)}
					<div ref={endRef} />
				</div>
			</div>

			<div className="border-t border-white/10 p-4">
				<div className={`flex gap-2 ${expanded ? "mx-auto max-w-3xl" : ""}`}>
					<button
						onMouseDown={startListening}
						onMouseUp={stopListening}
						onMouseLeave={() => listening && stopListening()}
						onTouchStart={startListening}
						onTouchEnd={stopListening}
						className={`flex-shrink-0 rounded-2xl border px-3 ${
							listening
								? "border-rose-400 bg-rose-500/20 text-rose-200"
								: "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
						}`}
						aria-label={listening ? "Release to stop recording" : "Hold to speak"}
					>
						{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
					</button>
					<input
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								void sendText(input);
							}
						}}
						placeholder={listening ? "Listening… release to keep the transcript" : "Tell Zoe the trip you want evaluated…"}
						className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					<button onClick={() => void sendText(input)} disabled={!input.trim() || typing} className="flex-shrink-0 rounded-2xl bg-emerald-500 px-4 py-3 text-white disabled:bg-slate-700">
						<Send className="h-5 w-5" />
					</button>
				</div>
				<p className={`mt-2 text-xs text-slate-500 ${expanded ? "mx-auto max-w-3xl" : ""}`}>
					Hold the mic to speak. Zoe will transcribe into the input so you can confirm before sending.
				</p>
			</div>
		</div>
	);
}
