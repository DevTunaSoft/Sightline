import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisible, visitInteractiveNodes } from '../extension/page-observer.js';

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

function fakeTreeDocument(count) {
  const nodes=Array.from({length:count},(_,i)=>({
    tagName:i%2===0?'BUTTON':'DIV',
    hasAttribute:()=>false,
    matches:()=>i%2===0,
  }));
  let nextCalls=0;
  return {
    documentElement:nodes[0],
    defaultView:{NodeFilter:{SHOW_ELEMENT:1}},
    createTreeWalker(){
      let cursor=0;
      return {nextNode(){nextCalls++;return nodes[++cursor]||null;}};
    },
    get nextCalls(){return nextCalls;},
    querySelectorAll(){throw new Error('unbounded selector collection must not be used');},
  };
}

test('interactive DOM walk visits at most its node budget', () => {
  const doc=fakeTreeDocument(5000);
  let matched=0;
  const result=visitInteractiveNodes(doc,'button',35,()=>{matched++;return true;});
  assert.equal(result.visited,35);
  assert.equal(matched,18);
  assert.equal(result.truncated,true);
  assert.ok(doc.nextCalls<=35);
});

test('interactive DOM walk stops immediately when the output limit is reached', () => {
  const doc=fakeTreeDocument(5000);
  let matched=0;
  const result=visitInteractiveNodes(doc,'button',500,()=>{
    matched++;
    return matched<3;
  });
  assert.equal(matched,3);
  assert.equal(result.visited,5);
  assert.equal(result.truncated,true);
  assert.ok(doc.nextCalls<10);
});

test('completed interactive DOM walk does not report truncation', () => {
  const doc=fakeTreeDocument(9);
  const result=visitInteractiveNodes(doc,'button',50,()=>true);
  assert.equal(result.visited,9);
  assert.equal(result.truncated,false);
});

test('unsupported observation documents fail closed without collecting candidates', () => {
  const result=visitInteractiveNodes(null,'button',20,()=>{throw new Error('unexpected');});
  assert.equal(result.truncated,true);
  assert.equal(result.visited,0);
});

test('plain layout nodes bypass expensive selector checks', () => {
  let matchingCalls=0;
  const plain={tagName:'DIV',hasAttribute:()=>false,matches:()=>{throw new Error('layout selector called');}};
  const button={tagName:'BUTTON',hasAttribute:()=>false,matches:()=>{matchingCalls++;return true;}};
  const role={tagName:'DIV',hasAttribute:name=>name==='role',matches:()=>{matchingCalls++;return true;}};
  const nodes=[plain,button,role];
  const doc={
    documentElement:plain,
    defaultView:{NodeFilter:{SHOW_ELEMENT:1}},
    createTreeWalker(){let index=0;return {nextNode:()=>nodes[++index]||null};},
  };
  let matched=0;
  const result=visitInteractiveNodes(doc,'button',10,()=>{matched++;return true;});
  assert.equal(result.truncated,false);
  assert.equal(result.visited,3);
  assert.equal(matchingCalls,2);
  assert.equal(matched,2);
});
