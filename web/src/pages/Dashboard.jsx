import { useEffect, useState } from "react";
import { CalendarDays, Database, FlaskConical, Globe, Network, ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { getAlerts, getLatestSummary } from "../api/client";
import { useFreshness } from "../components/freshness";
import Radar from "../components/Radar";
import Ticker from "../components/Ticker";
import { ErrorBlock, LoadingBlock, PageHeader, SeverityBadge, StatCard, formatTime } from "../components/common";

const tooltipStyle = { background: "#0a1428", border: "1px solid rgba(255,92,108,0.3)", borderRadius: 12, color: "#e2e8f0" };

function SourceTag() {
  return (
    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-emerald-300">
      Real data
    </span>
  );
}

export default function Dashboard() {
  const { version } = useFreshness();
  const [summary, setSummary] = useState(undefined); // undefined = loading, null = no file
  const [alerts, setAlerts] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getLatestSummary(), getAlerts()])
      .then(([sum, al]) => { setSummary(sum); setAlerts(al); })
      .catch((e) => setError(e.message));
  }, [version]);

  if (error) return <ErrorBlock message={`Could not load dashboard data: ${error}`} />;

  const exp = summary?.gnn_experiment;
  const rfPr = exp?.random_forest_host_features?.pr_auc;
  const counts = summary?.entity_counts;

  const tickerItems = alerts
    ? alerts.slice(0, 20).map((a) => `${a.severity.toUpperCase()}  ${a.title}  ·  ${a.urls} URL${a.urls === 1 ? "" : "s"}`)
    : null;
  const tickerEmpty = alerts === undefined
    ? "Loading alerts…"
    : alerts === null
      ? "No alerts file found."
      : "No hosts added in the last 7 collection days.";

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Threat Intelligence Dashboard"
        description="Collection statistics from the public URLhaus feed, accumulated day by day. Priorities are fixed rules based on URL counts, not model scores."
      />

      <div className="mb-6">
        <Ticker items={tickerItems} emptyText={tickerEmpty} />
      </div>

      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-white">Collection status</h2>
        <SourceTag />
      </section>

      {summary === undefined && <LoadingBlock label="Loading real data…" />}
      {summary === null && (
        <div className="glass p-5 text-sm text-slate-300">
          No data file found. Run <code className="font-mono text-accent-light">python -m src.export.summary</code> in the
          project folder, then reload this page.
        </div>
      )}

      {summary && !summary.daily_additions && (
        <div className="glass p-5 text-sm text-amber-200">
          This data file is from an older export. Run <code className="font-mono">python -m src.export.summary</code> again.
        </div>
      )}

      {summary && summary.daily_additions && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard i={0} icon={Database} label="URLs collected" value={summary.history.urls} hint="Unique URLs in the history" />
            <StatCard
              i={1}
              icon={CalendarDays}
              label="Collection days"
              value={summary.history.collection_days}
              hint={summary.history.first_collected ? `${summary.history.first_collected} to ${summary.history.last_collected}` : "No collection yet"}
            />
            <StatCard i={2} icon={Globe} label="Domains tracked" value={counts?.domains ?? 0} hint={`${counts?.ip_hosts ?? 0} IP-address hosts`} />
            <StatCard
              i={3}
              icon={Network}
              label="Domains with an IP"
              value={counts?.domains_with_dns_ip ?? 0}
              hint={`${counts?.unique_resolved_ips ?? 0} unique IPs from DNS A records`}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              i={4}
              icon={FlaskConical}
              label="Baseline PR-AUC"
              value={rfPr ? rfPr.mean.toFixed(3) : "n/a"}
              hint={rfPr ? `Random Forest, ±${rfPr.std.toFixed(3)} over seeds` : "Run the GNN experiment"}
            />
            <StatCard
              i={5}
              icon={ShieldAlert}
              label="Phishing URLs"
              value={summary.phishing_feed?.urls ?? 0}
              hint={summary.phishing_feed?.collection_days
                ? `${summary.phishing_feed.collection_days} collection day(s), OpenPhish`
                : "Run python -m src.ingest.phishing"}
            />
          </div>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="glass reveal p-5" style={{ "--i": 6 }}>
              <h3 className="mb-1 font-semibold text-white">New URLs per collection day</h3>
              <p className="mb-4 text-xs text-slate-500">URLs added to the history on each day the update ran.</p>
              {summary.daily_additions.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.daily_additions.map((d) => ({ day: d.day, urls: d.new_urls }))}>
                      <CartesianGrid stroke="rgba(148,163,184,0.1)" />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="urls" fill="#e11d2e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-slate-500">No collection days yet.</p>}
            </div>

            <div className="glass reveal p-5" style={{ "--i": 7 }}>
              <h3 className="mb-1 font-semibold text-white">Threat types in the feed</h3>
              <p className="mb-4 text-xs text-slate-500">Threat labels from URLhaus, by number of URLs.</p>
              {summary.threat_types.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.threat_types} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
                      <YAxis type="category" dataKey="threat" stroke="#64748b" fontSize={11} width={150} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="urls" fill="#ff5c6c" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-slate-500">No threat labels yet.</p>}
            </div>
          </section>

          <section className="glass reveal mt-6 p-5" style={{ "--i": 8 }}>
            <h3 className="mb-1 font-semibold text-white">Most frequent hosts</h3>
            <p className="mb-4 text-xs text-slate-500">Hosts with the most URLs in the history. Names are defanged, so they cannot be clicked.</p>
            {summary.top_hosts_defanged.length ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.top_hosts_defanged} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
                    <YAxis type="category" dataKey="host" stroke="#64748b" fontSize={11} width={220} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="urls" fill="#e11d2e" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-slate-500">No hosts yet.</p>}
          </section>

          <section className="glass reveal mt-6 p-5" style={{ "--i": 9 }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Recent alerts</h3>
              <Link to="/alerts" className="text-xs text-accent-light hover:underline">Open alerts →</Link>
            </div>
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              {alerts !== undefined && (
                <div className="flex justify-center md:justify-start">
                  <Radar alerts={alerts || []} />
                </div>
              )}
              <div className="min-w-0">
                {alerts === undefined && <LoadingBlock />}
                {alerts === null && <p className="text-sm text-slate-500">No alerts file found.</p>}
                {alerts && alerts.length === 0 && <p className="text-sm text-slate-500">No hosts added in the last 7 collection days.</p>}
                {alerts && alerts.length > 0 && (
                  <ul className="divide-y divide-white/5">
                    {alerts.slice(0, 6).map((a) => (
                      <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-slate-100">{a.title}</p>
                          <p className="text-xs text-slate-500">{formatTime(a.time)} · {a.urls} URL{a.urls === 1 ? "" : "s"} in history</p>
                        </div>
                        <SeverityBadge severity={a.severity} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Severity follows a fixed rule on URL count: 10 or more is critical, 5 or more high, 2 or more medium.
              The radar is decorative: each blip's angle is a hash of its host name, and its distance shows severity only.
            </p>
          </section>
        </>
      )}
    </>
  );
}
