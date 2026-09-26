import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { Badge, Button, Card } from "../ui/kit.js";

const CHANNELS: { key: string; icon: IconName; tone: "blue" | "green" | "violet" | "amber" }[] = [
  { key: "web", icon: "globe", tone: "blue" },
  { key: "voice", icon: "mic", tone: "violet" },
  { key: "whatsapp", icon: "message", tone: "green" },
  { key: "sms", icon: "phone", tone: "amber" },
];

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

        {/* A static WhatsApp-style conversation: what a citizen with no smartphone app actually sees. */}
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
                <p className="mt-1.5 font-mono text-xs font-bold tracking-widest text-brand-700">JS-K7M3P9QD</p>
              </div>
              <div className="ml-auto max-w-[70%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-800 shadow-sm">{t("ch.demo.user2")}</div>
              <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">{t("ch.demo.reply2")}</div>
            </div>
          </div>
        </div>
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

202 Accepted  ->  { "submission_id": "sub_...", "tracking_code": "JS-K7M3P9QD" }`}</pre>
      </Card>
    </div>
  );
}
