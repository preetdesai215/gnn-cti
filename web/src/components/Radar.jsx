import { useMemo } from "react";

// Decorative radar for the dashboard. Distance from the centre comes from severity.
// The angle is a hash of the host name, so positions stay the same between refreshes.
// Positions carry no geographic meaning and no more information than severity.
const SWEEP_SECONDS = 4;
const DISTANCE = { critical: 0.25, high: 0.5, medium: 0.72, low: 0.9 };
const COLOR = { critical: "#ff4d6d", high: "#ff9f1c", medium: "#fbbf24", low: "#34d399" };
// The sweep's bright edge sits about 60 degrees clockwise of its start (see .radar-sweep in index.css)
const LEAD_DEG = 60;

function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export default function Radar({ alerts }) {
  const total = alerts?.length ?? 0;

  const blips = useMemo(
    () =>
      (alerts || []).slice(0, 12).map((a) => {
        const deg = hash(a.host) % 360;
        const rad = (deg * Math.PI) / 180;
        const distance = DISTANCE[a.severity] ?? 0.9;
        // Clockwise from the top. The blip lights when the sweep's bright edge passes it.
        const litFraction = ((deg - LEAD_DEG + 360) % 360) / 360;
        return {
          id: a.id,
          x: 50 + Math.sin(rad) * distance * 50,
          y: 50 - Math.cos(rad) * distance * 50,
          color: COLOR[a.severity] || "#94a3b8",
          delay: litFraction * SWEEP_SECONDS,
          title: `${a.severity}: ${a.host}`,
        };
      }),
    [alerts],
  );

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative aspect-square w-full max-w-[220px] overflow-hidden rounded-full border border-red-500/25 bg-navy-950 shadow-[0_0_40px_-16px_#e11d2e]">
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <div key={r} className="absolute rounded-full border border-red-400/15" style={{ inset: `${(1 - r) * 50}%` }} />
        ))}
        <div className="absolute inset-x-0 top-1/2 h-px bg-red-400/15" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-red-400/15" />
        <div className="radar-sweep absolute inset-0 rounded-full" />
        {blips.map((b) => (
          <span
            key={b.id}
            title={b.title}
            className="blip absolute h-2 w-2 rounded-full"
            style={{ left: `${b.x}%`, top: `${b.y}%`, background: b.color, color: b.color, animationDelay: `${b.delay}s` }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-light" />
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
        {total ? `${total} host${total === 1 ? "" : "s"} on scope` : "Scope clear"}
      </p>
    </div>
  );
}
