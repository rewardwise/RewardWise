"use client";
import { useState } from "react";

interface SearchFormProps {
  onResults: (data: any) => void;
  onLoading: (loading: boolean) => void;
}

export default function SearchForm({ onResults, onLoading }: SearchFormProps) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [cabin, setCabin] = useState("economy");

  const handleSubmit = async () => {
    if (!origin || !destination || !date) return;
    onLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/search?origin=${origin}&destination=${destination}&date=${date}&cabin=${cabin}`,
        { method: "POST" }
      );
      const data = await res.json();
      onResults(data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-2xl shadow-md w-full max-w-lg">
      <h2 className="text-xl font-semibold text-gray-800">Find Award Flights</h2>
      <div className="flex gap-3">
        <input className="border rounded-lg p-2 w-full uppercase" placeholder="Origin (e.g. JFK)" value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())} maxLength={3} />
        <input className="border rounded-lg p-2 w-full uppercase" placeholder="Destination (e.g. LHR)" value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} maxLength={3} />
      </div>
      <input className="border rounded-lg p-2 w-full" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select className="border rounded-lg p-2 w-full" value={cabin} onChange={e => setCabin(e.target.value)}>
        <option value="economy">Economy</option>
        <option value="premium_economy">Premium Economy</option>
        <option value="business">Business</option>
        <option value="first">First</option>
      </select>
      <button onClick={handleSubmit} className="bg-indigo-600 text-white rounded-lg p-2 font-medium hover:bg-indigo-700 transition">
        Search Awards
      </button>
    </div>
  );
}