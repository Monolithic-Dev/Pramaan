import { useEffect, useRef, useState } from "react";
import { createAgentSession, streamAgentMessage } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Alert, Badge, Button, Card, PageHeader, Spinner, cx } from "../../ui/kit.js";
import { getIdToken } from "../../api/http.js";

interface Chip { tool: string; status: "running" | "done"; rows?: number; ms?: number }
interface Turn { id: string; query: string; chips: Chip[]; text: string | null; refused: boolean; error?: boolean }

const STARTERS = ["officer.starter1", "officer.starter2", "officer.starter3", "copilot.starter4"];

export default function Copilot() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const { me } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // One session per selected jurisdiction: the server pins the scope to it for every tool call.
  useEffect(() => {
    let alive = true;
    setSessionId(null);
    setSessionError(null);
    setTurns([]);
    (async () => {
      try {
        const token = await getIdToken();
        const s = await createAgentSession(token ?? "", regionId);
        if (alive) setSessionId(s.session_id);
      } catch (err) {
        if (alive) setSessionError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { alive = false; };
  }, [regionId]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns]);

  async function send(query: string) {
    if (!query.trim() || sending || !sessionId) return;
    const id = crypto.randomUUID();
    setTurns((p) => [...p, { id, query, chips: [], text: null, refused: false }]);
    setInput("");
    setSending(true);
    const patch = (fn: (turn: Turn) => Turn) => setTurns((p) => p.map((x) => (x.id === id ? fn(x) : x)));
    try {
      const token = (await getIdToken()) ?? "";
      await streamAgentMessage(token, sessionId, query, (event, data) => {
        const d = data as Record<string, any>;
        if (event === "tool_call") patch((x) => ({ ...x, chips: [...x.chips, { tool: d.tool, status: "running" }] }));
        if (event === "tool_result") patch((x) => ({ ...x, chips: x.chips.map((c) => (c.tool === d.tool && c.status === "running" ? { ...c, status: "done", rows: d.row_count, ms: d.latency_ms } : c)) }));
        if (event === "token") patch((x) => ({ ...x, text: d.text }));
        if (event === "done") patch((x) => ({ ...x, refused: Boolean(d.refused) }));
        if (event === "error") patch((x) => ({ ...x, text: d.message, error: true }));
      });
    } catch {
      patch((x) => ({ ...x, text: t("report.errorGeneric"), error: true }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[32rem] flex-col">
      <PageHeader
        eyebrow={regionName}
        title={t("console.copilot.title")}
        subtitle={t("console.copilot.subtitle")}
        actions={<Badge tone="violet"><Icon name="sparkles" size={12} />{t("copilot.grounded")}</Badge>}
      />
      {sessionError && <Alert tone="error">{sessionError}</Alert>}

      <Card padded={false} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="mx-auto max-w-xl py-6 text-center">
              <span className="inline-flex rounded-2xl bg-brand-50 p-4 text-brand-700"><Icon name="bot" size={32} /></span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{t("officer.chatTitle")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("copilot.intro", { region: regionName })}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {STARTERS.map((k) => (
                  <button key={k} type="button" disabled={!sessionId} onClick={() => send(t(k))} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-800 disabled:opacity-50">
                    {t(k)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-3 text-sm text-white">{turn.query}</div>
              {turn.chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {turn.chips.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {c.status === "running" ? <Spinner size={12} /> : <Icon name="check" size={12} className="text-emerald-600" />}
                      {c.status === "running" ? t("officer.toolRunning", { tool: c.tool }) : t("officer.toolDone", { tool: c.tool, rows: c.rows ?? 0, ms: c.ms ?? 0 })}
                    </span>
                  ))}
                </div>
              )}
              {turn.text ? (
                <div className={cx("max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed", turn.error ? "bg-rose-50 text-rose-800" : turn.refused ? "border border-amber-200 bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-900")}>
                  {turn.refused && <p className="mb-1 font-semibold">{t("officer.refusalTitle")}</p>}
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={16} />{t("copilot.thinking")}</div>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 border-t border-slate-100 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("officer.chatPlaceholder")}
            aria-label={t("officer.chatPlaceholder")}
            disabled={!sessionId || sending}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <Button type="submit" size="lg" icon="arrowRight" loading={sending} disabled={!sessionId || !input.trim()}>{t("officer.send")}</Button>
        </form>
      </Card>
      <p className="mt-2 text-xs text-slate-500">{t("copilot.scopeNote", { role: me?.role ? t(`role.${me.role}`) : "" })}</p>
    </div>
  );
}
