import { useEffect, useRef, useState } from "react";
import { uploadMediaAuthed } from "../api/api.js";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon } from "../ui/Icon.js";
import { cx } from "../ui/kit.js";

function MicButton({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
        active ? "border-rose-300 bg-rose-50" : "border-dashed border-brand-300 bg-brand-50/60 hover:border-brand-500 hover:bg-brand-50",
      )}
    >
      <span className={cx("relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white", active ? "bg-rose-600" : "bg-brand-700")}>
        {active && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-60" />}
        <Icon name="mic" size={26} className="relative" />
      </span>
      <span>
        <span className="block font-semibold text-slate-900">{label}</span>
        {sub && <span className="block text-sm text-slate-600">{sub}</span>}
      </span>
    </button>
  );
}

// Browsers without the Web Speech API (iOS Safari, Firefox) record audio with MediaRecorder and
// upload it; the worker transcribes it server-side with Gemini.
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
      const rec = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try {
          onAudioUploaded(await uploadMediaAuthed("audio", new Blob(chunks.current, { type: rec.mimeType })));
          setState("saved");
        } catch {
          setState("error");
        }
      };
      recorder.current = rec;
      rec.start();
      // 24 kbps for at most 60 s is about 180 KB, inside the free-plan upload limit.
      setTimeout(() => {
        if (rec.state === "recording") {
          rec.stop();
          setRecording(false);
        }
      }, 60_000);
      setRecording(true);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <MicButton active={recording} onClick={toggle} label={recording ? t("report.audioStop") : t("report.audioRecord")} sub={t("report.voiceSub")} />
      {state === "saved" && <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Icon name="checkCircle" size={16} />{t("report.audioSaved")}</p>}
      {state === "error" && <p className="text-sm font-medium text-rose-600">{t("report.uploadError")}</p>}
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
      return <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{t("report.voiceUnsupported")}</p>;
    }
    return <AudioUploadRecorder onAudioUploaded={onAudioUploaded} />;
  }

  return (
    <MicButton
      active={isListening}
      onClick={isListening ? stop : start}
      label={isListening ? t("report.voiceListening") : t("report.voiceButton")}
      sub={t("report.voiceSub")}
    />
  );
}
