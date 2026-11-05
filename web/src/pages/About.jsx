import { PageHeader } from "../components/common";

const SECTIONS = [
  {
    title: "What is Cyber Threat Intelligence?",
    text: "CTI is evidence about attackers: their infrastructure (IP addresses, domains, URLs), their tools (malware and file hashes) and their methods. Analysts use it to decide what to block, what to investigate and what to report.",
  },
  {
    title: "What are Graph Neural Networks?",
    text: "A GNN learns from data that is a network of linked items. Each node updates its representation by combining information from its neighbours over several rounds of message passing, so a node's label can depend on what it is connected to.",
  },
  {
    title: "Why graph-based threat intelligence?",
    text: "Attackers reuse infrastructure. Several domains may resolve to one IP, and malware may contact the same servers. A single indicator can look ordinary on its own while its relationships reveal a campaign.",
  },
  {
    title: "Project objectives",
    text: "Model relationships between threat entities, classify entities as benign, suspicious or malicious, predict suspicious relationships, and present the results in an analyst-friendly interface with honest evaluation.",
  },
  {
    title: "Project methodology",
    text: "Collect indicators from public feeds, build a typed knowledge graph, establish feature-only baselines, train GNN models, evaluate with splits that prevent leakage between related entities, and report results with their variance.",
  },
  {
    title: "Advantages of the proposed system",
    text: "Relationship context for each indicator, explainable results through the neighbours and relations behind a score, and an evaluation that reports where the model fails as well as where it works.",
  },
];

const TECH = [
  { name: "Python", status: "implemented", note: "Data ingestion, graph construction and baseline pipeline." },
  { name: "pandas / NumPy", status: "implemented", note: "Dataset construction and feature tables." },
  { name: "NetworkX", status: "implemented", note: "Knowledge graph construction (src/graph)." },
  { name: "scikit-learn", status: "implemented", note: "Random Forest baseline and evaluation metrics." },
  { name: "React.js + Vite", status: "implemented", note: "This frontend." },
  { name: "Tailwind CSS", status: "implemented", note: "Styling for this frontend." },
  { name: "Recharts", status: "implemented", note: "Dashboard charts." },
  { name: "React Flow (@xyflow/react)", status: "implemented", note: "Interactive graph view." },
  { name: "Lucide React", status: "implemented", note: "Icons." },
  { name: "PyTorch / PyTorch Geometric", status: "planned", note: "GNN model. Not trained or served yet." },
  { name: "FastAPI", status: "planned", note: "REST endpoints. Frontend uses simulated data until then." },
  { name: "PostgreSQL or MongoDB", status: "planned", note: "Storage for indicators and alerts. Not integrated." },
];

const STATUS_STYLE = {
  implemented: "bg-emerald-400/15 text-emerald-200 border-emerald-400/40",
  planned: "bg-amber-400/15 text-amber-200 border-amber-400/40",
};

export default function About() {
  return (
    <>
      <PageHeader eyebrow="About" title="About this project" description="Background, objectives and the technology stack. Status labels show what is actually built." />

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title} className="glass glass-hover p-5">
            <h2 className="font-semibold text-white">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.text}</p>
          </section>
        ))}
      </div>

      <section className="glass mt-6 p-5">
        <h2 className="mb-4 font-semibold text-white">Technology stack</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {TECH.map((t) => (
            <li key={t.name} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 p-4">
              <div>
                <p className="font-medium text-slate-100">{t.name}</p>
                <p className="mt-1 text-xs text-slate-500">{t.note}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLE[t.status]}`}>{t.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
