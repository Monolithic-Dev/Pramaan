import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api, type RegionInfo } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { Badge, Button, cx, Select, useAsync } from "../../ui/kit.js";
import { CommandPalette } from "../CommandPalette.js";
import { NotificationBell } from "../NotificationBell.js";
import { MAIN_ID } from "./A11y.js";
import { Brand, LanguageMenu } from "./Brand.js";

// ---- Jurisdiction context: every console page reads the selected region from here -----------

interface ScopeValue {
  regionId: string;
  regionName: string;
  setRegionId: (id: string) => void;
  regions: RegionInfo[];
  /** The officer's own jurisdiction is a whole country (a national administrator). */
  isNational: boolean;
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
      { to: "/console/queue", key: "console.nav.queue", icon: "inbox" },
      { to: "/console/priorities", key: "console.nav.priorities", icon: "list" },
      { to: "/console/map", key: "console.nav.map", icon: "map" },
      { to: "/console/projects", key: "console.nav.projects", icon: "folder" },
    ],
  },
  {
    key: "console.section.funding",
    items: [
      { to: "/console/planner", key: "console.nav.planner", icon: "sliders", perm: "manage_projects" },
      { to: "/console/schemes", key: "console.nav.schemes", icon: "rupee" },
      { to: "/console/impact", key: "console.nav.impact", icon: "target" },
    ],
  },
  {
    key: "console.section.intelligence",
    items: [
      { to: "/console/briefing", key: "console.nav.briefing", icon: "printer" },
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
const LEVEL_ORDER = ["country", "state", "estado", "district", "município"];

export function ConsoleLayout() {
  const { t } = useLanguage();
  const { me, signOut, can, email } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const [regionId, setRegionId] = useState(me?.region_id ?? "");
  const { data } = useAsync(() => api.regions(), []);
  const regions = useMemo(() => data?.regions ?? [], [data]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isNational = regions.find((r) => r.regionId === me?.region_id)?.level === "country";
  const scope = useMemo<ScopeValue>(
    () => ({ regionId, regionName: regions.find((r) => r.regionId === regionId)?.name ?? regionId, setRegionId, regions, isNational }),
    [regionId, regions, isNational],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, RegionInfo[]>();
    for (const r of regions) groups.set(r.level, [...(groups.get(r.level) ?? []), r]);
    return [...groups]
      .sort(([a], [b]) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
      .map(([level, rs]) => [level, rs.sort((a, b) => a.name.localeCompare(b.name))] as const);
  }, [regions]);

  const visible = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || can(i.perm)) })).filter((s) => s.items.length > 0);
  const paletteTargets = visible.flatMap((s) => s.items.map((i) => ({ to: i.to, label: t(i.key), icon: i.icon })));

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
        {visible.map((section) => (
          <div key={section.key} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{t(section.key)}</p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className={link}>
                  <Icon name={i.icon} size={18} />
                  {t(i.key)}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-saffron-500 text-sm font-bold text-brand-950">
            {(email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{email}</p>
            {me?.role && (
              <Badge tone={ROLE_TONE[me.role]} className="mt-0.5">
                {t(isNational && me.role === "state_admin" ? "role.national_admin" : `role.${me.role}`)}
              </Badge>
            )}
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
        <aside className="no-print hidden w-64 shrink-0 bg-gradient-to-b from-brand-950 to-brand-900 lg:block">
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
          <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Menu" onClick={() => setMenuOpen(true)}>
                <Icon name="menu" />
              </button>
              <label className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                <Icon name="pin" size={16} className="shrink-0 text-brand-600" />
                <span className="hidden font-medium sm:inline">{t("console.jurisdiction")}</span>
                <Select aria-label={t("console.jurisdiction")} value={regionId} onChange={(e) => setRegionId(e.target.value)} className="!w-auto max-w-[14rem] !py-1.5">
                  {regions.length === 0 && <option value={regionId}>{regionId}</option>}
                  {grouped.map(([level, rs]) => (
                    <optgroup key={level} label={t(`level.${level}`)}>
                      {rs.map((r) => (
                        <option key={r.regionId} value={r.regionId}>{r.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <CommandPalette targets={paletteTargets} regionId={regionId} />
              <NotificationBell />
              <LanguageMenu />
            </div>
          </header>
          <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ScopeContext.Provider>
  );
}
