// Static checks on the panel source. These prove the control exists, is off by
// default, and is wired into each run. They do not drive a browser: that is BLOCKED (X-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../extension/panel.html', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../extension/agent-panel.js', import.meta.url), 'utf8');

test('the debugger-click control exists and is unchecked in the markup', () => {
  const match = html.match(/<input id="debuggerClicks"[^>]*>/);
  assert.ok(match, 'control is present');
  assert.doesNotMatch(match[0], /\bchecked\b/, 'off by default');
});

test('the control is labelled as experimental and does not claim a banner', () => {
  assert.match(html, /Debugger clicks \(experimental\)/);
  assert.match(html, /has not been verified/);
  assert.doesNotMatch(html, /banner is shown|will show a banner/i);
});

test('each run reads the control live, and it is disabled while a task runs', () => {
  assert.match(panel, /useDebuggerClicks: ui\.debuggerClicks\.checked === true/);
  assert.match(panel, /ui\.debuggerClicks\.disabled = state\.running/);
});

test('the choice is not persisted, so a stale "on" state cannot carry over', () => {
  assert.doesNotMatch(panel, /debuggerClicks[^\n]*(localStorage|saveTaskCheckpoint|chrome\.storage)/);
});
