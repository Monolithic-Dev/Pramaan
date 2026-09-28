import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { ApiClientError } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { Badge, Button, Card, Segmented } from "../ui/kit.js";

const CHANNELS: { key: string; icon: IconName; tone: "blue" | "green" | "violet" | "amber" }[] = [
  { key: "web", icon: "globe", tone: "blue" },
  { key: "voice", icon: "mic", tone: "violet" },
  { key: "whatsapp", icon: "message", tone: "green" },
  { key: "sms", icon: "phone", tone: "amber" },
];

type Bubble = { from: "me" | "bot"; text: string; code?: string };

/**
 * A live phone: messages go through the same handler as the real WhatsApp/SMS webhooks, so a report sent
 * here gets a real tracking code and "STATUS <code>" answers from real data. If the server has the
 * simulator switched off, it shows the scripted conversation instead.
 */
function PhoneSimulator() {
  const { t, countryCode } = useLanguage();
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [draft, setDraft] = useState("");
  const [where, setWhere] = useState("Connaught Place, New Delhi");
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([{ from: "bot", text: t("sim.welcome") }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [bubbles]);

  async function send(text: string) {
    const body = text.trim();
    if (body.length < 3 || sending) return;
    setDraft("");
    setBubbles((b) => [...b, { from: "me", text: body }]);
    setSending(true);
    try {
      const r = await api.demoMessage({ channel, text: body, location_text: where.trim() || undefined, country_code: countryCode });
      if (r.kind === "report") setLastCode(r.tracking_code);
      setBubbles((b) => [...b, { from: "bot", text: r.reply, code: r.kind === "report" ? r.tracking_code : undefined }]);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) setOffline(true);
      else setBubbles((b) => [...b, { from: "bot", text: err instanceof ApiClientError && err.status === 429 ? t("sim.rate") : t("sim.error") }]);
    } finally {
      setSending(false);
    }
  }

  const wa = channel === "whatsapp";
  const suggestions = [t("sim.example.report"), `STATUS ${lastCode ?? "PR-K7M3P9QD"}`];

  if (offline) return <ScriptedPhone />;
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge tone="green"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{t("sim.live")}</Badge>
        <Segmented value={channel} onChange={setChannel} options={[{ value: "whatsapp" as const, label: "WhatsApp" }, { value: "sms" as const, label: "SMS" }]} />
      </div>
      <div className={`overflow-hidden rounded-[2rem] border-8 border-slate-900 shadow-lift ${wa ? "bg-[#e6ddd4]" : "bg-slate-100"}`}>
        <div className={`flex items-center gap-3 px-4 py-3 text-white ${wa ? "bg-[#075e54]" : "bg-slate-800"}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"><Icon name={wa ? "message" : "phone"} size={18} /></span>
          <div><p className="text-sm font-semibold">Pramaan</p><p className="text-[11px] text-white/70">{wa ? t("ch.demo.online") : "+91 1800-PRAMAAN"}</p></div>
        </div>
        <div className="h-80 space-y-2 overflow-y-auto p-3 text-[13px]" aria-live="polite">
          {bubbles.map((b, i) => (
            <div
              key={i}
              className={b.from === "me"
                ? `ml-auto max-w-[80%] rounded-lg rounded-tr-sm px-3 py-2 shadow-sm ${wa ? "bg-[#d9fdd3] text-slate-800" : "bg-brand-600 text-white"}`
                : "max-w-[85%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm"}
            >
              {b.text}
              {b.code && <Link to={`/track/${b.code}`} className="mt-1.5 block font-mono text-xs font-bold tracking-widest text-brand-700 underline">{b.code}</Link>}
            </div>
          ))}
          {sending && <div className="w-14 rounded-lg bg-white px-3 py-2 text-slate-400 shadow-sm">...</div>}
          <div ref={endRef} />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-black/5 bg-white/60 px-3 py-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => void send(s)} disabled={sending} className="truncate rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-400 disabled:opacity-50">{s}</button>
          ))}
        </div>
        <form className="flex items-center gap-2 bg-white px-3 py-2" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={600} placeholder={t("sim.placeholder")} aria-label={t("sim.placeholder")} className="min-w-0 flex-1 rounded-full bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300" />
          <button type="submit" disabled={sending || draft.trim().length < 3} aria-label={t("sim.send")} className={`flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-40 ${wa ? "bg-[#075e54]" : "bg-brand-700"}`}><Icon name="send" size={16} /></button>
        </form>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <Icon name="pin" size={13} />{t("sim.where")}
        <input value={where} onChange={(e) => setWhere(e.target.value)} maxLength={120} className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs" />
      </label>
      <p className="mt-2 text-xs text-slate-500">{t("sim.note")}</p>
    </div>
  );
}

/** What a citizen with no smartphone app sees, when the live simulator is not enabled on this server. */
function ScriptedPhone() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-[#e6ddd4] shadow-lift">
        <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"><Icon name="message" size={18} /></span>
          <div><p className="text-sm font-semibold">Pramaan</p><p className="text-[11px] text-white/70">{t("ch.demo.online")}</p></div>
        </div>
        <div className="space-y-2 p-3 text-[13px]">
          <div className="ml-auto max-w-[80%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-800 shadow-sm">{t("ch.demo.user")}</div>
          <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
            {t("ch.demo.reply1")}
            <p className="mt-1.5 font-mono text-xs font-bold tracking-widest text-brand-700">PR-K7M3P9QD</p>
          </div>
          <div className="ml-auto max-w-[70%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-800 shadow-sm">{t("ch.demo.user2")}</div>
          <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">{t("ch.demo.reply2")}</div>
        </div>
      </div>
    </div>
  );
}

/** One report pipeline, four ways in: a smartphone, a microphone, a chat app or a basic phone. */
export default function Channels() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("ch.title")}</h1>
        <p className="mt-2 text-slate-600">{t("ch.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHANNELS.map((c) => (
          <Card key={c.key} className="fade-up">
            <Badge tone={c.tone}><Icon name={c.icon} size={13} />{t(`ch.${c.key}.tag`)}</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-900">{t(`ch.${c.key}.title`)}</h2>
            <p className="mt-1 text-sm text-slate-600">{t(`ch.${c.key}.body`)}</p>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid items-center gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t("ch.flow.title")}</h2>
          <ol className="mt-5 space-y-4">
            {["ch.flow.1", "ch.flow.2", "ch.flow.3", "ch.flow.4"].map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                <p className="text-slate-700">{t(k)}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/report"><Button icon="plus">{t("nav.report")}</Button></Link>
            <Link to="/track"><Button variant="secondary" icon="search">{t("nav.track")}</Button></Link>
          </div>
        </div>

        <PhoneSimulator />
      </div>

      <Card className="mt-10 !bg-slate-900 text-slate-100">
        <div className="flex items-center gap-2 text-sm font-semibold"><Icon name="code" size={16} />{t("ch.webhook.title")}</div>
        <p className="mt-1 text-sm text-slate-400">{t("ch.webhook.body")}</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed">{`POST /v1/webhooks/whatsapp        (or /v1/webhooks/sms)
x-webhook-secret: <shared secret>

{
  "from": "+91XXXXXXXXXX",
  "message_id": "wamid.HBgL...",
  "text": "Broken streetlight near the school",
  "location_text": "Gandhi Nagar, Delhi"
}

202 Accepted  ->  { "submission_id": "sub_...", "tracking_code": "PR-K7M3P9QD",
                   "reply": "Pramaan: thank you, your report is recorded. ..." }

{ "text": "STATUS PR-K7M3P9QD" }
200 OK        ->  { "kind": "status", "stage": "verified", "reply": "Pramaan PR-K7M3P9QD: ..." }`}</pre>
      </Card>
    </div>
  );
}
