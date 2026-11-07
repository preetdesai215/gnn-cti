import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ENTITY_TYPES } from "../data/demo";

// Counts from the previous value to the new one, so changes after a refresh are visible.
export function AnimatedNumber({ value, duration = 700 }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      current.current = value;
      setShown(value);
      return undefined;
    }
    const from = typeof current.current === "number" ? current.current : 0;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return typeof shown === "number" ? Math.round(shown).toLocaleString() : shown;
}

export function SimulatedBanner({ children }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children || "SIMULATED DEMO DATA. Not real threat intelligence and not live detection results."}</p>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, right }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="label-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-white md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-slate-400">{description}</p>}
      </div>
      {right}
    </div>
  );
}

// `i` staggers the entrance: cards with a higher index appear a little later.
export function StatCard({ icon: Icon, label, value, hint, accent = "text-accent-light", i = 0 }) {
  return (
    <div className="glass glass-hover reveal p-5" style={{ "--i": i }}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${accent}`} />}
      </div>
      <p className="num mt-3 text-3xl font-semibold text-white">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-slate-500" title={hint}>{hint}</p>}
    </div>
  );
}

const SEVERITY_STYLES = {
  critical: "bg-sev-critical/15 text-sev-critical border-sev-critical/40",
  high: "bg-sev-high/15 text-sev-high border-sev-high/40",
  medium: "bg-sev-medium/15 text-sev-medium border-sev-medium/40",
  low: "bg-sev-low/15 text-sev-low border-sev-low/40",
};

export function SeverityBadge({ severity }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${SEVERITY_STYLES[severity] || ""}`}>
      {severity}
    </span>
  );
}

const STATUS_STYLES = {
  malicious: "bg-red-500/15 text-red-300 border-red-500/40",
  suspicious: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  benign: "bg-emerald-400/15 text-emerald-200 border-emerald-400/40",
};

export function StatusBadge({ status }) {
  const label = status.replace("_", " ");
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || "border-slate-500/40 text-slate-300"}`}>
      {label}
    </span>
  );
}

export function EntityBadge({ type }) {
  const t = ENTITY_TYPES[type];
  if (!t) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-0.5 text-xs text-slate-300">
      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

export function LoadingBlock({ label = "Loading data…" }) {
  return (
    <div className="glass flex items-center gap-3 p-6 text-sm text-slate-400">
      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{message}</div>
  );
}

export function formatTime(iso) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", hour12: false }) + " UTC";
}
