import { useState } from "react";
import { getTransparency, type TransparencyStats } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

export function TransparencyPage() {
  const { t } = useLanguage();
  const [stateId, setStateId] = useState("IN-DL");
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      setStats(await getTransparency(stateId.trim()));
    } catch {
      setError(true);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-gray-900">{t("transparency.title")}</h1>
      <p className="text-gray-600">{t("transparency.subtitle")}</p>
      <div className="flex gap-2">
        <input
          aria-label={t("transparency.stateLabel")}
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 p-3"
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
        >
          {t("transparency.load")}
        </button>
      </div>
      {error && <p className="text-red-600">{t("report.errorGeneric")}</p>}
      {stats?.status === "insufficient_data" && (
        <p>{t("transparency.insufficient", { min: stats.min_required })}</p>
      )}
      {stats?.status === "ok" && (
        <dl className="grid grid-cols-2 gap-3">
          {(
            [
              ["transparency.total", stats.total_reported],
              ["transparency.verified", `${stats.pct_verified}%`],
              ["transparency.funded", `${stats.pct_funded}%`],
              ["transparency.resolved", `${stats.pct_resolved}%`],
              ["transparency.avgDays", stats.avg_days_to_resolved ?? "-"],
            ] as [string, string | number][]
          ).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-gray-200 p-3">
              <dt className="text-sm text-gray-500">{t(k)}</dt>
              <dd className="text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
