/** @format */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, X } from "lucide-react";
import { searchAirports, type Airport } from "@/components/airports";

interface AirportSearchProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

export default function AirportSearch({
  label,
  value,
  onChange,
  placeholder = "e.g. JFK",
}: AirportSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keep query in sync if parent resets value
  useEffect(() => {
    setQuery(value);
  }, [value]);

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
        if (value && query !== value) setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [value, query]);

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
    const found = searchAirports(raw);
    setResults(found);
    setOpen(found.length > 0);
  }, [onChange]);

  const select = useCallback((airport: Airport) => {
    setQuery(airport.code);
    onChange(airport.code);
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
      if (value) setQuery(value);
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
              const found = searchAirports(query);
              setResults(found);
              setOpen(found.length > 0);
            }
          }}
          placeholder={placeholder}
          maxLength={10}
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
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}
        >
          {results.map((airport, i) => (
            <button
              key={airport.code}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                select(airport);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors"
              style={{
                background: i === highlighted ? "rgba(52,211,153,0.08)" : "transparent",
                borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              {/* IATA code badge */}
              <span
                className="font-bold text-sm flex-shrink-0 w-10 text-center rounded-md py-0.5"
                style={{
                  color: i === highlighted ? "#34d399" : "#94a3b8",
                  background: i === highlighted ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.05)",
                }}
              >
                {airport.code}
              </span>

              {/* City + name */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: i === highlighted ? "#fff" : "#cbd5e1" }}
                >
                  {airport.city}
                  {airport.name ? ` — ${airport.name}` : ""}
                </p>
              </div>

              {/* Country flag / code */}
              <span className="text-xs flex-shrink-0" style={{ color: "#475569" }}>
                {airport.country}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}