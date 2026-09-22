import { useEffect, useRef } from "react";
import L from "leaflet";

export interface LatLng {
  lat: number;
  lng: number;
}

// Click-to-place map for the report flow. OpenStreetMap tiles (no key). The pin is a divIcon so
// no image assets are needed (Leaflet's default marker images break under bundlers).
export function LocationPicker({
  value,
  onChange,
  center,
  className = "h-72",
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  center: LatLng;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], value ? 15 : 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    m.on("click", (e) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; value/center changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) return;
    const icon = L.divIcon({
      className: "",
      html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#1d3f97;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    if (marker.current) marker.current.setLatLng([value.lat, value.lng]);
    else marker.current = L.marker([value.lat, value.lng], { icon, draggable: true }).addTo(m).on("dragend", (e) => {
      const p = (e.target as L.Marker).getLatLng();
      onChangeRef.current({ lat: p.lat, lng: p.lng });
    });
    m.setView([value.lat, value.lng], Math.max(m.getZoom(), 15));
  }, [value]);

  return <div ref={el} className={`${className} w-full overflow-hidden rounded-xl border border-slate-200`} role="application" aria-label="map" />;
}
