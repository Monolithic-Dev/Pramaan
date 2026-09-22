import { Link } from "react-router-dom";
import { api } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_COLOR, CATEGORY_META, Icon } from "../../ui/Icon.js";
import { AreaChart, BarList, Donut, Meter, priorityColor } from "../../ui/charts.js";
import { Alert, Card, CardTitle, PageHeader, SampleDataBadge, Skeleton, Stat, cx, useAsync } from "../../ui/kit.js";

export const STATUS_COLOR: Record<string, string> = {
  open: "#94a3b8",
  verified: "#3b82f6",
  disputed: "#f59e0b",
  prioritized: "#8b5cf6",
  funded: "#14b8a6",
  in_progress: "#6366f1",
  resolved: "#16a34a",
};

export default function Overview() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const overview = useAsync(() => api.overview(regionId), [regionId]);
  const top = useAsync(() => api.issues({ region: regionId, sort: "score" }), [regionId]);
  const o = overview.data;

  return (
    <div>
      <PageHeader
        eyebrow={regionName}
        title={t("console.overview.title")}
        subtitle={t("console.overview.subtitle")}
        actions={o?.totals.sample_data ? <SampleDataBadge label={t("badge.sample")} /> : undefined}
      />

      {overview.error && <Alert tone="error">{overview.error.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.loading || !o ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Stat label={t("console.kpi.issues")} value={o.totals.issues.toLocaleString()} hint={t("console.kpi.reportsHint", { count: o.totals.reports })} icon="flag" />
            <Stat label={t("console.kpi.high")} value={o.totals.high_priority} hint={t("console.kpi.highHint")} icon="alert" tone="red" />
            <Stat label={t("console.kpi.resolution")} value={`${o.totals.resolution_rate}%`} hint={t("console.kpi.resolvedHint", { count: o.totals.resolved })} icon="checkCircle" tone="green" />
            <Stat label={t("console.kpi.flagged")} value={o.totals.flagged} hint={t("console.kpi.flaggedHint", { count: o.totals.emergency })} icon="shield" tone="amber" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle title={t("console.trend.title")} subtitle={t("console.trend.sub")} icon="trend" />
          {o ? <AreaChart label={t("console.trend.title")} data={o.trend_daily.map((d) => ({ label: d.date.slice(5), value: d.count }))} /> : <Skeleton className="h-44" />}
        </Card>
        <Card>
          <CardTitle title={t("console.byStatus")} icon="layers" />
          {o ? (
            <Donut
              center={{ value: String(o.totals.issues), label: t("console.kpi.issues") }}
              slices={o.by_status.filter((s) => s.count > 0).map((s) => ({ label: t(`status.${s.status}`), value: s.count, color: STATUS_COLOR[s.status] }))}
            />
          ) : <Skeleton className="h-36" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardTitle title={t("console.byCategory")} icon="chart" />
          {o ? (
            <BarList
              emptyText={t("console.empty")}
              items={o.by_category.map((c) => ({ label: t(`category.${c.category}`), value: c.issues, key: c.category, sub: t("transparency.reportsSub", { count: c.reports }) }))}
              colorFor={(i) => CATEGORY_COLOR[i.key ?? "other"]}
            />
          ) : <Skeleton className="h-36" />}
        </Card>
        <Card>
          <CardTitle title={t("console.hotspots")} subtitle={t("console.hotspotsSub")} icon="pin" />
          {o ? (
            <BarList
              emptyText={t("console.empty")}
              items={o.top_regions.map((r) => ({ label: r.name, value: r.reports, key: r.region_id, sub: t("console.hotspotIssues", { count: r.issues }) }))}
              colorFor={() => "#7c3aed"}
            />
          ) : <Skeleton className="h-36" />}
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-2">
            <CardTitle
              title={t("console.needsAttention")}
              icon="bolt"
              action={<Link className="text-sm font-semibold text-brand-700 hover:underline" to="/console/priorities">{t("common.viewAll")}</Link>}
            />
          </div>
          {top.loading ? (
            <div className="space-y-3 p-5 pt-0">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (top.data?.issues.length ?? 0) === 0 ? (
            <p className="p-8 pt-2 text-center text-sm text-slate-500">{t("console.empty")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {top.data!.issues.slice(0, 5).map((i) => {
                const meta = CATEGORY_META[i.category] ?? CATEGORY_META.other;
                return (
                  <li key={i.issue_id}>
                    <Link to={`/console/issues/${i.issue_id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                      <span className={cx("rounded-lg p-2", meta.bg, meta.tone)}><Icon name={meta.icon} size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{i.description}</p>
                        <p className="text-xs text-slate-500">{i.region_name ?? "-"} · {t("console.reportsCount", { count: i.report_count })}</p>
                      </div>
                      <div className="w-14 text-right">
                        <p className="text-sm font-bold tabular-nums" style={{ color: priorityColor(i.composite_score) }}>{i.composite_score?.toFixed(2) ?? "-"}</p>
                        <Meter value={i.composite_score ?? 0} color={priorityColor(i.composite_score)} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {o && o.totals.issues === 0 && (
        <div className="mt-6"><Alert tone="info" title={t("console.noData.title")}>{t("console.noData.body")}</Alert></div>
      )}
    </div>
  );
}
