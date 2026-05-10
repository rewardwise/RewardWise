/**
 * useZoeVoice.ts
 *
 * Hands-free Zoe voice loop:
 * Browser STT -> Zoe backend -> TTS audio/browser fallback
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState =
	| "idle"
	| "listening"
	| "speaking"
	| "processing"
	| "responding";

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

function decodeBase64Header(value: string | null): string {
	if (!value) return "";

	try {
		const binary = atob(value);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return "";
	}
}

export function useZoeVoice({
	conversationId,
	history,
	onTurn,
	onError,
}: UseZoeVoiceOptions) {
	const [voiceState, setVoiceState] = useState<VoiceState>("idle");
	const [liveTranscript, setLiveTranscript] = useState("");

	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

	const activeRef = useRef(false);
	const processingRef = useRef(false);
	const latestTranscriptRef = useRef("");
	const sentCurrentTurnRef = useRef(false);
	const sessionIdRef = useRef(0);

	const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startRecognitionRef = useRef<() => void>(() => {});
	const scheduleFinishRef = useRef<(delayMs: number) => void>(() => {});

	const clearSilenceTimer = useCallback(() => {
		if (silenceTimerRef.current) {
			clearTimeout(silenceTimerRef.current);
			silenceTimerRef.current = null;
		}
	}, []);

	const clearRestartTimer = useCallback(() => {
		if (restartTimerRef.current) {
			clearTimeout(restartTimerRef.current);
			restartTimerRef.current = null;
		}
	}, []);

	const scheduleRestart = useCallback((delayMs = 700) => {
		clearRestartTimer();
		restartTimerRef.current = setTimeout(() => {
			if (activeRef.current && !processingRef.current) {
				startRecognitionRef.current();
			}
		}, delayMs);
	}, [clearRestartTimer]);

	const playAudio = useCallback(async (blob: Blob): Promise<void> => {
		return new Promise((resolve) => {
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);
			audioPlayerRef.current = audio;

			audio.onended = () => {
				URL.revokeObjectURL(url);
				resolve();
			};

			audio.onerror = () => {
				URL.revokeObjectURL(url);
				resolve();
			};

			audio.play().catch(() => resolve());
		});
	}, []);

	const browserTTS = useCallback((text: string): Promise<void> => {
		return new Promise((resolve) => {
			if (!text || !("speechSynthesis" in window)) {
				resolve();
				return;
			}

			window.speechSynthesis.cancel();

			const speak = () => {
				const utterance = new SpeechSynthesisUtterance(text);
				const voices = window.speechSynthesis.getVoices();
				const femaleVoice =
					voices.find((v) => /samantha|victoria|karen|zira|moira|fiona|tessa/i.test(v.name) && v.lang.startsWith("en")) ||
					voices.find((v) => v.lang.startsWith("en"));
				if (femaleVoice) utterance.voice = femaleVoice;
				utterance.pitch = 1.05;
				utterance.onend = () => resolve();
				utterance.onerror = () => resolve();
				window.speechSynthesis.speak(utterance);
			};

			const voices = window.speechSynthesis.getVoices();
			if (voices.length > 0) {
				speak();
			} else {
				window.speechSynthesis.onvoiceschanged = () => {
					window.speechSynthesis.onvoiceschanged = null;
					speak();
				};
			}
		});
	}, []);

	const sendTranscript = useCallback(
		async (transcript: string) => {
			const cleaned = transcript.trim();

			if (!cleaned || !activeRef.current || processingRef.current) return;

			processingRef.current = true;
			setVoiceState("processing");
			setLiveTranscript("");

			const form = new FormData();
			form.append("transcript", cleaned);
			form.append("conversation_id", conversationId || "");
			form.append("history", JSON.stringify(history.slice(-10)));

			try {
				const res = await fetch("/api/zoe/voice", {
					method: "POST",
					body: form,
					signal: AbortSignal.timeout(120_000),
				});

				const reply =
					decodeBase64Header(res.headers.get("X-Reply-B64")) ||
					res.headers.get("X-Reply") ||
					"";
				const prefillRaw = res.headers.get("X-Prefill") || "";

				onTurn({
					transcript: cleaned,
					reply,
					prefill: prefillRaw || null,
				});

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
				latestTranscriptRef.current = "";
				sentCurrentTurnRef.current = false;
				setLiveTranscript("");

				if (activeRef.current) {
					scheduleRestart(450);
				}
			}
		},
		[conversationId, history, onTurn, onError, playAudio, browserTTS, scheduleRestart]
	);

	const finishCurrentTurn = useCallback(() => {
		if (!activeRef.current || sentCurrentTurnRef.current) return;

		const transcript = latestTranscriptRef.current.trim();

		if (!transcript) return;

		// If still processing previous turn, retry instead of dropping
		if (processingRef.current) {
			scheduleFinishRef.current(500);
			return;
		}

		sentCurrentTurnRef.current = true;
		clearSilenceTimer();

		try {
			(recognitionRef.current as any)?.stop();
		} catch {
			// Chrome can throw if recognition already ended.
		}

		void sendTranscript(transcript);
	}, [clearSilenceTimer, sendTranscript]);

	const scheduleFinish = useCallback(
		(delayMs: number) => {
			clearSilenceTimer();
			// Don't schedule if there's nothing to send
			if (!latestTranscriptRef.current.trim()) return;
			silenceTimerRef.current = setTimeout(() => {
				finishCurrentTurn();
			}, delayMs);
		},
		[clearSilenceTimer, finishCurrentTurn]
	);

	useEffect(() => {
		scheduleFinishRef.current = scheduleFinish;
	}, [scheduleFinish]);

	const startRecognition = useCallback(() => {
		if (!activeRef.current || processingRef.current) return;

		clearSilenceTimer();
		clearRestartTimer();

		const SpeechRecognitionAPI =
			(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

		if (!SpeechRecognitionAPI) {
			onError?.("Your browser doesn't support voice input. Try Chrome.");
			activeRef.current = false;
			setVoiceState("idle");
			return;
		}

		sessionIdRef.current += 1;
		const sessionId = sessionIdRef.current;

		latestTranscriptRef.current = "";
		sentCurrentTurnRef.current = false;
		setLiveTranscript("");

		try {
			(recognitionRef.current as any)?.abort();
		} catch {
			// ignore
		}

		const recognition: SpeechRecognition = new SpeechRecognitionAPI();
		const recognitionHandlers = recognition as any;

		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = "en-US";
		recognition.maxAlternatives = 1;

		recognitionHandlers.onstart = () => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;
			setVoiceState("listening");
		};

		recognitionHandlers.onsoundstart = () => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;
			setVoiceState("speaking");
		};

		recognitionHandlers.onspeechstart = () => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;
			setVoiceState("speaking");
		};

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;

			let combined = "";
			let hasFinal = false;

			for (let i = 0; i < event.results.length; i += 1) {
				combined += event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					hasFinal = true;
				}
			}

			const transcript = combined.replace(/\s+/g, " ").trim();

			if (!transcript) return;

			latestTranscriptRef.current = transcript;
			setLiveTranscript(transcript);
			setVoiceState("speaking");

			scheduleFinish(hasFinal ? 400 : 900);
		};

		recognitionHandlers.onspeechend = () => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;
			scheduleFinish(400);
		};

		recognitionHandlers.onsoundend = () => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;
			scheduleFinish(500);
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;

			if (event.error === "aborted") {
				return;
			}

			if (event.error === "no-speech") {
				scheduleRestart(400);
				return;
			}

			if (event.error === "not-allowed") {
				onError?.("Microphone access denied. Please allow mic access in your browser settings.");
				activeRef.current = false;
				setVoiceState("idle");
				return;
			}

			if (event.error === "network") {
				scheduleRestart(2000);
				return;
			}

			console.warn("Speech recognition error:", event.error);
			scheduleRestart(800);
		};

		recognition.onend = () => {
			if (!activeRef.current || sessionId !== sessionIdRef.current) return;

			const transcript = latestTranscriptRef.current.trim();

			if (transcript && !sentCurrentTurnRef.current && !processingRef.current) {
				scheduleFinish(300);
				return;
			}

			if (!processingRef.current && !sentCurrentTurnRef.current) {
				scheduleRestart(500);
			}
		};

		recognitionRef.current = recognition;

		try {
			recognition.start();
		} catch (err) {
			console.error("Recognition start error:", err);
			scheduleRestart(800);
		}
	}, [
		clearRestartTimer,
		clearSilenceTimer,
		onError,
		scheduleFinish,
		scheduleRestart,
	]);

	useEffect(() => {
		startRecognitionRef.current = startRecognition;
	}, [startRecognition]);

	const toggleVoiceMode = useCallback(async () => {
		if (activeRef.current) {
			activeRef.current = false;
			processingRef.current = false;
			sessionIdRef.current += 1;

			clearSilenceTimer();
			clearRestartTimer();

			try {
				(recognitionRef.current as any)?.abort();
			} catch {
				// ignore
			}

			recognitionRef.current = null;
			audioPlayerRef.current?.pause();
			audioPlayerRef.current = null;
			window.speechSynthesis?.cancel();

			latestTranscriptRef.current = "";
			sentCurrentTurnRef.current = false;
			setLiveTranscript("");
			setVoiceState("idle");
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			stream.getTracks().forEach((track) => track.stop());
			fetch("/api/zoe-warm", { method: "GET", cache: "no-store" }).catch(() => {});

			activeRef.current = true;
			processingRef.current = false;
			latestTranscriptRef.current = "";
			sentCurrentTurnRef.current = false;
			setLiveTranscript("");

			startRecognition();
		} catch (err: any) {
			onError?.(
				err?.name === "NotAllowedError"
					? "Microphone access denied. Please allow mic access in your browser settings."
					: "Couldn't open microphone."
			);
		}
	}, [clearRestartTimer, clearSilenceTimer, onError, startRecognition]);

	const interrupt = useCallback(() => {
		audioPlayerRef.current?.pause();
		audioPlayerRef.current = null;
		window.speechSynthesis?.cancel();

		processingRef.current = false;
		latestTranscriptRef.current = "";
		sentCurrentTurnRef.current = false;
		setLiveTranscript("");

		if (activeRef.current) {
			startRecognition();
		}
	}, [startRecognition]);

	useEffect(() => {
		return () => {
			activeRef.current = false;
			processingRef.current = false;
			sessionIdRef.current += 1;

			clearSilenceTimer();
			clearRestartTimer();

			try {
				(recognitionRef.current as any)?.abort();
			} catch {
				// ignore
			}

			audioPlayerRef.current?.pause();
			window.speechSynthesis?.cancel();
		};
	}, [clearRestartTimer, clearSilenceTimer]);

	return {
		voiceMode: voiceState !== "idle",
		voiceState,
		liveTranscript,
		toggleVoiceMode,
		interrupt,
	};
}
