import { useMemo, useState } from "react";
import { api, type Scheme } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Segmented, Skeleton, useAsync } from "../../ui/kit.js";
import { Donut, Meter } from "../../ui/charts.js";
import { money } from "../../ui/format.js";
import { SchemeLedgerView } from "./SchemeLedger.js";

const PALETTE = ["#1d3f97", "#ff9933", "#138808", "#7c3aed", "#0891b2", "#db2777", "#ca8a04", "#475569"];
const CATEGORIES = ["all", "roads", "water", "electricity", "sanitation", "health_infra", "education_infra"] as const;

export default function Schemes() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const align = useAsync(() => api.alignment(regionId), [regionId]);
  const catalogue = useAsync(() => api.schemes(), []);
  const ledger = useAsync(() => api.schemePerformance(regionId), [regionId]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");

  const a = align.data;
  const schemes = useMemo(
    () => (catalogue.data?.schemes ?? []).filter((s) => category === "all" || s.categories.includes(category)),
    [catalogue.data, category],
  );

  return (
    <div>
      <PageHeader title={t("schemes.title")} subtitle={t("schemes.subtitle")} eyebrow={regionName} />

      <section className="hero-grid mb-6 overflow-hidden rounded-2xl p-6 text-white sm:p-8">
        {align.loading || !a ? (
          <Skeleton className="h-28 !bg-white/10" />
        ) : a.open_issues === 0 ? (
          <p className="text-brand-100">{t("schemes.noOpen")}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-saffron-400">{t("schemes.hero.eyebrow")}</p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                {money(a.centre_inr)} <span className="text-2xl font-semibold text-brand-200">{t("schemes.hero.of", { total: money(a.total_cost_inr) })}</span>
              </p>
              <p className="mt-3 max-w-xl text-brand-100">{t("schemes.hero.body", { pct: Math.round(a.centre_share * 100), n: a.open_issues })}</p>
              <p className="mt-3 text-xs text-brand-200/80">{t("schemes.hero.caveat")}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-brand-100">
                <span>{t("schemes.hero.centre")}</span>
                <span>{t("schemes.hero.state")}</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-white/20">
                <div className="bg-saffron-500" style={{ width: `${a.centre_share * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm font-semibold">
                <span>{money(a.centre_inr)}</span>
                <span>{money(a.state_inr)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {a && a.by_scheme.length > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardTitle title={t("schemes.byScheme")} subtitle={t("schemes.byScheme.sub")} icon="layers" />
            <Donut
              slices={a.by_scheme.slice(0, 7).map((s, i) => ({ label: s.short, value: s.issues, color: PALETTE[i % PALETTE.length] }))}
              center={{ value: String(a.open_issues), label: t("schemes.openIssues") }}
            />
          </Card>
          <Card padded={false} className="overflow-hidden">
            <div className="px-5 pt-5"><CardTitle title={t("schemes.routes")} subtitle={t("schemes.routes.sub")} icon="rupee" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-3">{t("schemes.col.scheme")}</th><th className="px-3 py-3">{t("schemes.col.mission")}</th><th className="px-3 py-3 text-right">{t("schemes.col.issues")}</th><th className="px-3 py-3 text-right">{t("schemes.col.cost")}</th><th className="px-3 py-3 text-right">{t("schemes.col.centre")}</th></tr>
                </thead>
                <tbody>
                  {a.by_scheme.map((s, i) => (
                    <tr key={s.scheme_id} className="border-t border-slate-100">
                      <td className="px-5 py-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="font-semibold text-slate-900">{s.short}</span></td>
                      <td className="px-3 py-3 text-slate-600">{s.priority}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.issues}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(s.cost_inr)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">{money(s.centre_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-1 text-xl font-bold text-slate-900">{t("ledger.title")}</h2>
        <p className="mb-4 text-sm text-slate-600">{t("ledger.subtitle")}</p>
        {ledger.loading || !ledger.data ? <Skeleton className="h-64" /> : <SchemeLedgerView data={ledger.data} />}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{t("schemes.catalogue")}</h2>
        <Segmented value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: t(c === "all" ? "console.filter.allCategories" : `category.${c}`) }))} className="max-w-full overflow-x-auto" />
      </div>
      {catalogue.loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : schemes.length === 0 ? (
        <Card><EmptyState icon="rupee" title={t("console.empty")} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{schemes.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>
      )}
    </div>
  );
}

export function SchemeCard({ scheme: s }: { scheme: Scheme }) {
  const { t } = useLanguage();
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{s.short}</h3>
          <p className="text-xs text-slate-500">{s.name}</p>
        </div>
        <Badge tone={s.settlement === "urban" ? "blue" : s.settlement === "rural" ? "green" : "slate"}>{t(`schemes.settlement.${s.settlement}`)}</Badge>
      </div>
      <p className="mt-3 flex-1 text-sm text-slate-700">{s.summary}</p>
      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium text-slate-600">{t("schemes.centreShare")}</span>
          <span className="font-bold text-slate-900">{Math.round(s.centre_share * 100)}%</span>
        </div>
        <Meter value={s.centre_share} color="#ff9933" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {s.categories.slice(0, 4).map((c) => <Badge key={c}>{t(`category.${c}`)}</Badge>)}
        {s.categories.length > 4 && <Badge>+{s.categories.length - 4}</Badge>}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
        <Icon name="info" size={13} className="mt-0.5 shrink-0" />
        <span>{s.ministry}. {s.guideline_note}</span>
      </p>
      {s.requires_mp_recommendation && <p className="mt-2 text-xs font-semibold text-amber-700">{t("schemes.mpNote")}</p>}
    </Card>
  );
}
