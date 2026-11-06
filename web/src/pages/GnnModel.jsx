import { useEffect, useState } from "react";
import { ArrowDown, FlaskConical } from "lucide-react";
import { getGnnExperiment } from "../api/client";
import { LoadingBlock, PageHeader } from "../components/common";
import { useFreshness } from "../components/freshness";

const PIPELINE = [
  { title: "Feed ingestion", text: "The URLhaus recent feed is collected daily and merged into a history file. Each URL is kept once, with its first-seen date." },
  { title: "Host extraction", text: "Each URL gives a host: a domain or an IP address. Domains are grouped by registered domain for evaluation." },
  { title: "DNS A records", text: "Domains are resolved for A records only, with cached lookups. Each resolved IP becomes a node joined to its domain by an edge." },
  { title: "Node features", text: "Each domain gets seven host features: length, digits, hyphens, subdomain count, IP-host flag, character entropy and TLD length." },
  { title: "GraphSAGE", text: "Two GraphSAGE layers pass information between linked domains and IPs. A linear head outputs the probability of malicious." },
  { title: "Evaluation", text: "Grouped splits by registered domain, repeated over 10 seeds. Every model sees the same splits and the same features." },
];

const ARCHITECTURE = [
  "Input graph: domain and IP nodes, A-record edges",
  "Node features: 7 host features and an IP-node flag",
  "GraphSAGE layer 1 (32 units, ReLU)",
  "Dropout 0.2",
  "GraphSAGE layer 2 (32 units, ReLU)",
  "Linear head with sigmoid: probability of malicious",
];

const LIMITATIONS = [
  "Benign domains are popular sites, and malicious domains come from campaigns. Hosting and popularity can separate the classes without any real threat signal.",
  "DNS is looked up once. Records change, and many malicious domains no longer resolve, so graph coverage depends on when the lookup ran.",
  "Whether a domain has an IP record still differs by class (about 66% of malicious and 91% of benign). In a separate check, adding that one flag raised the Random Forest from 0.63 to 0.69 PR-AUC, so part of any graph signal may reflect resolvability rather than threat.",
  "One feed (URLhaus) and a short history. Results will change as the history grows.",
  "Hyperparameters are fixed and were not tuned, so the test set was never used for model selection.",
  "These are domain-level scores. They are not directly comparable with the URL-level baseline.",
];

