// Data access layer. Every page reads real files written by `python -m src.export.summary`
// into web/public/data/. A missing file returns null, so each page can say so instead of failing.
//
// Planned (not implemented): FastAPI endpoints for live lookups. Until then the pages read these files.

const BASE = import.meta.env.BASE_URL;

async function readData(name) {
  try {
    const res = await fetch(`${BASE}data/${name}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const getLatestSummary = () => readData("latest.json");

export async function getGnnExperiment() {
  const summary = await getLatestSummary();
  return summary?.gnn_experiment ?? null;
}

export async function getAlerts() {
  const data = await readData("alerts.json");
  return data ? data.alerts : null;
}

export const getGraphData = () => readData("graph.json");

export async function getIndicatorHosts() {
  const data = await readData("indicators.json");
  return data ? data.hosts : null;
}

export const getReference = () => readData("reference.json");

// Input validation for the analysis page. Pure string checks: nothing is fetched or resolved.
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const MD5 = /^[a-f0-9]{32}$/i;

// Defanged names (example[.]com) are accepted too, because the pages show them that way.
export function classifyInput(raw) {
  const value = (raw || "").trim().replace(/\[\.\]/g, ".");
  if (!value) return { ok: false, error: "Enter an IP address, domain or URL." };
  if (IPV4.test(value)) return { ok: true, type: "ip", value };
  if (SHA256.test(value) || MD5.test(value)) {
    return { ok: false, error: "File hashes are not in the URLhaus history, so they cannot be looked up here." };
  }
  if (URL_RE.test(value)) return { ok: true, type: "url", value };
  if (DOMAIN.test(value)) return { ok: true, type: "domain", value: value.toLowerCase() };
  return { ok: false, error: "Not a recognized IPv4 address, domain or URL." };
}

const defang = (host) => host.replace(/\./g, "[.]");

function hostFromCheck(check) {
  if (check.type === "url") {
    try {
      return new URL(check.value).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  return check.value.toLowerCase();
}

// Popularity check against the Tranco top list: the exact host, or the host without "www.".
// Parent domains are not checked, because subdomains of shared hosts (for example github.io)
// would otherwise look popular. Popularity is not a safety verdict.
function popularityFor(key, reference) {
  if (!reference?.domains) return null;
  const candidates = [key, key.replace(/^www\[\.\]/, "")];
  for (const candidate of candidates) {
    const rank = reference.domains[candidate];
    if (rank) return { rank, matched: candidate, topN: reference.top_n };
  }
  return null;
}

// Looks the host up in the local history index only. Nothing is resolved, visited or scanned.
// `hosts` is the list from indicators.json, `reference` is reference.json (both may be null).
export function analyzeIndicator(raw, hosts, reference) {
  const check = classifyInput(raw);
  if (!check.ok) throw new Error(check.error);
  const host = hostFromCheck(check);
  const key = host ? defang(host) : null;
  const popularity = key && check.type !== "ip" ? popularityFor(key, reference) : null;
  const record = key ? hosts.find((h) => h.host === key) : null;
  if (!record) return { input: check, found: false, host: key, popularity, referenceAvailable: !!reference?.available };

  const related = [];
  for (const other of hosts) {
    if (other.host === record.host) continue;
    const shared = other.ips.filter((ip) => record.ips.includes(ip));
    if (shared.length) related.push({ host: other.host, kind: other.kind, urls: other.urls, shared });
  }
  related.sort((a, b) => b.urls - a.urls);
  return {
    input: check,
    found: true,
    record,
    popularity,
    related: related.slice(0, 20),
    relatedCount: related.length,
  };
}
