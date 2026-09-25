import { useState, type ReactNode } from "react";
import type { Grade, Sla } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon } from "./Icon.js";
import { Badge, cx } from "./kit.js";

/** How long an issue may sit before someone must act on it. Colour tells the story at a glance. */
export function SlaChip({ sla }: { sla: Sla }) {
  const { t } = useLanguage();
  if (sla.state === "met") return <Badge tone="green"><Icon name="check" size={12} />{t("sla.met")}</Badge>;
  const days = Math.abs(sla.days_left ?? 0);
  if (sla.state === "overdue") return <Badge tone="red"><Icon name="clock" size={12} />{t("sla.overdue", { days })}</Badge>;
  if (sla.state === "due_soon") return <Badge tone="amber"><Icon name="clock" size={12} />{t("sla.due_soon", { days })}</Badge>;
  return <Badge tone="slate"><Icon name="clock" size={12} />{t("sla.ok", { days })}</Badge>;
}

const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-lime-600 text-white",
  C: "bg-amber-500 text-white",
  D: "bg-orange-600 text-white",
  E: "bg-rose-600 text-white",
};

export function GradeBadge({ grade, size = "md" }: { grade: Grade; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-7 w-7 text-sm", md: "h-10 w-10 text-lg", lg: "h-16 w-16 text-3xl" }[size];
  return (
    <span className={cx("inline-flex items-center justify-center rounded-xl font-extrabold shadow-card", dims, GRADE_STYLE[grade])} aria-label={`Grade ${grade}`}>
      {grade}
    </span>
  );
}

/** Circular score meter: the same number officers see, drawn so it can be read across a room. */
export function ScoreRing({ value, size = 64, color, label }: { value: number | null; size?: number; color?: string; label?: ReactNode }) {
  const v = value ?? 0;
  const stroke = Math.max(5, size / 9);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = color ?? (v >= 0.6 ? "#e11d48" : v >= 0.35 ? "#f59e0b" : "#10b981");
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {value !== null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ transition: "stroke-dasharray .6s ease" }} />
        )}
      </svg>
      <span className="absolute text-center font-bold leading-none text-slate-900" style={{ fontSize: size / 3.4 }}>
        {value === null ? "-" : value.toFixed(2)}
        {label && <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</span>}
      </span>
    </div>
  );
}

/** Tiny trend line for KPI tiles. */
export function Sparkline({ values, color = "#244ebc", width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - (v / max) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Horizontal journey: received > understood > verified > funded > fixed. */
export function JourneyStepper({ stages, current, labels }: { stages: readonly string[]; current: string; labels: Record<string, string> }) {
  const index = Math.max(0, stages.indexOf(current));
  return (
    <ol className="flex w-full items-start">
      {stages.map((stage, i) => {
        const done = i < index || (i === index && current === "fixed");
        const active = i === index && !done;
        return (
          <li key={stage} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cx("absolute left-[-50%] top-4 h-0.5 w-full", i <= index ? "bg-emerald-500" : "bg-slate-200")} aria-hidden="true" />}
            <span
              className={cx(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white",
                done ? "bg-emerald-500 text-white" : active ? "bg-brand-700 text-white" : "bg-slate-200 text-slate-500",
              )}
            >
              {done ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <span className={cx("mt-2 text-xs font-medium", i <= index ? "text-slate-900" : "text-slate-400")}>{labels[stage] ?? stage}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        });
      }}
    >
      <Icon name={done ? "check" : "copy"} size={14} />
      {done ? copiedLabel : label}
    </button>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size / 2.3, background: `hsl(${hue} 55% 42%)` }}>
      {initial}
    </span>
  );
}
