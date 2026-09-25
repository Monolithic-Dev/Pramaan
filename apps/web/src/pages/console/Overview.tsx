import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ActivityEvent } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { money } from "../../ui/format.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_COLOR, CATEGORY_META, Icon } from "../../ui/Icon.js";
import { AreaChart, BarList, Donut, Meter, priorityColor } from "../../ui/charts.js";
import { Alert, Badge, Card, CardTitle, PageHeader, SampleDataBadge, Skeleton, Stat, cx, timeAgo, useAsync } from "../../ui/kit.js";

export const STATUS_COLOR: Record<string, string> = {
  open: "#94a3b8",
  verified: "#3b82f6",
  disputed: "#f59e0b",
  prioritized: "#8b5cf6",
  funded: "#14b8a6",
  in_progress: "#6366f1",
  resolved: "#16a34a",
};

/** Newest reports and officer actions in the jurisdiction, refreshed every 20 seconds. */
function ActivityFeed({ regionId }: { regionId: string }) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api.activity(regionId).then((r) => live && setEvents(r.events)).catch(() => undefined);
    void load();
    const timer = setInterval(load, 20_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [regionId]);

  return (
    <Card padded={false} className="xl:col-span-2">
      <div className="p-5 pb-2">
        <CardTitle title={t("console.activity.title")} subtitle={t("console.activity.sub")} icon="activity" action={<Badge tone="green"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{t("console.activity.live")}</Badge>} />
      </div>
      {!events ? (
        <div className="space-y-2 p-5 pt-0">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : events.length === 0 ? (
        <p className="p-8 pt-2 text-center text-sm text-slate-500">{t("console.empty")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.slice(0, 8).map((e, i) => {
            const meta = CATEGORY_META[e.category] ?? CATEGORY_META.other;
            return (
              <li key={i}>
                <Link to={`/console/issues/${e.issue_id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-slate-50">
                  <span className={cx("rounded-lg p-1.5", meta.bg, meta.tone)}><Icon name={e.kind === "report" ? meta.icon : "activity"} size={15} /></span>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    {e.kind === "report"
                      ? t("console.activity.report", { category: t(`category.${e.category}`), region: e.region_name ?? "-" })
                      : t("console.activity.action", { action: t(`audit.${e.action}`), category: t(`category.${e.category}`) })}
                    {e.detail && <span className="text-slate-400"> · {e.detail}</span>}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(e.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function Overview() {
  const { t } = useLanguage();
  const { can, me } = useAuth();
  const { regionId, regionName } = useScope();
  const overview = useAsync(() => api.overview(regionId), [regionId]);
  const top = useAsync(() => api.issues({ region: regionId, sort: "score" }), [regionId]);
  const alignment = useAsync(() => api.alignment(regionId), [regionId]);
  const o = overview.data;
  const all = top.data?.issues ?? [];
  const overdue = all.filter((i) => i.sla.state === "overdue").length;
  const mine = all.filter((i) => i.assigned_to_uid === me?.uid && i.status !== "resolved").length;

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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/console/queue" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-lift">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><Icon name="inbox" size={20} /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{t("console.quick.queue")}</span><span className="block text-xs text-slate-500">{t("console.quick.queueHint", { n: mine })}</span></span>
        </Link>
        <Link to="/console/queue" className={cx("group flex items-center gap-3 rounded-2xl border p-4 shadow-card transition hover:shadow-lift", overdue > 0 ? "border-rose-200 bg-rose-50/60 hover:border-rose-300" : "border-slate-200 bg-white hover:border-brand-300")}>
          <span className={cx("rounded-xl p-2.5", overdue > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600")}><Icon name="clock" size={20} /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{t("console.quick.overdue")}</span><span className="block text-xs text-slate-500">{t("console.quick.overdueHint", { n: overdue })}</span></span>
        </Link>
        {can("manage_projects") ? (
          <Link to="/console/planner" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-lift">
            <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Icon name="sliders" size={20} /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{t("console.quick.plan")}</span><span className="block text-xs text-slate-500">{t("console.quick.planHint")}</span></span>
          </Link>
        ) : (
          <Link to="/console/impact" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-lift">
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Icon name="target" size={20} /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{t("console.nav.impact")}</span><span className="block text-xs text-slate-500">{t("console.quick.impactHint")}</span></span>
          </Link>
        )}
        <Link to="/console/briefing" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-lift">
          <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Icon name="printer" size={20} /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{t("console.quick.briefing")}</span><span className="block text-xs text-slate-500">{t("console.quick.briefingHint")}</span></span>
        </Link>
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
              items={o.top_regions.map((r) => ({ label: r.name, value: r.issues, key: r.region_id, sub: t("transparency.reportsSub", { count: r.reports }) }))}
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

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ActivityFeed regionId={regionId} />
        <Card>
          <CardTitle title={t("console.funding.title")} subtitle={t("console.funding.sub")} icon="rupee" action={<Link className="text-sm font-semibold text-brand-700 hover:underline" to="/console/schemes">{t("common.viewAll")}</Link>} />
          {alignment.loading || !alignment.data ? (
            <Skeleton className="h-32" />
          ) : alignment.data.open_issues === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t("console.empty")}</p>
          ) : (
            <>
              <p className="text-3xl font-extrabold tracking-tight text-slate-900">{money(alignment.data.centre_inr)}</p>
              <p className="text-sm text-slate-600">{t("console.funding.of", { total: money(alignment.data.total_cost_inr), pct: Math.round(alignment.data.centre_share * 100) })}</p>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="bg-saffron-500" style={{ width: `${alignment.data.centre_share * 100}%` }} /></div>
              <ul className="mt-4 space-y-2 text-sm">
                {alignment.data.by_scheme.slice(0, 4).map((s) => (
                  <li key={s.scheme_id} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{s.short}</span>
                    <span className="tabular-nums text-slate-500">{t("console.funding.issues", { n: s.issues })} · <b className="text-emerald-700">{money(s.centre_inr)}</b></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {o && o.totals.issues === 0 && (
        <div className="mt-6"><Alert tone="info" title={t("console.noData.title")}>{t("console.noData.body")}</Alert></div>
      )}
    </div>
  );
}
