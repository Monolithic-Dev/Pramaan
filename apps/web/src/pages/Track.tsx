import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Tracking } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { JourneyStepper } from "../ui/extras.js";
import { CATEGORY_META, Icon } from "../ui/Icon.js";
import { Alert, Badge, Button, Card, Input, PriorityBadge, Skeleton, timeAgo } from "../ui/kit.js";

const DEMO_CODE = "JS-K7M3P9QD";

/** Follow a report with nothing but its code: no account, no phone number, no personal data. */
export default function Track() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { code: param } = useParams();
  const [code, setCode] = useState(param ?? "");
  const [result, setResult] = useState<Tracking | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "notfound" | "limited" | "error">("idle");

  async function lookup(value: string) {
    if (!value.trim()) return;
    setState("loading");
    setResult(null);
    try {
      setResult(await api.track(value.trim()));
      setState("idle");
    } catch (e) {
      const status = (e as { status?: number }).status;
      setState(status === 404 ? "notfound" : status === 429 ? "limited" : "error");
    }
  }

  useEffect(() => {
    if (param) void lookup(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code.trim()) navigate(`/track/${encodeURIComponent(code.trim())}`);
  }

  const labels = Object.fromEntries((result?.stages ?? []).map((s) => [s, t(`journey.${s}`)]));
  const meta = result?.category ? CATEGORY_META[result.category] ?? CATEGORY_META.other : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <span className="mx-auto mb-4 inline-flex rounded-2xl bg-brand-50 p-3 text-brand-700"><Icon name="search" size={28} /></span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("track.title")}</h1>
        <p className="mt-2 text-slate-600">{t("track.subtitle")}</p>
      </div>

      <form onSubmit={submit} className="mt-8 flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="JS-XXXXXXXX" aria-label={t("track.code")} autoComplete="off" spellCheck={false} className="!py-3.5 text-center font-mono text-lg tracking-widest" />
        <Button type="submit" size="lg" icon="arrowRight" loading={state === "loading"}>{t("track.find")}</Button>
      </form>
      <p className="mt-2 text-center text-xs text-slate-500">
        {t("track.where")}{" "}
        <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => { setCode(DEMO_CODE); navigate(`/track/${DEMO_CODE}`); }}>{t("track.tryDemo", { code: DEMO_CODE })}</button>
      </p>

      <div className="mt-8 space-y-4">
        {state === "loading" && <Skeleton className="h-48" />}
        {state === "notfound" && <Alert tone="warn" title={t("track.notFound.title")}>{t("track.notFound.body")}</Alert>}
        {state === "limited" && <Alert tone="warn">{t("track.limited")}</Alert>}
        {state === "error" && <Alert tone="error">{t("report.errorGeneric")}</Alert>}

        {result && (
          <Card className="fade-up">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold tracking-widest text-brand-700">{result.tracking_code}</p>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
                  {meta && <span className={`rounded-lg p-1.5 ${meta.bg} ${meta.tone}`}><Icon name={meta.icon} size={18} /></span>}
                  {result.category ? t(`category.${result.category}`) : t("my.processing")}
                </h2>
                <p className="text-xs text-slate-500">{t("track.received", { when: timeAgo(result.submitted_at) })} · {result.channel}</p>
              </div>
              <PriorityBadge priority={result.priority} label={t(`status.priority.${result.priority}`)} />
            </div>

            <div className="mt-8"><JourneyStepper stages={result.stages} current={result.stage} labels={labels} /></div>

            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{t("track.stage")}</dt><dd className="font-semibold text-slate-900">{t(`journey.${result.stage}`)}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{t("my.community")}</dt><dd className="font-semibold text-slate-900">{t("track.others", { n: result.other_reporters })}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{t("track.project")}</dt><dd className="font-semibold text-slate-900">{result.project_stage ? t(`project.${result.project_stage}`) : "-"}</dd></div>
            </dl>
            <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-500"><Icon name="lock" size={13} className="mt-0.5 shrink-0" />{t("track.privacy")}</p>
          </Card>
        )}

        {!result && state === "idle" && (
          <Card className="!bg-brand-50/60">
            <h3 className="font-semibold text-slate-900">{t("track.why.title")}</h3>
            <p className="mt-1 text-sm text-slate-600">{t("track.why.body")}</p>
            <Link to="/login" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">{t("track.account")}</Link>
            <Badge tone="saffron" className="ml-2">{t("badge.sample")}</Badge>
          </Card>
        )}
      </div>
    </div>
  );
}
