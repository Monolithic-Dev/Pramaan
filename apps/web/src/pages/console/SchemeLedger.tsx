import type { SchemePerformance, SchemePerformanceRow } from "../../api/api.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Badge, Card, CardTitle, EmptyState, Stat } from "../../ui/kit.js";
import { compact, fullNumber, money } from "../../ui/format.js";

const SIGNAL_TONE: Record<SchemePerformanceRow["signal"], "green" | "amber" | "red" | "slate"> = {
  delivering: "green",
  slow: "amber",
  quality_concerns: "red",
  early: "slate",
};
const STAGES = ["recommended", "funded", "in_progress", "completed"] as const;
const STAGE_COLOR = { recommended: "#c4b5fd", funded: "#5eead4", in_progress: "#818cf8", completed: "#138808" };

/** Per scheme: money committed, work delivered, people reached, and whether citizens agree it was fixed. */
export function SchemeLedgerView({ data }: { data: SchemePerformance }) {
  const { t } = useLanguage();
  const d = data.totals;
  if (data.schemes.length === 0) return <Card><EmptyState icon="rupee" title={t("ledger.empty")} /></Card>;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("ledger.committed")} value={money(d.committed_inr)} hint={t("ledger.committed.hint", { n: d.schemes })} icon="rupee" tone="brand" />
        <Stat label={t("ledger.central")} value={money(d.central_inr)} hint={t("ledger.central.hint")} icon="building" tone="amber" />
        <Stat label={t("ledger.completed")} value={fullNumber(d.completed)} hint={t("ledger.completed.hint", { n: d.projects })} icon="checkCircle" tone="green" />
        <Stat label={t("ledger.people")} value={compact(d.people_benefited)} hint={t("ledger.people.hint")} icon="users" tone="green" />
      </div>

      <Card padded={false} className="mt-4 overflow-hidden">
        <div className="px-5 pt-5"><CardTitle title={t("ledger.table.title")} subtitle={t("ledger.table.sub")} icon="layers" /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">{t("schemes.col.scheme")}</th>
                <th className="px-3 py-3">{t("ledger.col.pipeline")}</th>
                <th className="px-3 py-3 text-right">{t("ledger.col.committed")}</th>
                <th className="px-3 py-3 text-right">{t("ledger.col.delivery")}</th>
                <th className="px-3 py-3 text-right">{t("ledger.col.days")}</th>
                <th className="px-3 py-3 text-right">{t("ledger.col.costPer")}</th>
                <th className="px-3 py-3 text-right">{t("ledger.col.confirmed")}</th>
                <th className="px-5 py-3">{t("ledger.col.signal")}</th>
              </tr>
            </thead>
            <tbody>
              {data.schemes.map((s) => (
                <tr key={s.scheme_id} className="border-t border-slate-100 align-middle">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{s.short}</p>
                    <p className="text-xs text-slate-500">{s.priority}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex h-2.5 w-36 overflow-hidden rounded-full bg-slate-100" title={STAGES.map((st) => `${t(`project.${st}`)}: ${s.pipeline[st]}`).join(", ")}>
                      {STAGES.map((st) => <div key={st} style={{ width: `${(s.pipeline[st] / Math.max(1, s.projects)) * 100}%`, background: STAGE_COLOR[st] }} />)}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{t("ledger.projects", { n: s.projects, done: s.completed })}</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <p className="font-semibold text-slate-900">{money(s.committed_inr)}</p>
                    <p className="text-[11px] text-slate-500">{t("ledger.centreShort", { amount: money(s.central_inr) })}</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.delivery_rate === null ? "-" : `${Math.round(s.delivery_rate * 100)}%`}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.avg_days_to_fix ?? "-"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.cost_per_person_inr === null ? "-" : `₹${fullNumber(s.cost_per_person_inr)}`}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {s.citizen_confirmation === null ? "-" : `${s.citizen_confirmation}%`}
                    {s.reopened > 0 && <p className="text-[11px] text-rose-600">{t("ledger.reopened", { n: s.reopened })}</p>}
                  </td>
                  <td className="px-5 py-3"><Badge tone={SIGNAL_TONE[s.signal]}>{t(`ledger.signal.${s.signal}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">{t("ledger.method")}</p>
    </>
  );
}
