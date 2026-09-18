import { useEffect, useState } from "react";
import {
  addState,
  ApiClientError,
  getEquityAudit,
  getForecasts,
  listStates,
  type EquityBand,
  type RiskForecast,
} from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

type Tab = "forecasts" | "equity" | "states";

export function InsightsPanel({ token, regionScope }: { token: string; regionScope: string }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("forecasts");
  const [forecasts, setForecasts] = useState<RiskForecast[] | null>(null);
  const [equity, setEquity] = useState<{ bands: EquityBand[]; verdict: string } | null>(null);
  const [states, setStates] = useState<{ state_id: string; name: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  const explain = (err: unknown) =>
    err instanceof ApiClientError && err.status === 403
      ? t("insights.forbidden")
      : t("report.errorGeneric");

  useEffect(() => {
    setMessage(null);
    if (tab === "forecasts") {
      getForecasts(token, regionScope)
        .then((r) => setForecasts(r.forecasts))
        .catch((e) => setMessage(explain(e)));
    }
    if (tab === "equity") {
      getEquityAudit(token, regionScope)
        .then(setEquity)
        .catch((e) => setMessage(explain(e)));
    }
    if (tab === "states") {
      listStates(token)
        .then((r) => setStates(r.states))
        .catch((e) => setMessage(explain(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token, regionScope]);

  async function submitState() {
    try {
      await addState(token, newId.trim(), newName.trim());
      setMessage(t("insights.added"));
      setNewId("");
      setNewName("");
      setStates((await listStates(token)).states);
    } catch (e) {
      setMessage(explain(e));
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex gap-2">
        {(["forecasts", "equity", "states"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`rounded-md border px-3 py-1 ${
              tab === k ? "border-blue-700 bg-blue-700 text-white" : "border-gray-300"
            }`}
          >
            {t(`insights.${k}`)}
          </button>
        ))}
      </div>
      {message && <p className="text-amber-700">{message}</p>}

      {tab === "forecasts" && (
        <div className="flex flex-col gap-2">
          <p className="text-gray-500">{t("insights.forecastNote")}</p>
          {forecasts?.length === 0 && <p>{t("insights.forecastNone")}</p>}
          {forecasts?.map((f) => (
            // Dashed outline: a forecast is never visually confused with a real report.
            <div key={f.forecast_id} className="rounded-md border-2 border-dashed border-orange-400 p-3">
              <p className="font-semibold">
                {t("insights.risk", { level: t(`level.${f.risk_level}`), category: f.category })}
              </p>
              <p>
                {t("insights.window", {
                  start: f.predicted_window_start.slice(0, 10),
                  end: f.predicted_window_end.slice(0, 10),
                })}
              </p>
              <ul className="list-disc pl-5 text-gray-600">
                {f.contributing_factors.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "equity" && equity && (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{equity.verdict}</p>
          {equity.bands.map((b) => (
            <div key={b.vulnerability_band} className="rounded-md border border-gray-200 p-2">
              <p className="font-semibold">
                {t("insights.equityBand", { band: t(`level.${b.vulnerability_band}`) })}
              </p>
              <p>
                {b.status === "ok"
                  ? t("insights.equityRow", {
                      score: b.avg_composite_score ?? "-",
                      funded: `${Math.round((b.funded_ratio ?? 0) * 100)}%`,
                      n: b.sample_size,
                    })
                  : t("insights.insufficientBand", { n: b.sample_size })}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "states" && (
        <div className="flex flex-col gap-2">
          <ul className="list-disc pl-5">
            {states.map((s) => (
              <li key={s.state_id}>
                {s.name} ({s.state_id})
              </li>
            ))}
          </ul>
          <input
            aria-label={t("insights.stateId")}
            placeholder={t("insights.stateId")}
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="rounded-md border border-gray-300 p-2"
          />
          <input
            aria-label={t("insights.stateName")}
            placeholder={t("insights.stateName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-md border border-gray-300 p-2"
          />
          <button
            type="button"
            onClick={submitState}
            className="rounded-md bg-blue-700 px-3 py-2 font-semibold text-white"
          >
            {t("insights.addState")}
          </button>
        </div>
      )}
    </div>
  );
}
