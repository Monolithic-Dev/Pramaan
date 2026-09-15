import type { PriorityScore } from "@jansetu/shared-types";
import { useLanguage } from "../i18n/LanguageProvider.js";

// docs/phases/phase-7-frontend.md §7.4: the single most important
// officer-facing component — every term, its weight, and every fallback
// disclosure in plain language. This is the answer to "why did my ward rank
// lower," so it's a first-class panel, not a tooltip.
export function ScoreBreakdown({ score }: { score: PriorityScore }) {
  const { t } = useLanguage();

  const rows: { label: string; value: number; weight: number }[] = [
    { label: t("score.demand"), value: score.demand_score, weight: score.weights.demand },
    {
      label: t("score.vulnerability"),
      value: score.vulnerability_score,
      weight: score.weights.vulnerability,
    },
    { label: t("score.gap"), value: score.gap_score, weight: score.weights.gap },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900">{t("officer.scoreBreakdownTitle")}</h3>

      <p className="text-3xl font-bold text-gray-900">{score.composite_score.toFixed(2)}</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 font-normal">{t("score.component")}</th>
            <th className="py-1 font-normal">{t("score.value")}</th>
            <th className="py-1 font-normal">{t("score.weight")}</th>
            <th className="py-1 font-normal">{t("score.contribution")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5">{row.value.toFixed(2)}</td>
              <td className="py-1.5">{row.weight.toFixed(2)}</td>
              <td className="py-1.5">{(row.value * row.weight).toFixed(3)}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-100">
            <td className="py-1.5">{t("score.duplicationPenalty")}</td>
            <td colSpan={3} className="py-1.5">
              {score.duplication_penalty.toFixed(2)}
            </td>
          </tr>
          <tr className="border-t border-gray-100">
            <td className="py-1.5">{t("score.impactEfficacy")}</td>
            <td colSpan={3} className="py-1.5">
              {score.impact_efficacy === null ? t("score.noHistory") : score.impact_efficacy.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      {score.data_fallbacks.length > 0 && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-1 font-medium">{t("score.fallbackTitle")}</p>
          <ul className="list-inside list-disc">
            {score.data_fallbacks.map((fallback, i) => (
              <li key={i}>{fallback.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400">{t("score.modelVersion", { version: score.model_version })}</p>
    </section>
  );
}
