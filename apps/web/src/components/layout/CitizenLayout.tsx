import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { Button, cx } from "../../ui/kit.js";
import { NotificationBell } from "../NotificationBell.js";
import { Brand, LanguageMenu } from "./Brand.js";

const ITEMS: { to: string; key: string; icon: IconName; end?: boolean }[] = [
  { to: "/my", key: "citizen.nav.reports", icon: "list", end: true },
  { to: "/report", key: "nav.report", icon: "plus" },
  { to: "/community", key: "nav.community", icon: "pin" },
  { to: "/my/profile", key: "citizen.nav.profile", icon: "settings" },
];

export function CitizenLayout() {
  const { t } = useLanguage();
  const { signOut, email } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    cx("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition", isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100");

  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <div className="tricolour" />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Brand to="/my" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {ITEMS.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={link}>
                <Icon name={i.icon} size={16} />
                {t(i.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <NotificationBell allHref="/my/notifications" />
            <LanguageMenu />
            <span className="hidden max-w-[11rem] truncate text-xs text-slate-500 2xl:inline">{email}</span>
            <Button variant="ghost" size="sm" icon="logout" onClick={signOut} aria-label={t("nav.signOut")} className="whitespace-nowrap">
              <span className="hidden sm:inline">{t("nav.signOut")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white md:hidden" aria-label="Mobile">
        {ITEMS.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-brand-700" : "text-slate-500")}>
            <Icon name={i.icon} size={20} />
            {t(i.key)}
          </NavLink>
        ))}
      </nav>
      <Link to="/report" className="sr-only">
        {t("nav.report")}
      </Link>
    </div>
  );
}
