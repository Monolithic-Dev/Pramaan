import { useState, type FormEvent } from "react";
import { api, type OfficerAccount } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { Icon } from "../../ui/Icon.js";
import { Alert, Badge, Button, Card, CardTitle, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, timeAgo, useAsync, useToast } from "../../ui/kit.js";

const ROLES = ["field_officer", "district_collector", "state_admin"] as const;
const ROLE_TONE = { field_officer: "blue", district_collector: "violet", state_admin: "saffron" } as const;

const PERMISSION_ROWS: { key: string; roles: readonly (typeof ROLES[number])[] }[] = [
  { key: "perm.viewConsole", roles: ["field_officer", "district_collector", "state_admin"] },
  { key: "perm.updateStatus", roles: ["district_collector", "state_admin"] },
  { key: "perm.projects", roles: ["district_collector", "state_admin"] },
  { key: "perm.equity", roles: ["state_admin"] },
  { key: "perm.users", roles: ["state_admin"] },
  { key: "perm.audit", roles: ["state_admin"] },
];

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

export default function Team() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { regions, regionId } = useScope();
  const { data, loading, error, refetch } = useAsync(() => api.officers(), []);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [role, setRole] = useState<string>("field_officer");
  const [region, setRegion] = useState(regionId);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.createOfficer({ email, password, role, region_id: region });
      setCreated({ email, password });
      setEmail("");
      setPassword(generatePassword());
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("report.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(o: OfficerAccount) {
    try {
      await api.setOfficerDisabled(o.uid, !o.disabled);
      toast("success", t(o.disabled ? "team.toast.enabled" : "team.toast.disabled"));
      refetch();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : t("report.errorGeneric"));
    }
  }

  const officers = data?.officers ?? [];
  return (
    <div>
      <PageHeader
        title={t("console.team.title")}
        subtitle={t("console.team.subtitle")}
        actions={<Button icon="plus" onClick={() => { setOpen(true); setCreated(null); setFormError(null); setRegion(regionId); }}>{t("team.add")}</Button>}
      />
      {error && <Alert tone="error">{error.message}</Alert>}

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : officers.length === 0 ? (
          <EmptyState icon="users" title={t("team.empty.title")} body={t("team.empty.body")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("team.col.officer")}</th>
                  <th className="px-4 py-3">{t("team.col.role")}</th>
                  <th className="px-4 py-3">{t("team.col.region")}</th>
                  <th className="hidden px-4 py-3 md:table-cell">{t("team.col.lastSignIn")}</th>
                  <th className="px-4 py-3">{t("team.col.status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {officers.map((o) => (
                  <tr key={o.uid} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{o.email}</td>
                    <td className="px-4 py-3"><Badge tone={ROLE_TONE[o.role]}>{t(`role.${o.role}`)}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{regions.find((r) => r.regionId === o.region_id)?.name ?? o.region_id}</td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{o.last_sign_in ? timeAgo(new Date(o.last_sign_in).toISOString()) : t("team.never")}</td>
                    <td className="px-4 py-3">{o.disabled ? <Badge tone="red">{t("team.disabled")}</Badge> : <Badge tone="green">{t("team.active")}</Badge>}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => toggle(o)}>{o.disabled ? t("team.enable") : t("team.disable")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle title={t("team.matrix.title")} subtitle={t("team.matrix.sub")} icon="shield" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2">{t("team.matrix.capability")}</th>
                {ROLES.map((r) => <th key={r} className="py-2 text-center">{t(`role.${r}`)}</th>)}
                <th className="py-2 text-center">{t("role.citizen")}</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="py-2.5 text-slate-800">{t(row.key)}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="py-2.5 text-center">{row.roles.includes(r) ? <Icon name="check" size={18} className="mx-auto text-emerald-600" /> : <span className="text-slate-300">-</span>}</td>
                  ))}
                  <td className="py-2.5 text-center text-slate-300">-</td>
                </tr>
              ))}
              <tr className="border-t border-slate-100">
                <td className="py-2.5 text-slate-800">{t("perm.report")}</td>
                {ROLES.map((r) => <td key={r} className="py-2.5 text-center text-slate-300">-</td>)}
                <td className="py-2.5 text-center"><Icon name="check" size={18} className="mx-auto text-emerald-600" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t("team.add")}>
        {created ? (
          <div className="space-y-4">
            <Alert tone="success" title={t("team.created")}>{t("team.created.body")}</Alert>
            <dl className="rounded-xl bg-slate-50 p-4 text-sm">
              <dt className="text-slate-500">{t("auth.email")}</dt><dd className="font-mono font-semibold text-slate-900">{created.email}</dd>
              <dt className="mt-2 text-slate-500">{t("auth.password")}</dt><dd className="font-mono font-semibold text-slate-900">{created.password}</dd>
            </dl>
            <div className="flex justify-end"><Button onClick={() => setOpen(false)}>{t("common.done")}</Button></div>
          </div>
        ) : (
          <form onSubmit={create} className="flex flex-col gap-4">
            <Field label={t("auth.email")} htmlFor="o-email"><Input id="o-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label={t("auth.password")} htmlFor="o-pass" hint={t("team.passwordHint")}>
              <div className="flex gap-2">
                <Input id="o-pass" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
                <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())} aria-label={t("team.generate")}><Icon name="refresh" size={16} /></Button>
              </div>
            </Field>
            <Field label={t("team.col.role")} htmlFor="o-role">
              <Select id="o-role" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}</Select>
            </Field>
            <Field label={t("team.col.region")} htmlFor="o-region">
              <Select id="o-region" value={region} onChange={(e) => setRegion(e.target.value)}>{regions.map((r) => <option key={r.regionId} value={r.regionId}>{r.name} ({r.level})</option>)}</Select>
            </Field>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" loading={busy} disabled={!email || password.length < 10}>{t("team.create")}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
