// SIMULATED DEMO DATA. Nothing here is real threat intelligence.
// Domains use reserved names (.example, .test, .invalid) and IPs use documentation
// ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), so nothing points at real hosts.
// Replace this module with calls to the FastAPI backend once it exists (see src/api/client.js).

export const ENTITY_TYPES = {
  ip: { label: "IP Address", color: "#22d3ee" },
  domain: { label: "Domain", color: "#3b82f6" },
  url: { label: "URL", color: "#a78bfa" },
  malware: { label: "Malware", color: "#ff4d6d" },
  file: { label: "File / Hash", color: "#facc15" },
  actor: { label: "Threat Actor", color: "#39ff88" },
};

// risk: 0-100 (model risk score in the demo). status: malicious | suspicious | benign
export const NODES = [
  { id: "ip-1", type: "ip", value: "192.0.2.14", risk: 92, status: "malicious", country: "Demo-Region A", asn: "AS64500 (demo)" },
  { id: "ip-2", type: "ip", value: "198.51.100.23", risk: 81, status: "malicious", country: "Demo-Region B", asn: "AS64501 (demo)" },
  { id: "ip-3", type: "ip", value: "203.0.113.77", risk: 58, status: "suspicious", country: "Demo-Region C", asn: "AS64502 (demo)" },
  { id: "ip-4", type: "ip", value: "192.0.2.201", risk: 12, status: "benign", country: "Demo-Region A", asn: "AS64500 (demo)" },
  { id: "ip-5", type: "ip", value: "198.51.100.90", risk: 74, status: "suspicious", country: "Demo-Region B", asn: "AS64501 (demo)" },
  { id: "dom-1", type: "domain", value: "update-check.evil-demo.example", risk: 95, status: "malicious" },
  { id: "dom-2", type: "domain", value: "cdn-static.demo-sync.test", risk: 77, status: "suspicious" },
  { id: "dom-3", type: "domain", value: "payroll-verify.demo.invalid", risk: 88, status: "malicious" },
  { id: "dom-4", type: "domain", value: "docs.company-demo.example", risk: 8, status: "benign" },
  { id: "dom-5", type: "domain", value: "login-secure-demo.test", risk: 69, status: "suspicious" },
  { id: "dom-6", type: "domain", value: "mirror.fastfiles-demo.example", risk: 84, status: "malicious" },
  { id: "url-1", type: "url", value: "http://update-check.evil-demo.example/gate.php", risk: 96, status: "malicious" },
  { id: "url-2", type: "url", value: "https://payroll-verify.demo.invalid/login", risk: 86, status: "malicious" },
  { id: "url-3", type: "url", value: "http://mirror.fastfiles-demo.example/setup.exe", risk: 79, status: "suspicious" },
  { id: "mal-1", type: "malware", value: "DemoLoader (family)", risk: 97, status: "malicious" },
  { id: "mal-2", type: "malware", value: "DemoStealer (family)", risk: 90, status: "malicious" },
  { id: "mal-3", type: "malware", value: "DemoMiner (family)", risk: 63, status: "suspicious" },
  { id: "file-1", type: "file", value: "3f2a…c91e (SHA-256, demo)", risk: 93, status: "malicious" },
  { id: "file-2", type: "file", value: "9b0d…4a77 (SHA-256, demo)", risk: 71, status: "suspicious" },
  { id: "file-3", type: "file", value: "e1c8…0f3b (SHA-256, demo)", risk: 5, status: "benign" },
  { id: "actor-1", type: "actor", value: "Actor-DEMO-01", risk: 89, status: "malicious" },
  { id: "actor-2", type: "actor", value: "Actor-DEMO-02", risk: 66, status: "suspicious" },
];

