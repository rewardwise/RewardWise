/** @format */

"use client";
import AirportSearch from "@/components/AirportSearch";
import { useState, useEffect, useRef } from "react";
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
}

// ---------------------------------------------------------------------------
// Stub helpers — replace with your real implementations
// ---------------------------------------------------------------------------

function parseTripFromText(text: string): FillData | null {
	// TODO: replace with your real NLP parser
	const lower = text.toLowerCase();
	const result: FillData = {};

	const originMap: Record<string, string> = {
		"san francisco": "SFO",
		sfo: "SFO",
		"new york": "JFK",
		nyc: "JFK",
		jfk: "JFK",

		"los angeles": "LAX",
		lax: "LAX",
		chicago: "ORD",
		ord: "ORD",
		seattle: "SEA",
		sea: "SEA",
		boston: "BOS",
		bos: "BOS",
	};
	for (const [key, code] of Object.entries(originMap)) {
		if (lower.includes(key)) {
			result.origin = code;
			break;
		}
	}

	if (lower.includes("business")) result.cabin = "business";
	else if (lower.includes("first")) result.cabin = "first";
	else if (lower.includes("economy")) result.cabin = "economy";

	const twoMatch = lower.match(
		/\b(2|two)\s*(people|travelers?|pax|passengers?)/,
	);
	if (twoMatch) result.travelers = 2;
	const threeMatch = lower.match(
		/\b(3|three)\s*(people|travelers?|pax|passengers?)/,
	);
	if (threeMatch) result.travelers = 3;

	const months: Record<string, string> = {
		january: "2026-01-15",
		february: "2026-02-15",
		march: "2026-03-15",
		april: "2026-04-15",
		may: "2026-05-15",
		june: "2026-06-15",
		july: "2026-07-15",
		august: "2026-08-15",
		september: "2026-09-15",
		october: "2026-10-15",
		november: "2026-11-15",
		december: "2026-12-15",
	};
	for (const [month, date] of Object.entries(months)) {
		if (lower.includes(month)) {
			result.date = date;
			break;
		}
	}

	return Object.keys(result).length > 0 ? result : null;
}

