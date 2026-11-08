import test from 'node:test';
import assert from 'node:assert/strict';
import { boundSnapshot, PAGE_OBSERVER_LIMITS } from '../extension/page-observer-core.js';
import { DiagnosticLedger, DIAGNOSTIC_LIMITS } from '../extension/diagnostics-core.js';
import { parsePlannerDecision } from '../extension/planner-core.js';
import { TaskProgressGuard } from '../extension/task-loop-core.js';

function largeSnapshot(count = 5000) {
  return {
    version: 1,
    url: 'https://example.com/huge',
    title: 'Huge synthetic page',
    visibleText: 'x'.repeat(PAGE_OBSERVER_LIMITS.maxVisibleTextChars),
    truncated: false,
    elements: Array.from({ length: count }, (_, i) => ({
      ref: `@e${i + 1}`,
      role: i % 3 === 0 ? 'button' : 'link',
      name: `Synthetic element ${i} ${'n'.repeat(180)}`,
      sensitive: false,
      state: {},
      rect: { x: i, y: i, width: 100, height: 20 },
    })),
  };
}

test('huge semantic snapshots are hard-bounded below serialized budget', () => {
  const bounded = boundSnapshot(largeSnapshot(), PAGE_OBSERVER_LIMITS.maxSnapshotChars);
  assert.equal(bounded.truncated, true);
  assert.ok(bounded.elements.length < 5000);
  assert.ok(JSON.stringify(bounded).length <= PAGE_OBSERVER_LIMITS.maxSnapshotChars + 80);
  assert.match(bounded.snapshotId, /^s1-[0-9a-f]{8}$/);
});

test('high-volume diagnostic writes retain only the configured tail', () => {
  const ledger = new DiagnosticLedger(DIAGNOSTIC_LIMITS.maxEvents, () => 'fixed-time');
  for (let i = 0; i < 50_000; i += 1) {
    ledger.record('stress', `event-${i}`, { token: `secret-${i}`, payload: 'x'.repeat(4000) });
  }
  const exported = ledger.export();
  assert.equal(exported.events.length, DIAGNOSTIC_LIMITS.maxEvents);
  assert.equal(exported.events[0].message, 'event-49800');
  assert.equal(exported.events.at(-1).message, 'event-49999');
  assert.equal(exported.events.at(-1).details.token, '[REDACTED]');
  assert.ok(exported.events.at(-1).details.payload.length <= DIAGNOSTIC_LIMITS.maxDetailsChars);
});

test('randomized malformed planner output never becomes an executable action', () => {
  const snapshot = { snapshotId: 's1', url: 'https://example.com', elements: [{ ref: '@e1', role: 'button', name: 'Go', sensitive: false }] };
  let seed = 0x12345678;
  for (let i = 0; i < 3000; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const len = 1 + (seed % 120);
    let raw = '';
    for (let j = 0; j < len; j += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      raw += String.fromCharCode(1 + (seed % 126));
    }
    try {
      const result = parsePlannerDecision(raw, snapshot);
      assert.ok(result.done === true || result.done === false);
      if (result.done === false) {
        assert.ok(result.action);
        if (result.action.ref) assert.equal(result.action.ref, '@e1');
      }
    } catch (error) {
      assert.ok(error instanceof Error);
    }
  }
});

test('progress guard terminates deterministic non-progress within configured bounds', () => {
  const guard = new TaskProgressGuard({ limits: { maxActions: 5000, maxRepeatedState: 4, maxRepeatedAction: 4, maxDurationMs: 999999 } });
  let stopped = null;
  for (let i = 0; i < 10000; i += 1) {
    const outcome = guard.beforeAction({ action: 'click', ref: '@e1' }, 'same-snapshot');
    if (!outcome.ok) { stopped = outcome; break; }
  }
  assert.ok(stopped);
  assert.ok(['REPEATED_STATE_STALL', 'REPEATED_ACTION_STALL'].includes(stopped.code));
  assert.ok(guard.actions <= 4);
});
