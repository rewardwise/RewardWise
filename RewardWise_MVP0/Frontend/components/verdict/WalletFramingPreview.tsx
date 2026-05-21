/** @format */
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

type Props = {
  onSignup?: () => void;
};

interface WalletExample {
  wallet: string;
  transferTo: string;
  pointsUsed: number;
  taxes: number;
  cashBaseline: number;
  savings: number;
}

// Static representative placeholders (ticket 86ba11m1f scope: static, not
// computed from the user's route). Math: savings = cash − points×$0.01 − taxes.
// Cash baseline = $800 economy long-haul; all flex currencies redeem at ~1 cpp.
const ECONOMY_EXAMPLES: WalletExample[] = [
  {
    wallet: "~50K Chase Ultimate Rewards",
    transferTo: "Aeroplan",
    pointsUsed: 35000,
    taxes: 80,
    cashBaseline: 350,
    savings: 370,
  },
  {
    wallet: "~80K Amex Membership Rewards",
    transferTo: "Flying Blue",
    pointsUsed: 50000,
    taxes: 90,
    cashBaseline: 500,
    savings: 210,
  },
  {
    wallet: "~60K Capital One Miles",
    transferTo: "British Airways Avios",
    pointsUsed: 30000,
    taxes: 55,
    cashBaseline: 300,
    savings: 445,
  },
];

export default function WalletFramingPreview({ onSignup }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="wallet-framing-body"
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            Why cash?
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Without your wallet we default to the safest verdict — cash. See
            what changes once you connect your loyalty programs.
          </p>
        </div>
        {open ? (
          <ChevronUp className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div id="wallet-framing-body" className="mt-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Examples on a typical $800 long-haul economy fare
          </p>

          <ul className="space-y-2">
            {ECONOMY_EXAMPLES.map((ex) => (
              <li
                key={ex.wallet}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <p className="text-xs text-slate-400">With {ex.wallet}</p>
                <p className="mt-1 text-sm text-slate-200">
                  Transfer to{" "}
                  <span className="font-semibold text-white">
                    {ex.transferTo}
                  </span>
                  , book for{" "}
                  <span className="font-semibold text-white">
                    {ex.pointsUsed.toLocaleString()} pts + ${ex.taxes}
                  </span>{" "}
                  taxes.
                </p>
                <p className="mt-1 text-xs text-emerald-300">
                  Saves ~${ex.savings} vs paying cash.
                </p>
              </li>
            ))}
          </ul>

          <p className="text-xs leading-5 text-slate-500">
            Or with bigger wallets: ~75K Chase UR to Aeroplan books a $3,000
            business-class seat for 75,000 pts + $80 — saving roughly{" "}
            <span className="font-semibold text-slate-300">$2,170</span>.
          </p>

          {onSignup && (
            <button
              type="button"
              onClick={onSignup}
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              Sign up to unlock wallet-aware verdicts
            </button>
          )}

          <p className="text-[11px] leading-4 text-slate-500">
            Numbers shown are representative — actual award cost depends on
            route, date, and availability.
          </p>
        </div>
      )}
    </div>
  );
}
