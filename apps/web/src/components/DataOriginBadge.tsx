import { useLanguage } from "../i18n/LanguageProvider.js";

/** docs/phases/phase-7-frontend.md §7.7: badge synthetic_demo data everywhere it appears. */
export function DataOriginBadge({ dataOrigin }: { dataOrigin: string }) {
  const { t } = useLanguage();
  if (dataOrigin !== "synthetic_demo") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {t("officer.synthetic")}
    </span>
  );
}
