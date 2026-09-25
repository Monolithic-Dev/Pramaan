import { api } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Card, CardTitle, EmptyState, PageHeader, SampleDataBadge, Skeleton, Stat, useAsync } from "../../ui/kit.js";
import { AreaChart, Meter } from "../../ui/charts.js";
import { compact, fullNumber, money } from "../../ui/format.js";

/** The impact ledger: what has actually changed for people, verified by the people who asked for it. */
export default function Impact() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const { data: d, loading } = useAsync(() => api.impact(regionId), [regionId]);

  return (
    <div>
      <PageHeader
        title={t("impact.title")}
        subtitle={t("impact.subtitle")}
        eyebrow={regionName}
        actions={d?.sample_data ? <SampleDataBadge label={t("badge.sample")} /> : undefined}
      />
      {loading || !d ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : d.issues === 0 ? (
        <Card><EmptyState icon="target" title={t("console.noData.title")} body={t("console.noData.body")} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("impact.people")} value={compact(d.people_benefited)} hint={t("impact.people.hint", { n: d.resolved })} icon="users" tone="green" />
            <Stat label={t("impact.days")} value={d.avg_days_to_resolve === null ? "-" : `${d.avg_days_to_resolve}`} hint={t("impact.days.hint")} icon="clock" tone="brand" />
            <Stat label={t("impact.costPer")} value={d.cost_per_beneficiary_inr === null ? "-" : `₹${fullNumber(d.cost_per_beneficiary_inr)}`} hint={t("impact.costPer.hint")} icon="rupee" tone="amber" />
            <Stat label={t("impact.confirmRate")} value={d.confirmation_rate === null ? "-" : `${d.confirmation_rate}%`} hint={t("impact.confirmRate.hint", { n: d.citizen_confirmations })} icon="thumbsUp" tone="green" />
          </div>

          <Card className="mt-4">
            <CardTitle title={t("impact.loop.title")} subtitle={t("impact.loop.sub")} icon="refresh" />
            <ol className="grid gap-3 sm:grid-cols-4">
              {[
                { icon: "flag" as const, value: fullNumber(d.issues), label: t("impact.loop.reported") },
                { icon: "rupee" as const, value: money(d.funds_committed_inr), label: t("impact.loop.committed") },
                { icon: "check" as const, value: fullNumber(d.resolved), label: t("impact.loop.fixed") },
                { icon: "thumbsUp" as const, value: fullNumber(d.citizen_confirmations), label: t("impact.loop.confirmed") },
              ].map((s, i) => (
                <li key={s.label} className="relative rounded-xl bg-slate-50 p-4">
                  <span className="absolute -top-2 left-4 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">{i + 1}</span>
                  <Icon name={s.icon} size={18} className="text-brand-700" />
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </li>
              ))}
            </ol>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardTitle title={t("impact.trend")} subtitle={t("impact.trend.sub")} icon="trend" />
              <AreaChart data={d.monthly_resolved.map((m) => ({ label: m.month.slice(2), value: m.count }))} label={t("impact.trend")} color="#138808" />
            </Card>
            <Card>
              <CardTitle title={t("impact.byCategory")} subtitle={t("impact.byCategory.sub")} icon="layers" />
              {d.by_category.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">{t("console.empty")}</p>
              ) : (
                <ul className="space-y-4">
                  {d.by_category.map((c) => {
                    const meta = CATEGORY_META[c.category] ?? CATEGORY_META.other;
                    return (
                      <li key={c.category}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <span className={`rounded-lg p-1.5 ${meta.bg} ${meta.tone}`}><Icon name={meta.icon} size={14} /></span>
                            {t(`category.${c.category}`)}
                          </span>
                          <span className="tabular-nums text-slate-600">{t("impact.resolvedCount", { n: c.resolved })}{c.avg_days !== null && ` · ${t("impact.daysShort", { n: c.avg_days })}`}</span>
                        </div>
                        <Meter value={(c.efficacy ?? 0) / 100} color="#138808" />
                        <p className="mt-0.5 text-right text-[11px] text-slate-400">{c.efficacy === null ? t("impact.noEfficacy") : t("impact.efficacy", { pct: Math.round(c.efficacy) })}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
          <p className="mt-4 text-xs text-slate-500">{t("impact.method")}</p>
        </>
      )}
    </div>
  );
}
