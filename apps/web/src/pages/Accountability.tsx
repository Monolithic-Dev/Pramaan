import { useMemo, useState } from "react";
import { api, type Scorecard } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { GradeBadge } from "../ui/extras.js";
import { Icon } from "../ui/Icon.js";
import { Meter } from "../ui/charts.js";
import { Alert, Badge, Card, CardTitle, EmptyState, Segmented, Skeleton, useAsync } from "../ui/kit.js";

type Ok = Extract<Scorecard, { status: "ok" }>;

/** District report cards: outcomes only, graded by a formula anyone can read. */
export default function Accountability() {
  const { t, countryCode } = useLanguage();
  const [group, setGroup] = useState<"district" | "state">("district");
  const { data, loading, error } = useAsync(() => api.publicScorecards(group, countryCode), [group, countryCode]);

  const cards = data?.scorecards ?? [];
  const ok = useMemo(() => cards.filter((c): c is Ok => c.status === "ok"), [cards]);
  const withheld = cards.length - ok.length;
  const f = data?.formula;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("score.pub.title")}</h1>
          <p className="mt-1 max-w-2xl text-slate-600">{t("score.pub.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.sample_data && <Badge tone="saffron"><Icon name="info" size={12} />{t("badge.sample")}</Badge>}
          <Segmented value={group} onChange={setGroup} options={[{ value: "district", label: t("score.pub.districts") }, { value: "state", label: t("score.pub.states") }]} />
        </div>
      </div>

      {error && <Alert tone="error">{error.message}</Alert>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : ok.length === 0 ? (
        <Card><EmptyState icon="award" title={t("score.pub.empty.title")} body={t("score.pub.empty.body", { min: data?.min_public_count ?? 5 })} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ok.map((c, i) => (
              <Card key={c.region_id} className="fade-up">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-400">#{i + 1}</p>
                    <h3 className="truncate text-lg font-bold text-slate-900">{c.name}</h3>
                    <p className="text-xs text-slate-500">{t("score.pub.issues", { n: c.issues })}</p>
                  </div>
                  <GradeBadge grade={c.grade} size="lg" />
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <div className="mb-1 flex justify-between"><dt className="text-slate-600">{t("score.pub.resolved")}</dt><dd className="font-semibold tabular-nums text-slate-900">{c.resolution_rate}%</dd></div>
                    <Meter value={c.resolution_rate / 100} color="#138808" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between"><dt className="text-slate-600">{t("score.pub.overdue")}</dt><dd className="font-semibold tabular-nums text-slate-900">{c.overdue_share}%</dd></div>
                    <Meter value={c.overdue_share / 100} color={c.overdue_share > 40 ? "#e11d48" : "#f59e0b"} />
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-3">
                    <dt className="text-slate-600">{t("score.pub.speed")}</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{c.avg_days_to_resolve === null ? "-" : t("impact.daysShort", { n: c.avg_days_to_resolve })}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
          {withheld > 0 && (
            <p className="mt-4 flex items-start gap-1.5 text-sm text-slate-500"><Icon name="lock" size={14} className="mt-0.5 shrink-0" />{t("score.pub.withheld", { n: withheld, min: data?.min_public_count ?? 5 })}</p>
          )}
        </>
      )}

      {f && (
        <Card className="mt-8">
          <CardTitle title={t("score.pub.how")} subtitle={t("score.pub.how.sub")} icon="scale" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { w: f.resolution, title: t("score.pub.f.resolution"), body: t("score.pub.f.resolution.body") },
              { w: f.responsiveness, title: t("score.pub.f.responsive"), body: t("score.pub.f.responsive.body") },
              { w: f.speed, title: t("score.pub.f.speed"), body: t("score.pub.f.speed.body", { days: f.speed_days_zero_score }) },
            ].map((x) => (
              <div key={x.title} className="rounded-xl bg-slate-50 p-4">
                <p className="text-2xl font-extrabold text-brand-700">{Math.round(x.w * 100)}%</p>
                <p className="font-semibold text-slate-900">{x.title}</p>
                <p className="mt-1 text-xs text-slate-600">{x.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {(["A", "B", "C", "D", "E"] as const).map((g, i) => (
              <span key={g} className="flex items-center gap-1.5"><GradeBadge grade={g} size="sm" />{["0.80+", "0.65+", "0.50+", "0.35+", "<0.35"][i]}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
