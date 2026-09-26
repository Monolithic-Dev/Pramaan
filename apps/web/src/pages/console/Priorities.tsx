import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type IssueSummary } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Meter, priorityColor } from "../../ui/charts.js";
import { SlaChip } from "../../ui/extras.js";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, SampleDataBadge, Select, Skeleton, StatusBadge, cx, timeAgo, useAsync } from "../../ui/kit.js";

const CATEGORIES = ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"];
const STATUSES = ["open", "verified", "disputed", "prioritized", "funded", "in_progress", "resolved"];
const PAGE = 15;

export function IssueRow({ i, onOpen }: { i: IssueSummary; onOpen: () => void }) {
  const { t } = useLanguage();
  const meta = CATEGORY_META[i.category] ?? CATEGORY_META.other;
  return (
    <tr onClick={onOpen} className="cursor-pointer border-t border-slate-100 transition hover:bg-brand-50/40">
      <td className="w-28 px-4 py-3">
        <p className="text-lg font-bold tabular-nums" style={{ color: priorityColor(i.composite_score) }}>{i.composite_score?.toFixed(2) ?? "-"}</p>
        <Meter value={i.composite_score ?? 0} color={priorityColor(i.composite_score)} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-start gap-3">
          <span className={cx("mt-0.5 rounded-lg p-2", meta.bg, meta.tone)}><Icon name={meta.icon} size={16} /></span>
          <div className="min-w-0">
            <Link to={`/console/issues/${i.issue_id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-1 font-medium text-slate-900 hover:text-brand-700">{i.description}</Link>
            <p className="text-xs text-slate-500">{t(`category.${i.category}`)} · {i.region_name ?? t("console.unresolved")}{i.state_name ? `, ${i.state_name}` : ""}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-sm md:table-cell">
        <span className="font-semibold tabular-nums text-slate-900">{i.report_count}</span>
        <span className="text-xs text-slate-500"> / {t("console.people", { count: i.distinct_reporter_count })}</span>
      </td>
      <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge status={i.status} label={t(`status.${i.status}`)} />{i.status === "open" && <SlaChip sla={i.sla} />}</div></td>
      <td className="hidden px-4 py-3 text-sm text-slate-500 lg:table-cell">{timeAgo(i.first_reported_at)}</td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {i.emergency_override && <Badge tone="red"><Icon name="bolt" size={11} />{t("console.flag.emergency")}</Badge>}
          {i.fraud_flags.map((f) => <Badge key={f} tone="amber">{t(`flag.${f}`)}</Badge>)}
          {i.has_project && <Badge tone="teal"><Icon name="folder" size={11} />{t("console.flag.project")}</Badge>}
          {i.assigned_to_label && <Badge tone="indigo"><Icon name="users" size={11} />{i.assigned_to_label.split("@")[0]}</Badge>}
          {i.support_count > 0 && <Badge tone="teal"><Icon name="thumbsUp" size={11} />{i.support_count}</Badge>}
        </div>
      </td>
    </tr>
  );
}

function toCsv(rows: IssueSummary[]): string {
  const head = ["issue_id", "category", "description", "region", "state", "status", "score", "reports", "reporters", "first_reported"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((i) => [i.issue_id, i.category, i.description, i.region_name, i.state_name, i.status, i.composite_score, i.report_count, i.distinct_reporter_count, i.first_reported_at].map(esc).join(","))].join("\n");
}

export default function Priorities() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"score" | "reports" | "recent">("score");
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(0);

  const { data, loading, error } = useAsync(
    () => api.issues({ region: regionId, category: category || undefined, status: status || undefined, q: q || undefined, sort, flagged: flagged ? true : undefined }),
    [regionId, category, status, q, sort, flagged],
  );
  const issues = data?.issues ?? [];
  const pages = Math.max(1, Math.ceil(issues.length / PAGE));
  const slice = useMemo(() => issues.slice(page * PAGE, page * PAGE + PAGE), [issues, page]);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(issues)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pramaan-priorities-${regionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow={regionName}
        title={t("console.priorities.title")}
        subtitle={t("console.priorities.subtitle")}
        actions={
          <>
            {issues.some((i) => i.is_synthetic) && <SampleDataBadge label={t("badge.sample")} />}
            <Button variant="secondary" icon="download" disabled={issues.length === 0} onClick={exportCsv}>{t("common.exportCsv")}</Button>
          </>
        }
      />

      <Card className="mb-4 !p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input aria-label={t("common.search")} placeholder={t("console.search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="!pl-9" />
          </div>
          <Select aria-label={t("console.filter.category")} value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}>
            <option value="">{t("console.filter.allCategories")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </Select>
          <Select aria-label={t("console.filter.status")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">{t("console.filter.allStatuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
          <Select aria-label={t("console.sort")} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="score">{t("console.sort.score")}</option>
            <option value="reports">{t("console.sort.reports")}</option>
            <option value="recent">{t("console.sort.recent")}</option>
          </Select>
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-1 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={flagged} onChange={(e) => { setFlagged(e.target.checked); setPage(0); }} className="h-4 w-4 rounded border-slate-300 text-brand-700" />
            {t("console.filter.flagged")}
          </label>
        </div>
      </Card>

      {error && <Alert tone="error">{error.message}</Alert>}

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : issues.length === 0 ? (
          <EmptyState icon="flag" title={t("console.priorities.empty.title")} body={t("console.priorities.empty.body")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("console.col.priority")}</th>
                  <th className="px-4 py-3">{t("console.col.issue")}</th>
                  <th className="hidden px-4 py-3 md:table-cell">{t("console.col.reports")}</th>
                  <th className="px-4 py-3">{t("console.col.status")}</th>
                  <th className="hidden px-4 py-3 lg:table-cell">{t("console.col.age")}</th>
                  <th className="hidden px-4 py-3 lg:table-cell">{t("console.col.flags")}</th>
                </tr>
              </thead>
              <tbody>{slice.map((i) => <IssueRow key={i.issue_id} i={i} onOpen={() => navigate(`/console/issues/${i.issue_id}`)} />)}</tbody>
            </table>
          </div>
        )}
        {issues.length > PAGE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>{t("common.pageOf", { page: page + 1, pages, total: issues.length })}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t("common.prev")}</Button>
              <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
            </div>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">{t("console.priorities.note")}</p>
    </div>
  );
}
