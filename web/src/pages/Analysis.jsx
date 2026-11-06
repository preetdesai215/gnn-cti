import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Info, Search } from "lucide-react";
import { analyzeIndicator, classifyInput, getIndicatorHosts, getReference } from "../api/client";
import { brandsFromReference, lookalikeMatch } from "../api/lookalike";
import { useFreshness } from "../components/freshness";
import { EntityBadge, ErrorBlock, LoadingBlock, PageHeader } from "../components/common";

const EXAMPLES = ["example.com", "203.0.113.5", "http://example.com/setup.exe"];

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
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get("q") || "");
  const { version } = useFreshness();
  const [hosts, setHosts] = useState(undefined); // undefined = loading, null = no file
  const [reference, setReference] = useState(undefined); // popularity list, same loading pattern
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [autoRan, setAutoRan] = useState(false);

  useEffect(() => {
    getIndicatorHosts().then(setHosts).catch(() => setHosts(null));
    getReference().then(setReference).catch(() => setReference(null));
  }, [version]);

  // Run the lookup straight away when arriving from the top-bar search or a table link
  useEffect(() => {
    if (hosts && reference !== undefined && params.get("q") && !autoRan) {
      setAutoRan(true);
      runLookup(params.get("q"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosts, reference]);

  function runLookup(value) {
    setError("");
    try {
      setResult(analyzeIndicator(value, hosts, reference));
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  }

  function submit(e) {
    e?.preventDefault();
    const check = classifyInput(text);
    if (!check.ok) {
      setResult(null);
      setError(check.error);
      return;
    }
    if (!hosts) {
      setError("No indicator index found. Run python -m src.export.summary, then reload.");
      return;
    }
    runLookup(text);
  }

  function pick(value) {
    setText(value);
    setError("");
    setResult(null);
  }

  const localHost = result?.input?.type === "domain" || result?.input?.type === "url"
    ? result.input.value.replace(/^https?:\/\//i, "").split(/[/?#]/)[0]
    : null;

  const brands = useMemo(() => brandsFromReference(reference), [reference]);
  const lookHost = localHost ? localHost.split(":")[0].toLowerCase() : null;
  const lookalike = lookHost && brands.length ? lookalikeMatch(lookHost, brands) : null;
  const lookalikeText = {
    homoglyph: "look-alike characters are swapped in",
    typo: "one character is different",
    combo: "the popular name is a word in this name",
    subdomain: "the popular name is used as a subdomain of an unrelated domain",
  };

  return (
    <>
      <PageHeader
        eyebrow="Threat analysis"
        title="Indicator Analysis"
        description="Look up a domain, IP address or URL in your URLhaus history. Lookups use the local index only: nothing is resolved, visited or scanned."
      />

      <form onSubmit={submit} className="glass p-5">
        <label htmlFor="indicator" className="label-eyebrow mb-3 block">Indicator</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="indicator"
            className="input font-mono"
            placeholder="e.g. example.com or 203.0.113.5"
            value={text}
            maxLength={2048}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          <button type="submit" className="btn-primary justify-center" disabled={hosts === undefined}>
            <Search className="h-4 w-4" /> {hosts === undefined ? "Loading…" : "Analyse"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => pick(ex)}
              className="max-w-full truncate rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-red-400/40 hover:text-white">
              {ex}
            </button>
          ))}
        </div>
      </form>

      {hosts === undefined && <div className="mt-4"><LoadingBlock label="Loading indicator index…" /></div>}
      {error && <div className="mt-4"><ErrorBlock message={error} /></div>}

      {lookalike && (
        <section className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm text-amber-100">
          <p className="font-semibold">Possible lookalike of {lookalike.brand}</p>
          <p className="mt-1 text-amber-100/80">
            This name resembles a popular site ({lookalikeText[lookalike.rule]}). That is a rule-based candidate for review,
            not a verdict. Check the address carefully before trusting it, and never enter credentials on a lookalike site.
          </p>
        </section>
      )}

      {result && !result.found && (
        <section className="glass mt-6 p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-accent-light" />
            <div>
              <h2 className="font-semibold text-white">Not in your URLhaus history</h2>
              <p className="mt-1 text-sm text-slate-400">
                URLhaus lists sites that distribute malware. This {result.input.type} did not appear in the feed on the days
                your update ran. That is not a safety check, and most popular sites are never listed.
              </p>
              {result.popularity && (
                <p className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">
                  Popular site: ranked #{result.popularity.rank.toLocaleString()} in the Tranco top{" "}
                  {result.popularity.topN.toLocaleString()} list (matched {result.popularity.matched}). Popularity is not a safety verdict.
                </p>
              )}
              {result.referenceAvailable && !result.popularity && (
                <p className="mt-3 text-xs text-slate-500">Not in the Tranco top list either.</p>
              )}
              {result.referenceAvailable === false && (
                <p className="mt-3 text-xs text-slate-500">
                  The popularity list is not exported yet. Run <code className="font-mono">python -m src.export.summary</code> to add it.
                </p>
              )}
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
              <EntityBadge type={result.record.kind} />
              <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-0.5 text-xs text-red-200">Listed in URLhaus</span>
            </div>
            <p className="mt-4 break-all font-mono text-sm text-slate-100">{result.record.host}</p>

            <dl className="mt-6 space-y-3 text-sm">
              <Row label="URLs in history" value={result.record.urls} />
              <Row label="First seen (URLhaus)" value={result.record.first_seen || "unknown"} />
              <Row label="Last added to history" value={result.record.last_added || "unknown"} />
              <Row label="Most common threat" value={result.record.threat} />
              <Row label="Tags" value={result.record.tags.length ? result.record.tags.join(", ") : "none"} />
              {result.record.kind === "domain" && (
                <Row label="DNS lookup" value={result.record.dns_status} />
              )}
              <Row
                label="Popularity"
                value={result.popularity
                  ? `Ranked #${result.popularity.rank.toLocaleString()} in Tranco top ${result.popularity.topN.toLocaleString()}. Possibly a compromised legitimate site.`
                  : "Not in the Tranco top list"}
              />
              <Row label="IP addresses" value={result.record.ips.length ? result.record.ips.join("  ") : "none"} mono />
            </dl>
            <p className="mt-6 text-xs text-slate-500">Facts from the feed and the DNS cache. Nothing here is a model score.</p>
          </div>

          <div className="glass p-6 lg:col-span-2">
            <h2 className="font-semibold text-white">Shares an IP address with</h2>
            {result.related.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No other host in the history shares an IP address with this one.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  {result.relatedCount} host{result.relatedCount === 1 ? "" : "s"} in the history share an IP address. Most URLs first.
                </p>
                <ul className="mt-4 divide-y divide-white/5">
                  {result.related.map((r) => (
                    <li key={r.host} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-sm text-slate-200">{r.host}</p>
                        <p className="text-xs text-slate-500">Shared: {r.shared.join(", ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <EntityBadge type={r.kind} />
                        <span className="text-xs text-slate-400">{r.urls} URL{r.urls === 1 ? "" : "s"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function Row({ label, value, mono }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-slate-200 ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</dd>
    </div>
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
