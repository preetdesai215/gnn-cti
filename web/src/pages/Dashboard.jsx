import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bug, Database, Gauge, Globe, ShieldAlert,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getActivity, getAlerts, getGraph } from "../api/client";
import { ENTITY_TYPES, NODES } from "../data/demo";
import {
  ErrorBlock, LoadingBlock, PageHeader, SeverityBadge, SimulatedBanner, StatCard, formatTime,
} from "../components/common";

const SEVERITY_COLORS = { critical: "#ff4d6d", high: "#ff9f1c", medium: "#facc15", low: "#39ff88" };
const tooltipStyle = { background: "#0a1428", border: "1px solid rgba(34,211,238,0.3)", borderRadius: 12, color: "#e2e8f0" };

function threatLevel(alerts) {
  const open = alerts.filter((a) => a.status === "open" || a.status === "investigating");
  if (open.some((a) => a.severity === "critical")) return { label: "Critical", color: "text-sev-critical" };
  if (open.some((a) => a.severity === "high")) return { label: "High", color: "text-sev-high" };
  if (open.length) return { label: "Elevated", color: "text-sev-medium" };
  return { label: "Low", color: "text-sev-low" };
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getAlerts(), getActivity(), getGraph()])
      .then(([a, act]) => { setAlerts(a); setActivity(act); })
      .catch((e) => setError(e.message));
  }, []);

  const stats = useMemo(() => {
    const flagged = NODES.filter((n) => n.status !== "benign");
    return {
      total: NODES.length,
      maliciousIps: NODES.filter((n) => n.type === "ip" && n.status === "malicious").length,
      suspiciousDomains: NODES.filter((n) => n.type === "domain" && n.status !== "benign").length,
      malware: NODES.filter((n) => n.type === "malware").length,
      detectionRate: Math.round((flagged.length / NODES.length) * 100),
    };
  }, []);

  const severityData = useMemo(() => {
    if (!alerts) return [];
    return ["critical", "high", "medium", "low"].map((s) => ({
      name: s, value: alerts.filter((a) => a.severity === s).length,
    }));
  }, [alerts]);

  const typeData = useMemo(() =>
    Object.entries(ENTITY_TYPES).map(([key, t]) => ({
      name: t.label, count: NODES.filter((n) => n.type === key).length, color: t.color,
    })), []);

  if (error) return <ErrorBlock message={`Could not load dashboard data: ${error}`} />;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Threat Intelligence Dashboard"
        description="Indicator counts, alert distribution and recent activity across the monitored graph."
      />
      <SimulatedBanner />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Database} label="Total Threat Indicators" value={stats.total} hint="Demo graph nodes" />
        <StatCard icon={Globe} label="Malicious IPs" value={stats.maliciousIps} accent="text-sev-critical" hint="Status: malicious" />
        <StatCard icon={AlertTriangle} label="Suspicious Domains" value={stats.suspiciousDomains} accent="text-sev-high" hint="Suspicious or malicious" />
        <StatCard icon={Bug} label="Malware Entities" value={stats.malware} accent="text-sev-critical" hint="Demo families" />
        <StatCard icon={Gauge} label="Detection Rate" value={`${stats.detectionRate}%`} accent="text-neon-green" hint="Flagged share of demo nodes" />
        <div className="glass glass-hover p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Current Threat Level</p>
            <ShieldAlert className="h-5 w-5 text-neon-cyan" />
          </div>
          {alerts ? (
            <p className={`mt-3 text-3xl font-bold ${threatLevel(alerts).color}`}>{threatLevel(alerts).label}</p>
          ) : (
            <p className="mt-3 text-slate-500">…</p>
          )}
          <p className="mt-1 text-xs text-slate-500">From open alerts</p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-white">Indicator and detection activity (14 days, simulated)</h2>
          {activity ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activity}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="indicators" stroke="#22d3ee" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="detections" stroke="#39ff88" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <LoadingBlock />}
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 font-semibold text-white">Severity distribution</h2>
          {alerts ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {severityData.map((d) => <Cell key={d.name} fill={SEVERITY_COLORS[d.name]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <LoadingBlock />}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="glass p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-white">Indicators by entity type</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {typeData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-5 lg:col-span-3">
          <h2 className="mb-4 font-semibold text-white">Recent threat activity</h2>
          {alerts ? (
            <ul className="divide-y divide-white/5">
              {alerts.slice(0, 6).map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{a.title}</p>
                    <p className="text-xs text-slate-500">{formatTime(a.time)} · risk {a.risk}</p>
                  </div>
                  <SeverityBadge severity={a.severity} />
                </li>
              ))}
            </ul>
          ) : <LoadingBlock />}
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-3.5 w-3.5" /> Simulated events. Not live detections.
          </p>
        </div>
      </section>
    </>
  );
}
