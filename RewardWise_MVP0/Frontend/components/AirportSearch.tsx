/** @format */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, X } from "lucide-react";
import { searchAirports, type Airport } from "@/components/airports";
import {
  searchMetros,
  findMetroByCsv,
  formatMetroDisplay,
  type MetroGroup,
} from "@/components/metro-groups";

interface AirportSearchProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

type Result =
  | { kind: "airport"; airport: Airport }
  | { kind: "metro"; metro: MetroGroup };

export default function AirportSearch({
  label,
  value,
  onChange,
  placeholder = "e.g. JFK",
}: AirportSearchProps) {
  const valueToDisplay = (raw: string): string => {
    if (!raw) return "";
    if (raw.includes(",")) {
      const metro = findMetroByCsv(raw);
      return metro ? formatMetroDisplay(metro) : raw;
    }
    return raw;
  };

  const [query, setQuery] = useState(() => valueToDisplay(value));
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync query when parent resets value (setState-during-render pattern)
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setQuery(valueToDisplay(value));
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        // If they typed but didn't select, restore to last valid value
        const display = valueToDisplay(value);
        if (value && query !== display) setQuery(display);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value, query]);

  const buildResults = (raw: string): Result[] => {
    const metros = searchMetros(raw).map<Result>((m) => ({ kind: "metro", metro: m }));
    const airports = searchAirports(raw).map<Result>((a) => ({ kind: "airport", airport: a }));
    return [...metros, ...airports].slice(0, 8);
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase();
    setQuery(raw);
    setHighlighted(-1);
    if (raw.length === 0) {
      setResults([]);
      setOpen(false);
      onChange("");
      return;
    }
    const found = buildResults(raw);
    setResults(found);
    setOpen(found.length > 0);
  }, [onChange]);

  const select = useCallback((r: Result) => {
    if (r.kind === "metro") {
      const csv = r.metro.airports.join(",");
      setQuery(formatMetroDisplay(r.metro));
      onChange(csv);
    } else {
      setQuery(r.airport.code);
      onChange(r.airport.code);
    }
    setOpen(false);
    setResults([]);
    setHighlighted(-1);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && results[highlighted]) {
        select(results[highlighted]);
      } else if (results[0]) {
        select(results[0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      if (value) setQuery(valueToDisplay(value));
    }
  };

  const clear = () => {
    setQuery("");
    onChange("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label className="block text-emerald-400 text-xs mb-1 flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
            else if (query.length > 0) {
              const found = buildResults(query);
              setResults(found);
              setOpen(found.length > 0);
            }
          }}
          placeholder={placeholder}
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 pr-8 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm uppercase"
          style={{ caretColor: "#34d399" }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {results.map((r, i) => {
            const isMetro = r.kind === "metro";
            const code = isMetro ? r.metro.code : r.airport.code;
            const primary = isMetro
              ? r.metro.name
              : `${r.airport.city}${r.airport.name ? ` - ${r.airport.name}` : ""}`;
            const trailing = isMetro
              ? r.metro.airports.join(" · ")
              : r.airport.country;
            const key = isMetro ? `metro-${r.metro.code}` : `airport-${r.airport.code}`;
            return (
              <button
                key={key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(r);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors"
                style={{
                  background: i === highlighted ? "rgba(16,185,129,0.08)" : "transparent",
                  borderBottom: i < results.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                }}
              >
                <span
                  className="font-bold text-sm flex-shrink-0 w-14 text-center rounded-md py-0.5"
                  style={{
                    color: i === highlighted ? "#059669" : "#6b7280",
                    background: i === highlighted ? "rgba(16,185,129,0.1)" : "rgba(0,0,0,0.04)",
                  }}
                >
                  {isMetro ? `${code} ✦` : code}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: i === highlighted ? "#1f2937" : "#374151" }}
                  >
                    {primary}
                  </p>
                  {isMetro && (
                    <p className="text-[11px] text-emerald-600/80 truncate">
                      All airports — {r.metro.airports.length} in this group
                    </p>
                  )}
                </div>

                <span className="text-xs flex-shrink-0 truncate max-w-[120px]" style={{ color: "#9ca3af" }}>
                  {trailing}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}