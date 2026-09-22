import { Link } from "react-router-dom";
import { api, type ProjectRow } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Meter } from "../../ui/charts.js";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, cx, useAsync, useToast } from "../../ui/kit.js";

const COLUMNS = [
  { key: "recommended", tone: "border-violet-300", dot: "bg-violet-500" },
  { key: "funded", tone: "border-teal-300", dot: "bg-teal-500" },
  { key: "in_progress", tone: "border-indigo-300", dot: "bg-indigo-500" },
  { key: "completed", tone: "border-emerald-300", dot: "bg-emerald-500" },
] as const;

function ProjectCard({ p, onChanged }: { p: ProjectRow; onChanged: () => void }) {
  const { t } = useLanguage();
  const { can } = useAuth();
  const { toast } = useToast();
  const meta = CATEGORY_META[p.issue.category] ?? CATEGORY_META.other;

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast("success", t(ok));
      onChanged();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : t("report.errorGeneric"));
    }
  }

  return (
    <Card className="!p-4">
      <div className="flex items-start gap-3">
        <span className={cx("rounded-lg p-2", meta.bg, meta.tone)}><Icon name={meta.icon} size={16} /></span>
        <div className="min-w-0">
          <Link to={`/console/issues/${p.issue.issue_id}`} className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-brand-700">{p.issue.description}</Link>
          <p className="mt-0.5 text-xs text-slate-500">{p.assigned_dept}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
        <span>{t("console.kpi.score")} <b className="text-slate-900">{p.composite_score.toFixed(2)}</b></span>
        {p.issue.country_code === "IN" && <span>INR {p.budget_estimate_inr.toLocaleString("en-IN")}</span>}
      </div>
      <div className="mt-2"><Meter value={p.composite_score} color="#7c3aed" /></div>
      {p.marked_complete_at && !p.officer_signed_off_at && <div className="mt-3"><Badge tone="amber"><Icon name="clock" size={11} />{t("project.awaitingConfirm")}</Badge></div>}
      {can("manage_projects") && p.status !== "completed" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.status === "recommended" && <Button size="sm" onClick={() => act(() => api.setProjectStatus(p.project_id, "funded"), "project.toast.funded")}>{t("project.action.fund")}</Button>}
          {(p.status === "recommended" || p.status === "funded") && <Button size="sm" variant="secondary" onClick={() => act(() => api.setProjectStatus(p.project_id, "in_progress"), "project.toast.started")}>{t("project.action.start")}</Button>}
          {p.status === "in_progress" && !p.marked_complete_at && <Button size="sm" variant="accent" onClick={() => act(() => api.markComplete(p.project_id), "project.toast.complete")}>{t("project.action.complete")}</Button>}
          {p.marked_complete_at && !p.officer_signed_off_at && <Button size="sm" onClick={() => act(() => api.signOff(p.project_id), "project.toast.signoff")}>{t("project.action.signoff")}</Button>}
        </div>
      )}
    </Card>
  );
}

export default function Projects() {
  const { t } = useLanguage();
  const { data, loading, refetch } = useAsync(() => api.projects(), []);
  const projects = data?.projects ?? [];

  return (
    <div>
      <PageHeader title={t("console.projects.title")} subtitle={t("console.projects.subtitle")} actions={<Link to="/console/priorities"><Button variant="secondary" icon="list">{t("console.nav.priorities")}</Button></Link>} />
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : projects.length === 0 ? (
        <Card><EmptyState icon="folder" title={t("console.projects.empty.title")} body={t("console.projects.empty.body")} action={<Link to="/console/priorities"><Button>{t("console.nav.priorities")}</Button></Link>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = projects.filter((p) => p.status === col.key);
            return (
              <div key={col.key} className={cx("rounded-2xl border-t-4 bg-slate-100/70 p-3", col.tone)}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className={cx("h-2.5 w-2.5 rounded-full", col.dot)} />{t(`project.${col.key}`)}</p>
                  <Badge tone="slate">{items.length}</Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {items.map((p) => <ProjectCard key={p.project_id} p={p} onChanged={refetch} />)}
                  {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-400">{t("console.empty")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
