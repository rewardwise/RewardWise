interface Result {
  program: string;
  points: number;
  taxes: number;
  cash_price: number;
  cpp: number;
  verdict: string;
}

interface VerdictCardProps {
  results: Result[];
  cashPrice: number;
  origin: string;
  destination: string;
}

const verdictColor = (verdict: string) => {
  if (verdict === "Excellent redemption") return "bg-green-100 text-green-700";
  if (verdict === "Good redemption") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

export default function VerdictCard({ results, cashPrice, origin, destination }: VerdictCardProps) {
  return (
    <div className="flex flex-col gap-4 w-full max-w-lg">
      <div className="text-sm text-gray-500 font-medium">
        {origin} → {destination} · Cash price: <span className="font-semibold text-gray-800">${cashPrice}</span>
      </div>
      {results.map((r, i) => (
        <div key={i} className="bg-white rounded-2xl shadow p-5 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-800 text-lg">{r.program}</span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${verdictColor(r.verdict)}`}>{r.verdict}</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <span>{r.points.toLocaleString()} pts</span>
            <span>+${r.taxes} taxes</span>
            <span className="font-bold text-indigo-600">{r.cpp.toFixed(2)}¢ / pt</span>
          </div>
        </div>
      ))}
    </div>
  );
}