/** @format */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";

import {
    Plane,
    CheckCircle,
    ArrowRight,
    Sparkles,
    Check,
    Search,
    ChevronDown,
    Mail,
    Lock,
    Loader2,
    Star,
} from "lucide-react";
import SearchProgress from "@/components/SearchProgress";

const REWARD_PROGRAMS = [
    { id: "chase_ur", name: "Chase Ultimate Rewards", short: "Chase UR" },
    { id: "amex_mr", name: "Amex Membership Rewards", short: "Amex MR" },
    { id: "united", name: "United MileagePlus", short: "United" },
    { id: "delta", name: "Delta SkyMiles", short: "Delta" },
    { id: "marriott", name: "Marriott Bonvoy", short: "Marriott" },
    { id: "hilton", name: "Hilton Honors", short: "Hilton" },
];

export default function LandingPage() {
    const router = useRouter();

    const { user } = useAuth();
    const isAuthenticated = !!user;
    const { searchFill, setPendingSearch } = useSearchFill();

    /* STATE */
    const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
    const [balances, setBalances] = useState<any>({});
    const [origin, setOrigin] = useState("");
    const [destination, setDestination] = useState("");
    const [dates, setDates] = useState("");
    const [cabin, setCabin] = useState("economy");
    const [travelers, setTravelers] = useState("2");
    const [searching, setSearching] = useState(false);
    const [teaserResult, setTeaserResult] = useState<any>(null);

    const [showSearch, setShowSearch] = useState(false);
    const [showSignupGate, setShowSignupGate] = useState(false);
    const [showInlineSearch, setShowInlineSearch] = useState(false);
    const [showTrySearch, setShowTrySearch] = useState(false);
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [signupLoading, setSignupLoading] = useState(false);
    const [signupError, setSignupError] = useState("");

    /* Zoe Autofill */
    useEffect(() => {
        if (!searchFill) return;

        if (searchFill.origin) setOrigin(searchFill.origin);
        if (searchFill.destination) setDestination(searchFill.destination);
        if (searchFill.dates) setDates(searchFill.dates);
        if (searchFill.cabin) setCabin(searchFill.cabin);
        if (searchFill.travelers) setTravelers(searchFill.travelers);

        if (searchFill.programs) {
            setSelectedPrograms(searchFill.programs);

            if (searchFill.balances) {
                setBalances((prev: any) => ({
                    ...prev,
                    ...searchFill.balances,
                }));
            }
        }
    }, [searchFill]);

    const toggleProgram = (id: string) => {
        setSelectedPrograms((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
        );
    };
    useEffect(() => {
        if (user === null) return;
        if (user) router.replace("/home");
    }, [user, router]);
    const updateBalance = (id: string, val: string) => {
        setBalances((prev: any) => ({ ...prev, [id]: val }));
    };

    const totalPoints = selectedPrograms.reduce(
        (sum, id) => sum + (parseInt(balances[id]) || 0),
        0,
    );

    const handleSearch = () => {
        if (!origin || !destination) return;

        setSearching(true);

        setTimeout(() => {
            const cashPrice =
                cabin === "business" ? 4200 : cabin === "first" ? 8500 : 387;

            const savings =
                cabin === "business" ? 6000 : cabin === "first" ? 12000 : 0;

            const cpp = cabin === "business" ? 4.9 : cabin === "first" ? 6.2 : 1.1;

            const usePoints = cabin !== "economy";

            setTeaserResult({
                origin,
                destination,
                travelers: parseInt(travelers),
                cashPrice,
                savings: savings * parseInt(travelers),
                cpp,
                usePoints,
                totalCash: cashPrice * parseInt(travelers),
            });

            setSearching(false);
        }, 3500);
    };

    const handleSignupGate = (e: any) => {
        e.preventDefault();
        setSignupError("");

        if (!signupEmail || !/\S+@\S+\.\S+/.test(signupEmail)) {
            setSignupError("Please enter a valid email");
            return;
        }

        if (!signupPassword || signupPassword.length < 8) {
            setSignupError("Password must be at least 8 characters");
            return;
        }

        setSignupLoading(true);

        setTimeout(() => {
            setPendingSearch({
                origin,
                destination,
                dates,
                cabin,
                travelers,
                selectedPrograms,
                balances,
            });

            router.push("/search");
        }, 1000);
    };

    /* Next-safe Redirect */
    useEffect(() => {
        if (!isAuthenticated) return;

        router.replace(teaserResult ? "/search" : "/home");
    }, [isAuthenticated, teaserResult, router]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
            {/* Background Image Layer */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{
                    backgroundImage:
                        "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')",
                }}
            />

            {/* Content Layer */}
            <div className="relative z-10">
                <header className="flex justify-between items-center px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Plane className="w-6 h-6 text-blue-400" />
                        <span className="font-bold text-lg text-white">MyTravelWallet</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => router.push("/about")}
                            className="text-gray-300 hover:text-white font-medium text-sm"
                        >
                            About
                        </button>

                        <button
                            onClick={() => {
                                if (origin && destination)
                                    setPendingSearch({
                                        origin,
                                        destination,
                                        dates,
                                        cabin,
                                        travelers,
                                        selectedPrograms,
                                        balances,
                                    });

                                router.push("/login");
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-medium text-sm"
                        >
                            Log In
                        </button>
                    </div>
                </header>

                <main id="main-content" className="max-w-2xl mx-auto px-6 py-8">
                    {/* HERO */}

                    {!teaserResult && !searching && !showSignupGate && (
                        <>
                            {/* Big headline */}
                            <div className="text-center mb-6">
                                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg leading-tight">
                                    We optimize your wallet.
                                    <br />
                                    <span className="text-emerald-400">You just travel.</span>
                                </h1>
                                <p className="text-gray-300 text-lg max-w-md mx-auto">
                                    MyTravelWallet sees your entire rewards portfolio and makes
                                    the smartest booking decision for you.
                                </p>
                            </div>

                            {/* How it works — compact strip */}
                            <div className="grid grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto">
                                <div className="text-center bg-gray-900/50 backdrop-blur rounded-lg p-3">
                                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <span className="text-emerald-400 text-sm font-bold">
                                            1
                                        </span>
                                    </div>
                                    <h3 className="text-white font-medium text-sm mb-0.5">
                                        Add your cards
                                    </h3>
                                    <p className="text-gray-400 text-xs">
                                        Link loyalty programs & balances
                                    </p>
                                </div>

                                <div className="text-center bg-gray-900/50 backdrop-blur rounded-lg p-3">
                                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <span className="text-emerald-400 text-sm font-bold">
                                            2
                                        </span>
                                    </div>
                                    <h3 className="text-white font-medium text-sm mb-0.5">
                                        Search a trip
                                    </h3>
                                    <p className="text-gray-400 text-xs">We analyze every path</p>
                                </div>

                                <div className="text-center bg-gray-900/50 backdrop-blur rounded-lg p-3">
                                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <span className="text-emerald-400 text-sm font-bold">
                                            3
                                        </span>
                                    </div>
                                    <h3 className="text-white font-medium text-sm mb-0.5">
                                        Get a verdict
                                    </h3>
                                    <p className="text-gray-400 text-xs">
                                        Points, cash, or save for later
                                    </p>
                                </div>
                            </div>

                            {/* Search wizard — only in delayed-signup (Flow 1B) variant */}
                            {showInlineSearch ? (
                                <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Sparkles className="w-5 h-5 text-emerald-400" />
                                        <span className="text-white font-semibold">
                                            Try it free — no signup needed
                                        </span>
                                    </div>
                                    {/* Step 1: Programs */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h2 className="text-white font-semibold">
                                                Which programs do you have?
                                            </h2>
                                            <button
                                                onClick={() => {
                                                    const allIds = REWARD_PROGRAMS.map((p) => p.id);
                                                    setSelectedPrograms((prev) =>
                                                        prev.length === allIds.length ? [] : allIds,
                                                    );
                                                }}
                                                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
                                            >
                                                {selectedPrograms.length === REWARD_PROGRAMS.length
                                                    ? "Deselect all"
                                                    : "Select all"}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {REWARD_PROGRAMS.map((prog) => {
                                                const selected = selectedPrograms.includes(prog.id);
                                                return (
                                                    <button
                                                        key={prog.id}
                                                        onClick={() => toggleProgram(prog.id)}
                                                        className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${selected ? "bg-emerald-500/20 border-emerald-500 text-white" : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600"}`}
                                                    >
                                                        <div
                                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? "bg-emerald-500 border-emerald-500" : "border-gray-600"}`}
                                                        >
                                                            {selected && (
                                                                <Check className="w-3 h-3 text-white" />
                                                            )}
                                                        </div>
                                                        {prog.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Step 2: Balances — only show for selected programs */}
                                    {/* Step 2: Balances — only show for selected programs */}
                                    {selectedPrograms.length > 0 && (
                                        <div className="mb-6">
                                            <h2 className="text-white font-semibold mb-1">
                                                Enter your balances{" "}
                                                <span className="text-gray-500 font-normal text-sm">
                                                    (approximate OK)
                                                </span>
                                            </h2>

                                            <div className="space-y-2 mt-3">
                                                {selectedPrograms.map((id) => {
                                                    const prog = REWARD_PROGRAMS.find((p) => p.id === id);
                                                    const bal = parseInt(balances[id]) || 0;

                                                    const rawValue = bal * 0.015;

                                                    const value =
                                                        rawValue >= 1
                                                            ? "$" + Math.round(rawValue).toLocaleString()
                                                            : rawValue > 0
                                                                ? "$" + rawValue.toFixed(2)
                                                                : null;

                                                    return (
                                                        <div key={id} className="flex items-center gap-3">
                                                            <span className="text-gray-400 text-sm w-24 flex-shrink-0">
                                                                {prog?.short}:
                                                            </span>

                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="number"
                                                                    value={balances[id] || ""}
                                                                    onChange={(e) =>
                                                                        updateBalance(id, e.target.value)
                                                                    }
                                                                    placeholder="80,000"
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                                />

                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                                                                    pts
                                                                </span>
                                                            </div>

                                                            {value && (
                                                                <span className="text-emerald-400 text-xs font-medium flex-shrink-0 bg-emerald-500/10 px-2 py-1 rounded">
                                                                    ~{value}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {/* Step 3: Trip Details */}
                                    <div className="mb-6">
                                        <h2 className="text-white font-semibold mb-3">
                                            Where do you want to go?
                                        </h2>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">
                                                    From
                                                </label>
                                                <input
                                                    value={origin}
                                                    onChange={(e) => setOrigin(e.target.value)}
                                                    placeholder="SFO"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">
                                                    To
                                                </label>
                                                <input
                                                    value={destination}
                                                    onChange={(e) => setDestination(e.target.value)}
                                                    placeholder="Tokyo"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs mb-1">
                                                    Dates
                                                </label>
                                                <input
                                                    value={dates}
                                                    onChange={(e) => setDates(e.target.value)}
                                                    placeholder="Mar 15-22"
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">
                                                        Class
                                                    </label>
                                                    <select
                                                        value={cabin}
                                                        onChange={(e) => setCabin(e.target.value)}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                    >
                                                        <option value="economy">Economy</option>
                                                        {/* <option value="premium_economy">Premium Economy</option> */}
                                                        <option value="business">Business</option>
                                                        <option value="first">First</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">
                                                        Travelers
                                                    </label>
                                                    <select
                                                        value={travelers}
                                                        onChange={(e) => setTravelers(e.target.value)}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                    >
                                                        {[1, 2, 3, 4].map((n) => (
                                                            <option key={n} value={n}>
                                                                {n}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={handleSearch}
                                        disabled={!origin || !destination}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    >
                                        FIND MY SAVINGS <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                /* Flow 1A: Signup-first variant — signup CTA is primary, but search funnel still available */
                                <>
                                    {/* Primary CTA — signup first */}
                                    <div className="text-center mb-6">
                                        <button
                                            onClick={() => router.push("/signup")}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-10 rounded-full inline-flex items-center gap-2 shadow-lg text-lg"
                                        >
                                            Get Started — It's Free
                                            <ArrowRight className="w-5 h-5" />
                                        </button>

                                        <p className="text-gray-400 text-sm mt-3">
                                            No credit card required. Set up in 30 seconds.
                                        </p>
                                    </div>

                                    {/* Social proof */}
                                    <div className="flex items-center justify-center gap-4 mb-8 text-sm text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Star
                                                className="w-4 h-4 text-amber-400"
                                                fill="currentColor"
                                            />{" "}
                                            4.9/5
                                        </span>
                                        <span>•</span>
                                        <span>12,000+ trips optimized</span>
                                        <span>•</span>
                                        <span>$2.4M saved</span>
                                    </div>

                                    {/* Secondary path — try a search first */}
                                    <div className="border-t border-gray-700/50 pt-6">
                                        <button
                                            onClick={() => setShowTrySearch((prev) => !prev)}
                                            className="flex items-center gap-2 mx-auto text-gray-400 hover:text-white text-sm transition-colors"
                                        >
                                            <Search className="w-4 h-4" /> Or try a search first — no
                                            signup needed{" "}
                                            <ChevronDown
                                                className={`w-4 h-4 transition-transform ${showTrySearch ? "rotate-180" : ""}`}
                                            />
                                        </button>
                                        {showTrySearch && (
                                            <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl mt-4">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Sparkles className="w-5 h-5 text-emerald-400" />
                                                    <span className="text-white font-semibold text-sm">
                                                        Quick search — see your savings instantly
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <div>
                                                        <label className="block text-gray-400 text-xs mb-1">
                                                            From
                                                        </label>
                                                        <input
                                                            value={origin}
                                                            onChange={(e) => setOrigin(e.target.value)}
                                                            placeholder="SFO"
                                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-xs mb-1">
                                                            To
                                                        </label>
                                                        <input
                                                            value={destination}
                                                            onChange={(e) => setDestination(e.target.value)}
                                                            placeholder="Tokyo"
                                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-xs mb-1">
                                                            Class
                                                        </label>
                                                        <select
                                                            value={cabin}
                                                            onChange={(e) => setCabin(e.target.value)}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                        >
                                                            <option value="economy">Economy</option>
                                                            {/* <option value="premium_economy">Premium Economy</option> */}
                                                            <option value="business">Business</option>
                                                            <option value="first">First</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-400 text-xs mb-1">
                                                            Travelers
                                                        </label>
                                                        <select
                                                            value={travelers}
                                                            onChange={(e) => setTravelers(e.target.value)}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                        >
                                                            {[1, 2, 3, 4].map((n) => (
                                                                <option key={n} value={n}>
                                                                    {n}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleSearch}
                                                    disabled={!origin || !destination}
                                                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                                                >
                                                    FIND MY SAVINGS <ArrowRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {showInlineSearch && (
                                <div className="text-center mb-8">
                                    <button
                                        onClick={() => router.push("/signup")}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-full inline-flex items-center gap-2 shadow-lg"
                                    >
                                        Get Started — It's Free
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Searching */}
                    {searching && (
                        <SearchProgress
                            origin={origin}
                            destination={destination}
                            cabin={cabin}
                            travelers={travelers}
                            programs={selectedPrograms
                                .map((id) => REWARD_PROGRAMS.find((p) => p.id === id)?.short)
                                .filter(Boolean)
                                .join(", ")}
                        />
                    )}

                    {/* Teaser Result */}
                    {teaserResult && !showSignupGate && (
                        <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
                            <div className="flex items-center gap-2 text-emerald-400 mb-4">
                                <Sparkles className="w-5 h-5" />
                                <span className="font-semibold">
                                    Great news. Savings detected.
                                </span>
                            </div>

                            <button
                                onClick={() => setShowSignupGate(true)}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
                            >
                                CREATE FREE ACCOUNT <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Signup Gate */}
                    {showSignupGate && (
                        <div className="bg-gray-900/90 backdrop-blur rounded-xl p-6 shadow-2xl">
                            <h2 className="text-xl font-bold text-white mb-2">
                                Unlock your verdict
                            </h2>

                            <button
                                onClick={() => router.push("/login")}
                                className="text-emerald-400 hover:text-emerald-300"
                            >
                                Log In
                            </button>
                        </div>
                    )}
                </main>
                <footer className="text-center py-8 text-gray-300 text-sm">
                    <p>© 2026 MyTravelWallet. One verdict, not 47 options.</p>

                    <button
                        onClick={() => router.push("/about")}
                        className="text-emerald-400 hover:text-emerald-300 text-sm mt-2"
                    >
                        About Us
                    </button>
                </footer>
            </div>
        </div>
    );
}
