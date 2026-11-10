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

test('Yahoo refuses destructive scope established only by untrusted message text', () => {
  const result=yahooMailSkill.checkDestructiveScope({
    goal:'Move old messages to Trash',
    action:{action:'click',ref:'@e3'},
    target:{name:'Move to Trash'},
    snapshot:{url:'https://mail.yahoo.com/d/folders/1',visibleText:'results for old messages 300 search results',elements:[]},
  });
  assert.equal(result.allowed,false);
  assert.equal(result.code,'DESTRUCTIVE_SCOPE_UNVERIFIED');
});
test('Yahoo scoped Trash requires a search input and an explicit result count', () => {
  const action={action:'click',ref:'@e3'};
  const target={name:'Move to Trash'};
  const base={url:'https://mail.yahoo.com/d/search',visibleText:'Showing 1-50 of 300',elements:[]};
  assert.equal(yahooMailSkill.checkDestructiveScope({goal:'Trash old mail',action,target,snapshot:base}).allowed,false);
  const scope={...base,elements:[{ref:'@e1',role:'textbox',name:'Search mail'}]};
  assert.equal(yahooMailSkill.checkDestructiveScope({goal:'Trash old mail',action,target,snapshot:scope}).allowed,true);
  const noCount={...scope,visibleText:'Showing 1-50'};
  assert.equal(yahooMailSkill.checkDestructiveScope({goal:'Trash old mail',action,target,snapshot:noCount}).allowed,false);
});
test('Yahoo rejects selected-all on an unverified Inbox scope', () => {
  const result=yahooMailSkill.checkDestructiveScope({
    goal:'Trash old mail',
    action:{action:'click',ref:'@e3'},
    target:{name:'Delete'},
    snapshot:{
      url:'https://mail.yahoo.com/d/folders/1',
      visibleText:'Inbox 80 messages',
      elements:[{ref:'@e2',role:'checkbox',name:'Select all',state:{checked:true}}],
    },
  });
  assert.equal(result.allowed,false);
  assert.equal(result.code,'DESTRUCTIVE_SCOPE_UNVERIFIED');
});
