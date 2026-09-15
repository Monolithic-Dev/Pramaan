import { SUPPORTED_LANGUAGES, useLanguage } from "../i18n/LanguageProvider.js";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <p className="text-lg font-medium text-gray-900">{t("language.prompt")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`min-w-[7rem] rounded-lg border-2 px-5 py-3 text-lg font-medium ${
              language === lang.code
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-gray-300 bg-white text-gray-900"
            }`}
            aria-pressed={language === lang.code}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
