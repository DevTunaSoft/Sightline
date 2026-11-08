import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_OBSERVER_LIMITS, cleanPageText, inferElementRole, isSensitiveField, boundSnapshot, snapshotIdentity, createBoundedTextCollector } from '../extension/page-observer-core.js';

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
