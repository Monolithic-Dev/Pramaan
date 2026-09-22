import { useState, type FormEvent } from "react";
import { api } from "../../api/api.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Alert, Badge, Button, Card, CardTitle, EmptyState, Field, Input, PageHeader, Skeleton, timeAgo, useAsync, useToast } from "../../ui/kit.js";

export default function States() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data, loading, refetch } = useAsync(() => api.states(), []);
  const regions = useAsync(() => api.regions(), []);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addState(id.trim(), name.trim());
      toast("success", t("insights.added"));
      setId("");
      setName("");
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  const states = data?.states ?? [];
  const seeded = (regions.data?.regions ?? []).filter((r) => r.level === "state" || r.level === "estado");

  return (
    <div>
      <PageHeader title={t("console.states.title")} subtitle={t("console.states.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardTitle title={t("states.reference")} subtitle={t("states.reference.sub")} icon="globe" />
            {regions.loading ? <Skeleton className="h-16" /> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {seeded.map((r) => (
                  <li key={r.regionId} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    <Badge tone="blue">{r.regionId}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle title={t("states.registered")} icon="layers" />
            {loading ? <Skeleton className="h-16" /> : states.length === 0 ? (
              <EmptyState icon="globe" title={t("states.none")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {states.map((s) => (
                  <li key={s.state_id} className="flex items-center justify-between py-3 text-sm">
                    <span><b className="text-slate-900">{s.name}</b> <span className="text-slate-500">({s.state_id})</span></span>
                    <span className="text-xs text-slate-500">{s.country_code} · {timeAgo(s.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card>
          <CardTitle title={t("insights.addState")} subtitle={t("states.add.sub")} icon="plus" />
          <form onSubmit={add} className="flex flex-col gap-4">
            <Field label={t("insights.stateId")} htmlFor="s-id" hint="e.g. IN-OD"><Input id="s-id" value={id} onChange={(e) => setId(e.target.value)} required /></Field>
            <Field label={t("insights.stateName")} htmlFor="s-name"><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" loading={busy} disabled={!id || !name}>{t("insights.addState")}</Button>
          </form>
          <p className="mt-4 text-xs text-slate-500">{t("states.note")}</p>
        </Card>
      </div>
    </div>
  );
}
