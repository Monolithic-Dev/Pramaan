import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiClientError, submitReport, uploadMedia, type CreateSubmissionInput } from "../api/client.js";
import { ConsentNotice, CONSENT_VERSION } from "../components/ConsentNotice.js";
import { LanguageSelector } from "../components/LanguageSelector.js";
import { VoiceRecorder } from "../components/VoiceRecorder.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

type Step = "consent" | "form" | "confirmed";

export function ReportPage() {
  const { t, speechLang, countryCode } = useLanguage();
  const { speak } = useSpeechSynthesis(speechLang);
  const { enqueue } = useOfflineQueue();

  const [step, setStep] = useState<Step>("consent");
  const [text, setText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setError(t("report.locationError"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setError(t("report.locationError"));
        setLocating(false);
      },
    );
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setPhotoUrl(await uploadMedia("photo", file));
    } catch {
      setError(t("report.uploadError"));
    }
  }

  async function handleSubmit() {
    setError(null);
    if ((!text.trim() && !audioUrl) || (!coords && !locationText.trim())) {
      setError(t("report.errorValidation"));
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const input: CreateSubmissionInput = {
      channel: "web",
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(audioUrl ? { audio_url: audioUrl } : {}),
      ...(photoUrl ? { photo_url: photoUrl } : {}),
      consent_version: CONSENT_VERSION,
      country_code: countryCode,
      ...(coords ? coords : { location_text: locationText.trim() }),
    };

    setSubmitting(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const result = await submitReport(input, idempotencyKey);
      setTrackingId(result.submission_id);
      setStep("confirmed");
      const confirmation = t("report.confirmationBody", { id: result.submission_id });
      speak(confirmation);
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        enqueue(input, idempotencyKey);
        setTrackingId(idempotencyKey);
        setStep("confirmed");
      } else if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(t("report.errorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "consent") {
    return (
      <div className="mx-auto max-w-md">
        <LanguageSelector />
        <ConsentNotice onAgree={() => setStep("form")} />
      </div>
    );
  }

  if (step === "confirmed" && trackingId) {
    const confirmation = t("report.confirmationBody", { id: trackingId });
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
        <h2 className="text-2xl font-semibold text-gray-900">{t("report.confirmationTitle")}</h2>
        <p className="text-lg text-gray-700">{confirmation}</p>
        {!navigator.onLine && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            {t("report.offlineQueued")}
          </p>
        )}
        <button
          type="button"
          onClick={() => speak(confirmation)}
          className="rounded-lg border-2 border-blue-700 px-6 py-3 text-lg font-medium text-blue-700"
        >
          {t("report.confirmationReplay")}
        </button>
        <Link to="/status" className="text-base text-blue-700 underline">
          {t("status.check")}
        </Link>
        <Link to="/transparency" className="text-sm text-gray-500 underline">
          {t("transparency.title")}
        </Link>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setText("");
            setLocationText("");
            setCoords(null);
            setPhotoUrl(null);
            setAudioUrl(null);
            setTrackingId(null);
          }}
          className="text-base text-gray-500 underline"
        >
          {t("report.another")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-24">
      <h1 className="text-xl font-semibold text-gray-900">{t("app.title")}</h1>

      <VoiceRecorder
        onTranscript={(t2) => setText((prev) => (prev ? `${prev} ${t2}` : t2))}
        onAudioUploaded={setAudioUrl}
      />

      <div>
        <label htmlFor="report-text" className="mb-1 block text-base font-medium text-gray-900">
          {t("report.textLabel")}
        </label>
        <textarea
          id="report-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("report.textPlaceholder")}
          rows={4}
          className="w-full rounded-lg border border-gray-300 p-3 text-base"
        />
      </div>

      <div>
        <label htmlFor="report-photo" className="mb-1 block text-base font-medium text-gray-900">
          {t("report.photoLabel")}
        </label>
        <input
          id="report-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => handlePhoto(e.target.files?.[0])}
          className="w-full text-base"
        />
        {photoUrl && <p className="text-sm text-green-700">{t("report.photoAttached")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={detectLocation}
          disabled={locating}
          className="rounded-lg border-2 border-blue-700 px-4 py-3 text-base font-medium text-blue-700 disabled:opacity-50"
        >
          {locating ? t("report.locationDetecting") : t("report.locationAuto")}
        </button>
        {coords && (
          <p className="text-sm text-green-700">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        )}
        <label htmlFor="report-location" className="mt-1 block text-base font-medium text-gray-900">
          {t("report.locationManualLabel")}
        </label>
        <input
          id="report-location"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder={t("report.locationManualPlaceholder")}
          className="w-full rounded-lg border border-gray-300 p-3 text-base"
        />
      </div>

      {error && <p className="text-base text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-lg bg-blue-700 px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {submitting ? t("report.submitting") : t("report.submit")}
      </button>
    </div>
  );
}
