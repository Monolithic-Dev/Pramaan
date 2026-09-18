import { useState } from "react";
import { ApiClientError, getReportStatus, type ReportStatus } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

export function StatusPage() {
  const { t } = useLanguage();
  const [submissionId, setSubmissionId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setError(null);
    setStatus(null);
    try {
      setStatus(await getReportStatus(token.trim(), submissionId.trim()));
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 404 ? t("status.notFound") : t("report.errorGeneric"),
      );
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-gray-900">{t("status.title")}</h1>
      <label className="text-base font-medium text-gray-900">
        {t("status.idLabel")}
        <input
          value={submissionId}
          onChange={(e) => setSubmissionId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3"
        />
      </label>
      <label className="text-base font-medium text-gray-900">
        {t("status.signIn")}
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-3"
        />
      </label>
      <button
        type="button"
        onClick={check}
        className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold text-white"
      >
        {t("status.check")}
      </button>
      {error && <p className="text-red-600">{error}</p>}
      {status && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
          <p className="font-medium">
            {t("status.issueStatus", { status: status.issue_status ?? status.submission_status })}
          </p>
          <p>{t(`status.priority.${status.priority}`)}</p>
          {status.other_reporters > 0 && (
            <p>{t("status.otherReporters", { count: status.other_reporters })}</p>
          )}
          {status.explanation && (
            <div>
              <h2 className="font-semibold">{t("status.explanationTitle")}</h2>
              <p className="text-gray-700">{status.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
