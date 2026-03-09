/** @format */
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletContext";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";
import { MapPin, Calendar, Plane, User, Search, Loader2, Star, Lock } from "lucide-react";

interface AwardOption {
  program: string;
  points: number;
  remaining_seats: number;
  airlines: string;
  direct: boolean;
  date: string;
  source: string;
}

interface SearchResult {
  origin: string;
  destination: string;
  date: string;
  cabin: string;
  cash_price: number | null;
  award_options: AwardOption[];
}

export default function HomePage() {
  const router = useRouter();
  const { searchCount, setSearchCount } = useAuth();
  const { userPrograms, hasWallet, cards } = useWallet();
  const { searchFill } = useSearchFill();
  const abTests = useABTest();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travelers, setTravelers] = useState("2");
  const [cabin, setCabin] = useState("economy");
  const [tripType, setTripType] = useState("roundtrip");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!searchFill) return;
    if (searchFill.origin) setOrigin(searchFill.origin);
    if (searchFill.destination) setDestination(searchFill.destination);
    if (searchFill.cabin) setCabin(searchFill.cabin);
    if (searchFill.travelers) setTravelers(searchFill.travelers);
  }, [searchFill]);

  const runSearch = async () => {
    if (!origin || !destination || !departDate) {
      setSearchError("Please fill in origin, destination, and departure date.");
      return;
    }
    setSearchError("");
    setResults(null);
    setSearching(true);
    setSearchCount(searchCount + 1);

    try {
      const res = await fetch(
        `http://localhost:8000/api/search?origin=${origin}&destination=${destination}&date=${departDate}&cabin=${cabin}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: SearchResult = await res.json();
      setResults(data);
    } catch (err: any) {
      setSearchError(err.message || "Something went wrong. Try again.");
    } finally {
      setSearching(false);
    }
  };

  // Split results into user's programs vs others
  const yourOptions = results?.award_options.filter((opt) =>
    userPrograms.includes(opt.program.toLowerCase())
  ) ?? [];

  const otherOptions = results?.award_options.filter((opt) =>
    !userPrograms.includes(opt.program.toLowerCase())
  ) ?? [];

  // Best option for verdict banner
  const bestOption = yourOptions.length > 0
    ? yourOptions.reduce((a, b) => a.points <= b.points ? a : b)
    : null;

  const cppVerdict = bestOption && results?.cash_price
    ? (results.cash_price / bestOption.points * 100).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
      <TropicalBackground />
      <div className="relative z-10">
        <main className="max-w-5xl mx-auto px-6 py-6">
          {/* HEADER */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">
              Let's optimize your wallet.
            </h1>
            <p className="text-gray-400 text-sm">
              Search a route or ask Zoe — we'll find the best decision for your rewards.
            </p>
          </div>

          {/* TRIP TYPE */}
          <div className="flex gap-2 mb-3">
            {["roundtrip", "oneway"].map((type) => (
              <button
                key={type}
                onClick={() => setTripType(type)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium ${
                  tripType === type
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {type === "roundtrip" ? "Round Trip" : "One Way"}
              </button>
            ))}
          </div>

          {/* SEARCH GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> FROM
              </label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. EWR"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> TO
              </label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. SFO"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> DEPART
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
              />
            </div>
          </div>

          {/* SECOND ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {tripType === "roundtrip" ? (
              <div>
                <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> RETURN
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm [color-scheme:dark]"
                />
              </div>
            ) : (
              <div />
            )}
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> TRAVELERS
              </label>
              <select
                value={travelers}
                onChange={(e) => setTravelers(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} Traveler{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <Plane className="w-3 h-3" /> CABIN
              </label>
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white"
              >
                <option value="economy">Economy</option>
                <option value="premium">Premium</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </div>
          </div>

          {/* SEARCH BUTTON */}
          <button
            onClick={runSearch}
            disabled={searching}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mb-4"
          >
            {searching ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
            ) : (
              <><Search className="w-5 h-5" /> Search Flights</>
            )}
          </button>

          {searchError && (
            <p className="text-red-400 text-sm text-center mb-4">{searchError}</p>
          )}

          {/* RESULTS */}
          {results && (
            <div className="mt-2 space-y-4">

              {/* VERDICT BANNER */}
              {bestOption && cppVerdict ? (
                <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-semibold">Best use of your points</span>
                  </div>
                  <p className="text-white font-bold text-lg capitalize">
                    {bestOption.program} — {bestOption.points.toLocaleString()} pts
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {cppVerdict}¢ per point · {results.cash_price ? `vs $${results.cash_price} cash` : ""}
                    {" · "}{bestOption.direct ? "Direct" : "Connecting"}
                  </p>
                </div>
              ) : results.award_options.length > 0 && !hasWallet ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <p className="text-amber-400 text-sm font-semibold mb-1">No wallet set up yet</p>
                  <p className="text-gray-400 text-xs mb-2">Add your cards to see which programs you can redeem with.</p>
                  <button
                    onClick={() => router.push("/wallet-setup")}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    Set up wallet →
                  </button>
                </div>
              ) : null}

              {/* CASH PRICE */}
              <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Best cash price</span>
                <span className="text-white font-bold text-lg">
                  {results.cash_price ? `$${results.cash_price}` : "N/A"}
                </span>
              </div>

              {/* YOUR PROGRAMS */}
              {hasWallet && (
                <div>
                  <h2 className="text-emerald-400 text-sm font-semibold mb-2 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" />
                    Your programs ({yourOptions.length})
                  </h2>
                  {yourOptions.length === 0 ? (
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                      <p className="text-gray-500 text-sm">No availability in your programs for this route.</p>
                      <p className="text-gray-600 text-xs mt-1">Check other programs below or try a different date.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {yourOptions.map((opt, i) => (
                        <AwardCard key={i} opt={opt} highlight />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* OTHER PROGRAMS */}
              <div>
                <h2 className="text-gray-400 text-sm font-semibold mb-2 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  {hasWallet ? `Other programs (${otherOptions.length})` : `All programs (${results.award_options.length})`}
                </h2>
                {(hasWallet ? otherOptions : results.award_options).length === 0 ? (
                  <p className="text-gray-600 text-sm">No other availability found.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(hasWallet ? otherOptions : results.award_options).map((opt, i) => (
                      <AwardCard key={i} opt={opt} highlight={false} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function AwardCard({ opt, highlight }: { opt: AwardOption; highlight: boolean }) {
  return (
    <div className={`rounded-xl p-4 flex items-center justify-between ${
      highlight ? "bg-gray-800 border border-emerald-500/20" : "bg-gray-800/50"
    }`}>
      <div>
        <p className={`font-semibold capitalize ${highlight ? "text-white" : "text-gray-400"}`}>
          {opt.program}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">
          {opt.airlines || "Various airlines"} · {opt.direct ? "Direct" : "Connecting"}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-bold ${highlight ? "text-emerald-400" : "text-gray-500"}`}>
          {opt.points.toLocaleString()} pts
        </p>
        {opt.remaining_seats > 0 && (
          <p className="text-gray-600 text-xs">{opt.remaining_seats} seats left</p>
        )}
      </div>
    </div>
  );
}