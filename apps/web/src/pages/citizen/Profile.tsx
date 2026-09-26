import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type MyReport } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { SUPPORTED_LANGUAGES, useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import { Alert, Badge, Button, Card, CardTitle, Modal, Skeleton, cx, useAsync, useToast } from "../../ui/kit.js";

const UNDERWAY = new Set(["prioritized", "funded", "in_progress"]);

/** What the citizen's reports have done so far. */
function summarize(reports: MyReport[]) {
  return {
    filed: reports.length,
    fixed: reports.filter((r) => r.issue_status === "resolved").length,
    underway: reports.filter((r) => r.issue_status !== null && UNDERWAY.has(r.issue_status)).length,
    neighbours: reports.reduce((sum, r) => sum + r.other_reporters, 0),
  };
}

function ImpactTile({ icon, value, label, tone }: { icon: IconName; value: number; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-slate-900">{value}</p>
        <p className="text-xs font-medium leading-snug text-slate-500 [overflow-wrap:anywhere]">{label}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { t, language, setLanguage, ready } = useLanguage();
  const { email, me, signOut } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const announce = useRef<string | null>(null);
  const reports = useAsync(() => api.myReports(), []);
  const stats = useMemo(() => summarize(reports.data?.reports ?? []), [reports.data]);

  const memberSince = me?.member_since
    ? new Date(me.member_since).toLocaleDateString(language, { month: "long", year: "numeric" })
    : null;

  function chooseLanguage(code: (typeof SUPPORTED_LANGUAGES)[number]["code"], label: string) {
    if (code === language) return;
    // The citizen layout saves the choice to the server, so updates follow the app language.
    setLanguage(code);
    announce.current = label;
  }

  // Confirm in the new language, once its dictionary has arrived.
  useEffect(() => {
    if (!announce.current || !ready) return;
    toast("success", t("profile.languageSaved", { language: announce.current }));
    announce.current = null;
  }, [ready, t, toast]);

  async function exportData() {
    setBusy(true);
    try {
      const data = await api.myData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pramaan-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("success", t("profile.exported"));
    } catch {
      toast("error", t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setBusy(true);
    try {
      await api.eraseMyData();
      setConfirmErase(false);
      toast("success", t("profile.erased"));
      reports.refetch();
    } catch {
      toast("error", t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">{t("profile.title")}</h1>

      {/* Who you are */}
      <Card className="mb-4 overflow-hidden" padded={false}>
        <div className="h-16 bg-gradient-to-r from-brand-900 via-brand-700 to-brand-500" />
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-5">
          <div className="flex min-w-0 items-end gap-4">
            <span className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-saffron-500 text-2xl font-bold text-brand-950 shadow-sm">
              {(email ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 pt-3">
              <p className="truncate text-lg font-semibold text-slate-900">{email ?? t("profile.citizen")}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Badge tone="blue">{t("profile.citizen")}</Badge>
                {memberSince && <span>{t("profile.memberSince", { date: memberSince })}</span>}
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon="logout" onClick={signOut}>{t("nav.signOut")}</Button>
        </div>
      </Card>

      {/* What your reports have done */}
      <Card className="mb-4">
        <CardTitle title={t("profile.impact")} subtitle={t("profile.impactSub")} icon="target" />
        {reports.loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[4.5rem]" />)}</div>
        ) : stats.filed === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">{t("profile.noReports")}</p>
            <Link to="/report"><Button size="sm" icon="plus">{t("nav.report")}</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ImpactTile icon="flag" value={stats.filed} label={t("profile.stat.filed")} tone="bg-brand-50 text-brand-700" />
            <ImpactTile icon="users" value={stats.neighbours} label={t("profile.stat.neighbours")} tone="bg-amber-50 text-amber-700" />
            <ImpactTile icon="clock" value={stats.underway} label={t("profile.stat.underway")} tone="bg-violet-50 text-violet-700" />
            <ImpactTile icon="checkCircle" value={stats.fixed} label={t("profile.stat.fixed")} tone="bg-emerald-50 text-emerald-700" />
          </div>
        )}
      </Card>

      {/* Language */}
      <Card className="mb-4">
        <CardTitle title={t("profile.language")} subtitle={t("profile.languageSub")} icon="language" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" role="radiogroup" aria-label={t("profile.language")}>
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = language === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={active}
                lang={l.code}
                onClick={() => chooseLanguage(l.code, l.label)}
                className={cx(
                  "flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-2.5 text-left font-semibold transition",
                  active ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:border-brand-300",
                )}
              >
                <span className="truncate">{l.label}</span>
                {active && <Icon name="check" size={18} className="shrink-0 text-brand-700" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Your data */}
      <Card>
        <CardTitle title={t("profile.privacy")} subtitle={t("profile.privacySub")} icon="shield" />
        <ul className="mb-4 space-y-2 text-sm text-slate-600">
          {(["profile.privacy.noPhone", "profile.privacy.aggregate", "profile.privacy.export"] as const).map((key) => (
            <li key={key} className="flex items-start gap-2">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-india-600" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <Button variant="secondary" icon="download" loading={busy} onClick={exportData}>{t("profile.export")}</Button>
          <Button variant="ghost" icon="trash" onClick={() => setConfirmErase(true)} className="text-rose-700! hover:bg-rose-50!">{t("profile.erase")}</Button>
        </div>
      </Card>

      <Modal
        open={confirmErase}
        onClose={() => setConfirmErase(false)}
        title={t("profile.erase.title")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmErase(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" loading={busy} onClick={erase}>{t("profile.erase.confirm")}</Button>
          </>
        }
      >
        <Alert tone="warn">{t("profile.erase.body")}</Alert>
      </Modal>
    </div>
  );
}
