import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Notification } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { cx, timeAgo } from "../ui/kit.js";

const KIND_ICON: Record<string, IconName> = {
  "issue.status_changed": "refresh",
  "issue.funded": "star",
  "issue.confirm_resolution": "checkCircle",
  "issue.assigned": "users",
  "issue.emergency": "alert",
  "issue.comment": "mail",
  "plan.approved": "folder",
};

/** Renders a stored notification in the reader's language: only kind + params are persisted. */
export function useNotificationText() {
  const { t } = useLanguage();
  return useCallback(
    (n: Pick<Notification, "kind" | "params">) => {
      const p = { ...n.params } as Record<string, string | number>;
      if (typeof p.category === "string") p.category = t(`category.${p.category}`);
      if (typeof p.status === "string") p.status = t(`status.${p.status}`);
      return t(`notify.${n.kind}`, p);
    },
    [t],
  );
}

export { KIND_ICON };

/** Bell with an unread badge and a dropdown inbox. Polls gently; works for citizens and officers. */
export function NotificationBell({ dark = false, allHref }: { dark?: boolean; allHref?: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const text = useNotificationText();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.notifications();
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      /* the bell is a convenience: a failed poll must never disturb the page */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      setItems((xs) => xs.map((x) => (x.notification_id === n.notification_id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void api.markRead([n.notification_id]).catch(() => undefined);
    }
    navigate(n.link);
  }

  async function readAll() {
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await api.markRead().catch(() => undefined);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={t("notify.title")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx("relative rounded-lg p-2 transition", dark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100")}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron-500 px-1 text-[10px] font-bold text-brand-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-lift">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">{t("notify.title")}</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-xs font-semibold text-brand-700 hover:underline">
                {t("notify.markAll")}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">{t("notify.empty")}</li>}
            {items.slice(0, 12).map((n) => (
              <li key={n.notification_id}>
                <button type="button" onClick={() => openItem(n)} className={cx("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read_at && "bg-brand-50/60")}>
                  <span className={cx("mt-0.5 rounded-lg p-1.5", n.read_at ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700")}>
                    <Icon name={KIND_ICON[n.kind] ?? "info"} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-800">{text(n)}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-saffron-500" />}
                </button>
              </li>
            ))}
          </ul>
          {allHref && (
            <button type="button" onClick={() => { setOpen(false); navigate(allHref); }} className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-brand-700 hover:bg-slate-50">
              {t("notify.viewAll")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
