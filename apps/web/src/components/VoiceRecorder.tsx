import { useEffect, useRef, useState } from "react";
import { uploadMedia } from "../api/client.js";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

// Browsers without the Web Speech API (iOS Safari, Firefox) record audio with
// MediaRecorder and upload it; the worker transcribes it server-side.
function AudioUploadRecorder({ onAudioUploaded }: { onAudioUploaded: (url: string) => void }) {
  const { t } = useLanguage();
  const [recording, setRecording] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function toggle() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try {
          onAudioUploaded(await uploadMedia("audio", new Blob(chunks.current, { type: rec.mimeType })));
          setState("saved");
        } catch {
          setState("error");
        }
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={recording}
        className={`w-full rounded-xl px-6 py-6 text-xl font-semibold text-white ${recording ? "animate-pulse bg-red-600" : "bg-blue-700"}`}
      >
        🎙️ {recording ? t("report.audioStop") : t("report.audioRecord")}
      </button>
      {state === "saved" && <p className="text-sm text-green-700">{t("report.audioSaved")}</p>}
      {state === "error" && <p className="text-sm text-red-600">{t("report.uploadError")}</p>}
    </div>
  );
}

export function VoiceRecorder({
  onTranscript,
  onAudioUploaded,
}: {
  onTranscript: (text: string) => void;
  onAudioUploaded: (url: string) => void;
}) {
  const { speechLang, t } = useLanguage();
  const { isListening, transcript, start, stop } = useSpeechRecognition(speechLang);

  useEffect(() => {
    if (transcript) onTranscript(transcript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  if (!isSpeechRecognitionSupported()) {
    if (typeof MediaRecorder === "undefined") {
      return <p className="text-sm text-gray-500">{t("report.voiceUnsupported")}</p>;
    }
    return <AudioUploadRecorder onAudioUploaded={onAudioUploaded} />;
  }

  return (
    <button
      type="button"
      onClick={isListening ? stop : start}
      aria-pressed={isListening}
      className={`flex w-full items-center justify-center gap-3 rounded-xl px-6 py-6 text-xl font-semibold text-white ${
        isListening ? "animate-pulse bg-red-600" : "bg-blue-700"
      }`}
    >
      <span aria-hidden="true">🎙️</span>
      {isListening ? t("report.voiceListening") : t("report.voiceButton")}
    </button>
  );
}
