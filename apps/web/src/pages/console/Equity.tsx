import { api } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Meter } from "../../ui/charts.js";
import { Alert, Badge, Card, CardTitle, PageHeader, Skeleton, useAsync } from "../../ui/kit.js";

const BAND_COLOR = { low: "#16a34a", medium: "#f59e0b", high: "#e11d48" } as const;

export default function Equity() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const { data, loading, error } = useAsync(() => api.equity(regionId), [regionId]);

  return (
    <div>
      <PageHeader eyebrow={regionName} title={t("console.equity.title")} subtitle={t("console.equity.subtitle")} />
      {error && <Alert tone="error">{error.message.includes("outside") ? t("equity.pickState") : error.message}</Alert>}

      {loading ? <Skeleton className="h-24" /> : data && (
        <Card className="!border-brand-200 !bg-brand-50">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700"><Icon name="scale" size={14} />{t("equity.verdict")}</p>
          <p className="mt-2 text-xl font-semibold leading-snug text-slate-900">{data.verdict}</p>
          <p className="mt-2 text-xs text-slate-600">{t("equity.verdictNote")}</p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {loading
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)
          : data?.bands.map((b) => (
              <Card key={b.vulnerability_band}>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 font-semibold text-slate-900"><span className="h-3 w-3 rounded-full" style={{ background: BAND_COLOR[b.vulnerability_band] }} />{t("insights.equityBand", { band: t(`level.${b.vulnerability_band}`) })}</p>
                  <Badge tone={b.status === "ok" ? "green" : "slate"}>n={b.sample_size}</Badge>
                </div>
                {b.status === "ok" ? (
                  <dl className="mt-4 space-y-4 text-sm">
                    <div>
                      <dt className="flex justify-between text-slate-600"><span>{t("equity.avgScore")}</span><b className="text-slate-900">{b.avg_composite_score?.toFixed(2)}</b></dt>
                      <Meter value={b.avg_composite_score ?? 0} color={BAND_COLOR[b.vulnerability_band]} className="mt-1" />
                    </div>
                    <div>
                      <dt className="flex justify-between text-slate-600"><span>{t("equity.funded")}</span><b className="text-slate-900">{Math.round((b.funded_ratio ?? 0) * 100)}%</b></dt>
                      <Meter value={b.funded_ratio ?? 0} color="#14b8a6" className="mt-1" />
                    </div>
                    <div className="flex justify-between text-slate-600"><span>{t("equity.days")}</span><b className="text-slate-900">{b.avg_days_to_resolved ?? "-"}</b></div>
                  </dl>
                ) : (
                  <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{t("insights.insufficientBand", { n: b.sample_size })}. {t("equity.minSample")}</p>
                )}
              </Card>
            ))}
      </div>

      <Card className="mt-4">
        <CardTitle title={t("equity.how.title")} icon="info" />
        <p className="text-sm leading-relaxed text-slate-600">{t("equity.how.body")}</p>
      </Card>
    </div>
  );
}