function parseDates(date: string): { dep: string | null; ret: string | null } {
	if (!date) return { dep: null, ret: null };

	try {
		// Case 1: range format → "2026-04-01 - 2026-04-10"
		if (date.includes(" - ")) {
			const [dep, ret] = date.split(" - ").map((d) => d.trim());
			return {
				dep: dep || null,
				ret: ret || null,
			};
		}

		// Case 2: single date → auto return = +7 days
		const depDate = new Date(date);

		if (isNaN(depDate.getTime())) {
			return { dep: null, ret: null };
		}

		const retDate = new Date(depDate);
		retDate.setDate(retDate.getDate() + 7);

		return {
			dep: depDate.toLocaleDateString("en-CA"),
			ret: retDate.toLocaleDateString("en-CA"),
		};
	} catch {
		return { dep: null, ret: null };
	}
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
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const [tripState, setTripState] = useState<FillData>({});
	const [currentStep, setCurrentStep] = useState<
		| "origin"
		| "destination"
		| "tripType"
		| "date"
		| "returnDate"
		| "travelers"
		| "cabin"
		| null
	>(null);

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
							"Speech recognition isn't available in this browser. Try Chrome on Android or desktop. On iOS, please type your request instead.",
					},
				]);
				return;
			}

			const recognition = new SpeechRecognitionAPI();

			// Config
			recognition.continuous = false;
			recognition.interimResults = true;
			recognition.lang = "en-US";
			recognition.maxAlternatives = 1;

			// Result handler
			recognition.onresult = (event) => {
				const transcript = Array.from(event.results)
					.map((r) => r[0].transcript)
					.join("");

				setInput(transcript);

				if (event.results[0].isFinal) {
					setListening(false);
				}
			};

			// Error handler
			recognition.onerror = (e) => {
				setListening(false);

				if (e.error === "not-allowed") {
					setMessages((prev) => [
						...prev,
						{
							role: "assistant",
							content:
								"Microphone access was denied. Please allow microphone access in your browser settings and try again.",
						},
					]);
				}
			};

			// End handler
			recognition.onend = () => {
				setListening(false);
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
						"Speech recognition isn't supported on this device. Please type your request instead.",
				},
			]);
		}
	};

	const stopListening = () => {
		recognitionRef.current?.stop();
		setListening(false);
	};

	// -------------------------------------------------------------------------
	// Banter / personality engine
	// -------------------------------------------------------------------------

	const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

	// -------------------------------------------------------------------------
	// Intent detection
	// -------------------------------------------------------------------------

	// -------------------------------------------------------------------------
	// Quick search chips
	// -------------------------------------------------------------------------

	const DEST_SUGGESTIONS: DestSuggestion[] = [
		{ emoji: "🇯🇵", label: "Tokyo", query: "SFO to Tokyo business class" },
		{
			emoji: "🇬🇧",
			label: "London",
			query: "JFK to London business class 2 people",
		},
		{ emoji: "🇮🇩", label: "Bali", query: "LAX to Bali business class" },
		{
			emoji: "🇫🇷",
			label: "Paris",
			query: "NYC to Paris business class 2 people",
		},
	];

	const handleQuickSearch = (item: QuickSearch) => {
		setShowChips(false);
		setMessages((prev) => [...prev, { role: "user", content: item.label }]);
		if (onFillSearch) {
			onFillSearch({
				origin: item.data.origin,
				destination: item.data.destination,
				cabin: item.data.cabin,
				travelers: Number(item.data.travelers), // ✅ string → number
				date: item.data.dates, // ✅ dates → date
			});
		}
		setTyping(true);
		setTimeout(() => {
			const programNames: Record<string, string> = {
				chase_ur: "Chase UR",
				amex_mr: "Amex MR",
				united: "United",
				delta: "Delta",
				marriott: "Marriott",
				hilton: "Hilton",
			};
			const names = item.data.programs
				.map((id) => programNames[id] || id)
				.join(" & ");
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: `$ I've filled in the search form for ${item.data.origin} → ${item.data.destination} in ${item.data.cabin} class for ${item.data.travelers} travelers.\n\n✅ Programs: ${names}\n✅ Dates: ${item.data.dates}\n\nSay "go ahead" or "search" and I'll find the best deal!`,
				},
			]);
			setTyping(false);
		}, 1200);
	};

	const handleEdit = (index: number, type: string) => {
		setCurrentStep(type as any);

		const labelMap: Record<string, string> = {
			origin: "From",
			destination: "To",
			tripType: "Trip",
			date: "Departure",
			returnDate: "Return",
			travelers: "Travelers",
			cabin: "Cabin",
		};

		setMessages((prev) =>
			prev.map((m, idx) => {
				// remove ALL other dropdowns
				if (m.dropdown && idx !== index) {
					return { ...m, dropdown: null };
				}

				// replace THIS message with editable version
				if (idx === index) {
					return {
						...m,
						role: "assistant",
						content: `Update ${labelMap[type]}`,
						dropdown: {
							type: type as any,
							options:
								type === "tripType"
									? ["One Way", "Round Trip"]
									: type === "travelers"
										? ["1", "2", "3", "4", "5"]
										: type === "cabin"
											? ["Economy", "Business", "First"]
											: [],
						},
						action: null, // remove edit button
					};
				}

				return m;
			}),
		);
	};

	const handleDropdownSelect = (type: string, value: string) => {
		if (!value) return;
		const labelMap: Record<string, string> = {
			origin: "From",
			destination: "To",
			tripType: "Trip",
			date: "Departure",
			returnDate: "Return",
			travelers: "Travelers",
			cabin: "Cabin",
		};

		setMessages((prev) => [
			...prev.filter((m) => !m.dropdown),
			{
				role: "user",
				content: `${labelMap[type] || type}: ${value}`,
				action: {
					label: "Edit",
					handler: () => handleEdit(prev.length, type), // 👈 KEY FIX
				},
			},
		]);
		let updated = { ...tripState };

		switch (type) {
			case "origin":
				updated.origin = value;
				setCurrentStep("destination");

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "Where are you flying to?",
						dropdown: {
							type: "destination",
							options: [],
						},
					},
				]);
				break;
			case "destination":
				updated.destination = value;

				setCurrentStep("tripType");

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "One-way or round trip?",
						dropdown: {
							type: "tripType",
							options: ["One Way", "Round Trip"],
						},
					},
				]);
				break;

			case "travelers":
				updated.travelers = Number(value);

				setCurrentStep("cabin");

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "Economy, Business, or First?",
						dropdown: {
							type: "cabin",
							options: ["Economy", "Business", "First"],
						},
					},
				]);
				break;

			case "tripType":
				updated.tripType = value === "Round Trip" ? "roundtrip" : "oneway";

				if (updated.tripType === "roundtrip") {
					updated.return_date = "";
				} else {
					updated.return_date = undefined;
				}

				setCurrentStep("date");

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "Select departure date",
						dropdown: {
							type: "date",
							options: [],
						},
					},
				]);

				break;

			case "date":
				updated.date = value;

				if (updated.tripType === "roundtrip") {
					setCurrentStep("returnDate");

					setMessages((prev) => [
						...prev,
						{
							role: "assistant",
							content: "Select return date",
							dropdown: {
								type: "returnDate",
								options: [],
							},
						},
					]);
				} else {
					setCurrentStep("travelers");

					setMessages((prev) => [
						...prev,
						{
							role: "assistant",
							content: "How many travelers?",
							dropdown: {
								type: "travelers",
								options: ["1", "2", "3", "4", "5"],
							},
						},
					]);
				}
				break;

			case "returnDate":
				updated.return_date = value;

				setCurrentStep("travelers");

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "How many travelers?",
						dropdown: {
							type: "travelers",
							options: ["1", "2", "3", "4", "5"],
						},
					},
				]);
				break;

			case "cabin":
				updated.cabin = value.toLowerCase();

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "Perfect. Running your search now...",
					},
				]);

				if (onTriggerSearch) onTriggerSearch();
				break;
		}

		setTripState(updated);

		// 🔥 keep UI + chat in sync
		if (onFillSearch) onFillSearch(updated);
	};
	// -------------------------------------------------------------------------
	// Send / process
	// -------------------------------------------------------------------------

	const sendText = (text: string) => {
		setMessages((prev) => [...prev, { role: "user", content: text }]);
		setInput("");
		setShowChips(false);
		setTyping(true);
		setTimeout(() => processMessage(text), 800);
	};

	const send = () => {
		if (!input.trim()) return;
		const text = input.trim();
		setMessages((prev) => [...prev, { role: "user", content: text }]);
		setInput("");
		setShowChips(false);
		setTyping(true);
		setTimeout(() => processMessage(text), 800);
	};

	const processMessage = (text: string) => {
		// ---------------- SLOT FLOW ----------------

		// Start conversation
		if (!currentStep && Object.keys(tripState).length === 0) {
			const lower = text.toLowerCase().trim();

			// ✅ HANDLE GREETING FIRST
			if (["hi", "hello", "hey"].includes(lower)) {
				setCurrentStep("origin");

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "Hi! Where are you flying from?",
					},
				]);

				setTyping(false);
				return;
			}

			// ✅ THEN handle origin normally
			const parsed = parseTripFromText(text);

			let originCode: string | undefined;

			if (parsed?.origin) {
				originCode = parsed.origin;
			} else if (text.trim().length === 3) {
				originCode = text.trim().toUpperCase();
			} else {
				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: "Please enter a valid airport (e.g., JFK or New York).",
					},
				]);
				setTyping(false);
				return;
			}

			const updated = { ...tripState, origin: originCode };
			setTripState(updated);

			setCurrentStep("destination");

			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Where are you flying to?" },
			]);

			setTyping(false);
			return;
		}
		if (currentStep) {
			let updated = { ...tripState };

			switch (currentStep) {
				case "destination":
					const parsed = parseTripFromText(text);

					let destCode: string | undefined;

					if (parsed?.origin) {
						destCode = parsed.origin; // "London" → LHR
					} else if (text.trim().length === 3) {
						destCode = text.trim().toUpperCase(); // "LHR"
					} else {
						setMessages((prev) => [
							...prev,
							{
								role: "assistant",
								content: "Please enter a valid airport (e.g., LHR or London).",
							},
						]);
						setTyping(false);
						return;
					}

					updated.destination = destCode;

					updated.destination = destCode;
					setCurrentStep("tripType");
					setMessages((prev) => [
						...prev,
						{ role: "assistant", content: "One-way or round trip?" },
					]);
					break;

				case "tripType":
					if (text.toLowerCase().includes("round")) {
						updated.tripType = "roundtrip";
						updated.return_date = "";
					} else {
						updated.tripType = "oneway";
						updated.return_date = undefined;
					}
					setCurrentStep("date");
					setMessages((prev) => [
						...prev,
						{
							role: "assistant",
							content: "What’s your departure date? (YYYY-MM-DD)",
						},
					]);
					break;

				case "date":
					updated.date = text;

					if (updated.tripType === "roundtrip") {
						setCurrentStep("returnDate");
						setMessages((prev) => [
							...prev,
							{ role: "assistant", content: "What’s your return date?" },
						]);
					} else {
						setCurrentStep("travelers");
						setMessages((prev) => [
							...prev,
							{ role: "assistant", content: "How many travelers?" },
						]);
					}
					break;

				case "returnDate":
					updated.return_date = text;
					setCurrentStep("travelers");
					setMessages((prev) => [
						...prev,
						{ role: "assistant", content: "How many travelers?" },
					]);
					break;

				case "travelers":
					const num = Number(text);
					if (isNaN(num)) {
						setMessages((prev) => [
							...prev,
							{ role: "assistant", content: "Please enter a valid number." },
						]);
						setTyping(false);
						return;
					}
					updated.travelers = num;
					setCurrentStep("cabin");
					setMessages((prev) => [
						...prev,
						{ role: "assistant", content: "Economy, Business, or First?" },
					]);
					break;

				case "cabin":
					updated.cabin = text.toLowerCase();
					setCurrentStep(null);

					if (onFillSearch) onFillSearch(updated);

					setMessages((prev) => [
						...prev,
						{
							role: "assistant",
							content: "Perfect. Running your search now...",
						},
					]);

					if (onTriggerSearch) setTimeout(() => onTriggerSearch(), 500);
					break;
			}

			setTripState(updated);
			setTyping(false);
			return;
		}

		// ---------------- EXISTING LOGIC CONTINUES ----------------

		const parsed = parseTripFromText(text);

		// --- Trip parsing ---
		const fillData: FillData = parsed || {};

		const dests: Record<string, { dest: string; code: string }> = {
			tokyo: { dest: "Tokyo", code: "HND" },
			bali: { dest: "Bali", code: "DPS" },
			london: { dest: "London", code: "LHR" },
			paris: { dest: "Paris", code: "CDG" },
			maldives: { dest: "Maldives", code: "MLE" },
			hawaii: { dest: "Hawaii", code: "HNL" },
			cancun: { dest: "Cancun", code: "CUN" },
			rome: { dest: "Rome", code: "FCO" },
			dubai: { dest: "Dubai", code: "DXB" },
			sydney: { dest: "Sydney", code: "SYD" },
			singapore: { dest: "Singapore", code: "SIN" },
			seoul: { dest: "Seoul", code: "ICN" },
			bangkok: { dest: "Bangkok", code: "BKK" },
			amsterdam: { dest: "Amsterdam", code: "AMS" },
		};

		const lower = text.toLowerCase();
		let destInfo: { dest: string; code: string } | null = null;
		for (const [key, val] of Object.entries(dests)) {
			if (lower.includes(key)) {
				destInfo = val;
				fillData.destination = val.code;
				break;
			}
		}

		if (!fillData.origin) fillData.origin = "SFO";
		if (!fillData.cabin) fillData.cabin = "economy";
		if (!fillData.travelers) fillData.travelers = 1;
		const dateWasExplicit = !!fillData.date;
		if (!fillData.date) fillData.date = "2026-03-15";

		const originCities: Record<string, string> = {
			sfo: "San Francisco (SFO)",
			jfk: "New York (JFK)",
			nyc: "New York (JFK)",
			lax: "Los Angeles (LAX)",
			ord: "Chicago (ORD)",
			dfw: "Dallas (DFW)",
			atl: "Atlanta (ATL)",
			sea: "Seattle (SEA)",
			bos: "Boston (BOS)",
			iad: "Washington (IAD)",
			yyz: "Toronto (YYZ)",
			yvr: "Vancouver (YVR)",
		};

		const originDisplay =
			originCities[fillData.origin.toLowerCase()] ?? fillData.origin;
		const destDisplay = destInfo ? destInfo.dest : fillData.destination;
		const cabinDisplay =
			fillData.cabin.charAt(0).toUpperCase() + fillData.cabin.slice(1);
		const { ret: retDate } = parseDates(fillData.date ?? "");
	};

	useEffect(() => {
		if (isOpen && messages.length === 0) {
			setMessages([
				{
					role: "assistant",
					content:
						"Hey! I'm Zoe, your RewardWise travel assistant.\n\nTell me where you want to fly and I'll find the best deal ✈️",
				},
				{
					role: "assistant",
					content: "Where are you flying from?",
					dropdown: {
						type: "origin",
						options: ["JFK", "SFO", "LAX", "ORD", "SEA", "BOS"],
					},
				},
			]);

			setCurrentStep("origin");
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
								{msg.content.split("\n").map((line, j) =>
									line !== undefined && line !== "undefined" ? (
										<p key={j} className={j > 0 ? "mt-1" : ""}>
											{line}
										</p>
									) : null,
								)}
							</div>
							{msg.dropdown?.type === "origin" && (
								<div className="mt-2 w-full max-w-[260px]">
									<AirportSearch
										label="From"
										value={tripState.origin || ""}
										onChange={(code) => handleDropdownSelect("origin", code)}
										placeholder="Search origin airport..."
									/>
								</div>
							)}
							{msg.dropdown?.type === "destination" && (
								<div className="mt-2 w-full max-w-[260px]">
									<AirportSearch
										label="To"
										value={tripState.destination || ""}
										onChange={(code) =>
											handleDropdownSelect("destination", code)
										}
										placeholder="Search destination..."
									/>
								</div>
							)}
							{/* DATE (departure) */}
							{msg.dropdown?.type === "date" && (
								<div className="mt-2">
									<input
										type="date"
										className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700"
										onChange={(e) =>
											handleDropdownSelect("date", e.target.value)
										}
									/>
								</div>
							)}

							{msg.dropdown?.type === "returnDate" && (
								<div className="mt-2">
									<input
										type="date"
										className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700"
										onChange={(e) =>
											handleDropdownSelect("returnDate", e.target.value)
										}
									/>
								</div>
							)}
							{/* OTHER DROPDOWNS */}
							{msg.dropdown &&
								msg.dropdown.type !== "origin" &&
								msg.dropdown.type !== "destination" &&
								msg.dropdown.type !== "date" &&
								msg.dropdown.type !== "returnDate" && (
									<div className="mt-2">
										<select
											className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700"
											onChange={(e) =>
												handleDropdownSelect(msg.dropdown!.type, e.target.value)
											}
										>
											<option value="">Select</option>
											{msg.dropdown.options.map((opt, idx) => (
												<option key={idx} value={opt}>
													{opt}
												</option>
											))}
										</select>
									</div>
								)}
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
									className={`mt-2 flex flex-wrap gap-2 ${expanded ? "max-w-[70%]" : "max-w-[85%]"}`}
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
						</div>
					))}

					{showChips && !typing && (
						<div
							className={`space-y-2 ${expanded ? "grid grid-cols-2 gap-2 space-y-0" : ""}`}
						></div>
					)}

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
