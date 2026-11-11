import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_OBSERVER_LIMITS, cleanPageText, inferElementRole, isSensitiveField, boundSnapshot, snapshotIdentity, createBoundedTextCollector, safeOrigin, mayUseValueAsAccessibleName, hasTargetStructuralEffect, normalizeObservationLimits, incompleteFrameInventory } from '../extension/page-observer-core.js';

test('observer defaults are deliberately bounded', () => {
  assert.equal(PAGE_OBSERVER_LIMITS.maxElements, 300);
  assert.equal(PAGE_OBSERVER_LIMITS.maxSnapshotChars, 48000);
  assert.equal(PAGE_OBSERVER_LIMITS.maxVisibleTextChars, 8000);
});
test('text is normalized and capped', () => assert.equal(cleanPageText('  hello\n   world ', 8), 'hello wo'));
test('roles are inferred without AI', () => {
  assert.equal(inferElementRole('BUTTON'), 'button'); assert.equal(inferElementRole('INPUT', '', 'checkbox'), 'checkbox'); assert.equal(inferElementRole('DIV', 'menuitem'), 'menuitem');
});
test('sensitive fields include passwords, OTP and payment security fields', () => {
  assert.equal(isSensitiveField('PASSWORD'), true);
  assert.equal(isSensitiveField({ autocomplete: 'one-time-code' }), true);
  assert.equal(isSensitiveField({ name: 'payment_cvv' }), true);
  assert.equal(isSensitiveField({ type: 'email', name: 'email' }), false);
});
test('snapshot bounding drops elements instead of exceeding budget', () => {
  const snapshot={version:1,truncated:false,elements:Array.from({length:50},(_,i)=>({ref:`@e${i}`,name:'x'.repeat(100)}))};
  const bounded=boundSnapshot(snapshot,700); assert.equal(JSON.stringify(bounded).length<=700,true); assert.equal(bounded.truncated,true); assert.equal(bounded.elements.length<50,true);
});
test('snapshot identity ignores ephemeral refs and geometry but changes with semantics', () => {
  const a={url:'https://example.com',title:'X',elements:[{ref:'@e1',role:'button',name:'Save',rect:{x:1}}]};
  const b={url:'https://example.com',title:'X',elements:[{ref:'@e9',role:'button',name:'Save',rect:{x:99}}]};
  const c={...b,elements:[{...b.elements[0],name:'Delete'}]};
  const d={...b,visibleText:'New inbox message arrived'};
  assert.equal(snapshotIdentity(a),snapshotIdentity(b)); assert.notEqual(snapshotIdentity(a),snapshotIdentity(c)); assert.notEqual(snapshotIdentity(b),snapshotIdentity(d));
});


test('bounded text collector stops before materializing unlimited page text', () => {
  const collector=createBoundedTextCollector(12);
  assert.equal(collector.push('  hello   world  '),true);
  assert.equal(collector.push('again and again'),false);
  assert.equal(collector.value(),'hello world ');
  assert.equal(collector.length,12);
  assert.equal(collector.full,true);
  assert.equal(collector.push('ignored'),false);
  assert.equal(collector.value().length,12);
});


test('safeOrigin exposes origin only and strips path/query/hash', () => {
  assert.equal(safeOrigin('https://example.com/path?q=secret#x'),'https://example.com');
  assert.equal(safeOrigin('/embedded','https://mail.yahoo.com/inbox'),'https://mail.yahoo.com');
  assert.equal(safeOrigin('not a url'),null);
});


test('only button-like inputs may use value attributes as labels', () => {
  assert.equal(mayUseValueAsAccessibleName('input','button','submit'),true);
  assert.equal(mayUseValueAsAccessibleName('input','textbox','text'),false);
  assert.equal(mayUseValueAsAccessibleName('textarea','textbox',''),false);
  assert.equal(mayUseValueAsAccessibleName('select','combobox',''),false);
});

