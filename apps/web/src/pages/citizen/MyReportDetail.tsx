import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/api.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Alert, Button, Card, CardTitle, EmptyState, PriorityBadge, Skeleton, StatusBadge, cx, timeAgo, useAsync, useToast } from "../../ui/kit.js";
import { Journey, stageIndex } from "./MyReports.js";

export default function MyReportDetail() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { submissionId = "" } = useParams();
  const { data, loading, error, refetch } = useAsync(() => api.reportStatus(submissionId), [submissionId]);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(false);

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /></div>;
  if (error || !data) {
    return (
      <Card>
        <EmptyState icon="alert" title={t("status.notFound")} action={<Link to="/my"><Button variant="secondary">{t("common.back")}</Button></Link>} />
      </Card>
    );
  }

  const meta = CATEGORY_META[data.category ?? "other"] ?? CATEGORY_META.other;
  const idx = stageIndex(data.submission_status, data.issue_status);

  async function confirm(confirmed: boolean) {
    if (!data?.project_id) return;
    setBusy(true);
    try {
      await api.confirmResolution(data.project_id, confirmed);
      setAnswered(true);
      toast("success", t("my.confirm.thanks"));
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/my" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700">
        <Icon name="arrowRight" size={14} className="rotate-180" /> {t("common.back")}
      </Link>

      <Card className="!p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cx("rounded-xl p-3", meta.bg, meta.tone)}><Icon name={meta.icon} size={24} /></span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{data.category ? t(`category.${data.category}`) : t("my.processing")}</h1>
            <p className="font-mono text-xs text-slate-500">{submissionId}{data.first_reported_at ? ` · ${timeAgo(data.first_reported_at)}` : ""}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {data.issue_status && <StatusBadge status={data.issue_status} label={t(`status.${data.issue_status}`)} />}
            {data.priority !== "pending" && <PriorityBadge priority={data.priority} label={t(`status.priority.${data.priority}`)} />}
          </div>
        </div>
        <div className="mt-6"><Journey index={idx} /></div>
      </Card>

      {data.awaiting_confirmation && !answered && (
        <Card className="mt-4 !border-emerald-300 !bg-emerald-50">
          <CardTitle title={t("my.confirm.title")} subtitle={t("my.confirm.body")} icon="checkCircle" />
          <div className="flex flex-wrap gap-3">
            <Button loading={busy} icon="check" onClick={() => confirm(true)}>{t("my.confirm.yes")}</Button>
            <Button variant="secondary" loading={busy} onClick={() => confirm(false)}>{t("my.confirm.no")}</Button>
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle title={t("my.community")} icon="users" />
          <p className="text-3xl font-bold text-slate-900">{data.other_reporters}</p>
          <p className="mt-1 text-sm text-slate-600">{t("my.community.body")}</p>
        </Card>
        <Card>
          <CardTitle title={t("my.priority")} icon="scale" />
          {data.priority === "pending" ? (
            <p className="text-sm text-slate-600">{t("status.priority.pending")}</p>
          ) : (
            <PriorityBadge priority={data.priority} label={t(`status.priority.${data.priority}`)} />
          )}
          <p className="mt-2 text-sm text-slate-600">{t("my.priority.body")}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle title={t("status.explanationTitle")} subtitle={t("my.why.sub")} icon="sparkles" />
        {data.explanation ? (
          <p className="leading-relaxed text-slate-800">{data.explanation}</p>
        ) : (
          <Alert tone="info">{t("my.why.none")}</Alert>
        )}
      </Card>
    </div>
  );
}
