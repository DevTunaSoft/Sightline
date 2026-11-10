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

test('Yahoo pagination count uses the total, not the first visible row', () => {
  const hints=yahooMailSkill.analyzeSnapshot({url:'https://mail.yahoo.com/d/search',visibleText:'Showing 1-50 of 300',elements:[]});
  assert.equal(hints.visibleCount,300);
});
test('Yahoo count is unknown when text does not prove a total', () => {
  for(const visibleText of ['Showing 1-50','of 300','Inbox 42 messages','Showing 1 of maybe 10']) {
    const hints=yahooMailSkill.analyzeSnapshot({url:'https://mail.yahoo.com/d/search',visibleText,elements:[]});
    assert.equal(hints.visibleCount,null,visibleText);
  }
});
