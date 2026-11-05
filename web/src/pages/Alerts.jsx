import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getAlerts } from "../api/client";
import { NODES } from "../data/demo";
import {
  ErrorBlock, LoadingBlock, PageHeader, SeverityBadge, SimulatedBanner, formatTime,
} from "../components/common";

const SEVERITIES = ["all", "critical", "high", "medium", "low"];
const STATUSES = ["all", "open", "investigating", "resolved", "false_positive"];
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

export default function Alerts() {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getAlerts().then(setAlerts).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    const q = query.trim().toLowerCase();
    return alerts.filter((a) =>
      (severity === "all" || a.severity === severity) &&
      (status === "all" || a.status === status) &&
      (!q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) || a.entities.some((id) => NODE_BY_ID[id]?.value.toLowerCase().includes(q)))
    );
  }, [alerts, severity, status, query]);

  function setAlertStatus(id, next) {
    setAlerts((cur) => cur.map((a) => (a.id === id ? { ...a, status: next } : a)));
  }

  if (error) return <ErrorBlock message={error} />;

  return (
    <>
      <PageHeader
        eyebrow="Alert management"
        title="Threat Alerts"
        description="Triage alerts by severity and status. Status changes are kept in this session only."
      />
      <SimulatedBanner />

      <div className="glass mb-6 grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" placeholder="Search title, description, ID or entity…"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search alerts" />
        </div>
        <select className="input md:w-40" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter by severity">
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === "all" ? "All severities" : s}</option>)}
        </select>
        <select className="input md:w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace("_", " ")}</option>)}
        </select>
      </div>

      {!alerts ? <LoadingBlock /> : (
        <>
          <p className="mb-3 text-xs text-slate-500">{filtered.length} of {alerts.length} alerts</p>
          <div className="glass overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Alert</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Detected (UTC)</th>
                  <th className="px-4 py-3">Related entities</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((a) => (
                  <tr key={a.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{a.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{a.id}</p>
                      <p className="mt-1 max-w-md text-xs text-slate-400">{a.description}</p>
                    </td>
                    <td className="px-4 py-3"><SeverityBadge severity={a.severity} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 font-bold text-white">{a.risk}</span>
                        <div className="h-1.5 w-20 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-gradient-to-r from-neon-green to-sev-high" style={{ width: `${a.risk}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatTime(a.time)}</td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {a.entities.map((id) => (
                          <li key={id} className="max-w-[260px] truncate font-mono text-xs text-slate-300">
                            {NODE_BY_ID[id]?.value || id}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5 text-xs"
                        value={a.status}
                        onChange={(e) => setAlertStatus(a.id, e.target.value)}
                        aria-label={`Status for ${a.id}`}
                      >
                        {STATUSES.filter((s) => s !== "all").map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No alerts match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