// relation describes the documented relationship between two entities
export const EDGES = [
  { id: "e1", source: "dom-1", target: "ip-1", relation: "resolves_to" },
  { id: "e2", source: "dom-3", target: "ip-2", relation: "resolves_to" },
  { id: "e3", source: "dom-6", target: "ip-1", relation: "resolves_to" },
  { id: "e4", source: "dom-2", target: "ip-5", relation: "resolves_to" },
  { id: "e5", source: "dom-5", target: "ip-2", relation: "resolves_to" },
  { id: "e6", source: "dom-4", target: "ip-4", relation: "resolves_to" },
  { id: "e7", source: "url-1", target: "dom-1", relation: "hosted_on" },
  { id: "e8", source: "url-2", target: "dom-3", relation: "hosted_on" },
  { id: "e9", source: "url-3", target: "dom-6", relation: "hosted_on" },
  { id: "e10", source: "url-1", target: "mal-1", relation: "delivers" },
  { id: "e11", source: "url-3", target: "mal-2", relation: "delivers" },
  { id: "e12", source: "file-1", target: "mal-1", relation: "variant_of" },
  { id: "e13", source: "file-2", target: "mal-2", relation: "variant_of" },
  { id: "e14", source: "file-3", target: "mal-3", relation: "similar_to" },
  { id: "e15", source: "mal-1", target: "ip-1", relation: "communicates_with" },
  { id: "e16", source: "mal-2", target: "ip-2", relation: "communicates_with" },
  { id: "e17", source: "mal-3", target: "ip-5", relation: "communicates_with" },
  { id: "e18", source: "actor-1", target: "mal-1", relation: "operates" },
  { id: "e19", source: "actor-1", target: "mal-2", relation: "operates" },
  { id: "e20", source: "actor-2", target: "mal-3", relation: "operates" },
  { id: "e21", source: "ip-3", target: "dom-2", relation: "hosts" },
  { id: "e22", source: "ip-4", target: "dom-4", relation: "hosts" },
  { id: "e23", source: "file-2", target: "url-3", relation: "downloaded_from" },
];

export const ALERTS = [
  { id: "AL-1041", severity: "critical", title: "C2 beaconing to known-bad infrastructure", description: "Host repeatedly contacts an IP linked to DemoLoader command-and-control.", entities: ["ip-1", "mal-1", "dom-1"], risk: 95, status: "open", time: "2026-11-05T08:42:00Z" },
  { id: "AL-1040", severity: "critical", title: "Credential-phishing domain resolving to malicious IP", description: "Domain impersonates a payroll portal and resolves to a flagged address.", entities: ["dom-3", "ip-2", "url-2"], risk: 91, status: "investigating", time: "2026-11-05T07:15:00Z" },
  { id: "AL-1039", severity: "high", title: "Malware sample variant of known family", description: "File hash is a close variant of DemoStealer per the similarity model.", entities: ["file-2", "mal-2"], risk: 78, status: "open", time: "2026-11-05T05:03:00Z" },
  { id: "AL-1038", severity: "high", title: "Suspicious download from new mirror domain", description: "Executable served from a domain with low reputation and high entropy name.", entities: ["url-3", "dom-6"], risk: 72, status: "open", time: "2026-11-04T21:30:00Z" },
  { id: "AL-1037", severity: "medium", title: "Infrastructure shared between two suspicious domains", description: "Two low-reputation domains share a hosting IP; review for common operator.", entities: ["dom-2", "dom-5", "ip-5"], risk: 58, status: "open", time: "2026-11-04T16:20:00Z" },
  { id: "AL-1036", severity: "medium", title: "Actor-linked miner family observed", description: "Miner family with a low-confidence link to a known actor.", entities: ["mal-3", "actor-2"], risk: 49, status: "resolved", time: "2026-11-04T11:05:00Z" },
  { id: "AL-1035", severity: "low", title: "Similar file to known benign sample", description: "Hash is similar to a benign reference; no malicious indicators found.", entities: ["file-3", "mal-3"], risk: 22, status: "false_positive", time: "2026-11-03T14:48:00Z" },
  { id: "AL-1034", severity: "low", title: "Low-risk domain contacted once", description: "Single contact to a benign documentation domain; logged for context.", entities: ["dom-4"], risk: 10, status: "resolved", time: "2026-11-03T09:12:00Z" },
];

// Simulated 14-day activity (indicators ingested, detections raised)
export const ACTIVITY = Array.from({ length: 14 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 10, 5 - (13 - i)));
  const indicators = 180 + ((i * 37) % 70) + i * 4;
  const detections = 9 + ((i * 7) % 11) + Math.round(i / 3);
  return {
    day: day.toISOString().slice(5, 10),
    indicators,
    detections,
  };
});

// Illustrative model metrics. These are sample values, NOT results from the trained model.
export const ILLUSTRATIVE_METRICS = {
  accuracy: 0.93,
  precision: 0.91,
  recall: 0.88,
  f1: 0.895,
  // rows = actual, cols = predicted; [benign, malicious]
  confusion: [
    [412, 38],
    [56, 394],
  ],
};
