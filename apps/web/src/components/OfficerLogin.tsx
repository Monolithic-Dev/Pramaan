import { useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider.js";

// Dev-only stand-in for Identity Platform SSO (docs/SECURITY_PRIVACY.md §1) —
// pastes a real Bearer JWT issued elsewhere, so the chat panel can be
// exercised against the real backend before OAuth wiring exists on the
// frontend. See docs/phases/phase-7-manual-checklist.md.
export function OfficerLogin({
  onLogin,
}: {
  onLogin: (token: string, regionScope: string) => void;
}) {
  const { t } = useLanguage();
  const [token, setToken] = useState("");
  const [regionScope, setRegionScope] = useState("");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-gray-900">{t("officer.loginTitle")}</h1>
      <div>
        <label htmlFor="officer-token" className="mb-1 block text-sm font-medium text-gray-900">
          {t("officer.loginTokenLabel")}
        </label>
        <input
          id="officer-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="officer-region" className="mb-1 block text-sm font-medium text-gray-900">
          {t("officer.loginRegionLabel")}
        </label>
        <input
          id="officer-region"
          value={regionScope}
          onChange={(e) => setRegionScope(e.target.value)}
          placeholder="LGD:IN-07-091-0014"
          className="w-full rounded-lg border border-gray-300 p-2 text-sm"
        />
      </div>
      <button
        type="button"
        disabled={!token || !regionScope}
        onClick={() => onLogin(token, regionScope)}
        className="rounded-lg bg-blue-700 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {t("officer.loginSubmit")}
      </button>
    </div>
  );
}
