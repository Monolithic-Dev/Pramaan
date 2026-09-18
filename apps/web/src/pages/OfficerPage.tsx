import { useState } from "react";
import { ApiClientError, createAgentSession } from "../api/client.js";
import { AgentChat } from "../components/AgentChat.js";
import { InsightsPanel } from "../components/InsightsPanel.js";
import { OfficerLogin } from "../components/OfficerLogin.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

export function OfficerPage() {
  const { t } = useLanguage();
  const [auth, setAuth] = useState<{ token: string; regionScope: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(token: string, regionScope: string) {
    setError(null);
    try {
      const { session_id } = await createAgentSession(token, regionScope);
      setAuth({ token, regionScope });
      setSessionId(session_id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("report.errorGeneric"));
    }
  }

  if (!auth || !sessionId) {
    return (
      <div>
        <OfficerLogin onLogin={login} />
        {error && <p className="mx-auto max-w-sm px-6 text-center text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    // docs/phases/phase-7-frontend.md §7.3: chat is primary (~60% width); the
    // map is a follow-up panel (docs/phases/phase-7-manual-checklist.md) —
    // the ranked list view is the load-bearing fallback per senior-frontend.
    <div className="flex h-screen">
      <div className="w-full md:w-3/5">
        <AgentChat token={auth.token} sessionId={sessionId} />
      </div>
      <div className="hidden w-2/5 overflow-y-auto border-l border-gray-200 p-4 md:block">
        <InsightsPanel token={auth.token} regionScope={auth.regionScope} />
      </div>
    </div>
  );
}
