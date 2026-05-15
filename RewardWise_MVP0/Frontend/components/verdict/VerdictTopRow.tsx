/** @format */
"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Volume2, VolumeX } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type Confidence = "high" | "medium" | "low";

type Props = {
  recommendationHeadline: string;
  confidence: Confidence;
  speaking: boolean;
  onListenToggle: () => void;
  verdictId?: string | null;
  publicPreview?: boolean;
};

function confidenceTone(confidence: Confidence) {
  if (confidence === "high") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (confidence === "medium") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

function confidenceDot(confidence: Confidence) {
  if (confidence === "high") return "bg-emerald-300";
  if (confidence === "medium") return "bg-amber-300";
  return "bg-slate-300";
}

export default function VerdictTopRow({
  recommendationHeadline,
  confidence,
  speaking,
  onListenToggle,
  verdictId,
  publicPreview = false,
}: Props) {
  const [choice, setChoice] = useState<1 | 5 | null>(null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const showFeedback = !publicPreview && !!verdictId;

  const submit = async () => {
    if (!choice || saving) return;
    setSaving(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Please log in again before submitting feedback.");
      return;
    }
    const payload = {
      verdict_id: verdictId,
      user_id: userId,
      rating: choice,
      comment: comment.trim() || null,
      did_book: false,
      booking_method: null,
    };
    const { error: insertError } = await supabase.from("feedback").insert(payload);
    if (insertError) {
      setSaving(false);
      setError(insertError.message || "Failed to save feedback.");
      return;
    }
    setSaving(false);
    setSaved(true);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-400">The Verdict</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold capitalize ${confidenceTone(confidence)}`}>
            <span className={`h-2 w-2 rounded-full ${confidenceDot(confidence)}`} />
            {confidence} confidence
          </span>
        </div>
      </div>

      <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">{recommendationHeadline}</h2>

      {!publicPreview && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onListenToggle}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.06]"
          >
            {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {speaking ? "Stop" : "Listen"}
          </button>
          {showFeedback && !saved && (
            <>
              <button
                onClick={() => {
                  setChoice(5);
                  setOpen(true);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${choice === 5 ? "border-emerald-400 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
              >
                <ThumbsUp className="h-4 w-4" /> Helpful
              </button>
              <button
                onClick={() => {
                  setChoice(1);
                  setOpen(true);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${choice === 1 ? "border-rose-400 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/[0.03] text-slate-300"}`}
              >
                <ThumbsDown className="h-4 w-4" /> Needs work
              </button>
            </>
          )}
          {saved && <span className="text-sm text-emerald-300">Thanks for the feedback.</span>}
        </div>
      )}

      {showFeedback && open && !saved && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: what should Zoe do better here?"
            className="min-h-[92px] w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-slate-700"
            >
              {saving ? "Saving" : "Submit feedback"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
