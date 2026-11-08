import test from 'node:test';
import assert from 'node:assert/strict';
import { yahooMailSkill, buildYahooSearchIntent } from '../extension/skills/yahoo-mail.js';

test('Yahoo skill treats Trash/Delete as destructive workflow steps', () => {
  assert.ok(yahooMailSkill.destructiveLabels.includes('Move to Trash')); assert.match(yahooMailSkill.guidance.join(' '),/confirmation/);
});
test('Yahoo search intent is bounded and composable', () => {
  const q=buildYahooSearchIntent({sender:'amazon.com',terms:'receipt',olderThan:'2026/01/01'});
  assert.equal(q,'from:amazon.com receipt before:2026/01/01'); assert.ok(q.length<=600);
});
