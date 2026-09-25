import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type OptimizeResult, type PlanItem, type SavedPlan, type WeightRow } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { Alert, Badge, Button, Card, CardTitle, EmptyState, Field, Input, Modal, PageHeader, Segmented, Skeleton, timeAgo, useAsync, useToast } from "../../ui/kit.js";
import { compact, fullNumber, money } from "../../ui/format.js";
import { Meter, priorityColor } from "../../ui/charts.js";

type Tab = "optimize" | "weights" | "plans";

const PRESETS = [1_000_000, 5_000_000, 10_000_000, 50_000_000];

export default function Planner() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("optimize");
  return (
    <div>
      <PageHeader title={t("planner.title")} subtitle={t("planner.subtitle")} />
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: "optimize", label: t("planner.tab.optimize") },
          { value: "weights", label: t("planner.tab.weights") },
          { value: "plans", label: t("planner.tab.plans") },
        ]}
      />
      {tab === "optimize" && <Optimizer onSaved={() => setTab("plans")} />}
      {tab === "weights" && <WeightsLab />}
      {tab === "plans" && <Plans />}
    </div>
  );
}

// ---- Optimiser ----------------------------------------------------------------------------------------

function Optimizer({ onSaved }: { onSaved: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { regionId, regionName } = useScope();
  const [budget, setBudget] = useState(10_000_000);
  const [share, setShare] = useState(30);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const touched = useRef(false);
  const seq = useRef(0);

  // Live: every change re-runs the optimiser after a short pause, so the sliders feel like a what-if instrument.
  useEffect(() => {
    const mine = ++seq.current;
    setBusy(true);
    const timer = setTimeout(() => {
      api
        .optimize({ region: regionId, budget_inr: budget, min_vulnerable_share: share / 100 })
        .then((r) => {
          if (mine !== seq.current) return;
          setResult(r);
          setError(null);
          // First load: a budget that covers everything teaches nothing. Start at ~40% of the total need so the
          // optimiser has real trade-offs to make; any later change by the user is respected.
          if (!touched.current && r.candidates > 1 && r.plan.items.length === r.candidates) {
            touched.current = true;
            setBudget(Math.max(100_000, Math.round((r.candidates_cost_inr * 0.4) / 100_000) * 100_000));
          }
        })
        .catch((e: Error) => mine === seq.current && setError(e.message))
        .finally(() => mine === seq.current && setBusy(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [budget, share, regionId]);

  async function save() {
    setSaving(true);
    try {
      await api.savePlan({ region: regionId, budget_inr: budget, min_vulnerable_share: share / 100, name });
      toast("success", t("planner.saved"));
      setSaveOpen(false);
      setName("");
      onSaved();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : t("report.errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  const plan = result?.plan;
  const base = result?.baseline;
  const uplift = plan && base && base.beneficiaries > 0 ? Math.round(((plan.beneficiaries - base.beneficiaries) / base.beneficiaries) * 100) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit lg:sticky lg:top-20">
        <CardTitle title={t("planner.inputs")} subtitle={regionName} icon="sliders" />
        <Field label={t("planner.budget")} htmlFor="budget" hint={t("planner.budgetHint")}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
            <Input id="budget" type="number" min={100000} step={100000} value={budget} onChange={(e) => { touched.current = true; setBudget(Math.max(100_000, Number(e.target.value) || 0)); }} className="pl-7" />
          </div>
        </Field>
        <p className="mt-1 text-sm font-semibold text-brand-700">= {money(budget)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => { touched.current = true; setBudget(p); }} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${budget === p ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-700 ring-slate-300 hover:ring-brand-400"}`}>
              {money(p)}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <label htmlFor="share" className="text-sm font-medium text-slate-800">{t("planner.equity")}</label>
            <span className="text-lg font-bold text-brand-700">{share}%</span>
          </div>
          <input id="share" type="range" min={0} max={80} step={5} value={share} onChange={(e) => setShare(Number(e.target.value))} className="mt-2 w-full accent-brand-700" />
          <p className="mt-1 text-xs text-slate-500">{t("planner.equityHint")}</p>
        </div>

        <Alert tone="info">
          <span className="text-xs">{t("planner.method")}</span>
        </Alert>
        <Button className="mt-4 w-full" icon="folder" disabled={!plan || plan.items.length === 0} onClick={() => setSaveOpen(true)}>
          {t("planner.saveAsPlan")}
        </Button>
      </Card>

      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {!result && !error && (
          <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        )}
        {result && plan && base && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="fade-up">
                <p className="text-sm font-medium text-slate-500">{t("planner.reach")}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{compact(plan.beneficiaries)}</p>
                <p className="mt-1 text-xs text-slate-500">{t("planner.peopleReached")}</p>
                {uplift !== null && (
                  <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${uplift >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    <Icon name="trend" size={12} /> {t("planner.vsBaseline", { pct: `${uplift >= 0 ? "+" : ""}${uplift}` })}
                  </p>
                )}
              </Card>
              <Card className="fade-up">
                <p className="text-sm font-medium text-slate-500">{t("planner.spend")}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{money(plan.cost_inr)}</p>
                <p className="mt-1 text-xs text-slate-500">{t("planner.ofBudget", { budget: money(budget), left: money(result.remaining_inr) })}</p>
                <Meter value={budget ? plan.cost_inr / budget : 0} className="mt-3" />
              </Card>
              <Card className="fade-up">
                <p className="text-sm font-medium text-slate-500">{t("planner.vulnerableShare")}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{Math.round(plan.vulnerable_share * 100)}%</p>
                <p className="mt-1 text-xs text-slate-500">{t("planner.vulnerableHint")}</p>
                <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${result.equity_floor_met ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  <Icon name={result.equity_floor_met ? "checkCircle" : "alert"} size={12} />
                  {t(result.equity_floor_met ? "planner.floorMet" : "planner.floorNotMet", { pct: share })}
                </p>
              </Card>
            </div>

            {plan.items.length === result.candidates && result.candidates > 0 && <Alert tone="info">{t("planner.coversAll", { n: result.candidates })}</Alert>}

            <Card>
              <CardTitle title={t("planner.compare")} subtitle={t("planner.compareSub")} icon="scale" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Compare label={t("planner.ours")} tone="brand" o={plan} />
                <Compare label={t("planner.naive")} tone="slate" o={base} />
              </div>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="px-5 pt-5">
                <CardTitle title={t("planner.portfolio", { count: plan.items.length })} subtitle={t("planner.portfolioSub", { n: result.candidates })} icon="list" />
              </div>
              {plan.items.length === 0 ? (
                <EmptyState icon="inbox" title={t("planner.none.title")} body={t("planner.none.body")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <tr><th className="px-5 py-3">{t("console.col.issue")}</th><th className="px-3 py-3">{t("planner.col.score")}</th><th className="px-3 py-3 text-right">{t("planner.col.reach")}</th><th className="px-3 py-3 text-right">{t("planner.col.cost")}</th><th className="px-3 py-3">{t("planner.col.vulnerable")}</th></tr>
                    </thead>
                    <tbody>
                      {plan.items.map((i) => <PlanRow key={i.issue_id} item={i} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {result.left_out.length > 0 && (
              <Card>
                <CardTitle title={t("planner.leftOut")} subtitle={t("planner.leftOutSub")} icon="info" />
                <ul className="divide-y divide-slate-100">
                  {result.left_out.slice(0, 5).map((i) => (
                    <li key={i.issue_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Link to={`/console/issues/${i.issue_id}`} className="flex min-w-0 items-center gap-2 hover:text-brand-700">
                        <CategoryIcon category={i.category} />
                        <span className="truncate">{i.description}</span>
                      </Link>
                      <span className="shrink-0 tabular-nums text-slate-500">{money(i.cost_inr)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
        {busy && result && <p className="text-center text-xs text-slate-400">{t("planner.recomputing")}</p>}
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={t("planner.saveAsPlan")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>{t("common.cancel")}</Button>
            <Button loading={saving} disabled={name.trim().length < 2} onClick={save}>{t("planner.savePlan")}</Button>
          </>
        }
      >
        <Field label={t("planner.planName")} htmlFor="plan-name" hint={t("planner.planNameHint")}>
          <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("planner.planNamePlaceholder")} autoFocus />
        </Field>
      </Modal>
    </div>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
  return (
    <span className={`rounded-lg p-1.5 ${meta.bg} ${meta.tone}`}>
      <Icon name={meta.icon} size={14} />
    </span>
  );
}

function PlanRow({ item }: { item: PlanItem }) {
  const { t } = useLanguage();
  return (
    <tr className="border-t border-slate-100">
      <td className="px-5 py-3">
        <Link to={`/console/issues/${item.issue_id}`} className="flex items-center gap-3 hover:text-brand-700">
          <CategoryIcon category={item.category} />
          <span className="min-w-0">
            <span className="block max-w-md truncate font-medium text-slate-900">{item.description ?? t(`category.${item.category}`)}</span>
            <span className="block text-xs text-slate-500">{t(`category.${item.category}`)} · {item.region_name ?? "-"}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-3"><span className="text-sm font-semibold" style={{ color: priorityColor(item.composite_score) }}>{item.composite_score.toFixed(2)}</span></td>
      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{compact(item.beneficiaries)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-medium text-slate-900">{money(item.cost_inr)}</td>
      <td className="px-3 py-3">{item.vulnerability_score >= 0.66 ? <Badge tone="violet">{t("planner.high")}</Badge> : <span className="text-slate-300">-</span>}</td>
    </tr>
  );
}

function Compare({ label, tone, o }: { label: string; tone: "brand" | "slate"; o: { beneficiaries: number; cost_inr: number; vulnerable_share: number; avg_score: number; items: unknown[] } }) {
  const { t } = useLanguage();
  const color = tone === "brand" ? "#1d3f97" : "#94a3b8";
  return (
    <div className={`rounded-xl border p-4 ${tone === "brand" ? "border-brand-200 bg-brand-50/50" : "border-slate-200"}`}>
      <p className="mb-3 text-sm font-semibold text-slate-900">{label}</p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-slate-600">{t("planner.peopleReached")}</dt><dd className="font-semibold tabular-nums">{fullNumber(o.beneficiaries)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">{t("planner.issuesFunded")}</dt><dd className="font-semibold tabular-nums">{o.items.length}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-600">{t("planner.avgScore")}</dt><dd className="font-semibold tabular-nums">{o.avg_score.toFixed(2)}</dd></div>
        <div>
          <div className="mb-1 flex justify-between"><dt className="text-slate-600">{t("planner.vulnerableShare")}</dt><dd className="font-semibold tabular-nums">{Math.round(o.vulnerable_share * 100)}%</dd></div>
          <Meter value={o.vulnerable_share} color={color} />
        </div>
      </dl>
    </div>
  );
}

// ---- Weights lab ---------------------------------------------------------------------------------------

function WeightsLab() {
  const { t } = useLanguage();
  const { regionId } = useScope();
  const [w, setW] = useState({ demand: 40, vulnerability: 30, gap: 30 });
  const [rows, setRows] = useState<WeightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .simulateWeights({ region: regionId, ...w })
        .then((r) => mine === seq.current && (setRows(r.ranking), setError(null)))
        .catch((e: Error) => mine === seq.current && setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [w, regionId]);

  const total = w.demand + w.vulnerability + w.gap || 1;
  const sliders: { key: keyof typeof w; label: string; color: string }[] = [
    { key: "demand", label: t("planner.w.demand"), color: "accent-blue-700" },
    { key: "vulnerability", label: t("planner.w.vulnerability"), color: "accent-violet-600" },
    { key: "gap", label: t("planner.w.gap"), color: "accent-amber-600" },
  ];
  const reset = () => setW({ demand: 40, vulnerability: 30, gap: 30 });

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit">
        <CardTitle title={t("planner.w.title")} subtitle={t("planner.w.sub")} icon="sliders" />
        <div className="space-y-5">
          {sliders.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={`w-${s.key}`} className="text-sm font-medium text-slate-800">{s.label}</label>
                <span className="text-sm font-bold tabular-nums text-slate-900">{Math.round((w[s.key] / total) * 100)}%</span>
              </div>
              <input id={`w-${s.key}`} type="range" min={0} max={100} value={w[s.key]} onChange={(e) => setW({ ...w, [s.key]: Number(e.target.value) })} className={`mt-1 w-full ${s.color}`} />
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon="refresh" className="mt-5" onClick={reset}>{t("planner.w.reset")}</Button>
        <p className="mt-4 text-xs text-slate-500">{t("planner.w.note")}</p>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="px-5 pt-5"><CardTitle title={t("planner.w.ranking")} subtitle={t("planner.w.rankingSub")} icon="list" /></div>
        {error && <div className="px-5 pb-5"><Alert tone="error">{error}</Alert></div>}
        {!rows && !error && <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {rows && rows.length === 0 && <EmptyState icon="inbox" title={t("planner.none.title")} />}
        {rows && rows.length > 0 && (
          <ul>
            {rows.map((r) => (
              <li key={r.issue_id} className="flex items-center gap-4 border-t border-slate-100 px-5 py-3 transition hover:bg-slate-50">
                <span className="w-6 text-center text-lg font-bold text-slate-400">{r.rank}</span>
                <Link to={`/console/issues/${r.issue_id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-brand-700">
                  <CategoryIcon category={r.category} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{t(`category.${r.category}`)}</span>
                    <span className="block truncate text-xs text-slate-500">{r.region_name ?? "-"}</span>
                  </span>
                </Link>
                <Move by={r.moved} />
                <span className="w-24 text-right">
                  <span className="block text-sm font-bold tabular-nums" style={{ color: priorityColor(r.simulated) }}>{r.simulated.toFixed(2)}</span>
                  <span className="block text-[11px] text-slate-400">{t("planner.w.was", { score: r.current.toFixed(2) })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Move({ by }: { by: number }) {
  if (by === 0) return <span className="w-12 text-center text-xs text-slate-300">-</span>;
  const up = by > 0;
  return (
    <span className={`inline-flex w-12 items-center justify-center gap-0.5 text-xs font-bold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(by)}
    </span>
  );
}

// ---- Saved plans -----------------------------------------------------------------------------------------

function Plans() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data, loading, refetch } = useAsync(() => api.plans(), []);
  const [confirm, setConfirm] = useState<SavedPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const plans = data?.plans ?? [];
  const totalIssues = useMemo(() => confirm?.items.length ?? 0, [confirm]);

  async function approve() {
    if (!confirm) return;
    setBusy(true);
    try {
      const r = await api.approvePlan(confirm.plan_id);
      toast("success", t("planner.approved", { n: r.funded }));
      setConfirm(null);
      refetch();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (plans.length === 0) return <Card><EmptyState icon="folder" title={t("planner.plans.empty.title")} body={t("planner.plans.empty.body")} /></Card>;

  return (
    <div className="space-y-4">
      {plans.map((p) => (
        <Card key={p.plan_id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                <Badge tone={p.status === "approved" ? "green" : "amber"}>{t(`planner.status.${p.status}`)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{t("planner.createdAgo", { when: timeAgo(p.created_at) })}</p>
            </div>
            {p.status === "draft" ? (
              <Button icon="checkCircle" onClick={() => setConfirm(p)}>{t("planner.approveFund")}</Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Icon name="checkCircle" size={16} /> {t("planner.fundedOn", { when: p.approved_at ? timeAgo(p.approved_at) : "" })}</span>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label={t("planner.plans.budget")} value={money(p.params.budget_inr)} />
            <Fact label={t("planner.spend")} value={money(p.totals.cost_inr)} />
            <Fact label={t("planner.peopleReached")} value={compact(p.totals.beneficiaries)} />
            <Fact label={t("planner.plans.issues")} value={String(p.totals.issues)} />
          </dl>
          <button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline" onClick={() => setOpen(open === p.plan_id ? null : p.plan_id)}>
            {open === p.plan_id ? t("planner.plans.hide") : t("planner.plans.show")}
            <Icon name="chevronDown" size={14} className={open === p.plan_id ? "rotate-180" : ""} />
          </button>
          {open === p.plan_id && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {p.items.map((i) => (
                <li key={i.issue_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <Link to={`/console/issues/${i.issue_id}`} className="flex min-w-0 items-center gap-2 hover:text-brand-700">
                    <CategoryIcon category={i.category} />
                    <span className="truncate">{t(`category.${i.category}`)}</span>
                  </Link>
                  <span className="shrink-0 tabular-nums text-slate-600">{money(i.cost_inr)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={t("planner.approveFund")}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>{t("common.cancel")}</Button><Button loading={busy} onClick={approve}>{t("planner.confirmApprove")}</Button></>}
      >
        <Alert tone="warn">{t("planner.approveWarning", { n: totalIssues, cost: confirm ? money(confirm.totals.cost_inr) : "" })}</Alert>
      </Modal>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
