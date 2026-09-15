import { useEffect } from "react";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

export function VoiceRecorder({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const { speechLang, t } = useLanguage();
  const { isListening, transcript, start, stop } = useSpeechRecognition(speechLang);

  useEffect(() => {
    if (transcript) onTranscript(transcript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  if (!isSpeechRecognitionSupported()) {
    return <p className="text-sm text-gray-500">{t("report.voiceUnsupported")}</p>;
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
