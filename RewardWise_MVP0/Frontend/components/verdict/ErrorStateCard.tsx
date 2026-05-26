/** @format */
"use client";

import { Calendar, DatabaseZap, RefreshCw } from "lucide-react";

type Props = {
  onRetry?: () => void;
  headline?: string;
  message?: string;
  ctaText?: string;
  onCta?: () => void;
};

const DEFAULT_HEADLINE = "We could not pull the latest data for this flight";
const DEFAULT_MESSAGE =
  "Please try again momentarily. The award and cash pricing data is temporarily unavailable for this route.";
const DEFAULT_CTA_TEXT = "Retry search";

export default function ErrorStateCard({
  onRetry,
  headline,
  message,
  ctaText,
  onCta,
}: Props) {
  const handleCta = () => {
    if (onCta) {
      onCta();
      return;
    }
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const finalHeadline = headline ?? DEFAULT_HEADLINE;
  const finalMessage = message ?? DEFAULT_MESSAGE;
  const finalCtaText = ctaText ?? DEFAULT_CTA_TEXT;
  const Icon = onCta ? Calendar : RefreshCw;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl md:p-8">
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
          <DatabaseZap className="h-8 w-8 text-amber-300" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            {finalHeadline}
          </h2>
          <p className="text-base leading-7 text-slate-300">{finalMessage}</p>
        </div>
        <button
          type="button"
          onClick={handleCta}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          <Icon className="h-4 w-4" /> {finalCtaText}
        </button>
      </div>
    </div>
  );
}
