import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisible } from '../extension/page-observer.js';

function element(style, rect = { width: 20, height: 10 }) {
  return {
    nodeType: 1,
    ownerDocument: { defaultView: { getComputedStyle: () => style } },
    getBoundingClientRect: () => rect,
  };
}

test('empty or absent computed opacity does not hide visible controls', () => {
  for (const opacity of ['', ' ', undefined, null]) {
    assert.equal(isVisible(element({ display: 'block', visibility: 'visible', opacity })), true);
  }
});

test('zero opacity, display none, hidden visibility and zero geometry hide controls', () => {
  assert.equal(isVisible(element({ opacity: '0' })), false);
  assert.equal(isVisible(element({ opacity: '0.0' })), false);
  assert.equal(isVisible(element({ display: 'none', opacity: '1' })), false);
  assert.equal(isVisible(element({ visibility: 'hidden', opacity: '1' })), false);
  assert.equal(isVisible(element({ opacity: '1' }, { width: 0, height: 10 })), false);
  assert.equal(isVisible(element({ opacity: '0.5' })), true);
});
