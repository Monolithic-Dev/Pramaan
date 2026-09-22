import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Button, cx } from "../../ui/kit.js";
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

export function PublicLayout() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }: { isActive: boolean }) =>
    cx("rounded-lg px-3 py-2 text-sm font-medium transition", isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900");

  return (
    <div className="flex min-h-screen flex-col">
      <div className="tricolour" />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink to="/report" className={link}>{t("nav.report")}</NavLink>
            <NavLink to="/transparency" className={link}>{t("nav.transparency")}</NavLink>
            <a href="/#how" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">{t("nav.howItWorks")}</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <LanguageMenu />
            <AccountButton />
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
            <nav className="flex flex-col gap-1">
              <NavLink to="/report" className={link}>{t("nav.report")}</NavLink>
              <NavLink to="/transparency" className={link}>{t("nav.transparency")}</NavLink>
              <a href="/#how" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600">{t("nav.howItWorks")}</a>
            </nav>
            <div className="mt-3 flex items-center justify-between">
              <LanguageMenu />
              <AccountButton />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
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
              <li><Link className="hover:text-brand-700" to="/transparency">{t("nav.transparency")}</Link></li>
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
