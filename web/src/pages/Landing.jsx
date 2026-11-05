import { Link } from "react-router-dom";
import { ArrowRight, Brain, GitFork, Radar, ShieldHalf, Siren } from "lucide-react";

const NODE_POS = [
  [12, 22], [38, 12], [70, 18], [88, 40], [78, 72], [54, 62],
  [30, 70], [14, 56], [46, 38], [64, 34], [24, 40], [92, 86],
];
const EDGE_PAIRS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 8], [8, 9], [9, 2], [6, 7], [7, 0], [6, 8], [10, 8], [11, 4], [10, 0]];

function NetworkBackdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-70" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="edge" x1="0" x2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#39ff88" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {EDGE_PAIRS.map(([a, b], i) => (
        <line key={i} x1={NODE_POS[a][0]} y1={NODE_POS[a][1]} x2={NODE_POS[b][0]} y2={NODE_POS[b][1]}
          stroke="url(#edge)" strokeWidth="0.25" className="animate-flow" />
      ))}
      {NODE_POS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.9" fill={i % 3 === 0 ? "#39ff88" : i % 3 === 1 ? "#22d3ee" : "#3b82f6"}
          className="animate-drift" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
    </svg>
  );
}

const CAPABILITIES = [
  { icon: GitFork, title: "Relationship graph", text: "Map IPs, domains, URLs, malware, files and actors through documented relationships." },
  { icon: Brain, title: "GNN classification", text: "Score entities using their own features and their neighbours in the graph." },
  { icon: Radar, title: "Indicator analysis", text: "Validate an IP, domain, URL or hash and look up its context in the dataset." },
  { icon: Siren, title: "Alert triage", text: "Prioritise critical, high, medium and low alerts with status and search." },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_60%)]" />
      <NetworkBackdrop />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-green to-neon-blue">
              <ShieldHalf className="h-5 w-5 text-navy-950" />
            </div>
            <span className="font-bold text-white">GNN-CTI</span>
          </div>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-xs text-amber-200">
            Simulated demo data
          </span>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <p className="label-eyebrow mb-4">Cyber Threat Intelligence Platform</p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-6xl">
            GNN-Based Cyber Threat Intelligence System
          </h1>
          <p className="mt-4 bg-gradient-to-r from-neon-green to-neon-cyan bg-clip-text text-xl font-semibold text-transparent sm:text-2xl">
            "Intelligent Threat Detection Through Graph Neural Networks."
          </p>
          <p className="mt-6 max-w-2xl text-slate-400">
            Malicious infrastructure rarely works alone. Domains resolve to shared IPs, malware talks to
            command servers, and actors reuse tools. This platform models those links as a graph and uses a
            Graph Neural Network to flag suspicious entities and relationships.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/analysis" className="btn-primary">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/dashboard" className="btn-ghost">Explore Dashboard</Link>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="glass glass-hover p-5">
                <Icon className="mb-3 h-6 w-6 text-neon-green" />
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="text-center text-xs text-slate-600">
          Demo interface. Indicators use reserved example names and documentation IP ranges. No live scanning.
        </footer>
      </div>
    </div>
  );
}
