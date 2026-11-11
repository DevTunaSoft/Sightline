import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageSnapshot } from '../extension/page-observer.js';

// A deliberately small, deterministic DOM test double. Selector collections
// are forbidden to catch accidental reintroduction of unbounded querySelectorAll.
function fakeDocument(url, elements = []) {
  const doc = {
    location: { href: url },
    title: 'Fixture',
    defaultView: {
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    },
    querySelectorAll() { throw new Error('unbounded selector collection'); },
  };
  const root = { tagName: 'HTML', nodeType: 1, ownerDocument: doc };
  doc.documentElement = root;
  doc.body = root;
  for (const element of elements) {
    element.nodeType = 1;
    element.ownerDocument = doc;
    element.hasAttribute ||= () => false;
    element.getAttribute ||= () => null;
    element.getBoundingClientRect ||= () => ({ x: 0, y: 0, width: 80, height: 24 });
    element.matches ||= selector => selector === 'button' && element.tagName === 'BUTTON';
  }
  doc.createTreeWalker = (_root, show) => {
    const nodes = show === 1 ? elements : [];
    let offset = 0;
    return { nextNode: () => nodes[offset++] || null };
  };
  return doc;
}

function withPage(doc, run) {
  const names = ['document', 'location', 'innerWidth', 'innerHeight'];
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const values = [doc, doc.location, 1024, 768];
  for (let i = 0; i < names.length; i += 1) {
    Object.defineProperty(globalThis, names[i], {
      value: values[i], configurable: true, writable: true,
    });
  }
  try { return run(); }
  finally {
    for (let i = 0; i < names.length; i += 1) {
      if (previous[i]) Object.defineProperty(globalThis, names[i], previous[i]);
      else delete globalThis[names[i]];
    }
  }
}

function button() {
  return { tagName: 'BUTTON', innerText: 'Apply', textContent: 'Apply' };
}

test('bounded integrated snapshot observes controls without CSS result allocations', () => {
  const doc = fakeDocument('https://example.com/', [button()]);
  const entries = [];
  const snapshot = withPage(doc, () => buildPageSnapshot({
    registry: { replace(id, refs) { entries.push({ id, refs }); } },
  }));
  assert.equal(snapshot.truncated, false);
  assert.equal(snapshot.elements.length, 1);
  assert.equal(snapshot.elements[0].name, 'Apply');
  assert.equal(entries[0].id, snapshot.snapshotId);
  assert.equal(entries[0].refs.length, 1);
});

test('integrated snapshot fails closed when frame discovery runs out of budget', () => {
  const inner = fakeDocument('https://example.com/inner', [button()]);
  const outer = fakeDocument('https://example.com/', [
    ...Array.from({ length: 40 }, () => ({ tagName: 'DIV' })),
    { tagName: 'IFRAME', contentDocument: inner,
      getAttribute: key => key === 'src' ? '/inner' : null },
    button(),
  ]);
  const snapshot = withPage(outer, () => buildPageSnapshot({
    maxFrameNodesVisited: 5,
  }));
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.frames.truncated, true);
  assert.equal(snapshot.frames.total, 0);
  assert.equal(snapshot.elements.length, 1);
});

test('same-origin embedded control carries a bounded frame identity', () => {
  const inner = fakeDocument('https://example.com/inner', [button()]);
  const outer = fakeDocument('https://example.com/', [{
    tagName: 'IFRAME', contentDocument: inner,
    getAttribute: key => key === 'src' ? '/inner' : null,
  }]);
  const snapshot = withPage(outer, () => buildPageSnapshot());
  assert.equal(snapshot.truncated, false);
  assert.equal(snapshot.frames.sameOrigin, 1);
  assert.equal(snapshot.elements.length, 1);
  assert.equal(snapshot.elements[0].frame.path, 'top/f1');
  assert.equal(snapshot.elements[0].frame.origin, 'https://example.com');
});
