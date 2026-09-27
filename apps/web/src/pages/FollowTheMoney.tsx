import { api } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Alert, Skeleton, useAsync } from "../ui/kit.js";
import { NeedVsSpendView } from "./console/NeedVsSpend.js";
import { SchemeLedgerView } from "./console/SchemeLedger.js";

/** Public: is public money going where the need is, and are the schemes paying for it delivering? */
export default function FollowTheMoney() {
  const { t, countryCode } = useLanguage();
  const nvs = useAsync(() => api.publicNeedVsSpend(countryCode), [countryCode]);
  const ledger = useAsync(() => api.publicSchemePerformance(countryCode), [countryCode]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("money.title")}</h1>
        <p className="mt-2 text-slate-600">{t("money.subtitle")}</p>
      </div>

      <h2 className="mb-4 text-xl font-bold text-slate-900">{t("nvs.title")}</h2>
      {nvs.error && <Alert tone="error">{nvs.error.message}</Alert>}
      {nvs.loading || !nvs.data ? <Skeleton className="h-96" /> : <NeedVsSpendView data={nvs.data} />}
      {nvs.data?.min_public_count && <p className="mt-2 text-xs text-slate-500">{t("nvs.publicNote", { min: nvs.data.min_public_count })}</p>}

      <h2 className="mb-1 mt-12 text-xl font-bold text-slate-900">{t("ledger.title")}</h2>
      <p className="mb-4 text-sm text-slate-600">{t("ledger.subtitle")}</p>
      {ledger.error && <Alert tone="error">{ledger.error.message}</Alert>}
      {ledger.loading || !ledger.data ? <Skeleton className="h-64" /> : <SchemeLedgerView data={ledger.data} />}
    </div>
  );
}
