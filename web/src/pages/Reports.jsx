import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { getAlerts, getLatestSummary } from "../api/client";
import { ErrorBlock, LoadingBlock, PageHeader, SeverityBadge, formatTime } from "../components/common";
import { useFreshness } from "../components/freshness";

const RECOMMENDATIONS = [
  "Start with the hosts that have the most URLs in the history. Their IP addresses and DNS status are on the Analysis page.",
  "Check DNS status before acting. Many domains stop resolving over time, so the result reflects the day of lookup.",
  "Treat these as feed listings, not confirmed incidents. Confirm with an independent source before any blocking.",
  "Do not visit the listed URLs. This report uses defanged host names only.",
  "Shared IP addresses can mean shared hosting or a shared operator. Review them as a group, not one by one.",
];

export default function Reports() {
  const { version } = useFreshness();
  const [summary, setSummary] = useState(undefined); // undefined = loading, null = no file
  const [alerts, setAlerts] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getLatestSummary(), getAlerts()])
      .then(([sum, al]) => { setSummary(sum); setAlerts(al); })
      .catch((e) => setError(e.message));
  }, [version]);

  if (error) return <ErrorBlock message={error} />;

  const ready = summary && alerts;
  const openCritical = ready && alerts.some((a) => a.severity === "critical");
  const counts = summary?.entity_counts;

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Reporting"
          title="Threat Report"
          description="A summary of the real URLhaus history, the alerts from the last 7 collection days, and the experiment results. Use the print dialog to save it as PDF."
          right={
            <button className="btn-primary" onClick={() => window.print()} disabled={!ready}>
              <Printer className="h-4 w-4" /> Export as PDF
            </button>
          }
        />
      </div>

      {summary === undefined && <LoadingBlock label="Loading real data…" />}
      {summary === null && (
        <div className="glass p-5 text-sm text-slate-300">
          No data file found. Run <code className="font-mono text-accent-light">python -m src.export.summary</code>, then reload.
        </div>
      )}

      {ready && (
        <article className="report-print glass space-y-8 p-6 md:p-8">
          <header>
            <p className="label-eyebrow">Threat intelligence report (real data)</p>
            <h2 className="mt-2 text-2xl font-bold text-white">URLhaus Collection Summary</h2>
            <p className="mt-1 text-sm text-slate-400">
              Generated {summary.generated_utc.replace("T", " ").slice(0, 16)} UTC from the accumulated history.
            </p>
          </header>

          <Section title="1. Collection summary">
            <p className="text-sm text-slate-300">
              The history contains <strong>{summary.history.urls.toLocaleString()}</strong> unique URLs collected over{" "}
              <strong>{summary.history.collection_days}</strong> collection day{summary.history.collection_days === 1 ? "" : "s"}
              {summary.history.first_collected && (
                <> (from {summary.history.first_collected} to {summary.history.last_collected})</>
              )}. They cover <strong>{(counts?.domains ?? 0).toLocaleString()}</strong> domains and{" "}
              <strong>{(counts?.ip_hosts ?? 0).toLocaleString()}</strong> IP-address hosts. <strong>{(counts?.domains_with_dns_ip ?? 0).toLocaleString()}</strong>{" "}
              domains have at least one DNS A record, pointing to <strong>{(counts?.unique_resolved_ips ?? 0).toLocaleString()}</strong> unique IP addresses.
            </p>
          </Section>

          <Section title="2. Most frequent hosts">
            <ul className="divide-y divide-white/5 text-sm">
              {summary.top_hosts_defanged.slice(0, 10).map((h) => (
                <li key={h.host} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="break-all font-mono text-slate-200">{h.host}</span>
                  <span className="text-slate-400">{h.urls} URL{h.urls === 1 ? "" : "s"}</span>
                </li>
              ))}
              {summary.top_hosts_defanged.length === 0 && <li className="py-2 text-slate-500">No hosts yet.</li>}
            </ul>
          </Section>

          <Section title="3. Threat types">
            <ul className="divide-y divide-white/5 text-sm">
              {summary.threat_types.map((t) => (
                <li key={t.threat} className="flex justify-between py-2">
                  <span className="text-slate-200">{t.threat}</span>
                  <span className="text-slate-400">{t.urls.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="4. Experiment results (measured)">
            <ExperimentSummary exp={summary.gnn_experiment} />
          </Section>

          <Section title="4b. Phishing model (OpenPhish vs popular sites)">
            <PhishingSummary data={summary.phishing_experiment} feed={summary.phishing_feed} />
          </Section>

          <Section title="5. Alerts from the last 7 collection days">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No hosts were added in the window.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all font-mono text-slate-200">{a.host}</span>
                    <span className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <span className="text-xs text-slate-500">{formatTime(a.time)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="6. Priority">
            <p className="text-sm text-slate-300">
              {openCritical
                ? "Priority is HIGH: at least one critical alert is open (10 or more URLs for one host)."
                : "Priority is MODERATE: no critical alerts are open. The rule is fixed on URL count and is not a model score."}
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

function ExperimentSummary({ exp }) {
  if (!exp || !exp.setup?.ip_edge_share_by_class) {
    return <p className="text-sm text-slate-400">No current experiment results. Run the GNN experiment and the export first.</p>;
  }
  const rf = exp.random_forest_host_features?.pr_auc;
  const ablation = exp.gnn_no_edges_ablation?.pr_auc;
  const gnn = exp.gnn_graphsage?.pr_auc;
  const graphHelped = gnn && ablation && rf && gnn.mean > Math.max(rf.mean, ablation.mean);
  const fmt = (x) => (x ? `${x.mean.toFixed(3)} ± ${x.std.toFixed(3)}` : "n/a");
  return (
    <div className="space-y-3 text-sm text-slate-300">
      <p>
        PR-AUC over {exp.setup.seeds} grouped seeds, {exp.setup.domain_nodes} domains ({exp.setup.malicious_domains} malicious,{" "}
        {exp.setup.benign_domains} benign):
      </p>
      <ul className="space-y-1 font-mono text-slate-200">
        <li>Random Forest, host features: {fmt(rf)}</li>
        <li>GNN without edges: {fmt(ablation)}</li>
        <li>GNN with IP/DNS edges: {fmt(gnn)}</li>
      </ul>
      <p>
        {graphHelped
          ? "In this run the graph model scored above both feature-only models. Verify the IP-record shares before relying on it."
          : "The graph model did not beat the feature-only models in this setup. The feature-only baseline is the headline result."}
      </p>
    </div>
  );
}

function PhishingSummary({ data, feed }) {
  const count = feed?.urls ?? 0;
  if (!data) {
    return (
      <p className="text-sm text-slate-400">
        {count} phishing URL{count === 1 ? "" : "s"} collected so far. No model results yet: run{" "}
        <code className="font-mono">python -m src.models.phish_eval</code> once there is enough data.
      </p>
    );
  }
  const head = data.headline_excluding_free_hosting;
  const ref = data.reference_including_free_hosting;
  const fmt = (x) => (x?.pr_auc ? `${x.pr_auc.mean.toFixed(3)} ± ${x.pr_auc.std.toFixed(3)}` : "n/a");
  return (
    <div className="space-y-3 text-sm text-slate-300">
      {data.setup?.warning && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-amber-200">{data.setup.warning}</p>
      )}
      <p>
        {data.setup?.phishing_urls_in_history ?? count} phishing URLs collected. The headline result excludes{" "}
        {data.setup?.free_hosting_urls_excluded_from_headline ?? 0} URLs on free hosting platforms, leaving{" "}
        {data.setup?.hosts_in_headline ?? 0} hosts.
      </p>
      <ul className="space-y-1 font-mono text-slate-200">
        <li>Headline PR-AUC (free hosting excluded): {fmt(head)}</li>
        <li>Reference PR-AUC (free hosting included): {fmt(ref)}</li>
      </ul>
      <p className="text-xs text-slate-500">
        Host-only features, grouped split by domain, {data.setup?.grouped_split_seeds ?? 10} seeds. Benign examples are
        popular sites, so this measures phishing against popular sites, not against typical unpopular sites.
      </p>
    </div>
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
