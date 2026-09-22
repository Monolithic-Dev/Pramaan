import { Link } from "react-router-dom";
import { api, type MyReport } from "../../api/api.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Button, Card, EmptyState, PageHeader, PriorityBadge, Skeleton, Stat, StatusBadge, cx, timeAgo, useAsync } from "../../ui/kit.js";

export const STAGES = ["received", "understood", "verified", "funded", "fixed"] as const;

/** Where a report is on the journey a citizen cares about, derived from server state. */
export function stageIndex(processing: string, issueStatus: string | null): number {
  if (issueStatus === "resolved") return 4;
  if (issueStatus === "funded" || issueStatus === "in_progress") return 3;
  if (issueStatus === "verified" || issueStatus === "prioritized") return 2;
  if (issueStatus || processing === "processed") return 1;
  return 0;
}

export function Journey({ index }: { index: number }) {
  const { t } = useLanguage();
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STAGES.map((stage, i) => (
        <li key={stage} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", i <= index ? (i === 4 ? "bg-emerald-500 text-white" : "bg-brand-700 text-white") : "bg-slate-200 text-slate-400")}>
              {i <= index ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <span className={cx("hidden text-[10px] font-medium sm:block", i <= index ? "text-slate-700" : "text-slate-400")}>{t(`journey.${stage}`)}</span>
          </div>
          {i < STAGES.length - 1 && <span className={cx("mx-1 h-0.5 flex-1 rounded", i < index ? "bg-brand-500" : "bg-slate-200")} />}
        </li>
      ))}
    </ol>
  );
}

function ReportCard({ r }: { r: MyReport }) {
  const { t } = useLanguage();
  const meta = CATEGORY_META[r.category ?? "other"] ?? CATEGORY_META.other;
  const idx = stageIndex(r.processing, r.issue_status);
  return (
    <Link to={`/my/${r.submission_id}`} className="block">
      <Card className="fade-up transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
        <div className="flex items-start gap-4">
          <span className={cx("rounded-xl p-3", meta.bg, meta.tone)}>
            <Icon name={meta.icon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900">{r.category ? t(`category.${r.category}`) : t("my.processing")}</p>
              {r.issue_status && <StatusBadge status={r.issue_status} label={t(`status.${r.issue_status}`)} />}
              {r.priority !== "pending" && <PriorityBadge priority={r.priority} label={t(`status.priority.${r.priority}`)} />}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.text ?? t("my.noText")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{timeAgo(r.submitted_at)}</span>
              {r.has_photo && <span className="flex items-center gap-1"><Icon name="camera" size={12} />{t("my.photo")}</span>}
              {r.has_audio && <span className="flex items-center gap-1"><Icon name="mic" size={12} />{t("my.voice")}</span>}
              {r.other_reporters > 0 && <span className="flex items-center gap-1"><Icon name="users" size={12} />{t("status.otherReporters", { count: r.other_reporters })}</span>}
            </div>
            <div className="mt-4"><Journey index={idx} /></div>
          </div>
          <Icon name="chevronRight" className="mt-1 hidden text-slate-400 sm:block" />
        </div>
      </Card>
    </Link>
  );
}

export default function MyReports() {
  const { t } = useLanguage();
  const { data, loading, error } = useAsync(() => api.myReports(), []);
  const reports = data?.reports ?? [];
  const resolved = reports.filter((r) => r.issue_status === "resolved").length;
  const active = reports.filter((r) => r.issue_status && r.issue_status !== "resolved").length;

  return (
    <div>
      <PageHeader
        title={t("my.title")}
        subtitle={t("my.subtitle")}
        actions={<Link to="/report"><Button icon="plus">{t("nav.report")}</Button></Link>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("my.stat.filed")} value={reports.length} icon="flag" />
        <Stat label={t("my.stat.active")} value={active} icon="clock" tone="amber" />
        <Stat label={t("my.stat.resolved")} value={resolved} icon="checkCircle" tone="green" />
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : error ? (
        <Card><p className="text-rose-600">{error.message}</p></Card>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState icon="flag" title={t("my.empty.title")} body={t("my.empty.body")} action={<Link to="/report"><Button icon="plus">{t("nav.report")}</Button></Link>} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">{reports.map((r) => <ReportCard key={r.submission_id} r={r} />)}</div>
      )}
    </div>
  );
}
