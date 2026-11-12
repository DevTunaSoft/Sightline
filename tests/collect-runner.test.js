import test from 'node:test';
import assert from 'node:assert/strict';
import { runBrowserTask } from '../extension/browser-task-runner.js';
import { createIpCollector } from '../extension/collect-core.js';

function fakeBrowser(snapshot) {
  return {
    tabs: {
      query: async () => [{ id: 7, url: snapshot.url, active: true, windowId: 1 }],
      get: async () => ({ id: 7, url: snapshot.url, active: true, windowId: 1 }),
      sendMessage: async (_id, msg) => {
        if (msg.type === 'SIGHTLINE_PING') return { ok: true };
        if (msg.type === 'SIGHTLINE_OBSERVE') return { ok: true, snapshot };
        throw new Error(`unexpected message ${msg.type}`);
      },
    },
    scripting: { executeScript: async () => {} },
  };
}

test('runner attaches collected addresses to the result when a collector is supplied', async () => {
  const snapshot = {
    snapshotId: 's1', url: 'https://ex.test/results?q=secret', visibleText: 'Servers 10.20.30.40 and 2001:db8::5',
    elements: [],
  };
  const result = await runBrowserTask({
    goal: 'List the IP addresses on this page',
    model: 'test-model',
    chromeApi: fakeBrowser(snapshot),
    fetchImpl: async () => new Response(JSON.stringify({ message: { content: '{"done":true,"result":"listed"}' } }), { status: 200 }),
    collector: createIpCollector(),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.collection.addresses.map(a => a.address), ['10.20.30.40', '2001:db8::5']);
  assert.equal(result.collection.pagesObserved, 1);
  assert.equal(JSON.stringify(result).includes('q=secret'), false, 'query string not stored');
});

test('runner result is unchanged when no collector is supplied', async () => {
  const snapshot = { snapshotId: 's1', url: 'https://ex.test/', visibleText: '10.0.0.1', elements: [] };
  const result = await runBrowserTask({
    goal: 'Read the page', model: 'test-model', chromeApi: fakeBrowser(snapshot),
    fetchImpl: async () => new Response(JSON.stringify({ message: { content: '{"done":true,"result":"ok"}' } }), { status: 200 }),
  });
  assert.equal(result.ok, true);
  assert.equal('collection' in result, false);
});
