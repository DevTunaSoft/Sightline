import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyActionRisk } from '../extension/safety-gate.js';

const button = name => ({ action: 'click', ref: '@e1' });
const target = name => ({ ref: '@e1', role: 'button', name, sensitive: false });

test('bulk archive and reject actions are classified as high impact', () => {
  for (const name of ['Archive all', 'Reject all']) {
    assert.equal(classifyActionRisk(button(name), target(name)).level, 'high', name);
  }
});

test('reversible read-state bulk action stays normal', () => {
  assert.equal(classifyActionRisk(button('Mark all as read'), target('Mark all as read')).level, 'normal');
});
