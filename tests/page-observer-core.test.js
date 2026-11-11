import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_OBSERVER_LIMITS, cleanPageText, inferElementRole, isSensitiveField, boundSnapshot, snapshotIdentity, createBoundedTextCollector, safeOrigin, mayUseValueAsAccessibleName, hasTargetStructuralEffect } from '../extension/page-observer-core.js';

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
