// Collects data across observed pages during a task and produces a workbook.
// Pure logic: no browser or network access. The runner feeds it snapshots.
import { extractIpAddresses, buildXlsxBytes, EXPORT_LIMITS } from './export-core.js';

export const COLLECT_LIMITS = Object.freeze({ maxPages: 500, maxRows: EXPORT_LIMITS.maxRows });

export function createIpCollector({ limits = COLLECT_LIMITS } = {}) {
  const byAddress = new Map();
  const sources = [];
  let pagesSeen = 0;
  let truncated = false;

  return {
    // Adds addresses found in one snapshot's visible text. Sensitive elements
    // are never read; only the page's visible text is used.
    observe(snapshot) {
      if (!snapshot || typeof snapshot.visibleText !== 'string') return { added: 0 };
      if (pagesSeen >= limits.maxPages) { truncated = true; return { added: 0 }; }
      pagesSeen += 1;
      const result = extractIpAddresses(snapshot.visibleText);
      if (result.truncated) truncated = true;
      let added = 0;
      const pageLabel = pageLabelOf(snapshot.url);
      for (const { address, kind } of result.addresses) {
        if (byAddress.has(address)) continue;
        if (byAddress.size >= limits.maxRows - 1) { truncated = true; break; }
        byAddress.set(address, { address, kind, page: pageLabel });
        added += 1;
      }
      sources.push({ page: pageLabel, found: result.addresses.length, added });
      return { added };
    },
    summary() {
      return {
        addresses: [...byAddress.values()],
        pagesObserved: pagesSeen,
        sources: sources.slice(0, 200),
        truncated,
      };
    },
    toWorkbookBytes() {
      const rows = [['IP address', 'Type', 'Page']];
      for (const row of byAddress.values()) rows.push([row.address, row.kind, row.page]);
      return buildXlsxBytes(rows, { sheetName: 'IP addresses' });
    },
  };
}

// Keeps origin and path only. Query strings and fragments can carry tokens or
// personal search terms, so they are never stored.
function pageLabelOf(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 300);
  } catch {
    return 'unknown';
  }
}
