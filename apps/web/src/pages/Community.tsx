import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import { api, type PublicIssue } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { CATEGORY_COLOR, CATEGORY_META, Icon } from "../ui/Icon.js";
import { Alert, Badge, Button, Card, EmptyState, Select, Skeleton, StatusBadge, cx, timeAgo, useAsync, useToast } from "../ui/kit.js";

const CATEGORIES = ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"];

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** What is being reported around me? Coarse locations only. Endorse an issue instead of filing a duplicate. */
export default function Community() {
  const { t, countryCode } = useLanguage();
  const { status, me } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [category, setCategory] = useState("");
  const { data, loading, error } = useAsync(() => api.publicIssues({ country: countryCode, category: category || undefined }), [countryCode, category]);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  const issues = useMemo(() => {
    const list = data?.issues ?? [];
    return [...list]
      .map((i) => ({ ...i, km: here ? distanceKm(here, i) : null }))
      .sort((a, b) => (a.km !== null && b.km !== null ? a.km - b.km : b.support_count + b.report_count - (a.support_count + a.report_count)));
  }, [data, here]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false }).setView(countryCode === "BR" ? [-15, -50] : [22.9, 79], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => void m.remove();
  }, [countryCode]);

  useEffect(() => {
    const g = layer.current;
    if (!g || !map.current) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    for (const i of issues) {
      const r = 6 + Math.min(14, Math.sqrt(i.report_count + i.support_count) * 2);
      L.circleMarker([i.lat, i.lng], { radius: r, color: "#fff", weight: 2, fillColor: CATEGORY_COLOR[i.category] ?? "#64748b", fillOpacity: 0.85 })
        .on("click", () => setSelected(i.issue_id))
        .bindTooltip(`${t(`category.${i.category}`)} · ${i.region_name ?? ""}`)
        .addTo(g);
      pts.push([i.lat, i.lng]);
    }
    if (here) L.circleMarker([here.lat, here.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#1d3f97", fillOpacity: 1 }).bindTooltip(t("community.you")).addTo(g);
    if (here) map.current.setView([here.lat, here.lng], 11);
    else if (pts.length) map.current.fitBounds(L.latLngBounds(pts).pad(0.15));
  }, [issues, here, t]);

  function locate() {
    if (!("geolocation" in navigator)) return toast("error", t("report.locationError"));
    navigator.geolocation.getCurrentPosition(
      (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast("error", t("report.locationError")),
      { timeout: 8000 },
    );
  }

  async function support(issue: PublicIssue) {
    if (status !== "authenticated" || me?.kind !== "citizen") return navigate(`/login?next=${encodeURIComponent("/community")}`);
    setBusy(issue.issue_id);
    try {
      const r = await api.support(issue.issue_id);
      setCounts((c) => ({ ...c, [issue.issue_id]: r.support_count }));
      setDone((d) => new Set(d).add(issue.issue_id));
      toast("success", t(r.already_supported ? "community.already" : "community.thanks"));
    } catch (e) {
      toast("error", e instanceof Error ? e.message : t("report.errorGeneric"));
    } finally {
      setBusy(null);
    }
  }

  const sample = issues.some((i) => i.is_synthetic);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("community.title")}</h1>
          <p className="mt-1 max-w-2xl text-slate-600">{t("community.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sample && <Badge tone="saffron"><Icon name="info" size={12} />{t("badge.sample")}</Badge>}
          <Select aria-label={t("console.filter.category")} value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto">
            <option value="">{t("console.filter.allCategories")}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </Select>
          <Button variant="secondary" icon="pin" onClick={locate}>{t("community.near")}</Button>
          <Link to="/report"><Button icon="plus">{t("nav.report")}</Button></Link>
        </div>
      </div>

      {error && <Alert tone="error">{error.message}</Alert>}
      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card padded={false} className="overflow-hidden">
          <div ref={el} className="h-[28rem] w-full lg:h-[36rem]" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            {CATEGORIES.slice(0, 6).map((c) => <span key={c} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />{t(`category.${c}`)}</span>)}
            <span className="ml-auto">{t("community.coarse")}</span>
          </div>
        </Card>

        <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
          {!loading && issues.length === 0 && <Card><EmptyState icon="pin" title={t("community.empty.title")} body={t("community.empty.body")} /></Card>}
          {issues.slice(0, 40).map((i) => {
            const meta = CATEGORY_META[i.category] ?? CATEGORY_META.other;
            const supports = counts[i.issue_id] ?? i.support_count;
            return (
              <Card key={i.issue_id} className={cx("!p-4 transition", selected === i.issue_id && "ring-2 ring-brand-400")}>
                <div className="flex items-start gap-3">
                  <span className={`rounded-xl p-2 ${meta.bg} ${meta.tone}`}><Icon name={meta.icon} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{t(`category.${i.category}`)}</p>
                    <p className="text-xs text-slate-500">{i.region_name ?? "-"}{i.km !== null && ` · ${i.km < 1 ? "<1" : Math.round(i.km)} km`} · {timeAgo(i.first_reported_at)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={i.status} label={t(`status.${i.status}`)} />
                      <Badge tone="slate">{t("console.reportsCount", { count: i.report_count })}</Badge>
                      {supports > 0 && <Badge tone="teal"><Icon name="thumbsUp" size={11} />{supports}</Badge>}
                    </div>
                  </div>
                </div>
                {i.status !== "resolved" && (
                  <Button size="sm" variant={done.has(i.issue_id) ? "ghost" : "secondary"} icon="thumbsUp" className="mt-3 w-full" loading={busy === i.issue_id} disabled={done.has(i.issue_id)} onClick={() => support(i)}>
                    {done.has(i.issue_id) ? t("community.supported") : t("community.affected")}
                  </Button>
                )}
              </Card>
            );
          })}
          <p className="px-1 text-xs text-slate-500">{t("community.note")}</p>
        </div>
      </div>
    </div>
  );
}
