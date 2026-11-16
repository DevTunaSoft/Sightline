// Static checks on the side-panel source. The layout itself was measured in headless Chromium
// at 371 px and 400 px, which is not installed Chrome (X-02). These tests keep the fixes in place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../extension/panel.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../extension/style.css', import.meta.url), 'utf8');

test('the action row wraps instead of running past the panel edge', () => {
  assert.match(css, /\.actions\{display:flex;flex-wrap:wrap;/);
});

test('the task controls Pause and Cancel exist in the markup', () => {
  assert.match(html, /id="stopTaskBtn"/);
  assert.match(html, /id="cancelTaskBtn"/);
});

test('panel.html has no UTF-8 text decoded as Windows-1252 (mojibake)', () => {
  assert.doesNotMatch(html, /â[\u0080-¿]{2}|Â[\u0080-¿]/);
});
