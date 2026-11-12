import test from 'node:test';
import assert from 'node:assert/strict';
import { runBrowserTask } from '../extension/browser-task-runner.js';

const snapshot = {
  snapshotId: 'd1', url: 'https://ex.test/', visibleText: 'Next page',
  elements: [{ ref: '@e1', role: 'button', name: 'Next page', sensitive: false }],
};

function setup({ locates, debuggerFail = null }) {
  const commands = [];
  const messages = [];
  let execCount = 0;
  let locateCount = 0;
  const chromeApi = {
    tabs: {
      query: async () => [{ id: 7, url: snapshot.url, active: true, windowId: 1 }],
      get: async () => ({ id: 7, url: snapshot.url, active: true, windowId: 1 }),
      sendMessage: async (_id, msg) => {
        messages.push(msg.type);
        if (msg.type === 'SIGHTLINE_PING') return { ok: true };
        if (msg.type === 'SIGHTLINE_OBSERVE') return { ok: true, snapshot };
        if (msg.type === 'SIGHTLINE_LOCATE') {
          const rect = locates[Math.min(locateCount, locates.length - 1)];
          locateCount += 1;
          return { ok: true, snapshotId: 'd1', sensitive: false, inFrame: false, rect, viewport: { width: 1000, height: 800 } };
        }
        if (msg.type === 'SIGHTLINE_EXECUTE') {
          execCount += 1;
          return { ok: false, code: 'CONFIRMATION_REQUIRED', target: snapshot.elements[0], risk: { level: 'high' }, confirmationKey: 'k' };
        }
        throw new Error(`unexpected ${msg.type}`);
      },
    },
    scripting: { executeScript: async () => {} },
    debugger: {
      attach: async () => { if (debuggerFail) throw new Error(debuggerFail); commands.push(['attach']); },
      sendCommand: async (_t, method) => { commands.push([method]); return {}; },
      detach: async () => { commands.push(['detach']); },
    },
  };
  const fetchImpl = async () => new Response(JSON.stringify({ message: { content: '{"done":false,"action":{"action":"click","ref":"@e1"}}' } }), { status: 200 });
  return { chromeApi, fetchImpl, commands, messages, execCount: () => execCount };
}

test('opt-in debugger click runs only after confirmation and two agreeing locates', async () => {
  const env = setup({ locates: [{ x: 100, y: 50, width: 40, height: 20 }, { x: 100, y: 50, width: 40, height: 20 }] });
  let planCalls = 0;
  const fetchImpl = async () => {
    planCalls += 1;
    const content = planCalls === 1 ? '{"done":false,"action":{"action":"click","ref":"@e1"}}' : '{"done":true,"result":"done"}';
    return new Response(JSON.stringify({ message: { content } }), { status: 200 });
  };
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi, fetchImpl,
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 5, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(env.commands.map(c => c[0]), ['attach', 'Input.dispatchMouseEvent', 'Input.dispatchMouseEvent', 'detach']);
  assert.equal(env.messages.filter(m => m === 'SIGHTLINE_LOCATE').length, 2);
  assert.equal(env.execCount(), 1, 'page-script confirmed execute is not used for debugger clicks');
});

test('a moved element is refused without any debugger input', async () => {
  const env = setup({ locates: [{ x: 100, y: 50, width: 40, height: 20 }, { x: 400, y: 300, width: 40, height: 20 }] });
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi,
    fetchImpl: async () => new Response(JSON.stringify({ message: { content: '{"done":false,"action":{"action":"click","ref":"@e1"}}' } }), { status: 200 }),
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 1, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, false);
  assert.equal(env.commands.length, 0, 'no attach or input when the target moved');
});

test('a failed attach reports a safe failure, not an unknown effect', async () => {
  const env = setup({ locates: [{ x: 100, y: 50, width: 40, height: 20 }], debuggerFail: 'Another debugger is already attached' });
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi,
    fetchImpl: async () => new Response(JSON.stringify({ message: { content: '{"done":false,"action":{"action":"click","ref":"@e1"}}' } }), { status: 200 }),
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 1, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, false);
  assert.notEqual(result.code, 'UNKNOWN_EFFECT');
  assert.equal(env.commands.some(c => c[0] === 'Input.dispatchMouseEvent'), false);
});
