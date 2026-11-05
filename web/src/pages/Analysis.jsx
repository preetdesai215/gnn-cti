import { useState } from "react";
import { Info, Search } from "lucide-react";
import { analyzeIndicator, classifyInput } from "../api/client";
import {
  EntityBadge, ErrorBlock, PageHeader, SimulatedBanner, StatusBadge,
} from "../components/common";

const EXAMPLES = [
  "update-check.evil-demo.example",
  "192.0.2.14",
  "http://mirror.fastfiles-demo.example/setup.exe",
  "3f2a0000000000000000000000000000000000000000000000000000000000c9",
  "docs.company-demo.example",
];

// Shannon entropy of a string, in bits per character. Computed locally, from the text only.
function entropy(s) {
  if (!s) return 0;
  const counts = {};
  for (const ch of s) counts[ch] = (counts[ch] || 0) + 1;
  return -Object.values(counts).reduce((sum, c) => {
    const p = c / s.length;
    return sum + p * Math.log2(p);
  }, 0);
}

export default function Analysis() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setError("");
    const check = classifyInput(text);
    if (!check.ok) {
      setResult(null);
      setError(check.error);
      return;
    }
    setLoading(true);
    try {
      setResult(await analyzeIndicator(text));
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function pick(value) {
    setText(value);
    setError("");
    setResult(null);
  }

  const localHost = result?.input?.type === "domain" || result?.input?.type === "url"
    ? result.input.value.replace(/^https?:\/\//i, "").split(/[/?#]/)[0]
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Threat analysis"
        title="Indicator Analysis"
        description="Enter an IP address, domain, URL or file hash. The input is checked and looked up in the simulated dataset only."
      />
      <SimulatedBanner>
        Lookup uses simulated demo data. This tool does not resolve, visit, scan or query any external threat
        intelligence service.
      </SimulatedBanner>

      <form onSubmit={submit} className="glass p-5">
        <label htmlFor="indicator" className="label-eyebrow mb-3 block">Indicator</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="indicator"
            className="input font-mono"
            placeholder="e.g. update-check.evil-demo.example or 192.0.2.14"
            value={text}
            maxLength={2048}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          <button type="submit" className="btn-primary justify-center" disabled={loading}>
            <Search className="h-4 w-4" /> {loading ? "Analysing…" : "Analyse"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => pick(ex)}
              className="max-w-full truncate rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-cyan-400/40 hover:text-white">
              {ex}
            </button>
          ))}
        </div>
      </form>

      {error && <div className="mt-4"><ErrorBlock message={error} /></div>}

      {result && !result.found && (
        <section className="glass mt-6 p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-neon-cyan" />
            <div>
              <h2 className="font-semibold text-white">Not in the simulated dataset</h2>
              <p className="mt-1 text-sm text-slate-400">
                This indicator is a valid {result.input.type}, but it is not in the demo data, so no classification
                is available. The platform will return a model score once the trained GNN is connected.
              </p>
            </div>
          </div>
          {localHost && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Feature label="Host length" value={`${localHost.length} chars`} />
              <Feature label="Host entropy" value={`${entropy(localHost).toFixed(2)} bits/char`} />
              <Feature label="Digits in host" value={String([...localHost].filter((c) => /\d/.test(c)).length)} />
            </div>
          )}
          {localHost && <p className="mt-3 text-xs text-slate-500">These are text features computed locally from the input. They are not a classification.</p>}
        </section>
      )}

      {result?.found && (
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="glass p-6 lg:col-span-1">
            <div className="flex items-center justify-between">
              <EntityBadge type={result.node.type} />
              <StatusBadge status={result.node.status} />
            </div>
            <p className="mt-4 break-all font-mono text-sm text-slate-100">{result.node.value}</p>

            <div className="mt-6">
              <div className="flex items-end justify-between">
                <p className="text-sm text-slate-400">Risk score (demo)</p>
                <p className="text-3xl font-bold text-white">{result.node.risk}<span className="text-base text-slate-500">/100</span></p>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${result.node.risk}%`,
                    background: result.node.risk >= 75 ? "#ff4d6d" : result.node.risk >= 50 ? "#ff9f1c" : "#39ff88",
                  }}
                />
              </div>
            </div>
            <p className="mt-6 text-xs text-slate-500">Simulated classification from the demo graph. Not a live result.</p>
          </div>

          <div className="glass p-6 lg:col-span-2">
            <h2 className="font-semibold text-white">Related entities and relationships</h2>
            {result.related.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No relationships recorded for this entity.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {result.related.map((r, i) => (
                  <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-neon-cyan">
                        {r.direction === "out" ? `→ ${r.relation}` : `← ${r.relation}`}
                      </p>
                      <p className="break-all font-mono text-sm text-slate-200">{r.entity?.value}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <EntityBadge type={r.entity?.type} />
                      {r.entity && <StatusBadge status={r.entity.status} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {result.related.some((r) => r.entity?.status === "malicious") && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                Suspicious relationship: this entity is linked to at least one malicious entity in the demo graph.
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function Feature({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-navy-900/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}
