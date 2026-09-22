import { Link } from "react-router-dom";
import { api } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { Badge, Button, Card, SampleDataBadge, Skeleton, useAsync } from "../ui/kit.js";

function LiveStats() {
  const { t } = useLanguage();
  const { data, loading } = useAsync(() => api.publicOverview().catch(() => null), []);
  const totals = data?.status === "ok" ? data.totals : null;

  const cells: { label: string; value: string; icon: IconName }[] = [
    { label: t("landing.stat.issues"), value: totals ? totals.issues.toLocaleString() : "-", icon: "flag" },
    { label: t("landing.stat.reports"), value: totals ? totals.reports.toLocaleString() : "-", icon: "users" },
    { label: t("landing.stat.states"), value: data?.states ? String(data.states) : "-", icon: "globe" },
    { label: t("landing.stat.resolved"), value: totals ? `${totals.resolution_rate}%` : "-", icon: "checkCircle" },
  ];

  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lift backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          {t("landing.live")}
        </p>
        {totals?.sample_data && <SampleDataBadge label={t("badge.sample")} />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white/10 p-4">
            <Icon name={c.icon} size={18} className="text-saffron-400" />
            {loading ? <Skeleton className="mt-2 h-7 w-16 !bg-white/20" /> : <p className="mt-2 text-3xl font-bold text-white">{c.value}</p>}
            <p className="text-xs text-brand-100">{c.label}</p>
          </div>
        ))}
      </div>
      {!loading && !totals && <p className="mt-3 text-xs text-brand-200">{t("landing.liveEmpty")}</p>}
    </div>
  );
}

const STEPS: { icon: IconName; key: string }[] = [
  { icon: "mic", key: "landing.step1" },
  { icon: "sparkles", key: "landing.step2" },
  { icon: "scale", key: "landing.step3" },
  { icon: "checkCircle", key: "landing.step4" },
];

const AUDIENCES: { icon: IconName; key: string; to: string; cta: string }[] = [
  { icon: "users", key: "landing.aud.citizen", to: "/report", cta: "landing.aud.citizenCta" },
  { icon: "building", key: "landing.aud.officer", to: "/login?as=officer", cta: "landing.aud.officerCta" },
  { icon: "eye", key: "landing.aud.public", to: "/transparency", cta: "landing.aud.publicCta" },
];

const FEATURES: { icon: IconName; key: string }[] = [
  { icon: "language", key: "landing.f.languages" },
  { icon: "mic", key: "landing.f.voice" },
  { icon: "camera", key: "landing.f.vision" },
  { icon: "layers", key: "landing.f.dedup" },
  { icon: "trend", key: "landing.f.forecast" },
  { icon: "scale", key: "landing.f.equity" },
  { icon: "bot", key: "landing.f.copilot" },
  { icon: "shield", key: "landing.f.privacy" },
];

export default function Landing() {
  const { t } = useLanguage();

  return (
    <div>
      {/* Hero */}
      <section className="hero-grid relative overflow-hidden text-white">
        <div className="dotted absolute inset-0 opacity-20" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div className="fade-up">
            <Badge tone="saffron" className="mb-5">
              <Icon name="sparkles" size={12} />
              {t("landing.badge")}
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.title1")} <span className="text-saffron-400">{t("landing.title2")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">{t("landing.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/report">
                <Button size="lg" variant="accent" icon="plus">
                  {t("landing.cta.report")}
                </Button>
              </Link>
              <Link to="/login?as=officer">
                <Button size="lg" variant="secondary" className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20">
                  {t("landing.cta.officer")}
                </Button>
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100">
              {["landing.trust1", "landing.trust2", "landing.trust3"].map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Icon name="checkCircle" size={16} className="text-emerald-400" />
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
          <div className="fade-up" style={{ animationDelay: "0.1s" }}>
            <LiveStats />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t("landing.problem.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{t("landing.problem.title")}</h2>
            <p className="mt-4 text-slate-600">{t("landing.problem.body")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["landing.gap1.title", "landing.gap1.body", "layers"],
              ["landing.gap2.title", "landing.gap2.body", "scale"],
              ["landing.gap3.title", "landing.gap3.body", "eye"],
            ].map(([title, body, icon]) => (
              <Card key={title}>
                <span className="inline-flex rounded-xl bg-rose-50 p-2.5 text-rose-600">
                  <Icon name={icon as IconName} />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{t(title)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(body)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t("landing.how.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{t("landing.how.title")}</h2>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.key} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <span className="absolute -top-3 left-5 rounded-full bg-brand-700 px-2.5 py-0.5 text-xs font-bold text-white">{i + 1}</span>
                <span className="inline-flex rounded-xl bg-white p-3 text-brand-700 shadow-card">
                  <Icon name={s.icon} size={24} />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{t(`${s.key}.title`)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(`${s.key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Explainable score */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{t("landing.score.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{t("landing.score.title")}</h2>
            <p className="mt-4 text-slate-600">{t("landing.score.body")}</p>
            <Link to="/transparency" className="mt-5 inline-flex items-center gap-2 font-semibold text-brand-700 hover:text-brand-900">
              {t("landing.score.cta")} <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <Card className="!p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("landing.score.formula")}</p>
            <div className="mt-4 space-y-4">
              {[
                ["score.demand", 0.4, "#244ebc"],
                ["score.vulnerability", 0.3, "#7c3aed"],
                ["score.gap", 0.3, "#ea7d0f"],
              ].map(([k, w, c]) => (
                <div key={k as string}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{t(k as string)}</span>
                    <span className="tabular-nums text-slate-500">{Math.round((w as number) * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(w as number) * 250}%`, maxWidth: "100%", background: c as string }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">score = (0.40 x demand + 0.30 x vulnerability + 0.30 x gap) x duplication x efficacy</p>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="bg-brand-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-saffron-400">{t("landing.features.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("landing.features.title")}</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.key} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                <Icon name={f.icon} size={24} className="text-saffron-400" />
                <h3 className="mt-3 font-semibold">{t(`${f.key}.title`)}</h3>
                <p className="mt-1 text-sm text-brand-100">{t(`${f.key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">{t("landing.aud.title")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <Card key={a.key} className="flex flex-col !p-6">
              <span className="inline-flex w-fit rounded-xl bg-brand-50 p-3 text-brand-700">
                <Icon name={a.icon} size={24} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{t(`${a.key}.title`)}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-600">{t(`${a.key}.body`)}</p>
              <Link to={a.to} className="mt-5">
                <Button variant="secondary" className="w-full">
                  {t(a.cta)}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Scale */}
      <section className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t("landing.scale.title")}</h2>
            <p className="mt-3 text-slate-600">{t("landing.scale.body")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["English", "हिन्दी", "தமிழ்", "Português", "IN-DL", "IN-MH", "IN-KA", "BR-SP"].map((chip) => (
              <Badge key={chip} tone="blue" className="!px-3 !py-1.5 !text-sm">
                {chip}
              </Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