test('sensitive field matching uses tokens, not substrings of everyday labels', () => {
  for(const name of ['shipping', 'mapping', 'compass', 'passenger', 'ShippingAddress', 'MapPinboard']) {
    assert.equal(isSensitiveField({name}),false,name);
  }
  for(const name of ['password', 'new_password', 'newPassword', 'Pin', 'security-code', 'cardNumber', 'oneTimeCode', 'payment_cvv']) {
    assert.equal(isSensitiveField({name}),true,name);
  }
});

test('structural effect ignores clocks, unrelated controls and hash changes', () => {
  const before={url:'https://example.com/inbox',snapshotId:'s1',visibleText:'Clock 10:00',elements:[
    {ref:'@e1',role:'button',name:'Delete item',state:{disabled:false}},
    {ref:'@e2',role:'button',name:'Refresh',state:{disabled:false}},
  ]};
  const after={...before,snapshotId:'s2',visibleText:'Clock 10:01',elements:[
    {...before.elements[0],ref:'@e9'},
    {ref:'@e8',role:'button',name:'Refresh',state:{disabled:true}},
  ]};
  assert.equal(hasTargetStructuralEffect(before,after,{action:'click',ref:'@e1'}),false);
});
test('target removal and concrete control-state changes count as structural evidence', () => {
  const before={url:'https://example.com/',elements:[
    {ref:'@e1',role:'button',name:'Delete item',state:{}},
  ]};
  assert.equal(hasTargetStructuralEffect(before,{...before,elements:[]},{action:'click',ref:'@e1'}),true);
  const checkbox={url:'https://example.com/',elements:[
    {ref:'@e2',role:'checkbox',name:'Select',state:{checked:false}},
  ]};
  const checked={...checkbox,elements:[{ref:'@e10',role:'checkbox',name:'Select',state:{checked:true}}]};
  assert.equal(hasTargetStructuralEffect(checkbox,checked,{action:'check',ref:'@e2'}),true);
  assert.equal(hasTargetStructuralEffect(checkbox,{...checked,truncated:true},{action:'check',ref:'@e2'}),false);
});
test('duplicate targets and text-only changes cannot prove effects', () => {
  const target={ref:'@e1',role:'button',name:'Delete',state:{}};
  const before={url:'https://example.com/',elements:[target,{...target,ref:'@e2'}]};
  assert.equal(hasTargetStructuralEffect(before,{...before,elements:[]},{action:'click',ref:'@e1'}),false);
  assert.equal(hasTargetStructuralEffect({url:before.url,elements:[target]},
    {url:before.url,elements:[target],visibleText:'Successfully deleted'},
    {action:'click',ref:'@e1'}),false);
  assert.equal(hasTargetStructuralEffect({url:'https://example.com/a',elements:[]},
    {url:'https://example.com/b',elements:[]},{action:'navigate',url:'https://example.com/b'}),true);
});

test('observation limits cannot be increased by unsafe overrides', () => {
  const limits=normalizeObservationLimits({
    maxElements:Infinity, maxSnapshotChars:100000000,
    maxVisibleTextChars:100000000, maxTextNodesVisited:100000000,
    maxDomNodesVisited:100000000,
  });
  for (const [key, maximum] of Object.entries(PAGE_OBSERVER_LIMITS)) {
    assert.ok(limits[key]<=maximum,key);
  }
  assert.equal(limits.maxElements,300);
  assert.equal(limits.maxTextNodesVisited,6000);
  assert.equal(limits.maxDomNodesVisited,12000);
});

test('small observation limits still reduce work without accepting invalid budgets', () => {
  const limits=normalizeObservationLimits({
    maxElements:12.8, maxTextNodesVisited:9,
    maxDomNodesVisited:0, maxTextPerElement:NaN,
  });
  assert.equal(limits.maxElements,12);
  assert.equal(limits.maxTextNodesVisited,9);
  assert.equal(limits.maxDomNodesVisited,PAGE_OBSERVER_LIMITS.maxDomNodesVisited);
  assert.equal(limits.maxTextPerElement,PAGE_OBSERVER_LIMITS.maxTextPerElement);
});

