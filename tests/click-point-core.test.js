import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLocateResult, isSamePoint } from '../extension/click-point-core.js';

const viewport = { width: 1000, height: 800 };
const good = { ok: true, snapshotId: 's1', sensitive: false, inFrame: false, rect: { x: 100, y: 50, width: 40, height: 20 } };
const opts = { expectedSnapshotId: 's1', viewport };

test('a visible, non-sensitive element yields its center point', () => {
  assert.deepEqual(validateLocateResult(good, opts), { ok: true, point: { x: 120, y: 60 } });
});

test('refuses sensitive, framed, stale, missing, hidden and off-screen targets', () => {
  assert.equal(validateLocateResult({ ...good, sensitive: true }, opts).code, 'SENSITIVE_TARGET');
  assert.equal(validateLocateResult({ ...good, inFrame: true }, opts).code, 'FRAME_TARGET');
  assert.equal(validateLocateResult({ ...good, snapshotId: 'old' }, opts).code, 'STALE_TARGET');
  assert.equal(validateLocateResult(null, opts).code, 'LOCATE_FAILED');
  assert.equal(validateLocateResult({ ...good, rect: { x: 1, y: 1, width: 0, height: 5 } }, opts).code, 'LOCATE_FAILED');
  assert.equal(validateLocateResult({ ...good, rect: { x: NaN, y: 1, width: 5, height: 5 } }, opts).code, 'LOCATE_FAILED');
  assert.equal(validateLocateResult({ ...good, rect: { x: 990, y: 50, width: 40, height: 20 } }, opts).code, 'OFFSCREEN_TARGET');
  assert.equal(validateLocateResult({ ...good, rect: { x: -100, y: 0, width: 40, height: 20 } }, opts).code, 'OFFSCREEN_TARGET');
});

test('unknown viewport size is refused rather than guessed', () => {
  assert.equal(validateLocateResult(good, { expectedSnapshotId: 's1', viewport: null }).code, 'LOCATE_FAILED');
});

test('isSamePoint allows only small movement', () => {
  assert.equal(isSamePoint({ x: 10, y: 10 }, { x: 11, y: 12 }), true);
  assert.equal(isSamePoint({ x: 10, y: 10 }, { x: 20, y: 10 }), false);
  assert.equal(isSamePoint(null, { x: 1, y: 1 }), false);
});
