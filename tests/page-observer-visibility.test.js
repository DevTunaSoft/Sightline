import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisible, visitInteractiveNodes, collectFrameContexts } from '../extension/page-observer.js';

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

test('lazy walker includes lowercase SVG/XHTML interactive tags', () => {
  const anchor={tagName:'a',hasAttribute:()=>false,matches:()=>true};
  const doc={
    documentElement:anchor,
    defaultView:{NodeFilter:{SHOW_ELEMENT:1}},
    createTreeWalker(){return {nextNode:()=>null};},
  };
  let matched=0;
  const result=visitInteractiveNodes(doc,'a[href]',4,()=>{matched++;return true;});
  assert.equal(result.truncated,false);
  assert.equal(result.visited,1);
  assert.equal(matched,1);
});

function frameTestDocument(url, children = []) {
  const doc = {
    location:{href:url},
    defaultView:{NodeFilter:{SHOW_ELEMENT:1},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})},
    querySelectorAll(){throw new Error('unbounded frame selector used');},
  };
  const root={tagName:'HTML'};
  const nodes=[root,...children];
  doc.documentElement=root;
  doc.createTreeWalker=()=>{
    let index=0;
    return {nextNode:()=>nodes[++index]||null};
  };
  for(const child of children) {
    child.ownerDocument=doc;
    child.getBoundingClientRect ||= ()=>({width:80,height:30});
    child.getAttribute ||= ()=>'/embedded';
  }
  return doc;
}

test('frame discovery is lazy and retains only bounded context references', () => {
  const child=frameTestDocument('https://example.com/child');
  const frames=Array.from({length:100},()=>({
    tagName:'IFRAME',contentDocument:child,
  }));
  const root=frameTestDocument('https://example.com/root',frames);
  const result=collectFrameContexts(root,20,3,200);
  assert.equal(result.contexts.length,21);
  assert.equal(result.inventory.total,20);
  assert.equal(result.inventory.sameOrigin,20);
  assert.equal(result.inventory.truncated,true);
  assert.equal(result.contexts.at(-1).path,'top/f20');
});

test('frame discovery budget stops before scanning a large page', () => {
  const leaf=frameTestDocument('https://example.com/child');
  const root=frameTestDocument('https://example.com/root',[
    ...Array.from({length:500},()=>({tagName:'DIV'})),
    {tagName:'IFRAME',contentDocument:leaf},
  ]);
  const result=collectFrameContexts(root,20,3,24);
  assert.equal(result.contexts.length,1);
  assert.equal(result.inventory.total,0);
  assert.equal(result.inventory.truncated,true);
});

test('unvisited nested same-origin frames report incomplete coverage', () => {
  const deepest=frameTestDocument('https://example.com/third');
  const child=frameTestDocument('https://example.com/second',[
    {tagName:'FRAME',contentDocument:deepest},
  ]);
  const top=frameTestDocument('https://example.com/',[
    {tagName:'IFRAME',contentDocument:child},
  ]);
  const result=collectFrameContexts(top,20,1,100);
  assert.equal(result.contexts.length,2);
  assert.equal(result.inventory.skippedDepth,1);
  assert.equal(result.inventory.total,2);
  assert.equal(result.contexts[1].path,'top/f1');
});

test('frame discovery enforces hard resource ceilings even with huge arguments', () => {
  const child=frameTestDocument('https://example.com/child');
  const frames=Array.from({length:35},()=>({tagName:'IFRAME',contentDocument:child}));
  const top=frameTestDocument('https://example.com/',frames);
  const result=collectFrameContexts(top,Infinity,Infinity,Infinity);
  assert.equal(result.inventory.total,20);
  assert.equal(result.inventory.truncated,true);
  assert.equal(result.contexts.length,21);
});

test('no embedded frames reports a complete frame inventory', () => {
  const root=frameTestDocument('https://example.com/',[
    {tagName:'DIV'},{tagName:'BUTTON'},
  ]);
  const result=collectFrameContexts(root);
  assert.equal(result.inventory.total,0);
  assert.equal(Boolean(result.inventory.truncated),false);
  assert.equal(result.contexts.length,1);
});
