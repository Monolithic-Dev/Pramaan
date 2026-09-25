import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Notification } from "../../api/api.js";
import { KIND_ICON, useNotificationText } from "../../components/NotificationBell.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Button, Card, EmptyState, PageHeader, Segmented, Skeleton, cx, timeAgo, useAsync } from "../../ui/kit.js";

export default function Notifications() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const text = useNotificationText();
  const { data, loading, refetch } = useAsync(() => api.notifications(), []);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const items = (data?.notifications ?? []).filter((n) => filter === "all" || !n.read_at);

  async function open(n: Notification) {
    if (!n.read_at) await api.markRead([n.notification_id]).catch(() => undefined);
    navigate(n.link);
  }

  return (
    <div>
      <PageHeader
        title={t("notify.title")}
        subtitle={t("notify.subtitle")}
        actions={<Button variant="secondary" icon="check" disabled={!data?.unread} onClick={async () => { await api.markRead(); refetch(); }}>{t("notify.markAll")}</Button>}
      />
      <Segmented value={filter} onChange={setFilter} className="mb-4" options={[{ value: "all", label: t("notify.all") }, { value: "unread", label: `${t("notify.unread")}${data?.unread ? ` (${data.unread})` : ""}` }]} />
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon="bell" title={t("notify.empty")} body={t("notify.empty.body")} /></Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.notification_id}>
                <button type="button" onClick={() => open(n)} className={cx("flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50", !n.read_at && "bg-brand-50/50")}>
                  <span className={cx("rounded-xl p-2.5", n.read_at ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700")}><Icon name={KIND_ICON[n.kind] ?? "info"} size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{text(n)}</span>
                    <span className="block text-xs text-slate-500">{timeAgo(n.created_at)}</span>
                  </span>
                  <Icon name="chevronRight" size={16} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
