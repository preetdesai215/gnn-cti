import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { getAlerts } from "../api/client";
import { EDGES, ENTITY_TYPES, NODES } from "../data/demo";
import { ErrorBlock, LoadingBlock, PageHeader, SeverityBadge, SimulatedBanner, StatusBadge, formatTime } from "../components/common";

const RECOMMENDATIONS = [
  "Block or sinkhole the malicious domains and IPs listed above at the network perimeter, after confirming with your own change process.",
  "Search endpoint logs for connections to the flagged infrastructure and for the file hashes listed.",
  "Investigate the open critical and high alerts first, then the suspicious entities.",
  "Review shared-hosting relationships: entities that resolve to the same IP may share an operator.",
  "Verify model results with an independent source before acting on them. Scores here are simulated.",
];

export default function Reports() {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("all");

  useEffect(() => {
    getAlerts().then(setAlerts).catch((e) => setError(e.message));
  }, []);

  const report = useMemo(() => {
    if (!alerts) return null;
    const nodes = scope === "malicious" ? NODES.filter((n) => n.status !== "benign") : NODES;
    const ids = new Set(nodes.map((n) => n.id));
    const edges = EDGES.filter((e) => ids.has(e.source) && ids.has(e.target));
    const relationCounts = edges.reduce((acc, e) => ({ ...acc, [e.relation]: (acc[e.relation] || 0) + 1 }), {});
    const open = alerts.filter((a) => a.status === "open" || a.status === "investigating");
    const avgRisk = Math.round(nodes.reduce((s, n) => s + n.risk, 0) / nodes.length);
    return {
      nodes,
      edges,
      relationCounts,
      open,
      avgRisk,
      topAlerts: [...alerts].sort((a, b) => b.risk - a.risk).slice(0, 5),
      malicious: nodes.filter((n) => n.status === "malicious"),
      suspicious: nodes.filter((n) => n.status === "suspicious"),
    };
  }, [alerts, scope]);

  if (error) return <ErrorBlock message={error} />;

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Reporting"
          title="Threat Report"
          description="Generate a summary of the demo graph, alerts and model output. Use the print dialog to save it as PDF."
          right={
            <button className="btn-primary" onClick={() => window.print()} disabled={!report}>
              <Printer className="h-4 w-4" /> Export as PDF
            </button>
          }
        />
        <SimulatedBanner />
        <div className="glass mb-6 flex flex-wrap items-center gap-3 p-4 text-sm">
          <span className="text-slate-400">Scope:</span>
          {[["all", "All entities"], ["malicious", "Suspicious and malicious only"]].map(([v, label]) => (
            <button key={v} onClick={() => setScope(v)}
              className={`rounded-full border px-3 py-1 transition ${scope === v ? "border-accent/60 bg-accent/10 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {!report ? <LoadingBlock /> : (
        <article className="report-print glass space-y-8 p-6 md:p-8">
          <header>
            <p className="label-eyebrow">Threat intelligence report (simulated)</p>
            <h2 className="mt-2 text-2xl font-bold text-white">GNN-Based CTI Summary</h2>
            <p className="mt-1 text-sm text-slate-400">Generated from demo data at {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.</p>
          </header>

          <Section title="1. Threat summary">
            <p className="text-sm text-slate-300">
              The demo graph contains <strong>{report.nodes.length}</strong> entities and <strong>{report.edges.length}</strong> documented
              relationships. <strong>{report.malicious.length}</strong> are classed as malicious and <strong>{report.suspicious.length}</strong> as
              suspicious. The average risk score is <strong>{report.avgRisk}</strong>/100. <strong>{report.open.length}</strong> alerts are open or under investigation.
            </p>
          </Section>

          <Section title="2. Identified malicious entities">
            <ul className="divide-y divide-white/5 text-sm">
              {report.malicious.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="break-all font-mono text-slate-200">{n.value}</span>
                  <span className="text-slate-400">{ENTITY_TYPES[n.type].label} · risk {n.risk}</span>
                </li>
              ))}
              {report.malicious.length === 0 && <li className="py-2 text-slate-500">None in this scope.</li>}
            </ul>
          </Section>

          <Section title="3. Graph relationship analysis">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(report.relationCounts).map(([rel, count]) => (
                <div key={rel} className="flex justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className="text-accent-light">{rel}</span>
                  <span className="text-slate-300">{count}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="4. GNN prediction results (illustrative)">
            <p className="text-sm text-slate-400">
              Predicted classes and risk values here are the demo values. Model performance figures are illustrative
              and are shown on the GNN Model page; they are not measured results.
            </p>
          </Section>

          <Section title="5. Top alerts">
            <ul className="space-y-2 text-sm">
              {report.topAlerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-200">{a.title}</span>
                  <span className="flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <StatusBadge status={a.status === "open" || a.status === "investigating" ? "suspicious" : "benign"} />
                    <span className="text-xs text-slate-500">{formatTime(a.time)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="6. Risk assessment">
            <p className="text-sm text-slate-300">
              {report.open.some((a) => a.severity === "critical")
                ? "Overall risk is HIGH in this demo: at least one critical alert is open."
                : "Overall risk is MODERATE in this demo: no critical alerts are open."}
            </p>
          </Section>

          <Section title="7. Recommendations">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
              {RECOMMENDATIONS.map((r) => <li key={r}>{r}</li>)}
            </ol>
          </Section>
        </article>
      )}
    </>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-white/10 pb-2 font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}
