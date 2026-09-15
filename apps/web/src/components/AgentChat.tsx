import { useState } from "react";
import { streamAgentMessage } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

interface ToolCallChip {
  tool: string;
  status: "running" | "done";
  rowCount?: number;
  latencyMs?: number;
}

interface ChatTurn {
  id: string;
  query: string;
  toolCalls: ToolCallChip[];
  responseText: string | null;
  refused: boolean;
}

// docs/phases/phase-7-frontend.md §7.3: tool-call chips are the evidence that
// function calling is real — never hidden behind a details toggle.
function ToolCallChipView({ chip }: { chip: ToolCallChip }) {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      🔧{" "}
      {chip.status === "running"
        ? t("officer.toolRunning", { tool: chip.tool })
        : t("officer.toolDone", { tool: chip.tool, rows: chip.rowCount ?? 0, ms: chip.latencyMs ?? 0 })}
    </span>
  );
}

export function AgentChat({ token, sessionId }: { token: string; sessionId: string }) {
  const { t } = useLanguage();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send(query: string) {
    if (!query.trim() || sending) return;
    setSending(true);
    const turnId = crypto.randomUUID();
    const turn: ChatTurn = { id: turnId, query, toolCalls: [], responseText: null, refused: false };
    setTurns((prev) => [...prev, turn]);
    setInput("");

    function update(patch: Partial<ChatTurn> | ((t: ChatTurn) => ChatTurn)) {
      setTurns((prev) =>
        prev.map((t2) =>
          t2.id === turnId ? (typeof patch === "function" ? patch(t2) : { ...t2, ...patch }) : t2,
        ),
      );
    }

    try {
      await streamAgentMessage(token, sessionId, query, (event, data) => {
        if (event === "tool_call") {
          const { tool } = data as { tool: string };
          update((t2) => ({ ...t2, toolCalls: [...t2.toolCalls, { tool, status: "running" }] }));
        } else if (event === "tool_result") {
          const { tool, row_count, latency_ms } = data as {
            tool: string;
            row_count?: number;
            latency_ms: number;
          };
          update((t2) => ({
            ...t2,
            toolCalls: t2.toolCalls.map((c) =>
              c.tool === tool && c.status === "running"
                ? { ...c, status: "done", rowCount: row_count, latencyMs: latency_ms }
                : c,
            ),
          }));
        } else if (event === "token") {
          const { text } = data as { text: string };
          update({ responseText: text });
        } else if (event === "done") {
          const { refused } = data as { refused: boolean };
          update({ refused });
        }
      });
    } finally {
      setSending(false);
    }
  }

  const starters = [t("officer.starter1"), t("officer.starter2"), t("officer.starter3")];

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold text-gray-900">{t("officer.chatTitle")}</h2>

      {turns.length === 0 && (
        <div className="flex flex-col gap-2">
          {starters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <p className="self-end rounded-lg bg-blue-700 px-3 py-2 text-sm text-white">{turn.query}</p>
            {turn.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {turn.toolCalls.map((chip, i) => (
                  <ToolCallChipView key={i} chip={chip} />
                ))}
              </div>
            )}
            {turn.refused ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="mb-1 font-medium">{t("officer.refusalTitle")}</p>
                <p>{turn.responseText}</p>
              </div>
            ) : (
              turn.responseText && (
                <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900">
                  {turn.responseText}
                </p>
              )
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("officer.chatPlaceholder")}
          className="flex-1 rounded-lg border border-gray-300 p-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {t("officer.send")}
        </button>
      </form>
    </div>
  );
}
