import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_OBSERVER_LIMITS, cleanPageText, inferElementRole, isSensitiveField, boundSnapshot } from '../extension/page-observer-core.js';

test('observer defaults are deliberately bounded', () => {
  assert.equal(PAGE_OBSERVER_LIMITS.maxElements, 300);
  assert.equal(PAGE_OBSERVER_LIMITS.maxSnapshotChars, 48000);
});
test('text is normalized and capped', () => assert.equal(cleanPageText('  hello\n   world ', 8), 'hello wo'));
test('roles are inferred without AI', () => {
  assert.equal(inferElementRole('BUTTON'), 'button'); assert.equal(inferElementRole('INPUT', '', 'checkbox'), 'checkbox'); assert.equal(inferElementRole('DIV', 'menuitem'), 'menuitem');
});
test('password fields are sensitive regardless of case', () => { assert.equal(isSensitiveField('PASSWORD'), true); assert.equal(isSensitiveField('email'), false); });
test('snapshot bounding drops elements instead of exceeding budget', () => {
  const snapshot={version:1,truncated:false,elements:Array.from({length:50},(_,i)=>({ref:`@e${i}`,name:'x'.repeat(100)}))};
  const bounded=boundSnapshot(snapshot,700); assert.equal(JSON.stringify(bounded).length<=700,true); assert.equal(bounded.truncated,true); assert.equal(bounded.elements.length<50,true);
});
