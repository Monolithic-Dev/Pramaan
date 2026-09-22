import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api, type RegionInfo } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { Badge, Button, cx, Select, useAsync } from "../../ui/kit.js";
import { Brand, LanguageMenu } from "./Brand.js";

// ---- Jurisdiction context: every console page reads the selected region from here -----------

interface ScopeValue {
  regionId: string;
  regionName: string;
  setRegionId: (id: string) => void;
  regions: RegionInfo[];
}
const ScopeContext = createContext<ScopeValue | null>(null);
export function useScope(): ScopeValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used inside the console layout");
  return ctx;
}

interface NavItem {
  to: string;
  key: string;
  icon: IconName;
  perm?: keyof import("../../api/api.js").Permissions;
  end?: boolean;
}
const SECTIONS: { key: string; items: NavItem[] }[] = [
  {
    key: "console.section.insight",
    items: [
      { to: "/console", key: "console.nav.overview", icon: "home", end: true },
      { to: "/console/priorities", key: "console.nav.priorities", icon: "list" },
      { to: "/console/map", key: "console.nav.map", icon: "map" },
      { to: "/console/projects", key: "console.nav.projects", icon: "folder" },
    ],
  },
  {
    key: "console.section.intelligence",
    items: [
      { to: "/console/forecasts", key: "console.nav.forecasts", icon: "trend" },
      { to: "/console/equity", key: "console.nav.equity", icon: "scale", perm: "view_equity" },
      { to: "/console/copilot", key: "console.nav.copilot", icon: "bot" },
    ],
  },
  {
    key: "console.section.admin",
    items: [
      { to: "/console/team", key: "console.nav.team", icon: "users", perm: "manage_officers" },
      { to: "/console/states", key: "console.nav.states", icon: "globe", perm: "manage_states" },
      { to: "/console/audit", key: "console.nav.audit", icon: "shield", perm: "view_audit_log" },
    ],
  },
];

const ROLE_TONE = { field_officer: "blue", district_collector: "violet", state_admin: "saffron" } as const;

export function ConsoleLayout() {
  const { t } = useLanguage();
  const { me, signOut, can, email } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const [regionId, setRegionId] = useState(me?.region_id ?? "");
  const { data } = useAsync(() => api.regions(), []);
  const regions = data?.regions ?? [];

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const scope = useMemo<ScopeValue>(
    () => ({
      regionId,
      regionName: regions.find((r) => r.regionId === regionId)?.name ?? regionId,
      setRegionId,
      regions,
    }),
    [regionId, regions],
  );

  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
      isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white",
    );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Brand dark to="/console" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Console">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.perm || can(i.perm));
          if (items.length === 0) return null;
          return (
            <div key={section.key} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{t(section.key)}</p>
              <div className="flex flex-col gap-0.5">
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={link}>
                    <Icon name={i.icon} size={18} />
                    {t(i.key)}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-saffron-500 text-sm font-bold text-brand-950">
            {(email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{email}</p>
            {me?.role && <Badge tone={ROLE_TONE[me.role]} className="mt-0.5">{t(`role.${me.role}`)}</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="logout" onClick={signOut} className="w-full justify-start !text-brand-100 hover:!bg-white/10">
          {t("nav.signOut")}
        </Button>
      </div>
    </div>
  );

  return (
    <ScopeContext.Provider value={scope}>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="hidden w-64 shrink-0 bg-gradient-to-b from-brand-950 to-brand-900 lg:block">
          <div className="sticky top-0 h-screen">{sidebar}</div>
        </aside>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/50" />
            <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-brand-950 to-brand-900" onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Menu" onClick={() => setMenuOpen(true)}>
                <Icon name="menu" />
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Icon name="pin" size={16} className="text-brand-600" />
                <span className="hidden font-medium sm:inline">{t("console.jurisdiction")}</span>
                <Select aria-label={t("console.jurisdiction")} value={regionId} onChange={(e) => setRegionId(e.target.value)} className="!w-auto !py-1.5">
                  {regions.length === 0 && <option value={regionId}>{regionId}</option>}
                  {regions.map((r) => (
                    <option key={r.regionId} value={r.regionId}>
                      {r.name} ({r.level})
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <LanguageMenu />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ScopeContext.Provider>
  );
}