test('frame count and depth truncation are never represented as complete coverage', () => {
  assert.equal(incompleteFrameInventory({truncated:true,skippedDepth:0}),true);
  assert.equal(incompleteFrameInventory({truncated:false,skippedDepth:1}),true);
  assert.equal(incompleteFrameInventory({truncated:false,skippedDepth:0}),false);
  assert.equal(incompleteFrameInventory({opaque:2,skippedDepth:0}),false);
  assert.equal(incompleteFrameInventory(null),false);
});

test('bounded normalization preserves Unicode whitespace and normal-length semantics', () => {
  const examples = [
    'hello   world', ' \t hello\n world \u00a0',
    '\u2003A\u2028B\uFEFFC', 'a '.repeat(1700),
    '    ', '\u00a0', '   open     inbox \r\n now',
    'abc\t\tdef\rghi\n',
  ];
  for (const input of examples) {
    for (const max of [1, 2, 3, 8, 12, 240, 300]) {
      assert.equal(cleanPageText(input, max),
        input.replace(/\s+/g, ' ').trim().slice(0, max),
        'limit ' + max);
    }
  }
});

test('huge page text is normalized without retaining huge strings', () => {
  const huge='  A  '.repeat(300000);
  assert.equal(cleanPageText(huge, 240).length, 240);
  const collector=createBoundedTextCollector(8000);
  assert.equal(collector.push(huge), false);
  assert.equal(collector.length, 8000);
  assert.equal(collector.full, true);
  assert.equal(collector.push('not included'), false);
  assert.equal(collector.value().length, 8000);
});

test('text input scan budget detects extreme leading whitespace without large output', () => {
  const collector=createBoundedTextCollector(40);
  assert.equal(collector.push(' '.repeat(400000)+'content'), false);
  assert.equal(collector.length, 0);
  assert.equal(collector.full, false);
  assert.equal(collector.push('new short text'), true);
  assert.equal(collector.value(), 'new short text');
});

test('collector refuses oversized configuration and stays at the hard text cap', () => {
  const collector=createBoundedTextCollector(100000000);
  assert.equal(collector.push('x'.repeat(1000000)), false);
  assert.equal(collector.length, PAGE_OBSERVER_LIMITS.maxVisibleTextChars);
});

test('shared page text scan budget limits work across many huge text nodes', () => {
  const collector=createBoundedTextCollector(8000,65536);
  for (let n=0; n<20 && !collector.exhausted; n += 1)
    assert.equal(collector.push(' '.repeat(100000)),false);
  assert.equal(collector.scannedChars,65536);
  assert.equal(collector.exhausted,true);
  assert.equal(collector.length,0);
  assert.equal(collector.push('not observed'),false);
});

test('custom smaller scan budget is counted exactly', () => {
  const collector=createBoundedTextCollector(100,20);
  assert.equal(collector.push('  hello  '),true);
  assert.equal(collector.scannedChars,9);
  assert.equal(collector.push('  world  '),true);
  assert.equal(collector.scannedChars,18);
  assert.equal(collector.push('more'),false);
  assert.equal(collector.scannedChars,20);
  assert.equal(collector.exhausted,true);
  assert.equal(collector.value(),'hello world mo');
});

test('huge whitespace-only text cannot fabricate a trailing separator', () => {
  const collector=createBoundedTextCollector(12,40000);
  assert.equal(collector.push('hello'),true);
  assert.equal(collector.push(' '.repeat(100000)),false);
  assert.equal(collector.value(),'hello');
  assert.equal(collector.scannedChars,32773);
});

test('bounded whitespace normalization matches reference on deterministic fuzz inputs', () => {
  const alphabet=['a','b','Z','9',' ','\t','\n','\r','\u00a0','\u2003','\u2028','\uFEFF','!'];
  let seed=0x9e3779b9;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let trial=0;trial<160;trial++){
    const length=next()%600;
    let input='';
    for(let i=0;i<length;i++) input+=alphabet[next()%alphabet.length];
    const max=1+(next()%300);
    const reference=input.replace(/\s+/g,' ').trim().slice(0,max);
    assert.equal(cleanPageText(input,max),reference,'trial '+trial);
  }
});
