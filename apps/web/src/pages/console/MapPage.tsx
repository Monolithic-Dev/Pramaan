import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { api, mapForecasts, type IssueSummary } from "../../api/api.js";
import { useScope } from "../../components/layout/ConsoleLayout.js";
import { useLanguage } from "../../i18n/LanguageProvider.js";
import { CATEGORY_META, Icon } from "../../ui/Icon.js";
import { priorityColor } from "../../ui/charts.js";
import { Card, PageHeader, PriorityBadge, SampleDataBadge, Select, StatusBadge, cx, useAsync } from "../../ui/kit.js";

const CATEGORIES = ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"];

export default function MapPage() {
  const { t } = useLanguage();
  const { regionId, regionName } = useScope();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [showForecasts, setShowForecasts] = useState(true);
  const [selected, setSelected] = useState<IssueSummary | null>(null);

  const issues = useAsync(() => api.issues({ region: regionId, sort: "score" }), [regionId]);
  const forecasts = useAsync(() => mapForecasts(regionId).catch(() => ({ forecasts: [] })), [regionId]);

  const visible = useMemo(
    () =>
      (issues.data?.issues ?? []).filter(
        (i) => i.lat != null && i.lng != null && (!category || i.category === category) && (!priority || i.priority === priority),
      ),
    [issues.data, category, priority],
  );

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current).setView([22.9, 79.0], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const i of visible) {
      points.push([i.lat!, i.lng!]);
      L.circleMarker([i.lat!, i.lng!], {
        radius: 7 + Math.min(i.report_count, 30) / 2.2,
        color: "#fff",
        weight: 2,
        fillColor: priorityColor(i.composite_score),
        fillOpacity: 0.85,
      })
        .on("click", () => setSelected(i))
        .bindTooltip(`${i.description.slice(0, 60)} (${i.report_count})`)
        .addTo(g);
    }
    if (showForecasts) {
      for (const f of forecasts.data?.forecasts ?? []) {
        if (category && f.category !== category) continue;
        points.push([f.lat, f.lng]);
        L.circle([f.lat, f.lng], { radius: 1800, color: "#ea580c", weight: 2.5, dashArray: "7 7", fill: false })
          .bindTooltip(`${t("map.forecast")}: ${t(`category.${f.category}`)} (${f.risk_level})`)
          .addTo(g);
      }
    }
    if (points.length > 0) m.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 15 });
  }, [visible, forecasts.data, showForecasts, category, t]);

  const meta = selected ? CATEGORY_META[selected.category] ?? CATEGORY_META.other : null;

  return (
    <div>
      <PageHeader
        eyebrow={regionName}
        title={t("console.map.title")}
        subtitle={t("console.map.subtitle")}
        actions={issues.data?.issues.some((i) => i.is_synthetic) ? <SampleDataBadge label={t("badge.sample")} /> : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
            <Select aria-label={t("console.filter.category")} value={category} onChange={(e) => setCategory(e.target.value)} className="!w-auto">
              <option value="">{t("console.filter.allCategories")}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
            </Select>
            <Select aria-label={t("console.col.priority")} value={priority} onChange={(e) => setPriority(e.target.value)} className="!w-auto">
              <option value="">{t("map.allPriorities")}</option>
              {["high", "medium", "low"].map((p) => <option key={p} value={p}>{t(`status.priority.${p}`)}</option>)}
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={showForecasts} onChange={(e) => setShowForecasts(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-700" />
              {t("map.showForecasts")}
            </label>
            <span className="ml-auto text-sm text-slate-500">{t("map.count", { count: visible.length })}</span>
          </div>
          <div ref={el} className="h-[28rem] w-full lg:h-[34rem]" role="application" aria-label="map" />
          <div className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-600" />{t("status.priority.high")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" />{t("status.priority.medium")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-600" />{t("status.priority.low")}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-dashed border-orange-500" />{t("map.legendForecast")}</span>
            <span className="text-slate-400">{t("map.sizeHint")}</span>
          </div>
        </Card>

        <div className="space-y-4">
          {selected && meta ? (
            <Card className="fade-up">
              <div className="flex items-start gap-3">
                <span className={cx("rounded-xl p-2.5", meta.bg, meta.tone)}><Icon name={meta.icon} size={20} /></span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`category.${selected.category}`)}</p>
                  <p className="font-semibold text-slate-900">{selected.description}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={selected.status} label={t(`status.${selected.status}`)} />
                <PriorityBadge priority={selected.priority} label={t(`status.priority.${selected.priority}`)} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{selected.region_name} · {t("console.reportsCount", { count: selected.report_count })} · {t("console.kpi.score")} {selected.composite_score?.toFixed(2) ?? "-"}</p>
              <Link to={`/console/issues/${selected.issue_id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                {t("map.open")} <Icon name="arrowRight" size={14} />
              </Link>
            </Card>
          ) : (
            <Card><p className="text-sm text-slate-600">{t("map.selectHint")}</p></Card>
          )}
          <Card>
            <p className="mb-3 text-sm font-semibold text-slate-900">{t("map.topInView")}</p>
            <ul className="space-y-2">
              {visible.slice(0, 6).map((i) => (
                <li key={i.issue_id}>
                  <button type="button" onClick={() => { setSelected(i); map.current?.setView([i.lat!, i.lng!], 15); }} className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-sm hover:bg-slate-50">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: priorityColor(i.composite_score) }} />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{i.description}</span>
                    <span className="tabular-nums text-slate-500">{i.report_count}</span>
                  </button>
                </li>
              ))}
              {visible.length === 0 && <li className="text-sm text-slate-500">{t("console.empty")}</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
