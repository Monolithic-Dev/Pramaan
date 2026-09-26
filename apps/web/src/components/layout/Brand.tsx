import { Link } from "react-router-dom";
import { SUPPORTED_LANGUAGES, useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { cx } from "../../ui/kit.js";

/** The Pramaan mark: a bridge (setu) spanning two banks, in the civic blue with a saffron keystone. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#1d3f97" />
      <path d="M6 27h28" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 27c2-9 7-13 12-13s10 4 12 13" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 27v-6M20 27v-9M26 27v-6" stroke="#9db8ff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="12" r="2.6" fill="#ff9933" />
    </svg>
  );
}

export function Brand({ dark = false, to = "/" }: { dark?: boolean; to?: string }) {
  const { t } = useLanguage();
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Pramaan home">
      <LogoMark />
      <span className="leading-tight">
        <span className={cx("block text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-brand-900")}>{t("app.title")}</span>
        <span className={cx("block text-[10px] font-semibold uppercase tracking-[0.14em]", dark ? "text-brand-200" : "text-slate-500")}>
          {t("brand.tagline")}
        </span>
      </span>
    </Link>
  );
}

export function LanguageMenu({ dark = false }: { dark?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return (
    <label className={cx("relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium", dark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}>
      <Icon name="language" size={18} />
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as (typeof SUPPORTED_LANGUAGES)[number]["code"])}
        className={cx("cursor-pointer appearance-none bg-transparent pr-4 font-medium focus:outline-none", dark && "[&>option]:text-slate-900")}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-2" />
    </label>
  );
}
