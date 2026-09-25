import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, submitReportAuthed, uploadMediaAuthed } from "../api/api.js";
import { ApiClientError } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { CONSENT_VERSION } from "../components/ConsentNotice.js";
import { LocationPicker, type LatLng } from "../components/LocationPicker.js";
import { VoiceRecorder } from "../components/VoiceRecorder.js";
import { CopyButton } from "../ui/extras.js";
import { useOfflineQueue } from "../hooks/useOfflineQueue.js";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis.js";
import { SUPPORTED_LANGUAGES, useLanguage } from "../i18n/LanguageProvider.js";
import { Icon, CATEGORY_META } from "../ui/Icon.js";
import { Alert, Badge, Button, Card, Field, Input, Spinner, Textarea, cx } from "../ui/kit.js";
import { compressImage } from "../utils/compressImage.js";

const COUNTRY_CENTER: Record<string, LatLng> = {
  IN: { lat: 22.9, lng: 79.0 },
  BR: { lat: -14.2, lng: -51.9 },
};

const STEPS = ["report.step.describe", "report.step.where", "report.step.review"] as const;

function Stepper({ step }: { step: number }) {
  const { t } = useLanguage();
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
      {STEPS.map((key, i) => (
        <li key={key} className="flex flex-1 items-center gap-2">
          <span
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
              i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-700 text-white ring-4 ring-brand-100" : "bg-slate-200 text-slate-500",
            )}
            aria-current={i === step ? "step" : undefined}
          >
            {i < step ? <Icon name="check" size={16} /> : i + 1}
          </span>
          <span className={cx("hidden text-sm font-semibold sm:block", i === step ? "text-slate-900" : "text-slate-500")}>{t(key)}</span>
          {i < STEPS.length - 1 && <span className={cx("h-0.5 flex-1 rounded", i < step ? "bg-emerald-400" : "bg-slate-200")} />}
        </li>
      ))}
    </ol>
  );
}

