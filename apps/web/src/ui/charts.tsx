import { useState } from "react";

// Dependency-free SVG charts. They are deliberately simple (area, bars, donut): every number on
// screen is also readable as text (title/aria-label), so the charts stay accessible and testable.

export function AreaChart({
  data,
  height = 180,
  color = "#244ebc",
  label,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const x = (i: number) => pad.l + (i * (width - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => height - pad.b - (v / niceMax) * (height - pad.t - pad.b);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`;
  const gradId = `g${color.replace("#", "")}`;
  const step = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={label}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={width - pad.r} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="#e2e8f0" strokeDasharray="3 4" />
            <text x={pad.l - 6} y={y(niceMax * f) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(niceMax * f)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label}>
            <rect
              x={x(i) - 10}
              y={0}
              width={20}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {(hover === i || i === data.length - 1) && <circle cx={x(i)} cy={y(d.value)} r="4" fill="white" stroke={color} strokeWidth="2.25" />}
            {i % step === 0 && (
              <text x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lift">
          {data[hover].label}: {data[hover].value}
        </div>
      )}
    </div>
  );
}

export function BarList({
  items,
  colorFor,
  emptyText,
  format = (n: number) => String(n),
}: {
  items: { label: string; value: number; sub?: string; key?: string }[];
  colorFor?: (item: { label: string; key?: string }) => string;
  emptyText?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key ?? item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-800">{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-600">
              {format(item.value)}
              {item.sub && <span className="ml-1.5 text-xs text-slate-400">{item.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%`, background: colorFor?.(item) ?? "#244ebc" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  slices,
  size = 150,
  center,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  center?: { value: string; label: string };
}) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={slices.map((s) => `${s.label} ${s.value}`).join(", ")}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f7" strokeWidth="16" />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${Math.max(0, len - 1.5)} ${c - len + 1.5}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
        {center && (
          <>
            <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">
              {center.value}
            </text>
            <text x="70" y="84" textAnchor="middle" fontSize="9" fill="#64748b">
              {center.label}
            </text>
          </>
        )}
      </svg>
      <ul className="flex min-w-[8rem] flex-1 flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums font-medium text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A 0-1 value as a labelled meter (used for priority scores and score components). */
export function Meter({ value, color = "#244ebc", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className ?? ""}`} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
    </div>
  );
}

export function priorityColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  return score >= 0.6 ? "#e11d48" : score >= 0.35 ? "#f59e0b" : "#16a34a";
}
