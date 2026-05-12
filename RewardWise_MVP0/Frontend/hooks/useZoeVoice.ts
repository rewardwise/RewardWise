/**
 * useZoeVoice.ts
 *
 * Hands-free Zoe voice loop:
 * MediaRecorder -> NVIDIA Parakeet STT -> Zoe backend -> NVIDIA Magpie TTS audio/browser fallback
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

	const recognitionRef = useRef<{ abort: () => void } | null>(null);
	const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

	const activeRef = useRef(false);
	const processingRef = useRef(false);
	const latestTranscriptRef = useRef("");
	const sentCurrentTurnRef = useRef(false);
	const sessionIdRef = useRef(0);

	const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startRecognitionRef = useRef<() => void>(() => {});

	const clearRestartTimer = useCallback(() => {
		if (restartTimerRef.current) {
			clearTimeout(restartTimerRef.current);
			restartTimerRef.current = null;
		}
	}, []);

	const scheduleRestart = useCallback(
		(delayMs = 700) => {
			clearRestartTimer();
			restartTimerRef.current = setTimeout(() => {
				if (activeRef.current && !processingRef.current) {
					startRecognitionRef.current();
				}
			}, delayMs);
		},
		[clearRestartTimer]
	);

	const playAudio = useCallback(async (blob: Blob): Promise<boolean> => {
		if (!blob || blob.size < 1000) {
			console.warn("NVIDIA TTS audio blob empty/tiny:", blob?.type, blob?.size);
			return false;
		}

		console.log("Trying NVIDIA audio playback:", blob.type || "(no type)", blob.size);

		const url = URL.createObjectURL(blob);

		return await new Promise<boolean>((resolve) => {
			let settled = false;

			const finish = (played: boolean) => {
				if (settled) return;
				settled = true;
				try { URL.revokeObjectURL(url); } catch { /* ignore */ }
				resolve(played);
			};

			try {
				audioPlayerRef.current?.pause();

				const audio = new Audio();
				audioPlayerRef.current = audio;

				audio.volume = 1.0;
				audio.preload = "auto";
				audio.src = url;

				audio.onended = () => { console.log("NVIDIA audio ended"); finish(true); };
				audio.onerror = () => {
					console.warn("NVIDIA audio element error", {
						code: audio.error?.code,
						message: audio.error?.message,
						networkState: audio.networkState,
						readyState: audio.readyState,
					});
					finish(false);
				};
				audio.onloadedmetadata = () => {
					console.log("NVIDIA audio metadata loaded", { duration: audio.duration, readyState: audio.readyState });
				};

				audio.play()
					.then(() => { console.log("NVIDIA audio playback started"); })
					.catch((err) => { console.warn("NVIDIA audio play rejected:", err); finish(false); });
			} catch (err) {
				console.error("NVIDIA audio playback crashed:", err);
				finish(false);
			}
		});
	}, []);

	const browserTTS = useCallback((text: string): Promise<void> => {
		return new Promise((resolve) => {
			if (!text || !("speechSynthesis" in window)) { resolve(); return; }

			window.speechSynthesis.cancel();

			const speak = () => {
				const utterance = new SpeechSynthesisUtterance(text);
				const voices = window.speechSynthesis.getVoices();
				const femaleVoice =
					voices.find((v) => /samantha|victoria|karen|zira|moira|fiona|tessa/i.test(v.name) && v.lang.startsWith("en")) ||
					voices.find((v) => v.lang.startsWith("en"));

				if (femaleVoice) utterance.voice = femaleVoice;
				utterance.pitch = 1.05;
				utterance.rate = 1.0;
				utterance.volume = 1.0;
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

				onTurn({ transcript: cleaned, reply, prefill: prefillRaw || null });

				if (!activeRef.current) return;

				setVoiceState("responding");

				if (res.ok && res.status === 200) {
					const audioBlob = await res.blob();
					console.log("NVIDIA TTS audio blob:", audioBlob.type || "(no type)", audioBlob.size);
					const played = await playAudio(audioBlob);
					if (!played && reply) {
						console.warn("Falling back to browser TTS because NVIDIA audio did not play.");
						await browserTTS(reply);
					}
				} else if (reply) {
					console.warn("No NVIDIA audio returned; using browser TTS.", res.status);
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
				if (activeRef.current) scheduleRestart(450);
			}
		},
		[conversationId, history, onTurn, onError, playAudio, browserTTS, scheduleRestart]
	);

	const startRecognition = useCallback(() => {
		if (!activeRef.current || processingRef.current) return;

		clearRestartTimer();
		sessionIdRef.current += 1;
		const sessionId = sessionIdRef.current;

		latestTranscriptRef.current = "";
		sentCurrentTurnRef.current = false;
		setLiveTranscript("");
		setVoiceState("listening");

		let mediaRecorder: MediaRecorder | null = null;
		let audioChunks: Blob[] = [];
		let audioContext: AudioContext | null = null;
		let silenceTimer: ReturnType<typeof setTimeout> | null = null;
		let hasSpoken = false;

		const SILENCE_MS = 2000;

		// ── Single, correct cleanup ───────────────────────────────────────────
		const cleanup = () => {
			try {
				if (mediaRecorder && mediaRecorder.state !== "inactive") {
					mediaRecorder.stop();
				}
			} catch { /* ignore */ }

			if (silenceTimer) {
				clearTimeout(silenceTimer);
				silenceTimer = null;
			}

			const ctx = audioContext;
			audioContext = null;
			if (ctx && ctx.state !== "closed") {
				ctx.close().catch(() => { /* ignore already-closed */ });
			}
		};

		const submitAudio = async () => {
			if (sessionId !== sessionIdRef.current || !activeRef.current) return;
			if (!audioChunks.length || processingRef.current) return;

			const mimeType = mediaRecorder?.mimeType || "audio/webm";
			const blob = new Blob(audioChunks, { type: mimeType });
			audioChunks = [];

			if (blob.size < 1000) {
				scheduleRestart(300);
				return;
			}

			setVoiceState("processing");
			processingRef.current = true;
			sentCurrentTurnRef.current = true;
			setLiveTranscript("…");

			try {
				const form = new FormData();
				form.append("audio", blob, "audio.webm");

				const res = await fetch("/api/zoe/stt", { method: "POST", body: form });
				if (!res.ok) throw new Error(`STT ${res.status}`);

				const data = (await res.json()) as { transcript?: string };
				const transcript = data.transcript?.trim() || "";

				if (transcript) {
					latestTranscriptRef.current = transcript;
					setLiveTranscript(transcript);
					processingRef.current = false;
					sentCurrentTurnRef.current = false;
					void sendTranscript(transcript);
				} else {
					processingRef.current = false;
					sentCurrentTurnRef.current = false;
					scheduleRestart(300);
				}
			} catch (err) {
				console.error("STT error:", err);
				processingRef.current = false;
				sentCurrentTurnRef.current = false;
				scheduleRestart(800);
			}
		};

		navigator.mediaDevices
			.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
			.then((stream) => {
				if (sessionId !== sessionIdRef.current || !activeRef.current) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}

				audioContext = new AudioContext();
				const source = audioContext.createMediaStreamSource(stream);
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 512;
				source.connect(analyser);
				const dataArray = new Uint8Array(analyser.fftSize);

				const checkSilence = () => {
					if (sessionId !== sessionIdRef.current) return;

					analyser.getByteTimeDomainData(dataArray);
					const volume = dataArray.reduce((sum, v) => sum + Math.abs(v - 128), 0) / dataArray.length;

					if (volume > 8) {
						hasSpoken = true;
						setVoiceState("speaking");
						if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
					} else if (hasSpoken && !silenceTimer) {
						silenceTimer = setTimeout(() => {
							cleanup();
							stream.getTracks().forEach((t) => t.stop());
							void submitAudio();
						}, SILENCE_MS);
					}

					if (activeRef.current && sessionId === sessionIdRef.current) {
						requestAnimationFrame(checkSilence);
					}
				};

				requestAnimationFrame(checkSilence);

				const mimeType =
					["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
						.find((t) => MediaRecorder.isTypeSupported(t)) || "";

				mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
				mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
				mediaRecorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); };
				mediaRecorder.start(100);

				recognitionRef.current = {
					abort: () => {
						cleanup();
						stream.getTracks().forEach((t) => t.stop());
					},
				};
			})
			.catch((err: unknown) => {
				const name = err instanceof DOMException ? err.name : "";
				onError?.(
					name === "NotAllowedError"
						? "Microphone access denied. Please allow mic access in your browser settings."
						: "Couldn't open microphone."
				);
				activeRef.current = false;
				setVoiceState("idle");
			});
	}, [clearRestartTimer, onError, scheduleRestart, sendTranscript]);

	useEffect(() => {
		startRecognitionRef.current = startRecognition;
	}, [startRecognition]);

	const toggleVoiceMode = useCallback(async () => {
		// Add this at the start of toggleVoiceMode, before the getUserMedia call
const unlock = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
unlock.play().catch(() => {});
		if (activeRef.current) {
			activeRef.current = false;
			processingRef.current = false;
			sessionIdRef.current += 1;

			clearRestartTimer();
			try { recognitionRef.current?.abort(); } catch { /* ignore */ }
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
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
			});
			stream.getTracks().forEach((t) => t.stop());

			fetch("/api/zoe-warm", { method: "GET", cache: "no-store" }).catch(() => {});

			activeRef.current = true;
			processingRef.current = false;
			latestTranscriptRef.current = "";
			sentCurrentTurnRef.current = false;
			setLiveTranscript("");

			startRecognition();
		} catch (err: unknown) {
			const name = err instanceof DOMException ? err.name : "";
			onError?.(
				name === "NotAllowedError"
					? "Microphone access denied. Please allow mic access in your browser settings."
					: "Couldn't open microphone."
			);
		}
	}, [clearRestartTimer, onError, startRecognition]);

	const interrupt = useCallback(() => {
		audioPlayerRef.current?.pause();
		audioPlayerRef.current = null;
		window.speechSynthesis?.cancel();

		processingRef.current = false;
		latestTranscriptRef.current = "";
		sentCurrentTurnRef.current = false;
		setLiveTranscript("");

		if (activeRef.current) startRecognition();
	}, [startRecognition]);

	useEffect(() => {
		return () => {
			activeRef.current = false;
			processingRef.current = false;
			sessionIdRef.current += 1;

			clearRestartTimer();
			try { recognitionRef.current?.abort(); } catch { /* ignore */ }

			audioPlayerRef.current?.pause();
			audioPlayerRef.current = null;
			window.speechSynthesis?.cancel();
		};
	}, [clearRestartTimer]);

	return {
		voiceMode: voiceState !== "idle",
		voiceState,
		liveTranscript,
		toggleVoiceMode,
		interrupt,
	};
}
