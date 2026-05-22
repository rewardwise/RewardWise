/** @format */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

export type CancelReasonCode =
  | "too_expensive"
  | "not_using"
  | "missing_features"
  | "found_alternative"
  | "other";

export interface CancelReasonPayload {
  reason_code: CancelReasonCode;
  free_text: string | null;
}

interface Props {
  open: boolean;
  submitting: boolean;
  onConfirm: (payload: CancelReasonPayload) => void;
  onDismiss: () => void;
}

const OPTIONS: Array<{ code: CancelReasonCode; label: string }> = [
  { code: "too_expensive", label: "Too expensive" },
  { code: "not_using", label: "Not using it enough" },
  { code: "missing_features", label: "Missing features I need" },
  { code: "found_alternative", label: "Found an alternative" },
  { code: "other", label: "Other reason" },
];

export default function CancelReasonModal({
  open,
  submitting,
  onConfirm,
  onDismiss,
}: Props) {
  const titleId = useId();
  const freeTextId = useId();
  const [reason, setReason] = useState<CancelReasonCode | null>(null);
  const [freeText, setFreeText] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setReason(null);
      setFreeText("");
      return;
    }
    firstButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onDismiss();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, submitting, onDismiss]);

  if (!open) return null;

  const canSubmit =
    reason !== null && !submitting && (reason !== "other" || freeText.trim().length > 0);

  function handleConfirm() {
    if (reason === null) return;
    onConfirm({
      reason_code: reason,
      free_text: freeText.trim().length > 0 ? freeText.trim() : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      data-testid="cancel-reason-modal"
    >
      <div
        onClick={() => {
          if (!submitting) onDismiss();
        }}
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl sm:p-6"
      >
        <button
          ref={firstButtonRef}
          type="button"
          onClick={() => {
            if (!submitting) onDismiss();
          }}
          aria-label="Close cancellation dialog"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id={titleId} className="pr-9 text-base font-extrabold text-white sm:text-lg">
          We&rsquo;re sorry to see you go
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Before you cancel, tell us what changed. It only takes a second
          and it directly shapes what we build next.
        </p>

        <fieldset className="mt-5 space-y-2">
          <legend className="sr-only">Reason for cancellation</legend>
          {OPTIONS.map((opt) => {
            const checked = reason === opt.code;
            return (
              <label
                key={opt.code}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                  checked
                    ? "border-emerald-400/40 bg-emerald-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
                }`}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={opt.code}
                  checked={checked}
                  onChange={() => setReason(opt.code)}
                  className="h-4 w-4 accent-emerald-400"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </fieldset>

        {reason === "other" ? (
          <div className="mt-4">
            <label
              htmlFor={freeTextId}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
            >
              Tell us more
            </label>
            <textarea
              id={freeTextId}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What would have kept you around?"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/40 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {freeText.length}/500
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm cancellation
          </button>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onDismiss();
            }}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Never mind, keep my subscription
          </button>
        </div>
      </div>
    </div>
  );
}
