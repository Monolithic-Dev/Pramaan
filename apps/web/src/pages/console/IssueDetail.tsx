import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import L from "leaflet";
import { api, type IssueDetail as Detail } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Meter, priorityColor } from "../../ui/charts.js";
import { SlaChip } from "../../ui/extras.js";
import { AssignCard, NotesCard, SchemesCard } from "./issueParts.js";
import { Alert, Badge, Button, Card, CardTitle, EmptyState, Field, Modal, PriorityBadge, SampleDataBadge, Select, Skeleton, StatusBadge, Textarea, cx, timeAgo, useAsync, useToast } from "../../ui/kit.js";

/** Which scheme pays for this project: set to the best match automatically, corrected by an officer, and
 *  what the scheme impact ledger attributes the project's results to. */
function ProjectSchemePicker({ value, editable, onChange }: { value: string; editable: boolean; onChange: (id: string) => void }) {
  const { t } = useLanguage();
  const { data } = useAsync(() => api.schemes(), []);
  const schemes = data?.schemes ?? [];
  const current = schemes.find((s) => s.id === value);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-slate-600"><Icon name="rupee" size={14} />{t("project.scheme")}</span>
      {editable ? (
        <Select value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="!w-auto !py-1 text-sm" aria-label={t("project.scheme")}>
          {!value && <option value="">{t("project.scheme.none")}</option>}
          {schemes.map((s) => <option key={s.id} value={s.id}>{s.short}</option>)}
        </Select>
      ) : (
        <Badge tone="saffron">{current?.short ?? t("project.scheme.none")}</Badge>
      )}
    </div>
  );
}

const NEXT_STATUSES =["verified", "disputed", "prioritized", "funded", "in_progress"];
const REPORTS_PREVIEW = 4;

/** What Gemini did before any officer looked, made visible: merging, language understanding,
 *  translation, channels and classification. Computed from the reports on the page. */
function AiSummary({ issue, reports }: { issue: Detail["issue"]; reports: Detail["reports"] }) {
  const { t, language } = useLanguage();
  if (reports.length === 0) return null;
  const names = (() => {
    try {
      const dn = new Intl.DisplayNames([language], { type: "language" });
      return (code: string) => dn.of(code) ?? code;
    } catch {
      return (code: string) => code;
    }
  })();
  const languages = [...new Set(reports.map((r) => r.language).filter((l): l is string => Boolean(l)))];
  const translated = reports.filter((r) => r.translated_text).length;
  const channels = [...new Set(reports.map((r) => r.channel))];
  const voice = reports.filter((r) => r.has_audio).length;
  const photos = reports.filter((r) => r.photo).length;
  const tiles = [
    { icon: "layers", value: `${issue.report_count} → 1`, label: t("issue.ai.merged") },
    { icon: "language", value: languages.length, label: languages.map(names).join(", ") || t("issue.ai.languages") },
    { icon: "sparkles", value: translated, label: t("issue.ai.translated") },
    { icon: "send", value: channels.length, label: channels.join(" · ") },
  ] as const;

  return (
    <Card className="border-violet-200! bg-linear-to-br from-violet-50/70 to-white">
      <CardTitle title={t("issue.ai.title")} subtitle={t("issue.ai.subtitle")} icon="sparkles" />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.icon} className="flex flex-col-reverse justify-end rounded-xl bg-white/80 p-3 ring-1 ring-violet-100">
            <dt className="mt-1 text-xs leading-snug text-slate-500">{tile.label}</dt>
            <dd className="flex items-center gap-1.5 text-xl font-bold text-slate-900"><Icon name={tile.icon} size={16} className="text-violet-600" />{tile.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
        <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-violet-600" />{t("issue.ai.classified", { category: t(`category.${issue.category}`), sub: issue.subcategory })}</li>
        <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-violet-600" />{t("issue.ai.dedup", { n: issue.report_count, people: issue.distinct_reporter_count })}</li>
        {(voice > 0 || photos > 0) && (
          <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-violet-600" />{t("issue.ai.media", { voice, photos })}</li>
        )}
        <li className="flex gap-2"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-violet-600" />{t("issue.ai.located", { area: issue.region_name ?? t("console.unresolved") })}</li>
      </ul>
      {issue.embedding_model && <p className="mt-3 text-xs text-slate-500">{t("issue.ai.models", { model: issue.embedding_model })}</p>}
    </Card>
  );
}

