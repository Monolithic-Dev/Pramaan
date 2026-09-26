import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageProvider.js";

export const MAIN_ID = "main-content";

/** First focusable element on every page: keyboard and screen-reader users jump past the navigation. */
export function SkipLink() {
  const { t } = useLanguage();
  return (
    <a
      href={`#${MAIN_ID}`}
      className="sr-only z-100 rounded-md bg-brand-700 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      {t("a11y.skip")}
    </a>
  );
}

const PAGE_TITLE: [RegExp, string][] = [
  [/^\/report/, "nav.report"],
  [/^\/track/, "nav.track"],
  [/^\/community/, "nav.community"],
  [/^\/accountability/, "nav.accountability"],
  [/^\/transparency/, "nav.transparency"],
  [/^\/open-data/, "nav.openData"],
  [/^\/channels/, "nav.channels"],
  [/^\/about/, "nav.howItWorks"],
  [/^\/login/, "nav.signIn"],
  [/^\/my/, "nav.myReports"],
  [/^\/console\/issues\//, "console.nav.priorities"],
  [/^\/console\/?$/, "console.nav.overview"],
];

/** A single-page app never reloads, so it must do what a page load does for free: give each page its
 *  own tab title, and move focus to the new content so a screen reader announces it (WCAG 2.4.2, 2.4.3). */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const first = useRef(true);

  useEffect(() => {
    const consolePage = /^\/console\/([a-z]+)/.exec(pathname)?.[1];
    const key = PAGE_TITLE.find(([re]) => re.test(pathname))?.[1] ?? (consolePage ? `console.nav.${consolePage}` : null);
    const page = key ? t(key) : null;
    document.title = page && page !== key ? `${page} · Pramaan` : "Pramaan";

    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById(MAIN_ID)?.focus({ preventScroll: true });
  }, [pathname, t]);

  return null;
}
