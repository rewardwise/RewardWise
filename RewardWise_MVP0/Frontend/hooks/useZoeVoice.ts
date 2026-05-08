/**
 * useZoeVoice.ts
 *
 * Fully hands-free conversational voice loop:
 *   STT  → Browser Web Speech API (free, no gRPC, works everywhere)
 *   LLM  → Existing Zoe backend (unchanged)
 *   TTS  → NVIDIA Magpie via backend /api/zoe/voice (great quality)
 *
 * Flow:
 *   1. Toggle Radio icon → mic opens
 *   2. Speak — Web Speech API transcribes in real time
 *   3. Silence detected by Web Speech API → auto-sends transcript
 *   4. Backend: Zoe LLM → Magpie TTS → WAV audio
 *   5. Frontend plays WAV. When done → mic re-opens automatically.
 *   6. Toggle Radio again → exit voice mode
 *
 * Branch: feature/zoe-voice-nvidia-nim
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState =
  | "idle"        // voice mode off
  | "listening"   // mic open, waiting for speech
  | "speaking"    // user is currently speaking
  | "processing"  // sending to backend
  | "responding"; // Zoe is playing audio reply

interface VoiceTurnResult {
  transcript: string;
  reply: string;
  prefill: string | null;
}

interface UseZoeVoiceOptions {
  conversationId: string | null;
  history: Array<{ role: string; content: string }>;
  onTurn: (result: VoiceTurnResult) => void;
  onError?: (msg: string) => void;
}

export function useZoeVoice({
  conversationId,
  history,
  onTurn,
  onError,
}: UseZoeVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false); // prevent overlapping turns

  // ── Play WAV audio ────────────────────────────────────────────────────────
  const playAudio = useCallback(async (blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    });
  }, []);

  // ── Browser TTS fallback ──────────────────────────────────────────────────
  const browserTTS = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.speechSynthesis.speak(utt);
    });
  }, []);

  // ── Send transcript to backend, get TTS audio back ────────────────────────
  const sendTranscript = useCallback(async (transcript: string) => {
    if (!activeRef.current || processingRef.current) return;
    processingRef.current = true;
    setVoiceState("processing");

    const form = new FormData();
    form.append("transcript", transcript);
    form.append("conversation_id", conversationId || "");
    form.append("history", JSON.stringify(history.slice(-10)));

    try {
      const res = await fetch("/api/zoe/voice", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(45_000),
      });

      const reply = res.headers.get("X-Reply") || "";
      const prefillRaw = res.headers.get("X-Prefill") || "";

      onTurn({ transcript, reply, prefill: prefillRaw || null });

      if (!activeRef.current) return;
      setVoiceState("responding");

      if (res.ok && res.status === 200) {
        await playAudio(await res.blob());
      } else if (reply) {
        await browserTTS(reply);
      }
    } catch (err) {
      console.error("Voice send error:", err);
      onError?.("Couldn't reach Zoe — check your connection.");
    } finally {
      processingRef.current = false;
      // Re-open mic after Zoe finishes
      if (activeRef.current) startRecognition();
    }
  }, [conversationId, history, onTurn, onError, playAudio, browserTTS]);

  // ── Web Speech API recognition ────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (!activeRef.current) return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError?.("Your browser doesn't support voice input. Try Chrome.");
      return;
    }

    // Stop any existing session
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    const recognition: SpeechRecognition = new SpeechRecognitionAPI();
    recognition.continuous = false;    // single utterance → auto-stops on silence
    recognition.interimResults = true; // show partial results
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (activeRef.current) setVoiceState("listening");
    };

    recognition.onspeechstart = () => {
      if (activeRef.current) setVoiceState("speaking");
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      // Only act on final results
      const result = e.results[e.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript.trim();
        if (transcript && activeRef.current) {
          recognition.stop();
          void sendTranscript(transcript);
        }
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (!activeRef.current) return;
      if (e.error === "no-speech") {
        // No speech detected — just restart
        if (activeRef.current && !processingRef.current) startRecognition();
      } else if (e.error === "not-allowed") {
  onError?.("Microphone access denied. Please allow mic access in your browser settings.");
  activeRef.current = false;
  setVoiceState("idle");
} else if (e.error === "network") {
  // Chrome localhost network glitch — wait longer then retry
  if (activeRef.current && !processingRef.current) {
    setTimeout(() => startRecognition(), 2000);
  }
} else {
  console.warn("Speech recognition error:", e.error);
  if (activeRef.current && !processingRef.current) {
    setTimeout(() => startRecognition(), 500);
  }
}
    };

    recognition.onend = () => {
      // If we ended without a result and still active, restart
      if (activeRef.current && !processingRef.current) {
        setTimeout(() => {
          if (activeRef.current && !processingRef.current) startRecognition();
        }, 300);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("Recognition start error:", err);
      if (activeRef.current && !processingRef.current) {
        setTimeout(() => startRecognition(), 500);
      }
    }
  }, [sendTranscript, onError]);

  // ── Toggle voice mode ─────────────────────────────────────────────────────
  const toggleVoiceMode = useCallback(async () => {
    if (activeRef.current) {
      // Turn off
      activeRef.current = false;
      processingRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
      window.speechSynthesis?.cancel();
      setVoiceState("idle");
    } else {
      // Turn on — check mic permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // just checking permission
        activeRef.current = true;
        startRecognition();
      } catch (err: any) {
        onError?.(
          err?.name === "NotAllowedError"
            ? "Microphone access denied. Please allow mic access in your browser settings."
            : "Couldn't open microphone."
        );
      }
    }
  }, [startRecognition, onError]);

  // ── Interrupt Zoe while speaking ──────────────────────────────────────────
  const interrupt = useCallback(() => {
    audioPlayerRef.current?.pause();
    audioPlayerRef.current = null;
    window.speechSynthesis?.cancel();
    processingRef.current = false;
    if (activeRef.current) startRecognition();
  }, [startRecognition]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      activeRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      audioPlayerRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    voiceMode: voiceState !== "idle",
    voiceState,
    toggleVoiceMode,
    interrupt,
  };
}
