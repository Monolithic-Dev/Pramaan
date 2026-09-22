import { api } from "../../api/api.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Badge, Card, EmptyState, PageHeader, Skeleton, timeAgo, useAsync } from "../../ui/kit.js";

export default function Audit() {
  const { t } = useLanguage();
  const { data, loading } = useAsync(() => api.audit(), []);
  const entries = data?.entries ?? [];
  return (
    <div>
      <PageHeader title={t("console.audit.title")} subtitle={t("console.audit.subtitle")} />
      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : entries.length === 0 ? (
          <EmptyState icon="shield" title={t("audit.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-3">{t("audit.col.when")}</th><th className="px-4 py-3">{t("audit.col.action")}</th><th className="px-4 py-3">{t("audit.col.target")}</th><th className="px-4 py-3">{t("audit.col.actor")}</th><th className="px-4 py-3">{t("audit.col.reason")}</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.audit_id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{timeAgo(e.timestamp)}</td>
                    <td className="px-4 py-3"><Badge tone="blue">{t(`audit.${e.action}`)}</Badge></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.target_id ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.actor_id.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-700">{e.justification ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
