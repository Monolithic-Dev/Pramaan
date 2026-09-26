import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { Badge, Button, Card } from "../ui/kit.js";

function Node({ x, y, w, h, title, sub, tone = "slate" }: { x: number; y: number; w: number; h: number; title: string; sub?: string; tone?: "brand" | "saffron" | "green" | "slate" | "violet" }) {
  const fill = { brand: "#eef4ff", saffron: "#fff4e5", green: "#e8f7ec", slate: "#f1f5f9", violet: "#f3eeff" }[tone];
  const stroke = { brand: "#8fb1ff", saffron: "#ffab4d", green: "#7fd08a", slate: "#cbd5e1", violet: "#c4b0ff" }[tone];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="9.5" fill="#475569">{sub}</text>}
    </g>
  );
}

const Arrow = ({ d }: { d: string }) => <path d={d} fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />;

function Architecture() {
  return (
    <svg viewBox="0 0 920 400" className="w-full" role="img" aria-label="Pramaan architecture: citizens, API gateway, AI pipeline, data stores, officer console and public ledger">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#94a3b8" /></marker>
      </defs>
      <text x="55" y="22" fontSize="10" fontWeight="700" fill="#64748b" letterSpacing="1.2">CITIZENS</text>
      <Node x={10} y={34} w={150} h={44} title="Web / PWA" sub="offline queue" tone="brand" />
      <Node x={10} y={90} w={150} h={44} title="Voice" sub="record in any language" tone="brand" />
      <Node x={10} y={146} w={150} h={44} title="WhatsApp" sub="webhook" tone="green" />
      <Node x={10} y={202} w={150} h={44} title="SMS" sub="feature phones" tone="green" />

      <text x="222" y="22" fontSize="10" fontWeight="700" fill="#64748b" letterSpacing="1.2">API GATEWAY</text>
      <rect x="200" y="34" width="170" height="212" rx="12" fill="#ffffff" stroke="#8fb1ff" strokeWidth="1.5" strokeDasharray="4 4" />
      <Node x={214} y={46} w={142} h={38} title="Auth + RBAC" sub="Firebase, 3 roles" tone="brand" />
      <Node x={214} y={92} w={142} h={38} title="Idempotent ingest" sub="rate limit, anti-fraud" tone="brand" />
      <Node x={214} y={138} w={142} h={38} title="Console API" sub="workflow, planner" tone="brand" />
      <Node x={214} y={184} w={142} h={38} title="Public API" sub="k-anonymous" tone="brand" />

      <text x="430" y="22" fontSize="10" fontWeight="700" fill="#64748b" letterSpacing="1.2">AI PIPELINE (GEMINI)</text>
      <rect x="410" y="34" width="190" height="212" rx="12" fill="#ffffff" stroke="#c4b0ff" strokeWidth="1.5" strokeDasharray="4 4" />
      <Node x={424} y={46} w={162} h={38} title="Understand" sub="classify, translate, vision, STT" tone="violet" />
      <Node x={424} y={92} w={162} h={38} title="Deduplicate" sub="embeddings + geohash" tone="violet" />
      <Node x={424} y={138} w={162} h={38} title="Score" sub="demand, vulnerability, gap" tone="violet" />
      <Node x={424} y={184} w={162} h={38} title="Co-pilot + briefing" sub="function calling, grounded" tone="violet" />

      <text x="662" y="22" fontSize="10" fontWeight="700" fill="#64748b" letterSpacing="1.2">DATA</text>
      <Node x={640} y={34} w={150} h={50} title="Firestore" sub="issues, reports, workflow" tone="saffron" />
      <Node x={640} y={96} w={150} h={50} title="Reference data" sub="regions, indices, schemes" tone="saffron" />
      <Node x={640} y={158} w={150} h={50} title="Audit log" sub="every officer action" tone="saffron" />

      <text x="815" y="22" fontSize="10" fontWeight="700" fill="#64748b" letterSpacing="1.2">OUTCOMES</text>
      <Node x={806} y={34} w={106} h={64} title="Officer console" sub="rank, plan, fund" tone="green" />
      <Node x={806} y={110} w={106} h={64} title="Public ledger" sub="scorecards, open data" tone="green" />
      <Node x={806} y={186} w={106} h={60} title="Citizen loop" sub="track, confirm fix" tone="green" />

      <Arrow d="M160 56 H200" /><Arrow d="M160 112 H200" /><Arrow d="M160 168 H200" /><Arrow d="M160 224 H200" />
      <Arrow d="M370 110 H410" /><Arrow d="M600 110 H640" /><Arrow d="M790 59 H806" /><Arrow d="M790 121 H806" /><Arrow d="M790 183 H806" />

      <text x="10" y="284" fontSize="10.5" fontWeight="700" fill="#0f172a">Same code, any country</text>
      <rect x="10" y="292" width="900" height="96" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
      <text x="26" y="316" fontSize="10.5" fill="#334155">A CountryProfile document (admin levels, languages, currency, privacy regime, policy corpus) is the only thing that changes per country.</text>
      <text x="26" y="336" fontSize="10.5" fill="#334155">India and Brazil already run side by side on one deployment. Adding a state is a form; adding a country is a document, not a rewrite.</text>
      <text x="26" y="360" fontSize="10.5" fill="#334155">Stateless services scale to zero on free tiers and to millions of reports on Cloud Run; storage is Firestore + BigQuery.</text>
    </svg>
  );
}

const PILLARS: { icon: IconName; key: string }[] = [
  { icon: "scale", key: "explain" },
  { icon: "shield", key: "ground" },
  { icon: "users", key: "equity" },
  { icon: "lock", key: "privacy" },
  { icon: "language", key: "lang" },
  { icon: "refresh", key: "loop" },
];

const STACK = ["Gemini 3.x (understand, vision, speech, co-pilot)", "Gemini embeddings", "Firebase Auth + Firestore", "Fastify (TypeScript)", "React 19 + Tailwind", "Leaflet + OpenStreetMap", "Render / Cloud Run", "pnpm + Turborepo"];

export default function About() {
  const { t } = useLanguage();
  return (
    <div>
      <section className="hero-grid text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <Badge tone="saffron">{t("about.badge")}</Badge>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{t("about.title")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-brand-100">{t("about.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/report"><Button variant="accent" size="lg" icon="plus">{t("nav.report")}</Button></Link>
            <Link to="/open-data"><Button variant="secondary" size="lg" icon="code">{t("nav.openData")}</Button></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t("about.arch.eyebrow")}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{t("about.arch.title")}</h2>
        <Card className="mt-6 overflow-x-auto"><div className="min-w-[720px]"><Architecture /></div></Card>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900">{t("about.pillars.title")}</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.key} className="rounded-2xl border border-slate-200 p-5">
                <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700"><Icon name={p.icon} size={22} /></span>
                <h3 className="mt-3 font-bold text-slate-900">{t(`about.p.${p.key}.title`)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(`about.p.${p.key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("about.stack.title")}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">{STACK.map((s) => <Badge key={s} tone="slate" className="!text-sm">{s}</Badge>)}</ul>
            <p className="mt-6 text-sm text-slate-600">{t("about.stack.note")}</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("about.road.title")}</h2>
            <ol className="mt-4 space-y-3">
              {["about.road.1", "about.road.2", "about.road.3", "about.road.4"].map((k) => (
                <li key={k} className="flex gap-3 text-sm text-slate-700"><Icon name="arrowRight" size={16} className="mt-0.5 shrink-0 text-saffron-600" />{t(k)}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
