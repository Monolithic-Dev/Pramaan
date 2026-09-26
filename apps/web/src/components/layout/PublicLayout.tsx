import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Button, cx } from "../../ui/kit.js";
import { MAIN_ID } from "./A11y.js";
import { Brand, LanguageMenu } from "./Brand.js";

function AccountButton() {
  const { me, status } = useAuth();
  const { t } = useLanguage();
  if (status === "authenticated" && me) {
    return (
      <Link to={me.kind === "officer" ? "/console" : "/my"}>
        <Button size="sm" icon={me.kind === "officer" ? "chart" : "list"}>
          {me.kind === "officer" ? t("nav.console") : t("nav.myReports")}
        </Button>
      </Link>
    );
  }
  return (
    <Link to="/login">
      <Button size="sm" variant="secondary">
        {t("nav.signIn")}
      </Button>
    </Link>
  );
}

const NAV = [
  { to: "/report", key: "nav.report" },
  { to: "/track", key: "nav.track" },
  { to: "/community", key: "nav.community" },
  { to: "/accountability", key: "nav.accountability" },
  { to: "/transparency", key: "nav.transparency" },
  { to: "/about", key: "nav.howItWorks" },
];

export function PublicLayout() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }: { isActive: boolean }) =>
    cx("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition", isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900");

  // Six links, the language picker and the account button need ~1,200px on one line (more in
  // Hindi or Tamil), so the full bar starts at xl; below that the menu button keeps it tidy.
  return (
    <div className="flex min-h-screen flex-col">
      <div className="tricolour" />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Brand compactTagline />
          <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={link}>{t(n.key)}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 whitespace-nowrap xl:flex">
            <LanguageMenu />
            <AccountButton />
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 xl:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 xl:hidden" onClick={() => setOpen(false)}>
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={link}>{t(n.key)}</NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between">
              <LanguageMenu />
              <AccountButton />
            </div>
          </div>
        )}
      </header>

      <main id={MAIN_ID} tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Brand />
            <p className="mt-3 max-w-md text-sm text-slate-600">{t("footer.about")}</p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">{t("footer.platform")}</h4>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              <li><Link className="hover:text-brand-700" to="/report">{t("nav.report")}</Link></li>
              <li><Link className="hover:text-brand-700" to="/track">{t("nav.track")}</Link></li>
              <li><Link className="hover:text-brand-700" to="/transparency">{t("nav.transparency")}</Link></li>
              <li><Link className="hover:text-brand-700" to="/open-data">{t("nav.openData")}</Link></li>
              <li><Link className="hover:text-brand-700" to="/channels">{t("nav.channels")}</Link></li>
              <li><Link className="hover:text-brand-700" to="/login">{t("nav.signIn")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">{t("footer.principles")}</h4>
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              <li>{t("footer.p1")}</li>
              <li>{t("footer.p2")}</li>
              <li>{t("footer.p3")}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">{t("footer.legal")}</div>
      </footer>
    </div>
  );
}