function MiniMap({ lat, lng, color }: { lat: number; lng: number; color: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, dragging: false }).setView([lat, lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
    L.circleMarker([lat, lng], { radius: 11, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(m);
    return () => void m.remove();
  }, [lat, lng, color]);
  return <div ref={el} className="h-44 w-full overflow-hidden rounded-xl border border-slate-200" />;
}

function ReportPhoto({ mediaUrl }: { mediaUrl: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.photoUrl(mediaUrl).then((u) => alive && setSrc(u)).catch(() => undefined);
    return () => { alive = false; };
  }, [mediaUrl]);
  return src ? <img src={src} alt="" className="mt-2 h-28 rounded-lg border border-slate-200 object-cover" /> : <Skeleton className="mt-2 h-28 w-40" />;
}

function ScorePanel({ score }: { score: NonNullable<Detail["score"]> }) {
  const { t } = useLanguage();
  const rows = [
    { key: "score.demand", value: score.demand_score, weight: score.weights.demand, color: "#244ebc" },
    { key: "score.vulnerability", value: score.vulnerability_score, weight: score.weights.vulnerability, color: "#7c3aed" },
    { key: "score.gap", value: score.gap_score, weight: score.weights.gap, color: "#ea7d0f" },
  ];
  return (
    <Card>
      <CardTitle title={t("officer.scoreBreakdownTitle")} subtitle={t("issue.score.sub")} icon="scale" />
      <div className="flex items-end justify-between">
        <p className="text-4xl font-extrabold tabular-nums" style={{ color: priorityColor(score.composite_score) }}>{score.composite_score.toFixed(2)}</p>
        <Badge tone="slate">{score.model_version}</Badge>
      </div>
      {score.estimated_impact_population != null && (
        <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
          {t("score.estimatedImpact", { count: score.estimated_impact_population.toLocaleString() })}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-800">{t(r.key)}</span>
              <span className="tabular-nums text-slate-500">{r.value.toFixed(2)} x {r.weight.toFixed(2)} = <b className="text-slate-900">{(r.value * r.weight).toFixed(3)}</b></span>
            </div>
            <Meter value={r.value} color={r.color} />
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div><dt className="text-slate-500">{t("score.duplicationPenalty")}</dt><dd className="font-semibold text-slate-900">{score.duplication_penalty.toFixed(2)}</dd></div>
        <div><dt className="text-slate-500">{t("score.impactEfficacy")}</dt><dd className="font-semibold text-slate-900">{score.impact_efficacy === null ? t("score.noHistory") : score.impact_efficacy.toFixed(2)}</dd></div>
      </dl>
      {score.data_fallbacks.length > 0 && (
        <div className="mt-4"><Alert tone="warn" title={t("score.fallbackTitle")}>
          <ul className="list-disc pl-4">{score.data_fallbacks.map((f, i) => <li key={i}>{f.component}: {f.reason} ({f.used_level})</li>)}</ul>
        </Alert></div>
      )}
    </Card>
  );
}

export default function IssueDetail() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { can } = useAuth();
  const { issueId = "" } = useParams();
  const { data, loading, error, refetch } = useAsync(() => api.issue(issueId), [issueId]);
  const [modal, setModal] = useState<"status" | "emergency" | null>(null);
  const [status, setStatus] = useState("verified");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAllReports, setShowAllReports] = useState(false);

  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-96" /><Skeleton className="h-64" /></div>;
  if (error || !data) {
    return <Card><EmptyState icon="lock" title={error?.message ?? t("common.notFound")} action={<Link to="/console/priorities"><Button variant="secondary">{t("common.back")}</Button></Link>} /></Card>;
  }

  const { issue, score, project, impact, reports, history } = data;
  const meta = CATEGORY_META[issue.category] ?? CATEGORY_META.other;
  const color = priorityColor(issue.composite_score);

  async function run<T>(fn: () => Promise<T>, okKey: string) {
    setBusy(true);
    try {
      await fn();
      toast("success", t(okKey));
      setModal(null);
      setJustification("");
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = () => run(() => api.setIssueStatus(issue.issue_id, status, justification), "issue.toast.status");
  const toggleEmergency = () => run(() => api.setEmergency(issue.issue_id, !issue.emergency_override, justification), "issue.toast.emergency");

  return (
    <div>
      <Link to="/console/priorities" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-700">
        <Icon name="arrowRight" size={14} className="rotate-180" /> {t("console.nav.priorities")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className={cx("rounded-2xl p-3.5", meta.bg, meta.tone)}><Icon name={meta.icon} size={28} /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={issue.status} label={t(`status.${issue.status}`)} />
              <PriorityBadge priority={issue.priority} label={t(`status.priority.${issue.priority}`)} />
              {issue.emergency_override && <Badge tone="red"><Icon name="bolt" size={11} />{t("console.flag.emergency")}</Badge>}
              <SlaChip sla={issue.sla} />
              {issue.support_count > 0 && <Badge tone="teal"><Icon name="thumbsUp" size={11} />{t("issue.supporters", { n: issue.support_count })}</Badge>}
              {issue.is_synthetic && <SampleDataBadge label={t("badge.sample")} />}
              {issue.fraud_flags.map((f) => <Badge key={f} tone="amber">{t(`flag.${f}`)}</Badge>)}
            </div>
            <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-slate-900">{issue.description}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {t(`category.${issue.category}`)} / {issue.subcategory} · {issue.region_name ?? t("console.unresolved")}{issue.state_name ? `, ${issue.state_name}` : ""} · {t("issue.firstReported", { when: timeAgo(issue.first_reported_at) })}
            </p>
          </div>
        </div>
        {can("update_issue_status") ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="flag" onClick={() => setModal("status")} disabled={issue.status === "resolved"}>{t("issue.changeStatus")}</Button>
            {can("emergency_override") && (
              <Button variant={issue.emergency_override ? "secondary" : "danger"} icon="bolt" onClick={() => setModal("emergency")}>
                {issue.emergency_override ? t("issue.emergency.remove") : t("officer.emergencyOverride")}
              </Button>
            )}
          </div>
        ) : (
          <Badge tone="slate"><Icon name="lock" size={12} />{t("issue.readOnly")}</Badge>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <AiSummary issue={issue} reports={reports} />
          <Card>
            <CardTitle title={t("issue.reports")} subtitle={t("issue.reportsSub", { reports: issue.report_count, people: issue.distinct_reporter_count })} icon="users" />
            {reports.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">{t("issue.reports.none")}</p>
            ) : (
              <>
              <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
                {(showAllReports ? reports : reports.slice(0, REPORTS_PREVIEW)).map((r) => (
                  <li key={r.submission_id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone="slate">{r.channel}</Badge>
                      {r.language && <Badge tone="blue">{r.language}</Badge>}
                      {r.has_audio && <Badge tone="indigo"><Icon name="mic" size={11} />{t("my.voice")}</Badge>}
                      <span>{timeAgo(r.submitted_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800">{r.text ?? <span className="text-slate-400">{t("my.noText")}</span>}</p>
                    {r.translated_text && (
                      <p className="mt-1 flex gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                        <Icon name="language" size={13} className="mt-0.5 shrink-0 text-brand-600" />
                        <span><b className="text-slate-700">{t("issue.translation")}:</b> {r.translated_text}</span>
                      </p>
                    )}
                    {r.photo && <ReportPhoto mediaUrl={r.photo} />}
                  </li>
                ))}
              </ol>
              {reports.length > REPORTS_PREVIEW && (
                <Button variant="ghost" size="sm" className="mt-3" icon={showAllReports ? undefined : "chevronDown"} onClick={() => setShowAllReports((v) => !v)}>
                  {showAllReports ? t("issue.reports.showFewer") : t("issue.reports.showAll", { n: reports.length })}
                </Button>
              )}
              </>
            )}
          </Card>

          {project ? (
            <Card>
              <CardTitle title={t("issue.project")} subtitle={project.assigned_dept} icon="folder" action={<StatusBadge status={project.status} label={t(`project.${project.status}`)} />} />
              <p className="leading-relaxed text-slate-800">{project.generated_brief}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={project.groundedness_check.passed ? "green" : "red"}>
                  <Icon name={project.groundedness_check.passed ? "checkCircle" : "alert"} size={12} />
                  {project.groundedness_check.passed ? t("issue.grounded") : t("issue.ungrounded")}
                </Badge>
                {issue.country_code === "IN" && <Badge tone="slate">{t("issue.budget", { amount: project.budget_estimate_inr.toLocaleString("en-IN") })}</Badge>}
              </div>
              {issue.country_code === "IN" && (
                <ProjectSchemePicker
                  value={project.scheme_id ?? ""}
                  editable={can("manage_projects")}
                  onChange={(id) => run(() => api.setProjectScheme(project.project_id, id), "project.toast.scheme")}
                />
              )}
              {impact && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">{t("issue.impact.title")}</p>
                  <div className="mt-2"><Meter value={impact.confirmations_received / Math.max(1, impact.confirmations_required)} color="#16a34a" /></div>
                  <p className="mt-1 text-slate-600">{t("issue.impact.body", { got: impact.confirmations_received, need: impact.confirmations_required, no: impact.confirmations_negative })}</p>
                  {(impact.reopened_count ?? 0) > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 font-medium text-amber-700"><Icon name="alert" size={14} />{t("issue.impact.reopened", { n: impact.reopened_count ?? 0 })}</p>
                  )}
                </div>
              )}
              {can("manage_projects") && project.status !== "completed" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.status === "recommended" && <Button size="sm" icon="scale" loading={busy} onClick={() => run(() => api.setProjectStatus(project.project_id, "funded"), "project.toast.funded")}>{t("project.action.fund")}</Button>}
                  {(project.status === "recommended" || project.status === "funded") && <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api.setProjectStatus(project.project_id, "in_progress"), "project.toast.started")}>{t("project.action.start")}</Button>}
                  {project.status === "in_progress" && !project.marked_complete_at && <Button size="sm" variant="accent" icon="checkCircle" loading={busy} onClick={() => run(() => api.markComplete(project.project_id), "project.toast.complete")}>{t("project.action.complete")}</Button>}
                  {project.marked_complete_at && !project.officer_signed_off_at && <Button size="sm" icon="shield" loading={busy} onClick={() => run(() => api.signOff(project.project_id), "project.toast.signoff")}>{t("project.action.signoff")}</Button>}
                </div>
              )}
            </Card>
          ) : (
            can("manage_projects") && (
              <Card>
                <CardTitle title={t("issue.project")} subtitle={t("issue.project.none")} icon="folder" />
                <Button icon="sparkles" loading={busy} disabled={!score} onClick={() => run(() => api.recommendProject(issue.issue_id), "issue.toast.project")}>{t("issue.project.recommend")}</Button>
                {!score && <p className="mt-2 text-xs text-slate-500">{t("issue.project.needsScore")}</p>}
              </Card>
            )
          )}

          <NotesCard issueId={issue.issue_id} />

          <Card>
            <CardTitle title={t("issue.history")} icon="clock" />
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">{t("issue.history.none")}</p>
            ) : (
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.audit_id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <p className="font-medium text-slate-900">{t(`audit.${h.action}`)} <span className="font-normal text-slate-500">· {timeAgo(h.timestamp)}</span></p>
                      {h.justification && <p className="text-slate-600">"{h.justification}"</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {issue.lat != null && issue.lng != null && (
            <Card padded={false} className="overflow-hidden">
              <MiniMap lat={issue.lat} lng={issue.lng} color={color} />
              <p className="p-3 text-xs text-slate-500">{issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}</p>
            </Card>
          )}
          <AssignCard issue={issue} onChanged={refetch} />
          {score ? <ScorePanel score={score} /> : (
            <Card><CardTitle title={t("officer.scoreBreakdownTitle")} icon="scale" /><Alert tone="info">{t("issue.notScored")}</Alert></Card>
          )}
          <SchemesCard issueId={issue.issue_id} />
        </div>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "status" ? t("issue.changeStatus") : issue.emergency_override ? t("issue.emergency.remove") : t("officer.emergencyOverride")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>{t("common.cancel")}</Button>
            <Button loading={busy} disabled={justification.trim().length < 3} variant={modal === "emergency" && !issue.emergency_override ? "danger" : "primary"} onClick={modal === "status" ? changeStatus : toggleEmergency}>
              {t("common.confirm")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {modal === "status" && (
            <Field label={t("console.filter.status")} htmlFor="new-status">
              <Select id="new-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {NEXT_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </Select>
            </Field>
          )}
          {modal === "emergency" && <Alert tone="warn">{t("issue.emergency.body")}</Alert>}
          <Field label={t("issue.justification")} htmlFor="justification" hint={t("issue.justification.hint")}>
            <Textarea id="justification" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
