import test from 'node:test';
import assert from 'node:assert/strict';
import { runBrowserTask } from '../extension/browser-task-runner.js';

const snapshot = {
  snapshotId: 'd1', url: 'https://ex.test/', visibleText: 'Next page',
  elements: [{ ref: '@e1', role: 'button', name: 'Next page', sensitive: false, state: { expanded: false } }],
};
// What the page looks like after a real effect on the target: the control's state changed.
const changedAfterClick = {
  snapshotId: 'd2', url: 'https://ex.test/', visibleText: 'Next page',
  elements: [{ ref: '@e1', role: 'button', name: 'Next page', sensitive: false, state: { expanded: true } }],
};

// afterClick: what SIGHTLINE_OBSERVE returns once a debugger click was dispatched.
// Default is a real structural effect; pass `snapshot` for no effect, or 'throw' for a failed re-observe.
function setup({ locates, debuggerFail = null, consumeResult = { ok: true, code: 'CONFIRMATION_CONSUMED' }, afterClick = changedAfterClick }) {
  const commands = [];
  let clicked = false;
  const messages = [];
  let execCount = 0;
  let locateCount = 0;
  const consumes = [];
  const chromeApi = {
    tabs: {
      query: async () => [{ id: 7, url: snapshot.url, active: true, windowId: 1 }],
      get: async () => ({ id: 7, url: snapshot.url, active: true, windowId: 1 }),
      sendMessage: async (_id, msg) => {
        messages.push(msg.type);
        if (msg.type === 'SIGHTLINE_PING') return { ok: true };
        if (msg.type === 'SIGHTLINE_OBSERVE') {
          if (!clicked) return { ok: true, snapshot };
          if (afterClick === 'throw') throw new Error('tab went away');
          return { ok: true, snapshot: afterClick };
        }
        if (msg.type === 'SIGHTLINE_LOCATE') {
          const rect = locates[Math.min(locateCount, locates.length - 1)];
          locateCount += 1;
          return { ok: true, snapshotId: 'd1', sensitive: false, inFrame: false, rect, viewport: { width: 1000, height: 800 } };
        }
        if (msg.type === 'SIGHTLINE_EXECUTE' && msg.consumeOnly === true) {
          consumes.push(msg);
          commands.push(['consume']);
          return consumeResult;
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
      sendCommand: async (_t, method) => { commands.push([method]); if (method === 'Input.dispatchMouseEvent') clicked = true; return {}; },
      detach: async () => { commands.push(['detach']); },
    },
  };
  const fetchImpl = async () => new Response(JSON.stringify({ message: { content: '{"done":false,"action":{"action":"click","ref":"@e1"}}' } }), { status: 200 });
  return { chromeApi, fetchImpl, commands, messages, consumes, execCount: () => execCount };
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
  assert.deepEqual(env.commands.map(c => c[0]), ['consume', 'attach', 'Input.dispatchMouseEvent', 'Input.dispatchMouseEvent', 'detach']);
  assert.equal(env.consumes.length, 1, 'the approval is spent exactly once');
  assert.equal(env.consumes[0].confirmationKey, 'k', 'the approval is spent with the key the person confirmed');
  assert.equal(env.messages.filter(m => m === 'SIGHTLINE_LOCATE').length, 3, 'two agreeing locates, then one more immediately before input');
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

test('a refused approval spend sends no debugger input at all', async () => {
  const env = setup({
    locates: [{ x: 100, y: 50, width: 40, height: 20 }, { x: 100, y: 50, width: 40, height: 20 }],
    consumeResult: { ok: false, code: 'CONFIRMATION_REQUIRED' },
  });
  let planCalls = 0;
  const fetchImpl = async () => {
    planCalls += 1;
    const content = planCalls === 1 ? '{"done":false,"action":{"action":"click","ref":"@e1"}}' : '{"done":true,"result":"done"}';
    return new Response(JSON.stringify({ message: { content } }), { status: 200 });
  };
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi, fetchImpl,
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 1, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(env.commands.map(c => c[0]), ['consume'], 'only the refused spend is sent; no attach, no input');
});

test('a debugger click with no verified target effect returns NO_VERIFIED_EFFECT, not success', async () => {
  const env = setup({
    locates: [{ x: 100, y: 50, width: 40, height: 20 }, { x: 100, y: 50, width: 40, height: 20 }],
    afterClick: snapshot,
  });
  let planCalls = 0;
  const fetchImpl = async () => {
    planCalls += 1;
    const content = planCalls === 1 ? '{"done":false,"action":{"action":"click","ref":"@e1"}}' : '{"done":true,"result":"done"}';
    return new Response(JSON.stringify({ message: { content } }), { status: 200 });
  };
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi, fetchImpl,
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 1, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, false, 'an unverified click must not finish as success');
  assert.equal(env.commands.filter(c => c[0] === 'Input.dispatchMouseEvent').length, 2, 'the click was sent once (two mouse events), not retried');
  assert.equal(env.execCount(), 1, 'only the initial confirmation request; no page-script execute after the debugger click');
  assert.equal(env.consumes.length, 1, 'the approval was spent once');
  assert.ok(result.timeline?.some(item => item.receipt?.code === 'NO_VERIFIED_EFFECT'), 'the timeline records NO_VERIFIED_EFFECT');
});

test('a debugger click whose page cannot be re-observed reports UNKNOWN_EFFECT and is never retried', async () => {
  const env = setup({
    locates: [{ x: 100, y: 50, width: 40, height: 20 }, { x: 100, y: 50, width: 40, height: 20 }],
    afterClick: 'throw',
  });
  let planCalls = 0;
  const fetchImpl = async () => {
    planCalls += 1;
    return new Response(JSON.stringify({ message: { content: '{"done":false,"action":{"action":"click","ref":"@e1"}}' } }), { status: 200 });
  };
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi, fetchImpl,
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 2, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, false);
  assert.equal(env.consumes.length, 1, 'a second confirmation is never spent on the same unknown effect');
  assert.ok(result.timeline?.some(item => item.receipt?.code === 'UNKNOWN_EFFECT' || result.code === 'UNKNOWN_EFFECT'), 'the unknown effect is reported');
});

test('a target that moves while the approval is spent is refused before input', async () => {
  // Two locates agree; the third, taken right before input, has moved.
  const env = setup({ locates: [{ x: 100, y: 50, width: 40, height: 20 }, { x: 100, y: 50, width: 40, height: 20 }, { x: 300, y: 200, width: 40, height: 20 }] });
  let planCalls = 0;
  const fetchImpl = async () => {
    planCalls += 1;
    return new Response(JSON.stringify({ message: { content: '{"done":false,"action":{"action":"click","ref":"@e1"}}' } }), { status: 200 });
  };
  const result = await runBrowserTask({
    goal: 'Click next', model: 'm', chromeApi: env.chromeApi, fetchImpl,
    confirmAction: async () => true, useDebuggerClicks: true,
    limits: { maxActions: 1, maxRepeatedAction: 5, maxRepeatedState: 5 },
  });
  assert.equal(result.ok, false);
  assert.equal(env.consumes.length, 1, 'the approval is spent before the final check');
  assert.equal(env.commands.some(c => c[0] === 'attach' || c[0] === 'Input.dispatchMouseEvent'), false, 'no attach or input after the target moved');
});
