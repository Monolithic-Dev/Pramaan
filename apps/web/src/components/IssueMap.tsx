import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getMapMarkers } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";

// OpenStreetMap tiles: no API key required. Real issues are solid circles, forecasts
// are dashed and never share a style, so a prediction can't be mistaken for a report.
export function IssueMap({ token, regionScope }: { token: string; regionScope: string }) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current).setView([22.5, 79], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    let cancelled = false;
    getMapMarkers(token, regionScope)
      .then(({ issues, forecasts }) => {
        if (cancelled) return;
        const points: L.LatLngExpression[] = [];
        for (const i of issues) {
          points.push([i.lat, i.lng]);
          L.circleMarker([i.lat, i.lng], {
            radius: 6 + Math.min(i.report_count, 20) / 2,
            color: "#1d4ed8",
            fillColor: "#3b82f6",
            fillOpacity: 0.7,
          })
            .bindPopup(`${i.category} · ${i.status} · ${i.report_count}`)
            .addTo(map);
        }
        for (const f of forecasts) {
          points.push([f.lat, f.lng]);
          L.circle([f.lat, f.lng], {
            radius: 1500,
            color: "#ea580c",
            weight: 2,
            dashArray: "6 6",
            fill: false,
          })
            .bindPopup(`${f.risk_level} · ${f.category} · ${f.window_start.slice(0, 10)}`)
            .addTo(map);
        }
        if (points.length > 0) map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 15 });
        else if (emptyRef.current) emptyRef.current.hidden = false;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      map.remove();
    };
  }, [token, regionScope]);

  return (
    <div className="mb-4">
      <div ref={container} className="h-64 w-full rounded-md border border-gray-200" role="region" aria-label="map" />
      <p ref={emptyRef} hidden className="mt-1 text-sm text-gray-500">{t("map.empty")}</p>
      <p className="mt-1 text-xs text-gray-500">
        <span className="text-blue-600">●</span> {t("map.legendIssue")} · <span className="text-orange-600">◌</span> {t("map.legendForecast")}
      </p>
    </div>
  );
}
