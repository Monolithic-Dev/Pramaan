import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type IssueSummary } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon, type IconName } from "../ui/Icon.js";
import { cx } from "../ui/kit.js";

export interface PaletteTarget {
  to: string;
  label: string;
  icon: IconName;
}

type Row = { key: string; to: string; label: string; hint?: string; icon: IconName; tone?: string };

/** Ctrl/Cmd+K: jump anywhere in the console, or find an issue by what it says or where it is. */
export function CommandPalette({ targets, regionId }: { targets: PaletteTarget[]; regionId: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIssues([]);
      setCursor(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setIssues([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      api
        .issues({ q: query.trim(), region: regionId, sort: "score" })
        .then((r) => live && setIssues(r.issues.slice(0, 6)))
        .catch(() => live && setIssues([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, open, regionId]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const nav = targets.filter((x) => !q || x.label.toLowerCase().includes(q)).map<Row>((x) => ({ key: `nav:${x.to}`, to: x.to, label: x.label, icon: x.icon, hint: t("palette.goTo") }));
    const found = issues.map<Row>((i) => ({
      key: `issue:${i.issue_id}`,
      to: `/console/issues/${i.issue_id}`,
      label: i.description,
      hint: `${t(`category.${i.category}`)} · ${i.region_name ?? ""}`,
      icon: CATEGORY_META[i.category]?.icon ?? "layers",
    }));
    return [...found, ...nav];
  }, [issues, targets, query, t]);

  useEffect(() => {
    setCursor(0);
  }, [rows.length]);

  function go(row: Row | undefined) {
    if (!row) return;
    setOpen(false);
    navigate(row.to);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 transition hover:border-brand-300 hover:bg-white md:flex"
        aria-label={t("palette.open")}
      >
        <Icon name="search" size={15} />
        <span>{t("palette.placeholder")}</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/50 px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-lift" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t("palette.open")}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Icon name="search" size={18} className="text-slate-400" />
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
                  if (e.key === "Enter") go(rows[cursor]);
                }}
                placeholder={t("palette.placeholder")}
                className="w-full bg-transparent py-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {rows.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">{t("palette.none")}</li>}
              {rows.map((r, i) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r)}
                    className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", i === cursor ? "bg-brand-50" : "hover:bg-slate-50")}
                  >
                    <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600"><Icon name={r.icon} size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{r.label}</span>
                      {r.hint && <span className="block truncate text-xs text-slate-500">{r.hint}</span>}
                    </span>
                    {i === cursor && <Icon name="arrowRight" size={14} className="text-brand-600" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
