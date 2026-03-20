/** @format */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletContext";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";
import VerdictCard from "@/components/VerdictCard";
import {
  MapPin,
  Calendar,
  Plane,
  User,
  Search,
  Loader2,
  ArrowRight,
} from "lucide-react";

// ─── INTERFACES ──────────────────────────────────────────────────────────────
interface FlightLeg {
  flight_number: string;
  airline: string;
  airline_logo: string;
  airplane: string;
  travel_class: string;
  legroom: string;
  duration: number;
  departure_airport: string;
  departure_iata: string;
  departure_time: string;
  arrival_airport: string;
  arrival_iata: string;
  arrival_time: string;
  extensions: string[];
  overnight: boolean;
  often_delayed: boolean;
}

interface CashFlight {
  price: number;
  total_duration: number;
  stops: number;
  departure_airport: string;
  departure_iata: string;
  departure_time: string;
  arrival_airport: string;
  arrival_iata: string;
  arrival_time: string;
  carbon_emissions: number | null;
  legs: FlightLeg[];
}

interface VerdictWinner {
  program: string | null;
  points: number | null;
  taxes: number | null;
  cpp: number | null;
  direct: boolean | null;
}

interface BookingLink {
  seats_aero_link: string | null;
  airline_link: string | null;
  preferred: "seats_aero" | "airline" | "none";
}

interface Verdict {
  verdict: string;
  winner: VerdictWinner | null;
  pay_cash: boolean;
  confidence: "high" | "medium" | "low";
  booking_note: string;
  booking_link: BookingLink;
}

interface SearchResult {
  origin: string;
  destination: string;
  date: string;
  cabin: string;
  travelers: number;
  is_roundtrip: boolean;
  return_date: string | null;
  cash_price: number | null;
  price_level: string | null;
  typical_price_range: [number, number] | null;
  flights: CashFlight[];
  award_options: any[];
  return_award_options: any[];
  verdict: Verdict;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// ─── CASH FLIGHT CARD ────────────────────────────────────────────────────────
function FlightCard({ flight }: { flight: CashFlight }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-gray-800/60 rounded-lg overflow-hidden border border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700/50 transition-colors"
      >
        {flight.legs[0]?.airline_logo && (
          <img
            src={flight.legs[0].airline_logo}
            alt={flight.legs[0].airline}
            className="w-7 h-7 object-contain flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold text-sm">
              {flight.departure_iata}
            </span>
            <ArrowRight className="w-3 h-3 text-gray-600" />
            <span className="text-white font-semibold text-sm">
              {flight.arrival_iata}
            </span>
            <span className="text-gray-500 text-xs ml-1">
              {flight.departure_time?.slice(11, 16)} –{" "}
              {flight.arrival_time?.slice(11, 16)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-gray-500 text-xs">
              {formatDuration(flight.total_duration)}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 text-xs">
              {flight.stops === 0
                ? "Nonstop"
                : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-500 text-xs">
              {flight.legs[0]?.airline}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-bold">${flight.price}</p>
          <p className="text-gray-600 text-xs">
            {expanded ? "▲ less" : "▼ details"}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-700/50 px-4 pb-4 pt-3 space-y-3">
          {flight.legs.map((leg, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                {i < flight.legs.length - 1 && (
                  <div className="w-px flex-1 bg-gray-700 my-1" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {leg.departure_iata} → {leg.arrival_iata}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {leg.departure_time?.slice(11, 16)} –{" "}
                      {leg.arrival_time?.slice(11, 16)}
                      {" · "}
                      {formatDuration(leg.duration)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs font-mono">
                      {leg.flight_number}
                    </p>
                    <p className="text-gray-600 text-xs">{leg.airplane}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { searchCount, setSearchCount, session } = useAuth();
  const { userPrograms, hasWallet } = useWallet();
  const { searchFill } = useSearchFill();
  useABTest();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travelers, setTravelers] = useState(1);
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
    if (searchFill.travelers) setTravelers(Number(searchFill.travelers));
  }, [searchFill]);

  const runSearch = async () => {
    if (!origin || !destination || !departDate) {
      setSearchError("Please fill in origin, destination, and departure date.");
      return;
    }
    if (tripType === "roundtrip" && !returnDate) {
      setSearchError("Please select a return date for round trips.");
      return;
    }

    setSearchError("");
    setResults(null);
    setSearching(true);
    setSearchCount(searchCount + 1);

    try {
      const params = new URLSearchParams({
        origin,
        destination,
        date: departDate,
        cabin,
        travelers: travelers.toString(),
      });
      if (tripType === "roundtrip" && returnDate) {
        params.append("return_date", returnDate);
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL;

      if (!session?.access_token) {
        throw new Error("You must be logged in to run searches.");
      }

      const res = await fetch(`${API_URL}/api/search?${params.toString()}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const detail = errData?.detail;
        const message = Array.isArray(detail)
          ? (detail[0]?.msg?.replace("Value error, ", "") ?? `Server error: ${res.status}`)
          : (detail ?? `Server error: ${res.status}`);
        throw new Error(message);
      }

      setResults(await res.json());
    } catch (err: any) {
      setSearchError(err.message || "Something went wrong. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const numTravelers = results?.travelers ?? travelers;

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

          {/* TRIP TYPE TOGGLE */}
          <div className="flex gap-2 mb-3">
            {(["roundtrip", "oneway"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTripType(type);
                  if (type === "oneway") setReturnDate("");
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tripType === type
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {type === "roundtrip" ? "Round Trip" : "One Way"}
              </button>
            ))}
          </div>

          {/* SEARCH ROW 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                FROM
              </label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                placeholder="e.g. EWR"
                maxLength={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                TO
              </label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                placeholder="e.g. LAX"
                maxLength={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                DEPART
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

          {/* SEARCH ROW 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {tripType === "roundtrip" ? (
              <div>
                <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  RETURN
                </label>
                <input
                  type="date"
                  min={departDate || new Date().toISOString().split("T")[0]}
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
                <User className="w-3 h-3" />
                TRAVELERS
              </label>
              <select
                value={travelers}
                onChange={(e) => setTravelers(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} Traveler{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
                <Plane className="w-3 h-3" />
                CABIN
              </label>
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 mb-4 transition-colors"
          >
            {searching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Search Flights
              </>
            )}
          </button>

          {searchError && (
            <p className="text-red-400 text-sm text-center mb-4">
              {searchError}
            </p>
          )}

          {/* ── RESULTS ─────────────────────────────────────────────────── */}
          {results && (
            <div className="mt-2 space-y-4">
              {results.verdict ? (
                <VerdictCard
                  verdict={results.verdict}
                  cashPrice={results.cash_price}
                  origin={results.origin}
                  destination={results.destination}
                  departDate={results.date}
                  returnDate={results.return_date}
                  cabin={results.cabin}
                  travelers={numTravelers}
                  isRoundtrip={results.is_roundtrip}
                  awardOptions={results.award_options}
                  returnAwardOptions={results.return_award_options}
                  flights={results.flights}
                />
              ) : !hasWallet ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <p className="text-amber-400 text-sm font-semibold mb-1">
                    No wallet set up yet
                  </p>
                  <p className="text-gray-400 text-xs mb-2">
                    Add your loyalty programs to get a personalized verdict.
                  </p>
                  <button
                    onClick={() => router.push("/wallet-setup")}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    Set up wallet →
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}