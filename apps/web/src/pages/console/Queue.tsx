import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type IssueSummary } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { SlaChip } from "../../ui/extras.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Badge, Button, Card, EmptyState, PageHeader, PriorityBadge, Segmented, Skeleton, StatusBadge, timeAgo, useAsync, useToast } from "../../ui/kit.js";

type Tab = "mine" | "escalated" | "overdue" | "emergency" | "unassigned";
const ACTIVE = new Set(["open", "verified", "prioritized", "funded", "in_progress"]);

export default function Queue() {
  const { t } = useLanguage();
  const { me, can } = useAuth();
  const { toast } = useToast();
  const { regionId, regionName } = useScope();
  const { data, loading, refetch } = useAsync(() => api.issues({ region: regionId, sort: "recent" }), [regionId]);
  const [tab, setTab] = useState<Tab>("mine");
  const [busy, setBusy] = useState<string | null>(null);

  const issues = useMemo(() => data?.issues ?? [], [data]);
  const buckets = useMemo<Record<Tab, IssueSummary[]>>(() => {
    const active = issues.filter((i) => ACTIVE.has(i.status));
    return {
      mine: active.filter((i) => i.assigned_to_uid === me?.uid),
      // Missed deadlines that have climbed to this officer's level (services/sla.ts escalation).
      escalated: active.filter((i) => i.sla.escalated_to && i.sla.escalated_to === me?.role).sort((a, b) => (a.sla.days_left ?? 0) - (b.sla.days_left ?? 0)),
      overdue: active.filter((i) => i.sla.state === "overdue").sort((a, b) => (a.sla.days_left ?? 0) - (b.sla.days_left ?? 0)),
      emergency: active.filter((i) => i.emergency_override),
      unassigned: active.filter((i) => !i.assigned_to_uid && i.status === "open").sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0)),
    };
  }, [issues, me?.uid, me?.role]);

  async function claim(issue: IssueSummary) {
    if (!me) return;
    setBusy(issue.issue_id);
    try {
      await api.assign(issue.issue_id, me.uid);
      toast("success", t("queue.claimed"));
      refetch();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : t("report.errorGeneric"));
    } finally {
      setBusy(null);
    }
  }

  const rows = buckets[tab];
  const label = (key: Tab, icon: Parameters<typeof Icon>[0]["name"]) => (
    <span className="inline-flex items-center gap-2">
      <Icon name={icon} size={15} />
      {t(`queue.tab.${key}`)}
      <span className={`rounded-full px-1.5 text-xs font-bold ${buckets[key].length && (key === "overdue" || key === "escalated") ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700"}`}>{buckets[key].length}</span>
    </span>
  );

  return (
    <div>
      <PageHeader title={t("queue.title")} subtitle={t("queue.subtitle")} eyebrow={regionName} />
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-5 max-w-full overflow-x-auto"
        options={[
          { value: "mine", label: label("mine", "inbox") },
          ...(me?.role === "district_collector" || me?.role === "state_admin" ? [{ value: "escalated" as const, label: label("escalated", "alert") }] : []),
          { value: "overdue", label: label("overdue", "clock") },
          { value: "emergency", label: label("emergency", "alert") },
          { value: "unassigned", label: label("unassigned", "userPlus") },
        ]}
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon="checkCircle" title={t(`queue.empty.${tab}.title`)} body={t(`queue.empty.${tab}.body`)} /></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((i) => {
            const meta = CATEGORY_META[i.category] ?? CATEGORY_META.other;
            return (
              <Card key={i.issue_id} className="fade-up !p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <span className={`rounded-xl p-2.5 ${meta.bg} ${meta.tone}`}><Icon name={meta.icon} size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/console/issues/${i.issue_id}`} className="font-semibold text-slate-900 hover:text-brand-700">{i.description}</Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t(`category.${i.category}`)} · {i.region_name ?? t("console.unresolved")} · {t("issue.firstReported", { when: timeAgo(i.first_reported_at) })} · {t("console.reportsCount", { count: i.report_count })}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={i.priority} label={t(`status.priority.${i.priority}`)} />
                      <StatusBadge status={i.status} label={t(`status.${i.status}`)} />
                      <SlaChip sla={i.sla} />
                      {i.emergency_override && <Badge tone="red"><Icon name="alert" size={12} />{t("console.flag.emergency")}</Badge>}
                      {i.assigned_to_label && <Badge tone="indigo"><Icon name="users" size={12} />{i.assigned_to_uid === me?.uid ? t("queue.you") : i.assigned_to_label}</Badge>}
                      {i.support_count > 0 && <Badge tone="teal"><Icon name="thumbsUp" size={12} />{i.support_count}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {can("update_issue_status") && i.assigned_to_uid !== me?.uid && (
                      <Button size="sm" variant="secondary" icon="userPlus" loading={busy === i.issue_id} onClick={() => claim(i)}>{t("queue.claim")}</Button>
                    )}
                    <Link to={`/console/issues/${i.issue_id}`}><Button size="sm" icon="arrowRight">{t("common.open")}</Button></Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
