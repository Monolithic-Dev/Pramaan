import { useState } from "react";
import { api } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.js";
import { SUPPORTED_LANGUAGES, useLanguage } from "../../i18n/LanguageProvider.js";
import { Alert, Button, Card, CardTitle, Modal, PageHeader, cx, useToast } from "../../ui/kit.js";

export default function Profile() {
  const { t, language, setLanguage } = useLanguage();
  const { email, signOut } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

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
    } catch {
      toast("error", t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("profile.title")} subtitle={email ?? undefined} />

      <Card className="mb-4">
        <CardTitle title={t("profile.language")} subtitle={t("profile.languageSub")} icon="language" />
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              aria-pressed={language === l.code}
              onClick={() => setLanguage(l.code)}
              className={cx("rounded-xl border-2 px-5 py-2.5 font-semibold transition", language === l.code ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:border-brand-300")}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle title={t("profile.privacy")} subtitle={t("profile.privacySub")} icon="shield" />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon="download" loading={busy} onClick={exportData}>{t("profile.export")}</Button>
          <Button variant="danger" icon="trash" onClick={() => setConfirmErase(true)}>{t("profile.erase")}</Button>
        </div>
      </Card>

      <Card>
        <CardTitle title={t("nav.signOut")} icon="logout" />
        <Button variant="secondary" onClick={signOut}>{t("nav.signOut")}</Button>
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
