import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getAlerts, getIndicatorHosts, getReference } from "../api/client";
import { brandsFromReference, lookalikeMatch, lookalikeSeverity } from "../api/lookalike";
import { ErrorBlock, LoadingBlock, PageHeader, SeverityBadge, formatTime } from "../components/common";
import { useFreshness } from "../components/freshness";

const SEVERITIES = ["all", "critical", "high", "medium", "low"];
const STATUSES = ["all", "open", "investigating", "resolved", "false_positive"];

export default function Alerts() {
  const { version } = useFreshness();
  const [alerts, setAlerts] = useState(undefined); // undefined = loading, null = no file
  const [error, setError] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("risk");

  const [indicators, setIndicators] = useState(undefined); // history index, undefined = loading
  const [reference, setReference] = useState(undefined);   // popularity list

  useEffect(() => {
    getAlerts().then(setAlerts).catch((e) => setError(e.message));
    getIndicatorHosts().then(setIndicators).catch(() => setIndicators(null));
    getReference().then(setReference).catch(() => setReference(null));
  }, [version]);

  // Names in the history that resemble a popular site. Rule-based candidates, not verdicts.
  const lookalikes = useMemo(() => {
    if (indicators === undefined || reference === undefined) return undefined;
    if (!indicators || !reference) return null;
    const brands = brandsFromReference(reference);
    const found = [];
    for (const h of indicators) {
      if (h.kind !== "domain") continue;
      const m = lookalikeMatch(h.host.replace(/\[\.\]/g, "."), brands);
      if (m) found.push({ host: h.host, brand: m.brand, rule: m.rule, severity: lookalikeSeverity(m.rule), urls: h.urls });
    }
    const order = { high: 0, medium: 1, low: 2 };
    return found.sort((a, b) => order[a.severity] - order[b.severity] || b.urls - a.urls).slice(0, 100);
  }, [indicators, reference]);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    const q = query.trim().toLowerCase();
    const rows = alerts.filter((a) =>
      (severity === "all" || a.severity === severity) &&
      (status === "all" || a.status === status) &&
      (!q || a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) ||
        a.threat.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.host.toLowerCase().includes(q))
    );
    return [...rows].sort((x, y) => (sortBy === "risk" ? y.risk - x.risk : y.time.localeCompare(x.time)));
  }, [alerts, severity, status, query, sortBy]);

  function setAlertStatus(id, next) {
    setAlerts((cur) => cur.map((a) => (a.id === id ? { ...a, status: next } : a)));
  }

  if (error) return <ErrorBlock message={error} />;

  return (
    <>
      <PageHeader
        eyebrow="Alert management"
        title="Threat Alerts"
        description="Hosts that gained new URLs in the last 7 collection days, from the URLhaus feed. Severity and risk follow a fixed rule on URL count. Status changes are kept in this session only."
      />

      <div className="glass mb-6 grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" placeholder="Search host, threat or tag…"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search alerts" />
        </div>
        <select className="input md:w-40" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter by severity">
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === "all" ? "All severities" : s}</option>)}
        </select>
        <select className="input md:w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace("_", " ")}</option>)}
        </select>
      </div>

      {alerts === undefined && <LoadingBlock label="Loading real alerts…" />}
      {alerts === null && (
        <div className="glass p-5 text-sm text-slate-300">
          No alerts file found. Run <code className="font-mono text-accent-light">python -m src.export.summary</code>, then reload.
        </div>
      )}

      {alerts && (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{filtered.length} of {alerts.length} alerts</p>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Sort by
              <select className="input w-auto py-1 text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="risk">Highest risk</option>
                <option value="time">Most recent</option>
              </select>
            </label>
          </div>
          <div className="glass overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Added (UTC)</th>
                  <th className="px-4 py-3">URLs in history</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((a) => (
                  <tr key={a.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="break-all font-mono text-xs font-medium text-slate-100">{a.host}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{a.threat}</p>
                      {a.tags.length > 0 && <p className="mt-1 text-xs text-slate-500">{a.tags.join(", ")}</p>}
                    </td>
                    <td className="px-4 py-3"><SeverityBadge severity={a.severity} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 font-bold text-white">{a.risk}</span>
                        <div className="h-1.5 w-20 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-gradient-to-r from-accent to-sev-high" style={{ width: `${a.risk}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatTime(a.time)}</td>
                    <td className="px-4 py-3 text-slate-300">{a.urls}</td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5 text-xs"
                        value={a.status}
                        onChange={(e) => setAlertStatus(a.id, e.target.value)}
                        aria-label={`Status for ${a.host}`}
                      >
                        {STATUSES.filter((s) => s !== "all").map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {alerts.length === 0 ? "No hosts were added in the last 7 collection days." : "No alerts match these filters."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <section className="mt-10">
        <div className="mb-3">
          <h2 className="font-semibold text-white">Possible lookalike domains</h2>
          <p className="mt-1 text-xs text-slate-500">
            Names in the history that resemble a popular site: a one-character typo, look-alike characters (paypa1),
            a popular word in the name, or a popular name used as a subdomain. Rule-based candidates for review, not verdicts.
          </p>
        </div>
        {lookalikes === undefined && <LoadingBlock label="Checking names…" />}
        {lookalikes === null && (
          <p className="text-sm text-slate-400">
            Needs the indicator index and popularity list. Run <code className="font-mono text-accent-light">python -m src.export.summary</code>.
          </p>
        )}
        {lookalikes && lookalikes.length === 0 && (
          <p className="text-sm text-slate-500">No lookalike names found in the history.</p>
        )}
        {lookalikes && lookalikes.length > 0 && (
          <div className="glass overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Domain (defanged)</th>
                  <th className="px-4 py-3">Resembles</th>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">URLs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lookalikes.map((l) => (
                  <tr key={l.host} className="transition hover:bg-white/[0.03]">
                    <td className="break-all px-4 py-3 font-mono text-xs text-slate-100">{l.host}</td>
                    <td className="px-4 py-3 text-slate-300">{l.brand}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{l.rule}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={l.severity} /></td>
                    <td className="px-4 py-3 text-slate-300">{l.urls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
