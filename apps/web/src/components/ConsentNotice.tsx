import { useLanguage } from "../i18n/LanguageProvider.js";

export const CONSENT_VERSION = "dpdp-notice-v1";

export function ConsentNotice({ onAgree }: { onAgree: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold text-gray-900">{t("consent.title")}</h2>
      <p className="text-base leading-relaxed text-gray-700">{t("consent.body")}</p>
      <button
        type="button"
        onClick={onAgree}
        className="rounded-lg bg-blue-700 px-6 py-4 text-lg font-medium text-white"
      >
        {t("consent.agree")}
      </button>
    </div>
  );
}