export default function GnnModel() {
  // undefined = still loading, null = no results file, object = results
  const { version } = useFreshness();
  const [exp, setExp] = useState(undefined);

  useEffect(() => {
    getGnnExperiment().then(setExp);
  }, [version]);

  return (
    <>
      <PageHeader
        eyebrow="Model"
        title="GNN Model Analysis"
        description="How the graph neural network is built, what it was compared with, and what the experiment showed."
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-500/5 px-4 py-3 text-sm text-red-100">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-accent-light" />
        <p>
          Real results from a limited experiment on public URLhaus data, shown on localhost only. This is a
          research result, not a production detector.
        </p>
      </div>

      <section className="glass p-5">
        <h2 className="mb-5 font-semibold text-white">Pipeline</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="glass glass-hover flex gap-4 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent/30 to-accent-dark/30 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass mt-6 p-5">
        <h2 className="mb-5 font-semibold text-white">Architecture</h2>
        <div className="flex flex-col items-center gap-2 text-center text-sm">
          {ARCHITECTURE.map((label, i, arr) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="w-full max-w-md rounded-xl border border-red-400/25 bg-navy-900/70 px-5 py-2.5 text-slate-200 shadow-[0_0_20px_-10px_#ff5c6c]">
                {label}
              </div>
              {i < arr.length - 1 && <ArrowDown className="h-4 w-4 text-accent-light/60" />}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <p className="label-eyebrow mb-3">Experiment results</p>
        {exp === undefined && <LoadingBlock />}
        {exp === null && <NoResults />}
        {exp && !exp.setup?.ip_edge_share_by_class && <StaleResults />}
        {exp && exp.setup?.ip_edge_share_by_class && <Results exp={exp} />}
      </section>

      <section className="glass mt-6 p-5">
        <h2 className="mb-4 font-semibold text-white">Limitations</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          {LIMITATIONS.map((text) => <li key={text}>{text}</li>)}
        </ul>
      </section>

      <section className="glass mt-6 p-5">
        <h2 className="mb-3 font-semibold text-white">A leak found and fixed</h2>
        <p className="text-sm text-slate-300">
          An early version resolved DNS only for malicious domains. Having an IP record then revealed the label, and
          the GNN scored about 0.91 PR-AUC for that reason alone. Both classes are now resolved the same way, and any
          score from before the fix is invalid and is not shown here.
        </p>
      </section>
    </>
  );
}

function NoResults() {
  return (
    <div className="glass p-5 text-sm text-slate-300">
      No results file found. Run <code className="font-mono text-accent-light">python -m src.models.gnn_experiment</code>,
      then <code className="font-mono text-accent-light">python -m src.export.summary</code>.
    </div>
  );
}

function StaleResults() {
  return (
    <div className="glass border-amber-400/30 p-5 text-sm text-amber-200">
      This results file was made before the DNS fix, so its GNN score is not valid. Rerun
      <code className="mx-1 font-mono">python -m src.models.gnn_experiment</code>
      and then <code className="font-mono">python -m src.export.summary</code>.
    </div>
  );
}

function Results({ exp }) {
  const rows = [
    { label: "Random Forest, host features", pr: exp.random_forest_host_features?.pr_auc, color: "from-slate-500 to-slate-400" },
    { label: "GNN without edges (ablation)", pr: exp.gnn_no_edges_ablation?.pr_auc, color: "from-accent-dark to-accent" },
    { label: "GNN with IP/DNS edges", pr: exp.gnn_graphsage?.pr_auc, color: "from-accent to-accent-light" },
  ].filter((r) => r.pr);

  const gnn = exp.gnn_graphsage?.pr_auc?.mean;
  const baselines = [exp.random_forest_host_features?.pr_auc?.mean, exp.gnn_no_edges_ablation?.pr_auc?.mean].filter((x) => x != null);
  const graphHelped = gnn != null && baselines.length > 0 && gnn > Math.max(...baselines);
  const share = exp.setup.ip_edge_share_by_class;
  const shareGap = Math.abs(share.malicious - share.benign);

  return (
    <div className="space-y-6">
      <div className="glass p-5">
        <h3 className="font-semibold text-white">PR-AUC, mean ± std over {exp.setup.seeds} seeds</h3>
        <p className="mb-5 text-xs text-slate-500">Higher is better. Same grouped splits and host features for every model.</p>
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">{r.label}</span>
                <span className="font-mono text-white">
                  {r.pr.mean.toFixed(3)} <span className="text-slate-500">± {r.pr.std.toFixed(3)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-white/5">
                <div className={`h-full rounded-full bg-gradient-to-r ${r.color}`} style={{ width: `${Math.min(r.pr.mean, 1) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-slate-300">
          {graphHelped
            ? "In this run the graph model scored above both feature-only models. Check the IP-edge share below before trusting it."
            : "In this setup the graph model did not beat the feature-only models, so the graph adds no value here. The feature-only baseline is the headline result."}
        </p>
      </div>

      <div className="glass grid gap-6 p-5 md:grid-cols-3">
        <Fact label="Domains" value={exp.setup.domain_nodes} hint={`${exp.setup.malicious_domains} malicious, ${exp.setup.benign_domains} benign`} />
        <Fact label="IP nodes" value={exp.setup.ip_nodes} hint={`${exp.setup.edges_directed} directed edges`} />
        <div>
          <p className="text-sm text-slate-400">Domains with an IP edge</p>
          <p className="mt-2 font-mono text-sm text-white">
            malicious {(share.malicious * 100).toFixed(0)}% · benign {(share.benign * 100).toFixed(0)}%
          </p>
          <p className={`mt-1 text-xs ${shareGap > 0.1 ? "text-amber-300" : "text-slate-500"}`}>
            {shareGap > 0.1
              ? "The classes differ by more than 10 points, so DNS coverage may still reveal the label."
              : "The classes are close, so DNS coverage does not reveal the label."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, hint }) {
  return (
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
