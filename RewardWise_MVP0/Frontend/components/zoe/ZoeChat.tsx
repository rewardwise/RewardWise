/** @format */

"use client";

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
}
interface FillData {
	origin?: string;
	destination?: string;
	date?: string;
	cabin?: string;
	travelers?: number;
	return_date?: string;
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
const QUICK_SEARCHES: QuickSearch[] = [
	{
		label: "✈️ Business Class to Tokyo",
		data: {
			origin: "SFO",
			destination: "Tokyo",
			cabin: "business",
			travelers: "2",
			dates: "2026-04-01",
			programs: ["chase_ur", "united"],
		},
	},
	{
		label: "🌴 Bali for 2 · Economy",
		data: {
			origin: "LAX",
			destination: "Bali",
			cabin: "economy",
			travelers: "2",
			dates: "2026-06-15",
			programs: ["amex_mr", "delta"],
		},
	},
	{
		label: "🗼 Paris · Business Class",
		data: {
			origin: "JFK",
			destination: "Paris",
			cabin: "business",
			travelers: "1",
			dates: "2026-05-10",
			programs: ["chase_ur", "amex_mr"],
		},
	},
	{
		label: "🇬🇧 London · 2 People",
		data: {
			origin: "JFK",
			destination: "London",
			cabin: "business",
			travelers: "2",
			dates: "2026-03-28",
			programs: ["amex_mr", "marriott"],
		},
	},
];

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

	const ZOE_BANTER = {
		rude: [
			"Ouch! 😄 My circuits felt that one. But hey, I'm still the one who can save you thousands on flights, so... friends? ✈️",
			"Wow, okay! I've been called worse by airline customer service bots. At least I actually find you good deals 😉",
			"That's not very nice! But you know what IS nice? Business class to Tokyo for the price of economy. Just saying... 🇯🇵",
		],
		nice: [
			"Aww, stop it! 😊 You're making my algorithms blush. Now let's find you a deal worthy of that good energy! ✈️",
			"Right back at you! 💚 Now let's channel this positive energy into some serious savings. Where are we flying?",
			"You're too kind! I'd high-five you but... you know, digital hands. Where do you want to go? 🌍",
		],
		greeting: [
			"Hey there! 👋 Ready to turn those dusty points into an adventure? Tell me where you want to fly!",
			"Hi! I'm Zoe — part travel agent, part points nerd, 100% here to save you money. Where are we going? ✈️",
			"Hello! Fun fact: the average person leaves $500+ in points value on the table every year. Let's not be average. Where to? 🌍",
		],
		identity: [
			"I'm Zoe! Think of me as your personal points whisperer 🧙‍♀️ — I look at your wallet, find the smartest way to book, and tell you exactly what to do. No spreadsheets required.",
			"I'm your AI travel assistant! I crunch the numbers across all your loyalty programs so you don't have to.",
		],
		thanks: [
			"You're welcome! That's what I'm here for 😊 Need anything else? I'm always down to find another deal.",
			"Anytime! Saving people money is literally my favorite thing. Well, that and pretending I can eat airplane food 🍱",
		],
		confused: [
			"Hmm, I'm not sure I caught that! I'm great with things like 'SFO to Tokyo in March' or 'find me a deal to Paris.' Want to try again? ✈️",
			"My travel-brain didn't quite parse that one 🤔 Try telling me a destination and I'll work my magic!",
		],
		joke: [
			"Why did the frequent flyer break up with their credit card? Too many transfer issues! 😂 ...Okay, I'll stick to finding deals.",
			"What's the difference between an airline's award chart and a mystery novel? The mystery novel makes more sense. Anyway, I'm here to decode it! 🔍",
		],
		empathy: [
			"Hey, sounds like you could use a getaway! 🌴 Nothing a beach and a well-optimized points booking can't fix.",
			"I hear you. Travel planning can be stressful — that's literally why I exist. Just tell me where you want to go 💚",
		],
		searchGo: [
			"On it! 🔍 Crunching numbers across every transfer partner... this is the part where I earn my keep!",
			"Let's gooo! 🚀 Scanning routes, comparing points vs. cash, finding the sweet spot... hold tight!",
		],
		searchGoUnauth: [
			"Ooh, I found some juicy options! 🎉 But I need you to create a free account first so I can show you the full verdict.",
			"Great news — there are savings hiding in your points! 💰 Create a free account to unlock your personalized verdict.",
		],
		gotIt: [
			"Love it! Let me set that up for you... 🛫",
			"Great choice! Setting up your search now... ✈️",
			"Ooh, nice destination! Let me crunch the numbers... 🔢",
		],
		searchDone: [
			"Boom! 💥 Results are in — check them out above. I'm pretty proud of this one.",
			"Done! ✈️ Your verdict is ready above. Spoiler: you're probably saving a lot.",
		],
		quickPick: [
			"Solid choice! 🎯",
			"Great taste! ✈️",
			"Ooh, love that route! 🌏",
			"Now we're talking! 🔥",
		],
		healthCheck: [
			"Head to Health Check from your Profile tab — it's like a physical for your points portfolio 📊",
			"Check out the Health Check under Profile — it'll show you exactly where your portfolio stands 💚",
		],
		help: [
			'I\'ve got you! Just tell me your trip in plain English. For example:\n\n• "SFO to Tokyo in March, business class"\n• "NYC to Bali for 2 people"\n• "Find me a deal to London"\n\nOr tap a quick search below 👇',
		],
	};

