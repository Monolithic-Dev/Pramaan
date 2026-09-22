import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icon.js";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ---- Buttons ---------------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white shadow-card hover:bg-brand-800",
  accent: "bg-saffron-500 text-brand-950 shadow-card hover:bg-saffron-600 hover:text-white",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:border-brand-400 hover:text-brand-800",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};
const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === "lg" ? 20 : 16} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-label="loading" role="status">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ---- Surfaces --------------------------------------------------------------------------------

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl border border-slate-200 bg-white shadow-card", padded && "p-5", className)}>
      {children}
    </section>
  );
}

export function CardTitle({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-700">
            <Icon name={icon} size={18} />
          </span>
        )}
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: "brand" | "green" | "red" | "amber" | "slate";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <Card className="fade-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <span className={cx("rounded-xl p-2.5", tones[tone])}>
            <Icon name={icon} size={20} />
          </span>
        )}
      </div>
    </Card>
  );
}

// ---- Badges ----------------------------------------------------------------------------------

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "violet" | "teal" | "indigo" | "saffron";
  className?: string;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    teal: "bg-teal-50 text-teal-700 ring-teal-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    saffron: "bg-saffron-100 text-amber-800 ring-amber-200",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  open: "slate",
  verified: "blue",
  disputed: "amber",
  prioritized: "violet",
  funded: "teal",
  in_progress: "indigo",
  resolved: "green",
  recommended: "violet",
  completed: "green",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "slate"}>{label}</Badge>;
}

const PRIORITY_TONE: Record<string, Parameters<typeof Badge>[0]["tone"]> = {
  high: "red",
  medium: "amber",
  low: "green",
  pending: "slate",
};

export function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "slate"}>{label}</Badge>;
}

export function SampleDataBadge({ label }: { label: string }) {
  return (
    <Badge tone="saffron">
      <Icon name="info" size={12} />
      {label}
    </Badge>
  );
}

// ---- Forms -----------------------------------------------------------------------------------

const CONTROL =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL, "pr-8", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, "resize-y", props.className)} />;
}

// ---- Tabs / segmented ------------------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-xl bg-slate-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg px-4 py-2 text-sm font-semibold transition",
            o.value === value ? "bg-white text-brand-800 shadow-card" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Feedback --------------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton h-4 w-full", className)} />;
}

export function EmptyState({
  icon = "info",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="rounded-2xl bg-slate-100 p-4 text-slate-500">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {body && <p className="max-w-md text-sm text-slate-600">{body}</p>}
      {action}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  title,
}: {
  tone?: "info" | "warn" | "error" | "success";
  children: ReactNode;
  title?: string;
}) {
  const styles = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  const icons: Record<string, IconName> = { info: "info", warn: "alert", error: "alert", success: "checkCircle" };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl border p-3.5 text-sm", styles[tone])}>
      <Icon name={icons[tone]} size={18} className="mt-0.5 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

// ---- Modal -----------------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fade-up w-full max-w-lg rounded-2xl bg-white shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ----------------------------------------------------------------------------------

interface Toast {
  id: number;
  tone: "success" | "error" | "info";
  text: string;
}
const ToastContext = createContext<{ toast: (tone: Toast["tone"], text: string) => void }>({ toast: () => undefined });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "fade-up pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lift",
              t.tone === "success" && "bg-emerald-600",
              t.tone === "error" && "bg-rose-600",
              t.tone === "info" && "bg-slate-800",
            )}
          >
            <Icon name={t.tone === "success" ? "checkCircle" : "alert"} size={18} className="mt-0.5 shrink-0" />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---- Data hook -------------------------------------------------------------------------------

/** Minimal fetch-state hook: loading / error / data / refetch, with stale-response protection. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error) => live && setState({ data: null, error: error as Error, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, refetch: () => setTick((t) => t + 1) };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 45) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
