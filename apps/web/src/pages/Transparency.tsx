import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { compact, fullNumber } from "../ui/format.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon } from "../ui/Icon.js";
import { CATEGORY_COLOR } from "../ui/Icon.js";
import { AreaChart, BarList, Donut } from "../ui/charts.js";
import { Alert, Card, CardTitle, PageHeader, SampleDataBadge, Select, Skeleton, Stat, useAsync } from "../ui/kit.js";

const STATUS_COLOR: Record<string, string> = {
  open: "#94a3b8",
  verified: "#3b82f6",
  disputed: "#f59e0b",
  prioritized: "#8b5cf6",
  funded: "#14b8a6",
  in_progress: "#6366f1",
  resolved: "#16a34a",
};

export default function Transparency() {
  const { t, countryCode } = useLanguage();
  const regions = useAsync(() => api.publicRegions({ country: countryCode }), [countryCode]);
  const impact = useAsync(() => api.publicImpact().catch(() => null), []);
  const states = (regions.data?.regions ?? []).filter((r) => r.level === "state" || r.level === "estado");
  const [stateId, setStateId] = useState("");
  useEffect(() => {
    if (!stateId && states[0]) setStateId(states[0].regionId);
  }, [states, stateId]);

  const overview = useAsync(() => api.publicOverview().catch(() => null), []);
  const stats = useAsync(() => (stateId ? api.transparency(stateId) : Promise.resolve(null)), [stateId]);
  const o = overview.data?.status === "ok" ? overview.data : null;
  const s = stats.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow={t("transparency.eyebrow")}
        title={t("transparency.title")}
        subtitle={t("transparency.subtitle")}
        actions={o?.totals?.sample_data ? <SampleDataBadge label={t("badge.sample")} /> : undefined}
      />

      <Alert tone="info" title={t("transparency.privacyTitle")}>
        {t("transparency.privacyBody", { min: overview.data?.min_required ?? 5 })}
      </Alert>

      {/* National view */}
      <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">{t("transparency.national")}</h2>
      {overview.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : o ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("landing.stat.issues")} value={o.totals!.issues.toLocaleString()} icon="flag" />
            <Stat label={t("landing.stat.reports")} value={o.totals!.reports.toLocaleString()} icon="users" tone="amber" />
            <Stat label={t("landing.stat.states")} value={o.states ?? 0} icon="globe" tone="slate" />
            <Stat label={t("landing.stat.resolved")} value={`${o.totals!.resolution_rate}%`} icon="checkCircle" tone="green" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle title={t("transparency.trend")} subtitle={t("transparency.trendSub")} icon="trend" />
              <AreaChart label={t("transparency.trend")} data={(o.trend_monthly ?? []).map((m) => ({ label: m.month.slice(2), value: m.count }))} />
            </Card>
            <Card>
              <CardTitle title={t("transparency.byStatus")} icon="layers" />
              <Donut
                center={{ value: String(o.totals!.issues), label: t("landing.stat.issues") }}
                slices={(o.by_status ?? []).filter((x) => x.count > 0).map((x) => ({ label: t(`status.${x.status}`), value: x.count, color: STATUS_COLOR[x.status] ?? "#94a3b8" }))}
              />
            </Card>
          </div>
          <Card className="mt-4">
            <CardTitle title={t("transparency.byCategory")} icon="chart" />
            <BarList
              items={(o.by_category ?? []).map((c) => ({ label: t(`category.${c.category}`), value: c.issues, key: c.category, sub: t("transparency.reportsSub", { count: c.reports }) }))}
              colorFor={(i) => CATEGORY_COLOR[i.key ?? "other"]}
            />
          </Card>
        </>
      ) : (
        <Card><p className="py-8 text-center text-slate-600">{t("transparency.insufficient", { min: overview.data?.min_required ?? 5 })}</p></Card>
      )}

      {/* Impact ledger: what changed for people, not just what was reported */}
      {impact.data && impact.data.status === "ok" && (
        <>
          <div className="mb-4 mt-12 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{t("transparency.impact")}</h2>
            <Link to="/accountability" className="text-sm font-semibold text-brand-700 hover:underline">{t("transparency.seeScorecards")}</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("impact.people")} value={compact(impact.data.people_benefited)} hint={t("impact.people.hint", { n: impact.data.resolved })} icon="users" tone="green" />
            <Stat label={t("impact.days")} value={impact.data.avg_days_to_resolve === null ? "-" : String(impact.data.avg_days_to_resolve)} hint={t("impact.days.hint")} icon="clock" />
            <Stat label={t("impact.costPer")} value={impact.data.cost_per_beneficiary_inr === null ? "-" : `₹${fullNumber(impact.data.cost_per_beneficiary_inr)}`} hint={t("impact.costPer.hint")} icon="rupee" tone="amber" />
            <Stat label={t("impact.confirmRate")} value={impact.data.confirmation_rate === null ? "-" : `${impact.data.confirmation_rate}%`} hint={t("impact.confirmRate.hint", { n: impact.data.citizen_confirmations })} icon="thumbsUp" tone="green" />
          </div>
        </>
      )}

      {/* State lens */}
      <div className="mb-4 mt-12 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{t("transparency.byState")}</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Icon name="pin" size={16} />
          <Select aria-label={t("transparency.stateLabel")} value={stateId} onChange={(e) => setStateId(e.target.value)} className="!w-auto">
            {states.map((r) => <option key={r.regionId} value={r.regionId}>{r.name}</option>)}
          </Select>
        </label>
      </div>
      {stats.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : s?.status === "ok" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("transparency.total")} value={s.total_reported} icon="flag" />
          <Stat label={t("transparency.verified")} value={`${s.pct_verified}%`} icon="eye" tone="brand" />
          <Stat label={t("transparency.funded")} value={`${s.pct_funded}%`} icon="scale" tone="amber" />
          <Stat label={t("transparency.resolved")} value={`${s.pct_resolved}%`} hint={s.avg_days_to_resolved != null ? t("transparency.avgDaysHint", { days: s.avg_days_to_resolved }) : undefined} icon="checkCircle" tone="green" />
        </div>
      ) : (
        <Card><p className="py-6 text-center text-slate-600">{t("transparency.insufficient", { min: s?.min_required ?? 5 })}</p></Card>
      )}
    </div>
  );
}
