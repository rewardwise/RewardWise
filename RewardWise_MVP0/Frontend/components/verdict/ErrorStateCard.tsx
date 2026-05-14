/** @format */
"use client";

import { DatabaseZap, RefreshCw } from "lucide-react";

type Props = {
  onRetry?: () => void;
};

export default function ErrorStateCard({ onRetry }: Props) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8">
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
          <DatabaseZap className="h-8 w-8 text-amber-300" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            We could not pull the latest data for this flight
          </h2>
          <p className="text-base leading-7 text-slate-300">
            Please try again momentarily. The award and cash pricing data is temporarily unavailable for this route.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          <RefreshCw className="h-4 w-4" /> Retry search
        </button>
      </div>
    </div>
  );
}
