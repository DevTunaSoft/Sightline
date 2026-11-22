import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseOptions, nextPrompt, madeProgress, acquireLock, runLoop, isLegacyOpenCodeVersion,
} from '../tools/opencode-autopilot.mjs';

const base = { maxCycles: 0, maxStalled: 2, maxFailures: 2, pauseSeconds: 0 };

test('autopilot options are bounded and reject shell metacharacters in models', () => {
  assert.equal(parseOptions([]).auto, true);
  assert.deepEqual(parseOptions(['--model', 'opencode-go/hy4-flash-free', '--max-cycles', '2', '--no-auto']),
    { model: 'opencode-go/hy4-flash-free', maxCycles: 2, maxStalled: 2,
      maxFailures: 2, pauseSeconds: 5, timeoutMinutes: 50, auto: false });
  assert.throws(() => parseOptions(['--model', 'a;rm -rf']), /Invalid model/);
  assert.throws(() => parseOptions(['--timeout-minutes', '0']), /outside the supported range/);
  assert.throws(() => parseOptions(['--max-cycles', '-1']), /nonnegative integer/);
  assert.throws(() => parseOptions(['--bogus']), /Unknown/);
});

test('OpenCode 1.x is rejected before touching a shared v2 session database', () => {
  for (const legacy of ['1.19.6', 'v1.19.5', 'opencode 1.18.34', '0.12.0']) {
    assert.equal(isLegacyOpenCodeVersion(legacy), true, legacy);
  }
  for (const current of ['2.0.24', '2.2.7', 'v2.2.7', 'opencode 2.2.6']) {
    assert.equal(isLegacyOpenCodeVersion(current), false, current);
  }
});

test('prompt chooses existing authorized PR review rather than asking operator', () => {
  const p = nextPrompt({ cycle: 3, stalled: 1 });
  assert.match(p, /PR #8 selective reconciliation/);
  assert.match(p, /Never ask which task/);
  assert.match(p, /change strategy/);
});

test('progress is actual HEAD/status change, not a successful chat response', () => {
  assert.equal(madeProgress({ head: 'a', status: '' }, { head: 'a', status: '' }), false);
  assert.equal(madeProgress({ head: 'a', status: '' }, { head: 'b', status: '' }), true);
  assert.equal(madeProgress({ head: 'a', status: '' }, { head: 'a', status: ' M x' }), true);
});

test('a completed task launches another cycle without another user prompt', async () => {
  let commit = 0;
  let launched = 0;
  const logs = [];
  const result = await runLoop({ ...base, maxCycles: 3 }, {
    getState: () => ({ head: `h${commit}`, status: '' }),
    execute: async () => { launched++; commit++; return { code: 0 }; },
    log: (e) => logs.push(e), pause: async () => {}, shouldStop: () => false,
  });
  assert.equal(launched, 3);
  assert.equal(result.reason, 'MAX_CYCLES');
  assert.deepEqual(logs.map(x => x.progress), [true, true, true]);
});

test('two no-change cycles stop instead of looping forever', async () => {
  let runs = 0;
  const result = await runLoop({ ...base }, {
    getState: () => ({ head: 'stable', status: '' }),
    execute: async () => { runs++; return { code: 0 }; },
    log: () => {}, pause: async () => {}, shouldStop: () => false,
  });
  assert.equal(result.reason, 'NO_MEASURABLE_PROGRESS');
  assert.equal(runs, 2);
});

test('two nonzero exits stop and do not repeat failures indefinitely', async () => {
  let runs = 0;
  const result = await runLoop({ ...base }, {
    getState: () => ({ head: 'stable', status: '' }),
    execute: async () => { runs++; return { code: 1, error: 'MOCK' }; },
    log: () => {}, pause: async () => {}, shouldStop: () => false,
  });
  assert.equal(result.reason, 'REPEATED_FAILURE');
  assert.equal(runs, 2);
});

test('stop signal prevents another cycle', async () => {
  let stopped = false;
  const result = await runLoop({ ...base }, {
    getState: () => ({ head: 'stable', status: '' }),
    execute: async () => { stopped = true; return { code: 0 }; },
    log: () => {}, pause: async () => {}, shouldStop: () => stopped,
  });
  assert.equal(result.reason, 'STOP_REQUESTED');
  assert.equal(result.cycle, 1);
});

test('lock rejects a duplicate process, then releases when owner exits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-autopilot-'));
  const file = path.join(dir, 'lock');
  try {
    const release = acquireLock(file);
    assert.throws(() => acquireLock(file), /Another autopilot/);
    release();
    const release2 = acquireLock(file);
    release2();
    assert.equal(fs.existsSync(file), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('stale dead-PID lock can be recovered', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-autopilot-'));
  const file = path.join(dir, 'lock');
  try {
    fs.writeFileSync(file, JSON.stringify({ pid: 2147483647, token: 'stale' }));
    const release = acquireLock(file);
    assert.notEqual(JSON.parse(fs.readFileSync(file, 'utf8')).token, 'stale');
    release();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
