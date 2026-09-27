import { useState } from "react";
import { api, type NeedVsSpend as NeedVsSpendData, type NeedVsSpendRow, type Quadrant } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader, Segmented, Skeleton, useAsync } from "../../ui/kit.js";
import { compact, money } from "../../ui/format.js";

const QUADRANT_COLOR: Record<Quadrant, string> = { underserved: "#e11d48", targeted: "#138808", over_indexed: "#f59e0b", stable: "#94a3b8" };
const QUADRANTS: Quadrant[] = ["underserved", "targeted", "over_indexed", "stable"];

/** Officer view: every district in scope placed by need (reports + deprivation) against money spent. */
export default function NeedVsSpend() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const { data, loading, error } = useAsync(() => api.needVsSpend(regionId), [regionId]);
  return (
    <div>
      <PageHeader eyebrow={regionName} title={t("nvs.title")} subtitle={t("nvs.subtitle")} />
      {error && <Alert tone="error">{error.message}</Alert>}
      {loading || !data ? <Skeleton className="h-96" /> : <NeedVsSpendView data={data} />}
    </div>
  );
}

export function NeedVsSpendView({ data }: { data: NeedVsSpendData }) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Quadrant | "all">("underserved");
  const [selected, setSelected] = useState<string | null>(null);

  if (data.districts.length === 0) return <Card><EmptyState icon="scale" title={t("console.noData.title")} body={t("console.noData.body")} /></Card>;

  const rows = data.districts.filter((d) => filter === "all" || d.quadrant === filter);
  const picked = data.districts.find((d) => d.region_id === selected) ?? null;
  const verdictTone = data.verdict === "aligned" ? "text-emerald-300" : data.verdict === "partly_aligned" ? "text-amber-300" : "text-rose-300";

  return (
    <>
      <section className="hero-grid mb-6 overflow-hidden rounded-2xl p-6 text-white sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-saffron-400">{t("nvs.hero.eyebrow")}</p>
            <p className={`mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl ${verdictTone}`}>{t(`nvs.verdict.${data.verdict}`)}</p>
            <p className="mt-3 max-w-xl text-brand-100">
              {t("nvs.hero.body", { n: data.quadrants.underserved, pop: compact(data.underserved_population), waiting: data.underserved_people_waiting })}
            </p>
            <p className="mt-3 text-xs text-brand-200/80">{t("nvs.hero.caveat", { fy: data.fiscal_years_from })}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUADRANTS.map((q) => (
              <div key={q} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="flex items-center gap-1.5 text-xs font-medium text-brand-100"><span className="h-2.5 w-2.5 rounded-full" style={{ background: QUADRANT_COLOR[q] }} />{t(`nvs.q.${q}`)}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{data.quadrants[q]}</p>
              </div>
            ))}
            <p className="col-span-2 text-xs text-brand-200">{t("nvs.corr", { r: data.alignment === null ? "-" : data.alignment.toFixed(2) })}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle title={t("nvs.chart.title")} subtitle={t("nvs.chart.sub")} icon="scale" />
          <Scatter rows={data.districts} selected={selected} onSelect={setSelected} />
          {picked && <DistrictDetail row={picked} />}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="px-5 pt-5">
            <CardTitle title={t("nvs.list.title")} subtitle={t("nvs.list.sub")} icon="list" />
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[{ value: "all" as const, label: t("nvs.all") }, ...QUADRANTS.map((q) => ({ value: q, label: t(`nvs.q.${q}`) }))]}
              className="mb-3 max-w-full overflow-x-auto"
            />
          </div>
          <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
            {rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">{t("console.empty")}</li>}
            {rows.map((d) => (
              <li key={d.region_id}>
                <button type="button" onClick={() => setSelected(d.region_id)} className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50 ${selected === d.region_id ? "bg-brand-50" : ""}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: QUADRANT_COLOR[d.quadrant] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{d.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {d.state_name ?? d.country_code} · {d.investment > 0 ? money(d.investment, d.currency as "INR" | "BRL") : t("nvs.noSpend")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold tabular-nums text-slate-900">{Math.round(d.need_index * 100)}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">{t("nvs.need")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle title={t("nvs.how.title")} icon="info" />
        <p className="text-sm leading-relaxed text-slate-600">{t("nvs.how.body")}</p>
      </Card>
    </>
  );
}

function Scatter({ rows, selected, onSelect }: { rows: NeedVsSpendRow[]; selected: string | null; onSelect: (id: string) => void }) {
  const { t } = useLanguage();
  const W = 520;
  const H = 360;
  const P = 36;
  const x = (v: number) => P + v * (W - 2 * P);
  const y = (v: number) => H - P - v * (H - 2 * P);
  const maxPop = Math.max(1, ...rows.map((r) => r.population));
  const r = (pop: number) => 4 + 10 * Math.sqrt(pop / maxPop);
  const corner = (q: Quadrant, cx: number, cy: number, anchor: "start" | "end") => (
    <text x={cx} y={cy} textAnchor={anchor} className="text-[11px] font-semibold" fill={QUADRANT_COLOR[q]}>{t(`nvs.q.${q}`)}</text>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("nvs.chart.title")}>
      <rect x={x(0.5)} y={y(0.5)} width={x(1) - x(0.5)} height={y(0) - y(0.5)} fill="#e11d48" opacity={0.06} />
      <line x1={x(0.5)} x2={x(0.5)} y1={y(0)} y2={y(1)} stroke="#cbd5e1" strokeDasharray="4 4" />
      <line x1={x(0)} x2={x(1)} y1={y(0.5)} y2={y(0.5)} stroke="#cbd5e1" strokeDasharray="4 4" />
      <line x1={x(0)} x2={x(1)} y1={y(0)} y2={y(1)} stroke="#e2e8f0" />
      {corner("underserved", x(1) - 4, y(0) - 6, "end")}
      {corner("targeted", x(1) - 4, y(1) + 14, "end")}
      {corner("over_indexed", x(0) + 4, y(1) + 14, "start")}
      {corner("stable", x(0) + 4, y(0) - 6, "start")}
      <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">{t("nvs.axis.need")}</text>
      <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`} className="fill-slate-500 text-[11px]">{t("nvs.axis.spend")}</text>
      {rows.map((d) => (
        <circle
          key={d.region_id}
          cx={x(d.need_index)}
          cy={y(d.spend_index)}
          r={r(d.population)}
          fill={QUADRANT_COLOR[d.quadrant]}
          fillOpacity={selected === d.region_id ? 0.95 : 0.6}
          stroke={selected === d.region_id ? "#0f172a" : "white"}
          strokeWidth={selected === d.region_id ? 2 : 1}
          className="cursor-pointer transition"
          onClick={() => onSelect(d.region_id)}
        >
          <title>{`${d.name}: ${t("nvs.need")} ${Math.round(d.need_index * 100)}, ${t("nvs.spend")} ${Math.round(d.spend_index * 100)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function DistrictDetail({ row: d }: { row: NeedVsSpendRow }) {
  const { t } = useLanguage();
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-900">{d.name}<span className="ml-2 font-normal text-slate-500">{d.state_name}</span></p>
        <Badge tone={d.quadrant === "underserved" ? "red" : d.quadrant === "targeted" ? "green" : d.quadrant === "over_indexed" ? "amber" : "slate"}>{t(`nvs.q.${d.quadrant}`)}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Fact label={t("nvs.f.vuln")} value={d.vulnerability === null ? "-" : `${Math.round(d.vulnerability * 100)}/100`} />
        <Fact label={t("nvs.f.waiting")} value={d.waiting_reporters === null ? t("nvs.withheld") : String(d.waiting_reporters)} />
        <Fact label={t("nvs.f.spend")} value={d.investment > 0 ? money(d.investment, d.currency as "INR" | "BRL") : t("nvs.noSpend")} />
        <Fact label={t("nvs.f.pop")} value={compact(d.population)} />
      </dl>
      {d.top_unmet_categories.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <Icon name="alert" size={13} className="text-rose-600" />
          {t("nvs.f.unmet")}
          {d.top_unmet_categories.map((c) => <Badge key={c.category}>{t(`category.${c.category}`)} · {c.reporters}</Badge>)}
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
