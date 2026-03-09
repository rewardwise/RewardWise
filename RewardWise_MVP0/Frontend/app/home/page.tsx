/** @format */
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TropicalBackground from "@/components/TropicalBackground";
import { useAuth } from "@/context/AuthProvider";
import { useWallet } from "@/context/WalletContext";
import { useSearchFill } from "@/context/SearchFillContext";
import { useABTest } from "@/context/ABTestContext";
import {
  MapPin,
  Calendar,
  Plane,
  User,
  Search,
  Loader2,
  Star,
  Lock,
  ExternalLink,
} from "lucide-react";

// ─── INTERFACES ────────────────────────────────────────────────────────────────

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

interface FlightSegment {
  flight_number: string;
  aircraft_name: string;
  aircraft_code: string;
  origin: string;
  destination: string;
  departs_at: string;
  arrives_at: string;
  fare_class: string;
  cabin: string;
  distance: number;
}

interface BookingLink {
  label: string;
  link: string;
  primary: boolean;
}

interface TripDetail {
  trips: Array<{
    id: string;
    total_duration: number;
    stops: number;
    flight_numbers: string;
    departs_at: string;
    arrives_at: string;
    segments: FlightSegment[];
  }>;
  booking_links: BookingLink[];
}

interface AwardOption {
  program: string;
  points: number;
  taxes: number | null;
  taxes_currency: string;
  remaining_seats: number;
  airlines: string;
  direct: boolean;
  date: string;
  route: string;
  trip_ids: string[];
  trips: Array<{
    id: string;
    total_duration: number;
    stops: number;
    flight_numbers: string;
    departs_at: string;
    arrives_at: string;
    segments: FlightSegment[];
  }>;
  also_available: Record<
    string,
    { available: boolean; points: number; seats: number; direct: boolean; taxes?: number }
  >;
  source: string;
}

interface SearchResult {
  origin: string;
  destination: string;
  date: string;
  cabin: string;
  cash_price: number | null;
  price_level: string | null;
  typical_price_range: [number, number] | null;
  flights: CashFlight[];
  award_options: AwardOption[];
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function getFallbackBookingUrl(program: string): string {
  const map: Record<string, string> = {
    united:      "https://www.united.com/en/us/flight-search/book-a-flight",
    aeroplan:    "https://www.aircanada.com/us/en/aco/home/book/flights-only.html",
    delta:       "https://www.delta.com/us/en/flight-search/book-a-flight",
    american:    "https://www.aa.com/booking/find-flights",
    british:     "https://www.britishairways.com/travel/redeem/execclub/_gf/en_us",
    virgin:      "https://flyvaa.com",
    singapore:   "https://www.singaporeair.com/en_UK/us/travel-info/krisflyer/use-miles/",
    cathay:      "https://www.cathaypacific.com/cx/en_US/cathay-membership/earn-use-miles/use-miles.html",
    flying_blue: "https://www.flyingblue.com/en/spend/flights/search",
    emirates:    "https://www.emirates.com/us/english/skywards/use-miles/",
    turkish:     "https://www.turkishairlines.com/en-us/miles-and-smiles/",
    avianca:     "https://www.avianca.com/us/en/travel-information/lifemiles/redeem-miles/",
    alaska:      "https://www.alaskaair.com/booking/flights",
    qantas:      "https://www.qantas.com/us/en/frequent-flyer/frequent-flyer-program/use-points/fly.html",
  };
  return map[program.toLowerCase()] ?? "https://seats.aero";
}

// ─── AWARD CARD ────────────────────────────────────────────────────────────────

function AwardCard({ opt, highlight }: { opt: AwardOption; highlight: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [tripData, setTripData] = useState<TripDetail | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(false);

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);

    if (next && !tripData && opt.trip_ids && opt.trip_ids.length > 0) {
      setLoadingTrip(true);
      try {
        const res = await fetch(`http://localhost:8000/api/trips/${opt.trip_ids[0]}`);
        if (res.ok) {
          const data = await res.json();
          setTripData(data);
        }
      } catch (_) {}
      setLoadingTrip(false);
    }
  };

  const segments =
    tripData?.trips?.[0]?.segments ??
    opt.trips?.[0]?.segments ??
    [];
  const bookingLinks = tripData?.booking_links ?? [];
  const primaryLink = bookingLinks.find((l) => l.primary) ?? bookingLinks[0];
  const secondaryLinks = bookingLinks.filter((l) => !l.primary);

