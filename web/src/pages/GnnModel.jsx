import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { getModelMetrics } from "../api/client";
import { ENTITY_TYPES, NODES } from "../data/demo";
import { ErrorBlock, LoadingBlock, PageHeader, SimulatedBanner, StatCard } from "../components/common";

const PIPELINE = [
  { title: "Graph construction", text: "Each indicator becomes a node. Documented relationships (resolves_to, hosted_on, delivers, communicates_with) become edges." },
  { title: "Node feature extraction", text: "Each node gets numeric features from its own value, such as length, character entropy, digit count and TLD." },
  { title: "Edge and relationship representation", text: "Edges are typed. Each relation type is kept so the model can treat, for example, communicates_with differently from similar_to." },
  { title: "GNN architecture", text: "Stacked graph layers (for example GraphSAGE or R-GCN in PyTorch Geometric) produce an embedding for each node." },
  { title: "Graph message passing", text: "Each layer updates a node's embedding by combining it with its neighbours' embeddings, so context from linked entities flows in." },
  { title: "Node classification", text: "A classification head maps each embedding to benign, suspicious or malicious." },
  { title: "Threat prediction", text: "Predicted probabilities become risk scores. Unobserved links can be scored as likely relationships (link prediction)." },
];

const CLASSES = ["Benign", "Malicious"];

export default function GnnModel() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getModelMetrics().then(setMetrics).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBlock message={error} />;

  const sample = NODES.filter((n) => n.status !== "benign").slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="Model"
        title="GNN Model Analysis"
        description="How the graph neural network is built, how it passes messages between entities, and how it is evaluated."
      />
      <SimulatedBanner>
        Metrics, the confusion matrix and the predictions below are illustrative sample values, not results from
        the trained model.
      </SimulatedBanner>

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
        <h2 className="mb-5 font-semibold text-white">Architecture (illustrative)</h2>
        <div className="flex flex-col items-center gap-2 text-center text-sm">
          {["Input graph: nodes + typed edges", "Node features (per entity)", "GNN layer 1: message passing", "GNN layer 2: message passing", "Classification head", "Output: class + confidence"].map((label, i, arr) => (
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
        <p className="label-eyebrow mb-3">Model performance (illustrative sample)</p>
        {metrics ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Accuracy" value={pct(metrics.accuracy)} />
            <StatCard label="Precision" value={pct(metrics.precision)} accent="text-accent" />
            <StatCard label="Recall" value={pct(metrics.recall)} accent="text-accent-dark" />
            <StatCard label="F1-Score" value={pct(metrics.f1)} accent="text-accent" />
          </div>
        ) : <LoadingBlock />}

        {metrics && (
          <div className="glass mt-6 grid gap-6 p-5 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold text-white">Confusion matrix (sample)</h3>
              <p className="mb-4 text-xs text-slate-500">Rows: actual class. Columns: predicted class.</p>
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-center text-xs">
                <span />
                {CLASSES.map((c) => <span key={c} className="text-slate-400">Pred {c}</span>)}
                {metrics.confusion.map((row, r) => (
                  <Row key={CLASSES[r]} label={`Actual ${CLASSES[r]}`} row={row} r={r} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-white">Model confidence on sample entities</h3>
              <p className="mb-4 text-xs text-slate-500">Illustrative: derived from the demo risk values.</p>
              <ul className="space-y-3">
                {sample.map((n) => (
                  <li key={n.id}>
                    <div className="flex justify-between text-xs">
                      <span className="max-w-[70%] truncate font-mono text-slate-300">{n.value}</span>
                      <span className="text-slate-400">{ENTITY_TYPES[n.type].label} · {n.risk}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light" style={{ width: `${n.risk}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function Row({ label, row, r }) {
  return (
    <>
      <span className="text-left text-slate-400">{label}</span>
      {row.map((v, c) => (
        <span
          key={c}
          className={`rounded-lg py-3 font-bold ${r === c ? "bg-emerald-400/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}
        >
          {v}
        </span>
      ))}
    </>
  );
}
