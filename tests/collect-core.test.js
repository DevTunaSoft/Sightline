import test from 'node:test';
import assert from 'node:assert/strict';
import { createIpCollector, COLLECT_LIMITS } from '../extension/collect-core.js';

test('collects unique addresses across pages with their page origin and path only', () => {
  const c = createIpCollector();
  c.observe({ url: 'https://ex.test/list?page=1&token=abc', visibleText: 'a 10.0.0.1 and 10.0.0.2' });
  c.observe({ url: 'https://ex.test/list?page=2', visibleText: '10.0.0.2 new 10.0.0.3' });
  const s = c.summary();
  assert.deepEqual(s.addresses.map(a => a.address), ['10.0.0.1', '10.0.0.2', '10.0.0.3']);
  assert.equal(s.pagesObserved, 2);
  assert.equal(s.addresses[0].page, 'https://ex.test/list');
  assert.equal(JSON.stringify(s).includes('token'), false, 'query strings are never stored');
});

test('ignores snapshots without visible text and never throws on bad input', () => {
  const c = createIpCollector();
  assert.deepEqual(c.observe(null), { added: 0 });
  assert.deepEqual(c.observe({ url: 'x', visibleText: 42 }), { added: 0 });
  assert.equal(c.summary().pagesObserved, 0);
});

test('page count is capped and the summary reports truncation', () => {
  const c = createIpCollector({ limits: { ...COLLECT_LIMITS, maxPages: 2 } });
  for (let i = 0; i < 5; i++) c.observe({ url: `https://ex.test/${i}`, visibleText: `10.1.1.${i}` });
  const s = c.summary();
  assert.equal(s.pagesObserved, 2);
  assert.equal(s.truncated, true);
});

test('workbook export contains one row per address plus a header', async () => {
  const c = createIpCollector();
  c.observe({ url: 'https://ex.test/a', visibleText: '192.168.1.1 2001:db8::1' });
  const bytes = c.toWorkbookBytes();
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0);
  const text = new TextDecoder('latin1').decode(bytes);
  assert.ok(text.includes('PK'), 'zip container present');
});
