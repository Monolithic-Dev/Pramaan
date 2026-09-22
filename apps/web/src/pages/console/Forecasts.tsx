import { api } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader, Skeleton, cx, useAsync } from "../../ui/kit.js";

const RISK_TONE = { high: "red", medium: "amber", low: "green" } as const;

export default function Forecasts() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const { data, loading, error } = useAsync(() => api.forecasts(regionId), [regionId]);
  const forecasts = data?.forecasts ?? [];
  const skipped = data?.not_forecast ?? [];

  return (
    <div>
      <PageHeader eyebrow={regionName} title={t("console.forecasts.title")} subtitle={t("console.forecasts.subtitle")} actions={<Badge tone="saffron"><Icon name="trend" size={12} />{t("forecast.model")}</Badge>} />
      <Alert tone="info" title={t("forecast.notReport.title")}>{t("insights.forecastNote")} {t("forecast.notReport.body")}</Alert>

      {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}

      <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">{t("forecast.active")}</h2>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : forecasts.length === 0 ? (
        <Card><EmptyState icon="trend" title={t("insights.forecastNone")} body={t("forecast.none.body")} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {forecasts.map((f) => {
            const meta = CATEGORY_META[f.category] ?? CATEGORY_META.other;
            return (
              <Card key={f.forecast_id} className="!border-2 !border-dashed !border-orange-300">
                <div className="flex items-start gap-3">
                  <span className={cx("rounded-xl p-3", meta.bg, meta.tone)}><Icon name={meta.icon} size={22} /></span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">{t(`category.${f.category}`)}</p>
                      <Badge tone={RISK_TONE[f.risk_level]}>{t("insights.risk", { level: t(`level.${f.risk_level}`), category: "" }).replace(/[:\s]+$/, "")}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{t("insights.window", { start: f.predicted_window_start.slice(0, 10), end: f.predicted_window_end.slice(0, 10) })}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {f.contributing_factors.map((c) => (
                    <li key={c} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-orange-600" />{c}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {skipped.length > 0 && (
        <Card className="mt-8">
          <CardTitle title={t("forecast.skipped.title")} subtitle={t("forecast.skipped.sub")} icon="info" />
          <ul className="divide-y divide-slate-100">
            {skipped.map((s) => (
              <li key={s.category} className="flex items-start justify-between gap-4 py-3 text-sm">
                <span className="font-medium text-slate-900">{t(`category.${s.category}`)}</span>
                <span className="max-w-md text-right text-slate-600">{s.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
