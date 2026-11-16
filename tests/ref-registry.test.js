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

test('registry hard-caps infinite and oversized requested retention', () => {
  for (const requested of [Infinity, Number.MAX_SAFE_INTEGER, 999999, NaN]) {
    const registry=new RefRegistry(requested);
    assert.ok(registry.maxRefs<=300);
    const elements=Array.from({length:500},(_,i)=>({
      ref:`@e${i+1}`,value:{index:i},
    }));
    const retained=registry.replace('bounded',elements);
    assert.equal(retained,300);
    assert.equal(registry.refs.size,300);
    assert.equal(registry.has('@e301','bounded'),false);
  }
});

test('registry drops old DOM object references on snapshot replacement and clear', () => {
  const registry=new RefRegistry(2);
  const old={tagName:'BUTTON'};
  registry.replace('old',[{ref:'@e1',value:old}]);
  registry.replace('new',[{ref:'@e2',value:{tagName:'A'}}]);
  assert.equal(registry.has('@e1','old'),false);
  assert.equal([...registry.refs.values()].includes(old),false);
  registry.clear();
  assert.equal(registry.refs.size,0);
});

test('null and zero registry configuration preserve the original default cap', () => {
  assert.equal(new RefRegistry(0).maxRefs,300);
  assert.equal(new RefRegistry(null).maxRefs,300);
  assert.equal(new RefRegistry(undefined).maxRefs,300);
  assert.equal(new RefRegistry(-5).maxRefs,1);
});
