import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { SUPPORTED_LANGUAGES, useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Alert, Badge, Button, Card, CardTitle, EmptyState, PageHeader, Select, Skeleton, StatusBadge, useAsync, useToast } from "../../ui/kit.js";
import { fullNumber, saveBlob } from "../../ui/format.js";
import { priorityColor } from "../../ui/charts.js";

/** The Monday-morning briefing: computed figures, a grounded plain-language summary, and what to do first. */
export default function Briefing() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { regionId } = useScope();
  const [lang, setLang] = useState<string>(language);
  const { data, loading, error, refetch } = useAsync(() => api.briefing(regionId, lang), [regionId, lang]);
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      saveBlob(await api.exportIssuesCsv(regionId), `pramaan-issues-${regionId}.csv`);
    } catch {
      toast("error", t("report.errorGeneric"));
    } finally {
      setExporting(false);
    }
  }

  const f = data?.facts;
  return (
    <div>
      <PageHeader
        title={t("briefing.title")}
        subtitle={t("briefing.subtitle")}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Select aria-label={t("briefing.language")} value={lang} onChange={(e) => setLang(e.target.value)} className="!w-auto">
              {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
            <Button variant="secondary" icon="refresh" onClick={refetch}>{t("briefing.regenerate")}</Button>
            <Button variant="secondary" icon="download" loading={exporting} onClick={exportCsv}>{t("common.exportCsv")}</Button>
            <Button icon="printer" onClick={() => window.print()}>{t("briefing.print")}</Button>
          </div>
        }
      />

      {error && <Alert tone="error">{error.message}</Alert>}
      {loading || !f || !data ? (
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
      ) : f.totals.issues === 0 ? (
        <Card><EmptyState icon="printer" title={t("console.noData.title")} body={t("console.noData.body")} /></Card>
      ) : (
        <article className="space-y-4">
          <Card className="print-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t("briefing.weekly")}</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{f.region.name}</h2>
                <p className="text-sm text-slate-500">{new Date(f.generated_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <Badge tone={data.narrative.source === "gemini" ? "violet" : "slate"}>
                <Icon name={data.narrative.source === "gemini" ? "sparkles" : "info"} size={12} />
                {t(data.narrative.source === "gemini" ? "briefing.source.ai" : "briefing.source.template")}
              </Badge>
            </div>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-800">
              {data.narrative.text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-500">
              <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
              {t("briefing.grounded")}
            </p>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: t("console.kpi.issues"), value: fullNumber(f.totals.issues), icon: "flag" as const },
              { label: t("briefing.new7"), value: f.last_7_days.new_issues, icon: "plus" as const },
              { label: t("briefing.actions7"), value: f.last_7_days.actions_taken, icon: "activity" as const },
              { label: t("briefing.overdue"), value: f.overdue.count, icon: "clock" as const, alert: f.overdue.count > 0 },
              { label: t("console.kpi.resolution"), value: `${f.totals.resolution_rate}%`, icon: "checkCircle" as const },
            ].map((k) => (
              <Card key={k.label} className={`print-card !p-4 ${k.alert ? "border-rose-200 bg-rose-50/50" : ""}`}>
                <Icon name={k.icon} size={18} className={k.alert ? "text-rose-600" : "text-brand-700"} />
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{k.value}</p>
                <p className="text-xs text-slate-500">{k.label}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card padded={false} className="print-card overflow-hidden">
              <div className="px-5 pt-5"><CardTitle title={t("briefing.top")} subtitle={t("briefing.top.sub")} icon="list" /></div>
              <ul>
                {f.top_priorities.map((p, i) => {
                  const meta = CATEGORY_META[p.category] ?? CATEGORY_META.other;
                  return (
                    <li key={p.issue_id} className="flex items-center gap-3 border-t border-slate-100 px-5 py-3">
                      <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                      <span className={`rounded-lg p-1.5 ${meta.bg} ${meta.tone}`}><Icon name={meta.icon} size={15} /></span>
                      <Link to={`/console/issues/${p.issue_id}`} className="min-w-0 flex-1 hover:text-brand-700">
                        <span className="block truncate text-sm font-medium text-slate-900">{t(`category.${p.category}`)} · {p.region_name ?? "-"}</span>
                        <span className="block text-xs text-slate-500">{t("console.reportsCount", { count: p.reports })}</span>
                      </Link>
                      <StatusBadge status={p.status} label={t(`status.${p.status}`)} />
                      {!p.has_project && <Badge tone="amber">{t("briefing.noProject")}</Badge>}
                      <span className="w-10 text-right text-sm font-bold" style={{ color: priorityColor(p.score) }}>{p.score?.toFixed(2)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="space-y-4">
              <Card className="print-card">
                <CardTitle title={t("briefing.actions")} subtitle={t("briefing.actions.sub")} icon="checkCircle" />
                {f.recommended_actions.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("briefing.noActions")}</p>
                ) : (
                  <ol className="space-y-3">
                    {f.recommended_actions.map((a, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-800">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white">{i + 1}</span>
                        {a}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
              <Card className="print-card">
                <CardTitle title={t("briefing.funding")} icon="rupee" />
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-600">{t("briefing.needed")}</dt><dd className="font-semibold">{f.funding.needed}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-600">{t("briefing.central")}</dt><dd className="font-semibold text-emerald-700">{f.funding.central_drawable} ({f.funding.central_share_pct}%)</dd></div>
                </dl>
              </Card>
              {f.forecasts.length > 0 && (
                <Card className="print-card">
                  <CardTitle title={t("briefing.forecasts")} icon="trend" />
                  <ul className="space-y-2 text-sm">
                    {f.forecasts.map((x, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span>{t(`category.${x.category}`)} · {x.region_name}</span>
                        <Badge tone={x.risk_level === "high" ? "red" : "amber"}>{x.month}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
