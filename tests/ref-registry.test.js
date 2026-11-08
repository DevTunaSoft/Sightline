import test from 'node:test';
import assert from 'node:assert/strict';
import { RefRegistry } from '../extension/ref-registry.js';

test('registry resolves refs only for current snapshot', () => {
  const r=new RefRegistry();
  const button={id:1};
  r.replace('s1',[{ref:'@e1',value:button}]);
  assert.equal(r.resolve('@e1','s1'),button);
  assert.equal(r.resolve('@e1','old'),null);
});

test('replacing snapshot invalidates old refs and enforces cap', () => {
  const r=new RefRegistry(2);
  r.replace('s1',[{ref:'@e1',value:1}]);
  const count=r.replace('s2',[{ref:'@e1',value:2},{ref:'@e2',value:3},{ref:'@e3',value:4}]);
  assert.equal(count,2);
  assert.equal(r.resolve('@e1','s1'),null);
  assert.equal(r.resolve('@e3','s2'),null);
});
