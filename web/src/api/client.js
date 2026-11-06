// Data access layer. Every page reads through this module, so the simulated data
// can be swapped for the FastAPI backend without changing the pages.
//
// Planned endpoints (not implemented yet):
//   GET  /api/indicators        list indicators and risk scores
//   GET  /api/graph             nodes and edges for the graph view
//   POST /api/analyze           classify a submitted indicator with the trained GNN
//   GET  /api/alerts            alert list with filters
//   GET  /api/model/metrics     evaluation metrics from data/processed
import { ACTIVITY, ALERTS, EDGES, ILLUSTRATIVE_METRICS, NODES } from "../data/demo";

const SIMULATED_DELAY_MS = 350;

function simulated(value) {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), SIMULATED_DELAY_MS));
}

export const DATA_SOURCE = "simulated";

export const getGraph = () => simulated({ nodes: NODES, edges: EDGES });
export const getAlerts = () => simulated(ALERTS);
export const getActivity = () => simulated(ACTIVITY);
export const getModelMetrics = () => simulated(ILLUSTRATIVE_METRICS);

// Real results written by `python -m src.export.summary` to web/public/data/latest.json.
// Returns null when the file is missing or unreadable, so pages can say so instead of failing.
export async function getLatestSummary() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getGnnExperiment() {
  const summary = await getLatestSummary();
  return summary?.gnn_experiment ?? null;
}

// Input validation for the analysis page. Pure string checks: nothing is fetched or resolved.
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const MD5 = /^[a-f0-9]{32}$/i;

export function classifyInput(raw) {
  const value = (raw || "").trim();
  if (!value) return { ok: false, error: "Enter an IP address, domain, URL, or file hash." };
  if (IPV4.test(value)) return { ok: true, type: "ip", value };
  if (SHA256.test(value) || MD5.test(value)) return { ok: true, type: "file", value: value.toLowerCase() };
  if (URL_RE.test(value)) return { ok: true, type: "url", value };
  if (DOMAIN.test(value)) return { ok: true, type: "domain", value: value.toLowerCase() };
  return {
    ok: false,
    error: "Not a recognized IPv4 address, domain, URL, MD5/SHA-256 hash.",
  };
}

// Looks up the submitted value in the simulated dataset only.
// It does not contact the indicator, resolve it, or query any external service.
export async function analyzeIndicator(raw) {
  const check = classifyInput(raw);
  if (!check.ok) throw new Error(check.error);
  const graph = await simulated({ nodes: NODES, edges: EDGES });
  const match = graph.nodes.find(
    (n) => n.value.toLowerCase() === check.value.toLowerCase() ||
      n.value.toLowerCase().startsWith(check.value.toLowerCase())
  );
  if (!match) {
    return { input: check, found: false };
  }
  const related = graph.edges
    .filter((e) => e.source === match.id || e.target === match.id)
    .map((e) => {
      const otherId = e.source === match.id ? e.target : e.source;
      const other = graph.nodes.find((n) => n.id === otherId);
      return { relation: e.relation, direction: e.source === match.id ? "out" : "in", entity: other };
    });
  return { input: check, found: true, node: match, related };
}
