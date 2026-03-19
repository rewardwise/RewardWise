/** @format */

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;

	start(): void;
	stop(): void;

	onresult:
		| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
		| null;
	onerror:
		| ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
		| null;
	onend: (() => any) | null;
}

interface SpeechRecognitionEvent extends Event {
	results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
}

interface Window {
	SpeechRecognition: {
		new (): SpeechRecognition;
	};
	webkitSpeechRecognition: {
		new (): SpeechRecognition;
	};
}
