import { useState } from "react";
import { BASE_URL } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { CopyButton } from "../ui/extras.js";
import { Icon } from "../ui/Icon.js";
import { Badge, Button, Card, CardTitle, Spinner } from "../ui/kit.js";

const ENDPOINTS = [
  { path: "/public/overview", key: "od.ep.overview" },
  { path: "/public/impact", key: "od.ep.impact" },
  { path: "/public/scorecards?group=district", key: "od.ep.scorecards" },
  { path: "/public/issues", key: "od.ep.issues" },
  { path: "/public/regions?level=state", key: "od.ep.regions" },
  { path: "/public/schemes", key: "od.ep.schemes" },
  { path: "/public/transparency?state=IN-DL", key: "od.ep.transparency" },
];

/** Digital Public Good: every public number is downloadable, documented and free to reuse. */
export default function OpenData() {
  const { t } = useLanguage();
  const [tried, setTried] = useState<{ path: string; body: string; ms: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const csv = `${BASE_URL}/public/opendata/issues.csv`;

  async function tryIt(path: string) {
    setBusy(path);
    const started = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`);
      const text = JSON.stringify(await res.json(), null, 2);
      setTried({ path, body: text.length > 1800 ? `${text.slice(0, 1800)}\n... (${text.length - 1800} more characters)` : text, ms: Math.round(performance.now() - started) });
    } catch {
      setTried({ path, body: t("report.errorGeneric"), ms: 0 });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <Badge tone="green"><Icon name="code" size={12} />{t("od.badge")}</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{t("od.title")}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{t("od.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <Card className="!bg-brand-950 text-white">
          <span className="rounded-lg bg-white/10 p-2 inline-flex"><Icon name="download" size={20} /></span>
          <h2 className="mt-3 text-xl font-bold">{t("od.csv.title")}</h2>
          <p className="mt-1 text-sm text-brand-100">{t("od.csv.body")}</p>
          <a href={csv} download><Button variant="accent" icon="download" className="mt-4">{t("od.csv.download")}</Button></a>
        </Card>
        <Card>
          <CardTitle title={t("od.guarantees")} icon="shield" />
          <ul className="space-y-2 text-sm text-slate-700">
            {["od.g1", "od.g2", "od.g3", "od.g4"].map((k) => (
              <li key={k} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />{t(k)}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5"><CardTitle title={t("od.api.title")} subtitle={t("od.api.sub")} icon="code" /></div>
        <ul>
          {ENDPOINTS.map((e) => (
            <li key={e.path} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3">
              <Badge tone="green">GET</Badge>
              <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{e.path}</code>
              <span className="hidden text-sm text-slate-500 md:block md:w-64">{t(e.key)}</span>
              <CopyButton text={`curl "${BASE_URL}${e.path}"`} label="curl" copiedLabel={t("common.copied")} />
              <Button size="sm" variant="secondary" onClick={() => tryIt(e.path)} disabled={busy !== null}>{busy === e.path ? <Spinner size={14} /> : t("od.tryIt")}</Button>
            </li>
          ))}
          <li className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-3">
            <Badge tone="green">GET</Badge>
            <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">/public/track/PR-XXXXXXXX</code>
            <span className="hidden text-sm text-slate-500 md:block md:w-64">{t("od.ep.track")}</span>
          </li>
        </ul>
      </Card>

      {tried && (
        <Card className="mt-4 !bg-slate-900">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span><b className="text-emerald-400">200</b> GET {tried.path}</span>
            <span>{tried.ms} ms</span>
          </div>
          <pre className="max-h-96 overflow-auto text-xs leading-relaxed text-slate-100">{tried.body}</pre>
        </Card>
      )}

      <p className="mt-6 text-xs text-slate-500">{t("od.licence")}</p>
    </div>
  );
}
