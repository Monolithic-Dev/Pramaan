import { useState } from "react";
import { signInOfficer } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

// Email/password against Firebase Auth. The officer role and region come from custom
// claims set by an administrator (see docs/FREE_DEPLOYMENT_GUIDE.md); the region field is
// pre-filled from them and can be narrowed, never widened (the server enforces jurisdiction).
export function OfficerLogin({
  onLogin,
}: {
  onLogin: (token: string, regionScope: string) => void;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regionScope, setRegionScope] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setFailed(false);
    try {
      const { token, regionId } = await signInOfficer(email.trim(), password);
      setSession(token);
      setRegionScope(regionId);
      if (regionId) onLogin(token, regionId);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-gray-900">{t("officer.loginTitle")}</h1>
      <label className="text-sm font-medium text-gray-900">
        {t("officer.email")}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        />
      </label>
      <label className="text-sm font-medium text-gray-900">
        {t("officer.password")}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        />
      </label>
      {session && (
        <label className="text-sm font-medium text-gray-900">
          {t("officer.loginRegionLabel")}
          <input
            value={regionScope}
            onChange={(e) => setRegionScope(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </label>
      )}
      {failed && <p className="text-sm text-red-600">{t("officer.loginFailed")}</p>}
      <button
        type="button"
        disabled={!email || !password}
        onClick={session ? () => onLogin(session, regionScope) : signIn}
        className="rounded-lg bg-blue-700 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {t("officer.loginSubmit")}
      </button>
    </div>
  );
}
