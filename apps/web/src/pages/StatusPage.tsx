import { useState } from "react";
import {
  ApiClientError,
  getReportStatus,
  requestOtp,
  verifyOtp,
  type ReportStatus,
} from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

export function StatusPage() {
  const { t, countryCode } = useLanguage();
  const [submissionId, setSubmissionId] = useState("");
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    try {
      setOtpRequestId((await requestOtp(phone.trim(), countryCode)).request_id);
    } catch {
      setError(t("report.errorGeneric"));
    }
  }

  async function verify() {
    setError(null);
    try {
      setToken((await verifyOtp(otpRequestId!, otp.trim(), countryCode)).citizen_token);
    } catch {
      setError(t("status.otpFailed"));
    }
  }

  async function check() {
    setError(null);
    setStatus(null);
    try {
      setStatus(await getReportStatus(token, submissionId.trim()));
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 404 ? t("status.notFound") : t("report.errorGeneric"),
      );
    }
  }

  const box = "mt-1 w-full rounded-lg border border-gray-300 p-3";
  const secondary = "rounded-lg border-2 border-blue-700 px-4 py-2 font-medium text-blue-700";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-gray-900">{t("status.title")}</h1>

      {!token && (
        <div className="flex flex-col gap-2">
          <label className="text-base font-medium text-gray-900">
            {t("status.phone")}
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." className={box} />
          </label>
          {!otpRequestId ? (
            <button type="button" onClick={sendCode} className={secondary}>
              {t("status.sendCode")}
            </button>
          ) : (
            <>
              <label className="text-base font-medium text-gray-900">
                {t("status.otp")}
                <input value={otp} onChange={(e) => setOtp(e.target.value)} className={box} />
              </label>
              <button type="button" onClick={verify} className={secondary}>
                {t("status.verify")}
              </button>
            </>
          )}
        </div>
      )}

      <label className="text-base font-medium text-gray-900">
        {t("status.idLabel")}
        <input value={submissionId} onChange={(e) => setSubmissionId(e.target.value)} className={box} />
      </label>
      <button
        type="button"
        onClick={check}
        disabled={!token || !submissionId}
        className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold text-white disabled:opacity-50"
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
