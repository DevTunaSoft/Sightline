import test from 'node:test';
import assert from 'node:assert/strict';
import { yahooMailSkill } from '../extension/skills/yahoo-mail.js';
import { skillPlannerContext } from '../extension/skill-registry.js';

test('Yahoo snapshot analyzer deterministically identifies core mail controls and count', () => {
  const snapshot = {
    url: 'https://mail.yahoo.com/d/search/name=amazon',
    visibleText: 'Search results 327 messages',
    elements: [
      { ref: '@e1', role: 'textbox', name: 'Search mail', sensitive: false },
      { ref: '@e2', role: 'checkbox', name: 'Select all messages', sensitive: false },
      { ref: '@e3', role: 'button', name: 'Move selected messages to Trash', sensitive: false },
      { ref: '@e4', role: 'link', name: 'Amazon.com Your order has shipped yesterday', sensitive: false },
      { ref: '@e5', role: 'link', name: 'Amazon receipt for order 12345', sensitive: false },
    ],
  };
  const analysis = yahooMailSkill.analyzeSnapshot(snapshot);
  assert.equal(analysis.searchRef, '@e1');
  assert.equal(analysis.selectAllRef, '@e2');
  assert.deepEqual(analysis.trashRefs, ['@e3']);
  assert.equal(analysis.visibleCount, 327);
  assert.equal(analysis.messageSamples.length, 2);
  assert.equal(analysis.messageSamples[0].ref, '@e4');
});

test('Yahoo planner context includes bounded deterministic page hints', () => {
  const snapshot = {
    url: 'https://mail.yahoo.com/d/folders/1',
    visibleText: 'Inbox 42 messages',
    elements: [{ ref: '@e1', role: 'textbox', name: 'Search mail', sensitive: false }],
  };
  const context = skillPlannerContext(snapshot.url, snapshot);
  assert.equal(context.pageHints.searchRef, '@e1');
  assert.equal(context.pageHints.visibleCount, 42);
  assert.ok(context.pageHints.messageSamples.length <= 5);
});

test('Yahoo analyzer never samples sensitive fields or navigation chrome', () => {
  const analysis = yahooMailSkill.analyzeSnapshot({
    url: 'https://mail.yahoo.com/',
    visibleText: 'Inbox',
    elements: [
      { ref: '@e1', role: 'textbox', name: 'Password', sensitive: true },
      { ref: '@e2', role: 'link', name: 'Inbox 99', sensitive: false },
      { ref: '@e3', role: 'link', name: 'Real subject from sender', sensitive: false },
    ],
  });
  assert.deepEqual(analysis.messageSamples, [{ ref: '@e3', role: 'link', name: 'Real subject from sender' }]);
});


test('Yahoo Trash verification accepts count decrease and success signal', () => {
  const before={url:'https://mail.yahoo.com/d/search',visibleText:'12 messages',elements:[
    {ref:'@e1',role:'button',name:'Move selected messages to Trash',sensitive:false},
    {ref:'@e2',role:'link',name:'Amazon order shipped yesterday',sensitive:false},
  ]};
  const after={url:before.url,visibleText:'10 messages. Selected messages moved to Trash.',elements:[]};
  const result=yahooMailSkill.verifyActionEffect({action:{action:'click',ref:'@e1'},target:before.elements[0],before,after});
  assert.equal(result.applicable,true);
  assert.equal(result.verified,true);
  assert.ok(result.evidence.some(item=>/count decreased|success signal/.test(item)));
});

test('Yahoo Trash verification remains inconclusive when only unrelated state changed', () => {
  const before={url:'https://mail.yahoo.com/d/search',visibleText:'12 messages',elements:[{ref:'@e1',role:'button',name:'Move selected messages to Trash',sensitive:false}]};
  const after={url:before.url,visibleText:'12 messages',elements:[{ref:'@e9',role:'button',name:'Move selected messages to Trash',sensitive:false}]};
  const result=yahooMailSkill.verifyActionEffect({action:{action:'click',ref:'@e1'},target:before.elements[0],before,after});
  assert.equal(result.applicable,true);
  assert.equal(result.verified,null);
});


test('Yahoo analyzer exposes visible advanced-search controls without inventing syntax', () => {
  const snapshot={
    url:'https://mail.yahoo.com/d/search',
    visibleText:'Advanced search',
    elements:[
      {ref:'@e1',role:'button',name:'Advanced Search',sensitive:false},
      {ref:'@e2',role:'textbox',name:'From',sensitive:false},
      {ref:'@e3',role:'textbox',name:'Subject',sensitive:false},
      {ref:'@e4',role:'button',name:'Date range',sensitive:false},
      {ref:'@e5',role:'textbox',name:'Search mail',sensitive:false},
    ],
  };
  const analysis=yahooMailSkill.analyzeSnapshot(snapshot);
  assert.equal(analysis.searchRef,'@e5');
  assert.equal(analysis.advancedSearchRef,'@e1');
  assert.equal(analysis.fromFieldRef,'@e2');
  assert.equal(analysis.subjectFieldRef,'@e3');
  assert.deepEqual(analysis.dateControlRefs,['@e4']);
  assert.match(yahooMailSkill.guidance.join(' '),/Do not invent Yahoo search operator syntax/);
});
