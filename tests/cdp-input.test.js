import test from 'node:test';
import assert from 'node:assert/strict';
import { createCdpInput, CdpInputError } from '../extension/cdp-input.js';

function fakeDebugger({ failAttach = false } = {}) {
  const log = [];
  return {
    log,
    debugger: {
      attach: async (t, v) => { log.push(['attach', t.tabId, v]); if (failAttach) throw new Error('Another debugger is already attached'); },
      sendCommand: async (t, method, params) => { log.push([method, t.tabId, params]); return {}; },
      detach: async t => { log.push(['detach', t.tabId]); },
    },
  };
}

test('click sends press and release on the approved tab, then detaches', async () => {
  const f = fakeDebugger();
  const input = createCdpInput({ debugger: f.debugger }, { isApprovedTab: id => id === 7 });
  assert.deepEqual(await input.click(7, 120.4, 88.6), { ok: true });
  assert.deepEqual(f.log.map(e => e[0]), ['attach', 'Input.dispatchMouseEvent', 'Input.dispatchMouseEvent', 'detach']);
  assert.equal(f.log[1][2].type, 'mousePressed');
  assert.equal(f.log[1][2].x, 120);
  assert.equal(f.log[2][2].type, 'mouseReleased');
});

test('no debugger attach happens on a tab that was not approved', async () => {
  const f = fakeDebugger();
  const input = createCdpInput({ debugger: f.debugger }, { isApprovedTab: () => false });
  await assert.rejects(input.click(7, 1, 1), e => e instanceof CdpInputError && e.code === 'TAB_NOT_APPROVED');
  await assert.rejects(input.insertText(7, 'x'), e => e.code === 'TAB_NOT_APPROVED');
  assert.equal(f.log.length, 0);
});

test('a failed attach is reported and nothing is sent', async () => {
  const f = fakeDebugger({ failAttach: true });
  const input = createCdpInput({ debugger: f.debugger }, { isApprovedTab: () => true });
  await assert.rejects(input.click(7, 1, 1), e => e.code === 'ATTACH_FAILED');
  assert.deepEqual(f.log.map(e => e[0]), ['attach']);
});

test('detach still runs when a command fails', async () => {
  const f = fakeDebugger();
  f.debugger.sendCommand = async (t, method) => { f.log.push([method]); throw new Error('boom'); };
  const input = createCdpInput({ debugger: f.debugger }, { isApprovedTab: () => true });
  await assert.rejects(input.click(7, 1, 1), /boom/);
  assert.equal(f.log.at(-1)[0], 'detach');
});

test('bad coordinates and oversize text are refused before any attach', async () => {
  const f = fakeDebugger();
  const input = createCdpInput({ debugger: f.debugger }, { isApprovedTab: () => true });
  await assert.rejects(input.click(7, NaN, 1), e => e.code === 'BAD_COORDINATES');
  await assert.rejects(input.click(7, -1, 1), e => e.code === 'BAD_COORDINATES');
  await assert.rejects(input.insertText(7, 'x'.repeat(2001)), e => e.code === 'TEXT_TOO_LONG');
  assert.equal(f.log.length, 0);
});

test('insertText uses Input.insertText on the approved tab', async () => {
  const f = fakeDebugger();
  const input = createCdpInput({ debugger: f.debugger }, { isApprovedTab: () => true });
  assert.deepEqual(await input.insertText(7, 'hello'), { ok: true, characters: 5 });
  assert.deepEqual(f.log[1], ['Input.insertText', 7, { text: 'hello' }]);
});
