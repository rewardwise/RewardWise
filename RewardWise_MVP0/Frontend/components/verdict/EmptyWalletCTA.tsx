/** @format */
"use client";

import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";

type Props = {
  onCta?: () => void;
};

export default function EmptyWalletCTA({ onCta }: Props) {
  const router = useRouter();

  const handleCta = () => {
    if (onCta) {
      onCta();
      return;
    }
    router.push("/wallet-setup");
  };

  return (
    <div
      data-testid="empty-wallet-cta"
      className="rounded-3xl border border-emerald-400/20 bg-slate-950/95 p-6 shadow-2xl md:p-8"
    >
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
          <Wallet className="h-8 w-8 text-emerald-300" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            Add a card or program to get your full verdict
          </h2>
          <p className="text-base leading-7 text-slate-300">
            We can show you the cash prices, but to compare points vs cash you&apos;ll need at least one credit card or loyalty program in your wallet.
          </p>
        </div>
        <button
          type="button"
          data-testid="empty-wallet-cta-button"
          onClick={handleCta}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          <Wallet className="h-4 w-4" /> Set up your wallet
        </button>
      </div>
    </div>
  );
}
