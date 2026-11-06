// Heuristic lookalike check for possible phishing domains. It compares a domain with the most
// popular sites in the Tranco top list. A match is a candidate for review, not a verdict.
//
// Rules, checked against each popular site ("brand"), first match wins:
//   homoglyph  equal to the brand after swapping look-alike characters (paypa1 -> paypal)
//   typo       one edit away from the brand (goggle -> google)
//   combo      the brand is a hyphen-separated word (paypal-secure-login)
//   subdomain  the brand is a hyphen-separated word in a label under a different domain
//              (paypal.com.evil.example)
//
// Names shorter than MIN_NAME_LEN are not compared for typo and homoglyph, so short words do not match.
// Exact copies of popular domains, and the same name under another country suffix (google.de), are skipped.

export const MIN_NAME_LEN = 5;
export const BRAND_TOP_N = 1000;
const HOMOGLYPH = { 0: "o", 1: "l", 3: "e", 4: "a", 5: "s" };
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);

export function registeredParts(host) {
  const labels = host.toLowerCase().split(".");
  const last = labels[labels.length - 1];
  const cut = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) && last.length === 2 ? 3 : 2;
  if (labels.length < cut) return { name: last, registered: host.toLowerCase(), before: [] };
  return {
    name: labels[labels.length - cut],
    registered: labels.slice(-cut).join("."),
    before: labels.slice(0, -cut),
  };
}

function fold(name) {
  const swapped = name.replaceAll("rn", "m").replaceAll("vv", "w");
  return [...swapped].map((c) => HOMOGLYPH[c] ?? c).join("");
}

// True when a and b differ by exactly one substitution, insertion or deletion.
function isOneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diff > 1) return false;
    }
    return diff === 1;
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

// Brands from the Tranco reference (defanged names with ranks). Returns [{ name, registered }].
export function brandsFromReference(reference) {
  if (!reference?.domains) return [];
  const seen = new Map();
  for (const [defanged, rank] of Object.entries(reference.domains)) {
    if (rank > BRAND_TOP_N) continue;
    const registered = defanged.replace(/\[\.\]/g, ".");
    const { name } = registeredParts(registered);
    if (name.length >= MIN_NAME_LEN && !seen.has(registered)) seen.set(registered, { name, registered });
  }
  return [...seen.values()];
}

// `host` is a plain domain name (not defanged). Returns { rule, brand } or null.
export function lookalikeMatch(host, brands) {
  const { name, registered, before } = registeredParts(host);
  if (brands.some((b) => b.registered === registered)) return null;
  const folded = fold(name);
  for (const b of brands) {
    if (name === b.name) continue;
    if (name.length >= MIN_NAME_LEN && folded === b.name) return { rule: "homoglyph", brand: b.registered };
    if (name.length >= MIN_NAME_LEN && (isOneEdit(name, b.name) || isOneEdit(folded, b.name))) {
      return { rule: "typo", brand: b.registered };
    }
    if (name.includes("-") && name.split("-").includes(b.name)) return { rule: "combo", brand: b.registered };
    if (before.some((label) => label.split("-").includes(b.name))) return { rule: "subdomain", brand: b.registered };
  }
  return null;
}

// Rule-based priority: homoglyph and subdomain are high, typo and combo are medium.
export function lookalikeSeverity(rule) {
  return rule === "homoglyph" || rule === "subdomain" ? "high" : "medium";
}
