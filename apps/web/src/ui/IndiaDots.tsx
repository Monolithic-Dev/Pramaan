import { useMemo } from "react";

// A dot-matrix map of India. The outline is a hand-simplified polygon (lng, lat), good enough to be
// recognisable at hero size; dots are laid on a regular grid inside it. Places with data light up in
// saffron and pulse. It is decoration that also tells the truth: only regions that really have reports glow.
const OUTLINE: [number, number][] = [
  [68.2, 23.7], [69.0, 22.4], [70.1, 20.9], [72.0, 20.7], [72.6, 21.4], [72.7, 20.4], [72.9, 19.0], [73.1, 17.5],
  [73.8, 15.8], [74.6, 13.0], [75.4, 11.9], [76.3, 9.9], [77.1, 8.3], [77.6, 8.1], [78.2, 8.9], [79.3, 10.3],
  [79.85, 10.3], [80.2, 12.6], [80.1, 15.0], [81.5, 16.5], [82.3, 16.9], [83.3, 17.7], [85.0, 19.5], [86.8, 20.9],
  [88.1, 21.6], [89.0, 21.8], [88.7, 22.9], [88.2, 24.5], [88.9, 25.2], [89.8, 26.0], [90.2, 26.8], [92.0, 25.2],
  [92.6, 24.7], [92.4, 23.4], [92.3, 22.5], [93.3, 22.0], [93.6, 23.5], [94.7, 25.0], [95.2, 26.0], [96.0, 27.3],
  [97.3, 28.2], [96.1, 29.0], [94.9, 29.3], [92.5, 27.9], [91.6, 27.8], [89.9, 26.8], [88.9, 27.3], [88.1, 26.5],
  [87.0, 26.4], [84.9, 27.4], [83.0, 27.4], [81.5, 28.9], [80.1, 28.8], [80.4, 30.2], [79.0, 31.0], [78.8, 32.5],
  [79.5, 33.0], [79.9, 34.4], [78.9, 35.5], [77.8, 35.5], [76.8, 35.9], [75.5, 36.6], [74.5, 37.0], [73.5, 35.0],
  [74.2, 34.4], [74.5, 33.5], [75.3, 32.8], [74.7, 32.0], [74.6, 31.0], [74.1, 30.2], [73.9, 29.7], [72.8, 28.9],
  [71.2, 27.4], [70.2, 26.4], [70.0, 25.0], [69.5, 24.3], [68.5, 23.9],
];

const LNG = [67.5, 98] as const;
const LAT = [6.5, 37.5] as const;

function inside(lng: number, lat: number): boolean {
  let hit = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export interface Glow {
  lat: number;
  lng: number;
  /** 0..1: how strongly the spot glows (e.g. issue volume). */
  weight?: number;
  label?: string;
}

export function IndiaDots({ glows = [], className }: { glows?: Glow[]; className?: string }) {
  const W = 320;
  const H = Math.round((W * (LAT[1] - LAT[0])) / (LNG[1] - LNG[0]));
  const x = (lng: number) => ((lng - LNG[0]) / (LNG[1] - LNG[0])) * W;
  const y = (lat: number) => ((LAT[1] - lat) / (LAT[1] - LAT[0])) * H;

  const dots = useMemo(() => {
    const out: { cx: number; cy: number }[] = [];
    const step = 0.55;
    for (let lat = LAT[0]; lat <= LAT[1]; lat += step) {
      for (let lng = LNG[0]; lng <= LNG[1]; lng += step) {
        if (inside(lng, lat)) out.push({ cx: x(lng), cy: y(lat) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Map of India showing where reports are coming from">
      <g fill="currentColor" opacity="0.34">
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={1.15} />
        ))}
      </g>
      {glows.map((g, i) => {
        const w = Math.min(1, Math.max(0.15, g.weight ?? 0.4));
        return (
          <g key={i}>
            <circle cx={x(g.lng)} cy={y(g.lat)} r={3 + w * 9} fill="#ff9933" opacity="0.18" className="india-pulse" style={{ animationDelay: `${(i % 7) * 0.35}s` }} />
            <circle cx={x(g.lng)} cy={y(g.lat)} r={1.6 + w * 2.4} fill="#ff9933">
              {g.label && <title>{g.label}</title>}
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