/** After submitting, a signed-in citizen watches the AI read their report in near real time. */
function LiveResult({ submissionId }: { submissionId: string }) {
  const { t } = useLanguage();
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.myReports>>["reports"][number] | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (report?.category || tries > 20) return;
    const timer = setTimeout(async () => {
      try {
        const found = (await api.myReports()).reports.find((r) => r.submission_id === submissionId) ?? null;
        setReport(found);
      } catch {
        /* keep polling */
      }
      setTries((n) => n + 1);
    }, tries === 0 ? 1500 : 4000);
    return () => clearTimeout(timer);
  }, [report, tries, submissionId]);

  const done = Boolean(report?.category);
  const meta = report?.category ? CATEGORY_META[report.category] ?? CATEGORY_META.other : null;

  return (
    <Card className="text-left">
      <div className="flex items-start gap-4">
        <span className={cx("rounded-2xl p-3", done ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700")}>
          {done ? <Icon name="sparkles" size={24} /> : <Spinner size={24} />}
        </span>
        <div>
          <p className="font-semibold text-slate-900">{done ? t("report.live.done") : t("report.live.reading")}</p>
          {done && meta && report ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="blue">
                <Icon name={meta.icon} size={12} /> {t(`category.${report.category}`)}
              </Badge>
              {report.other_reporters > 0 ? (
                <Badge tone="violet">{t("status.otherReporters", { count: report.other_reporters })}</Badge>
              ) : (
                <Badge tone="green">{t("report.live.first")}</Badge>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-600">{t("report.live.hint")}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ReportWizard() {
  const { t, speechLang, countryCode, language, setLanguage } = useLanguage();
  const { speak } = useSpeechSynthesis(speechLang);
  const { enqueue } = useOfflineQueue();
  const { status: authStatus, me } = useAuth();
  const signedIn = authStatus === "authenticated" && me?.kind === "citizen";

  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locationText, setLocationText] = useState("");
  const [locating, setLocating] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; queued: boolean; code: string | null } | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step, done]);

  function detectLocation() {
    if (!("geolocation" in navigator)) return setError(t("report.locationError"));
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setError(t("report.locationError"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const blob = await compressImage(file);
      setPhotoPreview(URL.createObjectURL(blob));
      setPhotoUrl(await uploadMediaAuthed("photo", blob));
    } catch {
      setPhotoPreview(null);
      setError(t("report.uploadError"));
    } finally {
      setPhotoBusy(false);
    }
  }

  const hasContent = Boolean(text.trim() || audioUrl || photoUrl);
  const hasLocation = Boolean(coords || locationText.trim());

  function next() {
    setError(null);
    if (step === 0 && !hasContent) return setError(t("report.errorContent"));
    if (step === 1 && !hasLocation) return setError(t("report.errorLocation"));
    setStep((s) => s + 1);
  }

  async function submit() {
    if (!consent) return setError(t("report.errorConsent"));
    setError(null);
    setSubmitting(true);
    const input = {
      channel: "web" as const,
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(audioUrl ? { audio_url: audioUrl } : {}),
      ...(photoUrl ? { photo_url: photoUrl } : {}),
      consent_version: CONSENT_VERSION,
      country_code: countryCode,
      ...(coords ? coords : { location_text: locationText.trim() }),
    };
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      const result = await submitReportAuthed(input, idempotencyKey.current);
      setDone({ id: result.submission_id, queued: false, code: result.tracking_code ?? null });
      speak(t("report.confirmationBody", { id: result.submission_id }));
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        enqueue(input, idempotencyKey.current);
        setDone({ id: idempotencyKey.current, queued: true, code: null });
      } else if (err instanceof ApiClientError && err.status === 429) {
        setError(t("report.errorRate"));
      } else {
        setError(err instanceof ApiClientError ? err.message : t("report.errorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Confirmation -------------------------------------------------------------------------
  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center sm:py-16">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Icon name="checkCircle" size={44} />
        </span>
        <h1 className="mt-6 text-3xl font-bold text-slate-900">{t("report.confirmationTitle")}</h1>
        <p className="mt-2 text-slate-600">{done.queued ? t("report.offlineQueued") : t("report.confirmationSub")}</p>
        {done.code ? (
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{t("report.trackingCode")}</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.15em] text-brand-900">{done.code}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
              <CopyButton text={done.code} label={t("common.copy")} copiedLabel={t("common.copied")} />
              <Link to={`/track/${done.code}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"><Icon name="search" size={14} />{t("report.trackNow")}</Link>
              {"share" in navigator && (
                <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100" onClick={() => void navigator.share({ title: "JanSetu", text: t("report.shareText", { code: done.code ?? "" }), url: `${location.origin}/track/${done.code}` }).catch(() => undefined)}>
                  <Icon name="send" size={14} />{t("report.share")}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600">{t("report.trackingHint")}</p>
          </div>
        ) : (
          <div className="mx-auto mt-6 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("status.idLabel")}</p>
              <p className="font-mono text-lg font-bold text-slate-900">{done.id}</p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {signedIn && !done.queued ? (
            <LiveResult submissionId={done.id} />
          ) : (
            <Alert tone="info" title={t("report.anon.title")}>
              {t("report.anon.body")}{" "}
              <Link to="/login" className="font-semibold underline">{t("login.createAccount")}</Link>
            </Alert>
          )}
        </div>

        <ol className="mx-auto mt-8 max-w-md space-y-3 text-left text-sm">
          {["report.next1", "report.next2", "report.next3"].map((k, i) => (
            <li key={k} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
              <span className="text-slate-700">{t(k)}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" icon="plus" onClick={() => location.reload()}>{t("report.another")}</Button>
          {signedIn && <Link to="/my"><Button icon="list">{t("nav.myReports")}</Button></Link>}
          <Link to="/transparency"><Button variant="ghost" icon="eye">{t("nav.transparency")}</Button></Link>
        </div>
      </div>
    );
  }

  // ---- Wizard -------------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("report.title")}</h1>
          <p className="mt-1 text-slate-600">{t("report.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Language">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              aria-pressed={language === l.code}
              onClick={() => setLanguage(l.code)}
              className={cx("rounded-full border px-3 py-1 text-sm font-medium transition", language === l.code ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand-400")}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <Stepper step={step} />

      <Card className="fade-up !p-5 sm:!p-8" key={step}>
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <VoiceRecorder onTranscript={(v) => setText((prev) => (prev ? `${prev} ${v}` : v))} onAudioUploaded={setAudioUrl} />
            <Field label={t("report.textLabel")} htmlFor="report-text" hint={t("report.textHint")}>
              <Textarea id="report-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("report.textPlaceholder")} />
            </Field>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-800">{t("report.photoLabel")}</p>
              {photoPreview ? (
                <div className="relative w-fit">
                  <img src={photoPreview} alt="" className="h-40 rounded-xl border border-slate-200 object-cover" />
                  {photoBusy && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70"><Spinner /></div>}
                  <button type="button" aria-label="Remove photo" onClick={() => { setPhotoPreview(null); setPhotoUrl(null); }} className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-1 text-white shadow">
                    <Icon name="x" size={14} />
                  </button>
                  {photoUrl && <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-emerald-700"><Icon name="checkCircle" size={14} />{t("report.photoAttached")}</p>}
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-slate-600 transition hover:border-brand-400 hover:bg-brand-50/40">
                  <Icon name="camera" size={22} />
                  <span className="text-sm">
                    <span className="font-semibold text-brand-700">{t("report.photoPick")}</span> {t("report.photoSub")}
                  </span>
                  <input id="report-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => handlePhoto(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" icon="pin" loading={locating} onClick={detectLocation}>
                {locating ? t("report.locationDetecting") : t("report.locationAuto")}
              </Button>
              <span className="text-sm text-slate-500">{t("report.mapHint")}</span>
            </div>
            <LocationPicker value={coords} onChange={setCoords} center={COUNTRY_CENTER[countryCode] ?? COUNTRY_CENTER.IN} className="h-80" />
            {coords && (
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Icon name="checkCircle" size={16} /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
            <Field label={t("report.locationManualLabel")} htmlFor="report-location" hint={t("report.locationManualHint")}>
              <Input id="report-location" value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder={t("report.locationManualPlaceholder")} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-slate-900">{t("report.review")}</h2>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              <div className="flex gap-4 p-3">
                <dt className="w-28 shrink-0 font-medium text-slate-500">{t("report.step.describe")}</dt>
                <dd className="text-slate-900">
                  {text.trim() || <span className="text-slate-400">{t("report.review.noText")}</span>}
                  <div className="mt-1.5 flex gap-1.5">
                    {audioUrl && <Badge tone="blue"><Icon name="mic" size={12} /> {t("report.audioSaved")}</Badge>}
                    {photoUrl && <Badge tone="blue"><Icon name="camera" size={12} /> {t("report.photoAttached")}</Badge>}
                  </div>
                </dd>
              </div>
              <div className="flex gap-4 p-3">
                <dt className="w-28 shrink-0 font-medium text-slate-500">{t("report.step.where")}</dt>
                <dd className="text-slate-900">
                  {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : locationText}
                  {coords && locationText && <span className="block text-slate-500">{locationText}</span>}
                </dd>
              </div>
            </dl>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="shield" size={16} className="text-brand-700" /> {t("consent.title")}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("consent.body")}</p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-900">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-500" />
                {t("consent.agree")}
              </label>
            </div>

            {!signedIn && <Alert tone="info">{t("report.anon.hint")}</Alert>}
          </div>
        )}

        {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" icon={undefined} disabled={step === 0} onClick={() => { setError(null); setStep((s) => s - 1); }}>
            {t("common.back")}
          </Button>
          {step < 2 ? (
            <Button size="lg" onClick={next}>{t("common.continue")}</Button>
          ) : (
            <Button size="lg" variant="accent" loading={submitting} disabled={!consent || photoBusy} onClick={submit} icon="upload">
              {t("report.submit")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
