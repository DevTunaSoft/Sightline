// Turns a local failure into safe, bounded web search queries.
// Nothing here performs a network request. Outbound search is a separate,
// explicitly configured step, and everything sent to it passes through
// redactForSearch first.

export const RESEARCH_LIMITS = Object.freeze({
  maxProblemChars: 500,
  maxQueries: 3,
  maxQueryChars: 120,
});

const REDACTIONS = [
  [/\b(?:bearer|token|api[_-]?key|secret|password|passwd|pwd)\b\s*[:=]?\s*\S+/gi, '[redacted-secret]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[redacted-token]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]'],
  [/https?:\/\/[^\s)"'<>]+/gi, '[redacted-url]'],
  [/\b[A-Za-z]:\\[^\s"'<>|]*/g, '[redacted-path]'],
  [/\/(?:home|Users|root)\/[^\s"'<>]*/g, '[redacted-path]'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]'],
  [/(?<![\w:])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\w:])/g, '[redacted-ip]'],
  [/\b\d(?:[ -]?\d){12,18}\b/g, '[redacted-number]'],
];

// Removes secrets and personal or network identifiers before any text can
// leave the machine. Unknown content is kept but bounded.
export function redactForSearch(text) {
  let out = String(text ?? '').slice(0, RESEARCH_LIMITS.maxProblemChars * 4);
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, ' ').trim().slice(0, RESEARCH_LIMITS.maxProblemChars);
}

// Builds up to three queries from a problem summary and an app/product name.
// Each query keeps the product name and the error wording, nothing else.
export function buildResearchQueries({ product, problem, errorCode } = {}) {
  const name = redactForSearch(product).slice(0, 60);
  const core = redactForSearch(problem);
  const code = /^[A-Z0-9_]{3,60}$/.test(String(errorCode || '')) ? String(errorCode).replace(/_/g, ' ').toLowerCase() : '';
  const candidates = [
    [name, code, core].filter(Boolean).join(' '),
    [name, 'troubleshooting', code].filter(Boolean).join(' '),
    [name, 'known issue forum', code].filter(Boolean).join(' '),
  ];
  const unique = [...new Set(candidates.map(q => q.replace(/\s+/g, ' ').trim()).filter(q => q.length > 3))];
  return unique.slice(0, RESEARCH_LIMITS.maxQueries).map(q => q.slice(0, RESEARCH_LIMITS.maxQueryChars));
}

// Prefers vendor docs, support sites and developer forums over content farms.
const PREFERRED = [
  [/(^|\.)github\.com$/, 'code'],
  [/(^|\.)stackoverflow\.com$|(^|\.)stackexchange\.com$/, 'forum'],
  [/(^|\.)learn\.microsoft\.com$|(^|\.)docs\.microsoft\.com$/, 'vendor-docs'],
  [/(^|\.)support\.google\.com$|(^|\.)developer\.chrome\.com$|(^|\.)developers\.google\.com$/, 'vendor-docs'],
  [/(^|\.)docs\.[a-z0-9-]+\.[a-z]{2,}$|(^|\.)support\.[a-z0-9-]+\.[a-z]{2,}$/, 'vendor-docs'],
  [/(^|\.)reddit\.com$/, 'forum'],
];

export function rankSources(results, limit = 8) {
  const kindRank = { 'vendor-docs': 0, code: 1, forum: 2, other: 3 };
  return results
    .map(result => {
      let host = '';
      try { host = new URL(result.url).hostname.toLowerCase(); } catch { return null; }
      const match = PREFERRED.find(([pattern]) => pattern.test(host));
      return { title: String(result.title || '').slice(0, 200), url: result.url, host, kind: match ? match[1] : 'other' };
    })
    .filter(Boolean)
    .sort((a, b) => kindRank[a.kind] - kindRank[b.kind])
    .slice(0, limit);
}
