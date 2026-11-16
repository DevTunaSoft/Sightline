import { performance } from 'node:perf_hooks';
import { boundSnapshot, PAGE_OBSERVER_LIMITS } from '../extension/page-observer-core.js';
import { DiagnosticLedger } from '../extension/diagnostics-core.js';

function makeSnapshot(count) {
  return {
    version: 1,
    url: 'https://example.com/benchmark',
    title: 'Benchmark',
    visibleText: 'v'.repeat(PAGE_OBSERVER_LIMITS.maxVisibleTextChars),
    elements: Array.from({ length: count }, (_, i) => ({
      ref: `@e${i + 1}`,
      role: 'button',
      name: `Button ${i} ${'x'.repeat(180)}`,
      sensitive: false,
      state: {},
      rect: { x: 0, y: i, width: 120, height: 24 },
    })),
  };
}

function measure(label, fn) {
  const beforeMem = process.memoryUsage().heapUsed;
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  const afterMem = process.memoryUsage().heapUsed;
  return { label, elapsedMs: Number(elapsed.toFixed(2)), heapDeltaKb: Math.round((afterMem - beforeMem) / 1024), result };
}

const snapshot = measure('bound 5,000-element snapshot', () => boundSnapshot(makeSnapshot(5000)));
const ledger = measure('record 50,000 diagnostic events', () => {
  const log = new DiagnosticLedger();
  for (let i = 0; i < 50_000; i += 1) log.record('benchmark', `event ${i}`, { token: `s${i}`, payload: 'x'.repeat(1000) });
  return log.export().events.length;
});

console.log(JSON.stringify({
  budgets: PAGE_OBSERVER_LIMITS,
  results: [
    { ...snapshot, result: { elements: snapshot.result.elements.length, chars: JSON.stringify(snapshot.result).length } },
    { ...ledger, result: { retainedEvents: ledger.result } },
  ],
}, null, 2));
