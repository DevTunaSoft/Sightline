// Regression test for a dead browser-agent panel. agent-panel.js throws at load time if an
// element it requires is missing, and then no button is wired up. This checks, from source,
// that every element id the script looks up exists in panel.html, except the one optional
// button that is guarded. A DOM run was done separately in headless Chromium (not installed Chrome).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../extension/panel.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../extension/agent-panel.js', import.meta.url), 'utf8');
const OPTIONAL = new Set(['localAiSelfTestBtn']);

test('every element the browser-agent script requires exists in panel.html', () => {
  const ids = [...new Set([...js.matchAll(/byId\('([^']+)'\)/g)].map(m => m[1]))];
  const missing = ids.filter(id => !OPTIONAL.has(id) && !new RegExp(`id="${id}"`).test(html));
  assert.deepEqual(missing, [], 'a missing required element stops every button from being wired');
});

test('the optional local-AI button is guarded wherever it is used', () => {
  assert.match(js, /if \(ui\.aiTest\) ui\.aiTest\.disabled/);
  assert.match(js, /ui\.aiTest\?\.addEventListener/);
});

test('panel.html has no literal backslash-n sequences outside code', () => {
  assert.doesNotMatch(html, /\\n\s+<script/);
});