	// -------------------------------------------------------------------------
	// Intent detection
	// -------------------------------------------------------------------------

	const detectIntent = (text: string): string | null => {
		const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
		if (
			/\b(not cool|stupid|dumb|suck|hate you|worst|terrible|awful|shut up|useless|trash|bad bot|idiot|ugly|lame|boring)\b/.test(
				lower,
			)
		)
			return "rude";
		if (/\b(f+u+c+k|wtf|stfu|bs|crap|damn)\b/.test(lower)) return "rude";
		if (
			/\b(cool|awesome|amazing|love you|great job|nice work|thank|thanks|thx|appreciate|you rock|best|brilliant|fantastic|wonderful|perfect)\b/.test(
				lower,
			)
		) {
			if (/\b(thank|thanks|thx|appreciate)\b/.test(lower)) return "thanks";
			return "nice";
		}
		if (
			/^(hi|hey|hello|yo|sup|whats up|howdy|hola|good morning|good evening|good afternoon|heya|hiya)\b/.test(
				lower,
			)
		)
			return "greeting";
		if (
			/\b(who are you|what are you|what do you do|what can you do|your name)\b/.test(
				lower,
			)
		)
			return "identity";
		if (
			/\b(joke|funny|make me laugh|tell me something funny|humor|lol|haha)\b/.test(
				lower,
			)
		)
			return "joke";
		if (
			/\b(sad|stressed|frustrated|angry|upset|depressed|tired|exhausted|overwhelmed|ugh)\b/.test(
				lower,
			)
		)
			return "empathy";
		if (
			/\b(search|find flight|go ahead|run it|lets go|search now|find my saving|do it|book it|yes search|yes please|run the search|find it)\b/.test(
				lower,
			)
		)
			return "search";
		if (
			/^(yes|ok|okay|sure|yep|yeah|yup|alright|lets do it|ok ok|yes that|yes please|do it|lets go|go for it|yea|ya)\b/.test(
				lower,
			)
		)
			return "search";
		if (/\b(help|how does|how do|what can|how to)\b/.test(lower)) return "help";
		if (
			/\b(health|portfolio|check my points|points check|balance check)\b/.test(
				lower,
			)
		)
			return "healthCheck";
		return null;
	};

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
					content: `${pick(ZOE_BANTER.quickPick)} I've filled in the search form for ${item.data.origin} → ${item.data.destination} in ${item.data.cabin} class for ${item.data.travelers} travelers.\n\n✅ Programs: ${names}\n✅ Dates: ${item.data.dates}\n\nSay "go ahead" or "search" and I'll find the best deal!`,
				},
			]);
			setTyping(false);
		}, 1200);
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
		const parsed = parseTripFromText(text);
		const intent = detectIntent(text);

		// --- Conversational intents ---
		if (intent === "rude") {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: pick(ZOE_BANTER.rude),
					suggestions: DEST_SUGGESTIONS,
				},
			]);
			setTyping(false);
			return;
		}
		if (intent === "nice") {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.nice) },
			]);
			setTyping(false);
			return;
		}
		if (intent === "thanks") {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.thanks) },
			]);
			setTyping(false);
			return;
		}
		if (intent === "greeting") {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: pick(ZOE_BANTER.greeting),
					suggestions: DEST_SUGGESTIONS,
				},
			]);
			setTyping(false);
			return;
		}
		if (intent === "identity") {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.identity) },
			]);
			setTyping(false);
			return;
		}
		if (intent === "joke") {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.joke) },
			]);
			setTyping(false);
			return;
		}
		if (intent === "empathy") {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: pick(ZOE_BANTER.empathy),
					suggestions: DEST_SUGGESTIONS,
				},
			]);
			setTyping(false);
			return;
		}
		if (intent === "help") {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.help) },
			]);
			setShowChips(true);
			setTyping(false);
			return;
		}
		if (intent === "healthCheck") {
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.healthCheck) },
			]);
			setTyping(false);
			return;
		}

		// --- Search trigger ---
		if (intent === "search" && onTriggerSearch) {
			if (!isAuthenticated) {
				setMessages((prev) => [
					...prev,
					{ role: "assistant", content: pick(ZOE_BANTER.searchGoUnauth) },
				]);
				setTyping(false);
				return;
			}
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: pick(ZOE_BANTER.searchGo) },
			]);
			setTyping(false);
			setTimeout(() => onTriggerSearch(), 500);
			return;
		}

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

		if (!fillData.destination) {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: pick(ZOE_BANTER.confused),
					suggestions: DEST_SUGGESTIONS,
				},
			]);
			setTyping(false);
			return;
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

		const summaryText = `${pick(ZOE_BANTER.gotIt)}\n\n✈️ ${originDisplay} → ${destDisplay}\n📅 ${fillData.date}→ ${retDate ?? "flexible"}\n👥 ${fillData.travelers} traveler${fillData.travelers !== 1 ? "s" : ""} · ${cabinDisplay}${!dateWasExplicit ? "\n\n📆 I picked March — tap below to change:" : ""}`;

		const doSearch = () => {
			if (onFillSearch) onFillSearch(fillData);
			if (!isAuthenticated) {
				setMessages((prev) => [
					...prev,
					{ role: "assistant", content: pick(ZOE_BANTER.searchGoUnauth) },
				]);
			} else {
				setMessages((prev) => [
					...prev,
					{ role: "assistant", content: pick(ZOE_BANTER.searchGo) },
				]);
				if (onTriggerSearch) setTimeout(() => onTriggerSearch(), 500);
			}
		};

		const monthChips: DestSuggestion[] | null = !dateWasExplicit
			? [
					{
						emoji: "🌸",
						label: "March",
						query: `${fillData.origin} to ${destDisplay} in March ${fillData.cabin} ${fillData.travelers} people`,
					},
					{
						emoji: "🌷",
						label: "April",
						query: `${fillData.origin} to ${destDisplay} in April ${fillData.cabin} ${fillData.travelers} people`,
					},
					{
						emoji: "☀️",
						label: "May",
						query: `${fillData.origin} to ${destDisplay} in May ${fillData.cabin} ${fillData.travelers} people`,
					},
					{
						emoji: "🏖️",
						label: "June",
						query: `${fillData.origin} to ${destDisplay} in June ${fillData.cabin} ${fillData.travelers} people`,
					},
				]
			: null;

		setMessages((prev) => [
			...prev,
			{
				role: "assistant",
				content: summaryText,
				action: { label: "Let's do it!", handler: doSearch },
				suggestions: monthChips,
			},
		]);
		setTyping(false);
	};

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
						>
							{QUICK_SEARCHES.map((item, i) => (
								<button
									key={i}
									onClick={() => handleQuickSearch(item)}
									className="w-full text-left bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-white transition-all hover:scale-[1.02]"
								>
									<span className="font-medium">{item.label}</span>
									<span className="text-gray-400 text-xs block mt-0.5">
										{item.data.travelers} travelers • {item.data.dates}
									</span>
								</button>
							))}
						</div>
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
