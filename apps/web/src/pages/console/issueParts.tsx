import { useState } from "react";
import { api, type IssueSummary, type SchemeMatch } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Avatar, SlaChip } from "../../ui/extras.js";
import { money } from "../../ui/format.js";
import { Icon } from "../../ui/Icon.js";
import { Meter } from "../../ui/charts.js";
import { Badge, Button, Card, CardTitle, Field, Segmented, Select, Skeleton, Textarea, timeAgo, useAsync, useToast } from "../../ui/kit.js";

/** Who is accountable for the next step, and by when. */
export function AssignCard({ issue, onChanged }: { issue: IssueSummary; onChanged: () => void }) {
  const { t } = useLanguage();
  const { can, me } = useAuth();
  const { toast } = useToast();
  const canAssign = can("update_issue_status");
  const directory = useAsync(() => (canAssign ? api.directory() : Promise.resolve({ officers: [] })), [canAssign]);
  const [choice, setChoice] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);

  async function assign(uid: string | null) {
    setBusy(true);
    try {
      await api.assign(issue.issue_id, uid, days ? Number(days) : undefined);
      toast("success", t(uid ? "assign.toast.assigned" : "assign.toast.cleared"));
      setChoice("");
      setDays("");
      onChanged();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle title={t("assign.title")} subtitle={t("assign.sub")} icon="userPlus" />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
        {issue.assigned_to_label ? (
          <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Avatar name={issue.assigned_to_label} size={28} />
            {issue.assigned_to_uid === me?.uid ? t("queue.you") : issue.assigned_to_label}
          </span>
        ) : (
          <span className="text-sm text-slate-500">{t("assign.nobody")}</span>
        )}
        <SlaChip sla={issue.sla} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{t("assign.due", { when: new Date(issue.sla.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) })}</p>

      {canAssign && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <Field label={t("assign.officer")} htmlFor="assignee">
            <Select id="assignee" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">{t("assign.choose")}</option>
              {(directory.data?.officers ?? []).map((o) => <option key={o.uid} value={o.uid}>{o.email} ({t(`role.${o.role}`)})</option>)}
            </Select>
          </Field>
          <Field label={t("assign.days")} htmlFor="due-days" hint={t("assign.days.hint")}>
            <Select id="due-days" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="">{t("assign.days.default")}</option>
              {[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{t("assign.days.n", { n: d })}</option>)}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button size="sm" icon="userPlus" disabled={!choice} loading={busy} onClick={() => assign(choice)}>{t("assign.assign")}</Button>
            {issue.assigned_to_uid && <Button size="sm" variant="ghost" loading={busy} onClick={() => assign(null)}>{t("assign.clear")}</Button>}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Internal notes: the working conversation about an issue. Never shown to citizens. */
export function NotesCard({ issueId }: { issueId: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data, loading, refetch } = useAsync(() => api.comments(issueId), [issueId]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const notes = data?.comments ?? [];

  async function post() {
    setBusy(true);
    try {
      await api.addComment(issueId, body);
      setBody("");
      refetch();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle title={t("notes.title")} subtitle={t("notes.sub")} icon="message" />
      {loading ? (
        <Skeleton className="h-16" />
      ) : notes.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">{t("notes.none")}</p>
      ) : (
        <ul className="mb-4 space-y-4">
          {notes.map((n) => (
            <li key={n.comment_id} className="flex gap-3">
              <Avatar name={n.author_label} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500"><b className="text-slate-800">{n.author_label}</b> · {timeAgo(n.created_at)}</p>
                <p className="mt-0.5 whitespace-pre-wrap rounded-xl rounded-tl-sm bg-slate-50 px-3 py-2 text-sm text-slate-800">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("notes.placeholder")} maxLength={1000} aria-label={t("notes.title")} />
      <div className="mt-2 flex justify-end">
        <Button size="sm" icon="send" loading={busy} disabled={!body.trim()} onClick={post}>{t("notes.post")}</Button>
      </div>
    </Card>
  );
}

/** Which national programme could pay for this fix, with the typical centre/state split. */
export function SchemesCard({ issueId }: { issueId: string }) {
  const { t } = useLanguage();
  const [settlement, setSettlement] = useState<"auto" | "urban" | "rural">("auto");
  const { data, loading } = useAsync(() => api.issueSchemes(issueId, settlement === "auto" ? undefined : settlement), [issueId, settlement]);
  const matches = data?.matches ?? [];

  return (
    <Card>
      <CardTitle title={t("issueSchemes.title")} subtitle={t("issueSchemes.sub")} icon="rupee" />
      <Segmented
        value={settlement}
        onChange={setSettlement}
        className="mb-3 w-full [&>button]:flex-1 [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs"
        options={[{ value: "auto", label: t("issueSchemes.auto") }, { value: "urban", label: t("schemes.settlement.urban") }, { value: "rural", label: t("schemes.settlement.rural") }]}
      />
      {data && <p className="mb-3 text-xs text-slate-500">{data.settlement_basis}</p>}
      {loading ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="space-y-3">
          {matches.slice(0, 3).map((m, i) => <MatchRow key={m.scheme.id} match={m} best={i === 0} />)}
        </ul>
      )}
    </Card>
  );
}

function MatchRow({ match: m, best }: { match: SchemeMatch; best: boolean }) {
  const { t } = useLanguage();
  return (
    <li className={`rounded-xl border p-3 ${best ? "border-brand-200 bg-brand-50/50" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{m.scheme.short}</p>
          <p className="text-xs text-slate-500">{m.scheme.priority}</p>
        </div>
        <Badge tone={best ? "blue" : "slate"}>{t("issueSchemes.fit", { pct: Math.round(m.fit * 100) })}</Badge>
      </div>
      <Meter value={m.fit} color="#1d3f97" className="mt-2" />
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-slate-600">{t("issueSchemes.centre")} <b className="text-emerald-700">{money(m.funding.centre_inr)}</b></span>
        <span className="text-slate-600">{t("issueSchemes.state")} <b className="text-slate-900">{money(m.funding.state_inr)}</b></span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
        {m.reasons.slice(0, 2).map((r) => <li key={r} className="flex gap-1"><Icon name="check" size={11} className="mt-0.5 shrink-0 text-emerald-600" />{r}</li>)}
      </ul>
      {m.scheme.requires_mp_recommendation && <p className="mt-1 text-[11px] font-semibold text-amber-700">{t("schemes.mpNote")}</p>}
    </li>
  );
}
