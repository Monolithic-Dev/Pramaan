import { useCallback, useRef, useState } from "react";

// Browser-native STT (Web Speech API) — zero backend dependency for the
// citizen voice-report path. Chrome/Android Chrome support this; iOS Safari
// does not (docs/phases/phase-7-frontend.md "Traps") — voiceUnsupported
// covers that case in the UI.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

/** Errors meaning the browser's speech *service* is unavailable (Brave ships the API but no
 *  backing service and fails with "network"), as opposed to the user or the microphone. */
export const SPEECH_SERVICE_ERRORS = new Set(["network", "service-not-allowed", "language-not-supported"]);

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  // Brave exposes webkitSpeechRecognition but has no speech service behind it.
  if ((navigator as Navigator & { brave?: unknown }).brave) return false;
  return getSpeechRecognitionCtor() !== null;
}

export function useSpeechRecognition(lang: string) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    setError(null);
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const result = (
        event as { results: { transcript: string }[][] }
      ).results[0]?.[0]?.transcript;
      if (result) setTranscript((prev) => (prev ? `${prev} ${result}` : result));
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setError(event.error ?? "unknown");
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError("unknown");
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, setTranscript, error, start, stop };
}