  return (
    <div className={`rounded-xl overflow-hidden ${highlight ? "border border-emerald-500/20" : ""}`}>
      {/* SUMMARY ROW */}
      <button
        onClick={handleExpand}
        className={`w-full p-4 flex items-center justify-between text-left transition-colors ${
          highlight
            ? "bg-gray-800 hover:bg-gray-700"
            : "bg-gray-800/50 hover:bg-gray-800/70"
        }`}
      >
        <div>
          <p className={`font-semibold capitalize text-sm ${highlight ? "text-white" : "text-gray-400"}`}>
            {opt.program}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">
            {opt.airlines || "Various airlines"}
            {" · "}
            {opt.direct ? "Nonstop" : "Connecting"}
            {opt.taxes != null && opt.taxes > 0 && (
              <span className="ml-1">
                · +{opt.taxes_currency} {opt.taxes} taxes
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`font-bold text-sm ${highlight ? "text-emerald-400" : "text-gray-500"}`}>
              {opt.points.toLocaleString()} pts
            </p>
            {opt.remaining_seats > 0 && (
              <p className="text-gray-600 text-xs">{opt.remaining_seats} left</p>
            )}
          </div>
          <span className="text-gray-600 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* EXPANDED DETAIL */}
      {expanded && (
        <div
          className={`border-t border-gray-700 px-4 pb-4 pt-3 space-y-3 ${
            highlight ? "bg-gray-800" : "bg-gray-800/50"
          }`}
        >
          {loadingTrip && (
            <p className="text-gray-500 text-xs flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading flight details...
            </p>
          )}

          {/* SEGMENTS */}
          {segments.length > 0 && (
            <div className="space-y-2">
              {segments.map((seg, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {i < segments.length - 1 && (
                      <div className="w-px flex-1 bg-gray-700 my-1 min-h-[12px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-medium">
                          {seg.origin} → {seg.destination}
                        </p>
                        {(seg.departs_at || seg.arrives_at) && (
                          <p className="text-gray-500 text-xs">
                            {seg.departs_at?.slice(11, 16)} – {seg.arrives_at?.slice(11, 16)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {seg.flight_number && (
                          <p className="text-gray-400 text-xs font-mono">{seg.flight_number}</p>
                        )}
                        {seg.aircraft_name && (
                          <p className="text-gray-600 text-xs">{seg.aircraft_name}</p>
                        )}
                        {seg.fare_class && (
                          <p className="text-gray-600 text-xs">Class {seg.fare_class}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* OTHER CABINS UPSELL */}
          {Object.keys(opt.also_available ?? {}).length > 0 && (
            <div className="pt-2 border-t border-gray-700">
              <p className="text-gray-500 text-xs mb-1.5">Also available on this program:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(opt.also_available).map(([cabinName, info]) => (
                  <div key={cabinName} className="bg-gray-700 rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-gray-300 capitalize">{cabinName}</span>
                    <span className="text-emerald-400 ml-1.5 font-medium">
                      {Number(info.points).toLocaleString()} pts
                    </span>
                    {info.direct && <span className="text-gray-500 ml-1">· Direct</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOOKING LINKS */}
          {!loadingTrip && (
            <div className="pt-2 border-t border-gray-700 space-y-2">
              {primaryLink ? (
                <>
                  <a
                    href={primaryLink.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {primaryLink.label}
                  </a>
                  {secondaryLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {secondaryLinks.map((l, i) => (
                        <a
                          key={i}
                          href={l.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-2 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-gray-600 text-xs text-center">
                    ⚠ Verify availability before transferring points — data may be cached
                  </p>
                </>
              ) : (
                <a
                  href={getFallbackBookingUrl(opt.program)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold py-2.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Search on {opt.program}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CASH FLIGHT CARD ──────────────────────────────────────────────────────────

function FlightCard({ flight }: { flight: CashFlight }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-700 transition-colors"
      >
        {flight.legs[0]?.airline_logo && (
          <img
            src={flight.legs[0].airline_logo}
            alt={flight.legs[0].airline}
            className="w-8 h-8 object-contain"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">{flight.departure_iata}</span>
            <span className="text-gray-600 text-xs">→</span>
            <span className="text-white font-semibold text-sm">{flight.arrival_iata}</span>
            <span className="text-gray-500 text-xs ml-1">
              {flight.departure_time?.slice(11, 16)} – {flight.arrival_time?.slice(11, 16)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gray-500 text-xs">{formatDuration(flight.total_duration)}</span>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-gray-500 text-xs">
              {flight.stops === 0
                ? "Nonstop"
                : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </span>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-gray-500 text-xs">{flight.legs[0]?.airline}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-bold">${flight.price}</p>
          <p className="text-gray-600 text-xs">{expanded ? "▲ less" : "▼ details"}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-700 px-4 pb-4 pt-3 space-y-3">
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
                      {leg.departure_time?.slice(11, 16)} – {leg.arrival_time?.slice(11, 16)}
                      {" · "}
                      {formatDuration(leg.duration)}
                      {leg.overnight && (
                        <span className="ml-1 text-blue-400">Overnight</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs font-mono">{leg.flight_number}</p>
                    <p className="text-gray-600 text-xs">{leg.airplane}</p>
                  </div>
                </div>
                {leg.extensions && leg.extensions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {leg.extensions.slice(0, 4).map((ext, j) => (
                      <span
                        key={j}
                        className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                )}
                {leg.often_delayed && (
                  <p className="text-amber-400 text-xs mt-1">⚠ Often delayed 30+ min</p>
                )}
              </div>
            </div>
          ))}
          {flight.carbon_emissions && (
            <p className="text-gray-600 text-xs pt-1 border-t border-gray-700">
              ~{Math.round(flight.carbon_emissions / 1000)}kg CO₂
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { searchCount, setSearchCount } = useAuth();
  const { userPrograms, hasWallet } = useWallet();
  const { searchFill } = useSearchFill();
  useABTest();

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

  const yourOptions =
    results?.award_options.filter((opt) =>
      userPrograms.includes(opt.program.toLowerCase())
    ) ?? [];

  const otherOptions =
    results?.award_options.filter(
      (opt) => !userPrograms.includes(opt.program.toLowerCase())
    ) ?? [];

  const bestOption =
    yourOptions.length > 0
      ? yourOptions.reduce((a, b) => (a.points <= b.points ? a : b))
      : null;

  const cppVerdict =
    bestOption && results?.cash_price
      ? ((results.cash_price / bestOption.points) * 100).toFixed(2)
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

          {/* SEARCH GRID ROW 1 */}
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

          {/* SEARCH GRID ROW 2 */}
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
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Searching...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" /> Search Flights
              </>
            )}
          </button>

          {searchError && (
            <p className="text-red-400 text-sm text-center mb-4">{searchError}</p>
          )}

          {/* ── RESULTS ── */}
          {results && (
            <div className="mt-2 space-y-4">

              {/* VERDICT BANNER */}
              {bestOption && cppVerdict ? (
                <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-semibold">
                      Best use of your points
                    </span>
                  </div>
                  <p className="text-white font-bold text-lg capitalize">
                    {bestOption.program} — {bestOption.points.toLocaleString()} pts
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {cppVerdict}¢ per point
                    {results.cash_price ? ` · vs $${results.cash_price} cash` : ""}
                    {" · "}
                    {bestOption.direct ? "Nonstop" : "Connecting"}
                  </p>
                </div>
              ) : results.award_options.length > 0 && !hasWallet ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <p className="text-amber-400 text-sm font-semibold mb-1">
                    No wallet set up yet
                  </p>
                  <p className="text-gray-400 text-xs mb-2">
                    Add your cards to see which programs you can redeem with.
                  </p>
                  <button
                    onClick={() => router.push("/wallet-setup")}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    Set up wallet →
                  </button>
                </div>
              ) : null}

              {/* CASH FLIGHTS */}
              {results.flights && results.flights.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-gray-300 text-sm font-semibold">Cash Flights</h2>
                    {results.price_level && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          results.price_level === "low"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : results.price_level === "high"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {results.price_level === "low"
                          ? "🟢 Low prices"
                          : results.price_level === "high"
                          ? "🔴 High prices"
                          : "🟡 Typical prices"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {results.flights.map((flight, i) => (
                      <FlightCard key={i} flight={flight} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Best cash price</span>
                  <span className="text-white font-bold text-lg">
                    {results.cash_price ? `$${results.cash_price}` : "N/A"}
                  </span>
                </div>
              )}

              {/* YOUR PROGRAMS */}
              {hasWallet && (
                <div>
                  <h2 className="text-emerald-400 text-sm font-semibold mb-2 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" />
                    Your programs ({yourOptions.length})
                  </h2>
                  {yourOptions.length === 0 ? (
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                      <p className="text-gray-500 text-sm">
                        No availability in your programs for this route.
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        Check other programs below or try a different date.
                      </p>
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
                  {hasWallet
                    ? `Other programs (${otherOptions.length})`
                    : `All programs (${results.award_options.length})`}
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
