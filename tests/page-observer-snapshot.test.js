import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageSnapshot } from '../extension/page-observer.js';

// A deliberately small, deterministic DOM test double. Selector collections
// are forbidden to catch accidental reintroduction of unbounded querySelectorAll.
function fakeDocument(url, elements = [], textNodes = []) {
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
    element.matches ||= selector => selector.includes('button') && element.tagName === 'BUTTON';
  }
  doc.createTreeWalker = (_root, show) => {
    const nodes = show === 1 ? elements : textNodes;
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

function fakeText(value) {
  return {
    nodeValue: value,
    parentElement: {
      tagName: 'DIV',
      closest: () => null,
      getClientRects: () => [{}],
    },
  };
}

test('visible text overflow sets incomplete coverage instead of false success', () => {
  const doc = fakeDocument('https://example.com/', [button()], [
    fakeText('one two three four five'),
  ]);
  const snapshot = withPage(doc, () => buildPageSnapshot({
    maxVisibleTextChars: 10,
  }));
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.visibleText.length, 10);
  assert.equal(snapshot.elements.length, 1);
});

test('text node visit exhaustion reports incomplete coverage', () => {
  const doc = fakeDocument('https://example.com/', [button()], [
    fakeText('one'), fakeText('two'), fakeText('three'),
  ]);
  const snapshot = withPage(doc, () => buildPageSnapshot({
    maxTextNodesVisited: 1,
  }));
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.visibleText, 'one');
});

test('short complete visible text keeps a non-truncated observation', () => {
  const doc = fakeDocument('https://example.com/', [button()], [
    fakeText('hello'),
  ]);
  const snapshot = withPage(doc, () => buildPageSnapshot({
    maxVisibleTextChars: 40,
  }));
  assert.equal(snapshot.truncated, false);
  assert.equal(snapshot.visibleText, 'hello');
});

test('integrated observation stops after the shared text scan budget', () => {
  const doc = fakeDocument('https://example.com/', [button()], [
    fakeText(' '.repeat(40000)),
    fakeText(' '.repeat(40000)),
    fakeText('hidden after budget'),
  ]);
  const snapshot = withPage(doc, () => buildPageSnapshot({
    maxTextCharsInspected: 40000,
  }));
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.visibleText, '');
  assert.equal(snapshot.elements.length, 1);
});

test('oversized text budgets cannot override the hard per-page ceiling', () => {
  const doc = fakeDocument('https://example.com/', [button()], [
    fakeText(' '.repeat(50000)),
    fakeText(' '.repeat(50000)),
    fakeText('never scanned'),
  ]);
  const snapshot = withPage(doc, () => buildPageSnapshot({
    maxTextCharsInspected: Number.MAX_SAFE_INTEGER,
  }));
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.visibleText, '');
});

test('oversized aria-labelledby references are scanned without split/map/join expansion', () => {
  const control = button();
  const ids = Array.from({ length: 5000 }, (_, i) => 'id' + i).join(' ');
  let resolved = 0;
  control.getAttribute = key => key === 'aria-labelledby' ? ids : null;
  const doc = fakeDocument('https://example.com/', [control]);
  doc.getElementById = () => { resolved++; return { textContent: 'Send' }; };
  const snapshot = withPage(doc, () => buildPageSnapshot());
  assert.equal(snapshot.truncated, true);
  assert.ok(resolved <= 16);
  assert.equal(snapshot.elements.length, 1);
  assert.ok(snapshot.elements[0].name.length <= 240);
  assert.equal(snapshot.elements[0].incompleteLabel, undefined);
});

test('large live labels collection is read by index with a strict cap', () => {
  const control = button();
  let reads = 0;
  control.labels = new Proxy({ length: 1000000 }, {
    get(target, key) {
      if (key === 'length') return target.length;
      if (/^\d+$/.test(String(key))) {
        reads++;
        return { textContent: 'Button label' };
      }
      return undefined;
    },
  });
  const snapshot = withPage(fakeDocument('https://example.com/', [control]),
    () => buildPageSnapshot());
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.elements.length, 1);
  assert.ok(reads <= 16);
  assert.ok(snapshot.elements[0].name.length <= 240);
});

test('ordinary short accessible labels remain complete and readable', () => {
  const control = button();
  control.labels = [{ textContent: 'Save' }, { textContent: 'draft' }];
  const snapshot = withPage(fakeDocument('https://example.com/', [control]),
    () => buildPageSnapshot());
  assert.equal(snapshot.truncated, false);
  assert.equal(snapshot.elements[0].name, 'Save draft');
});

test('long individual label text triggers partial-observation protection', () => {
  const control = button();
  control.labels = [{ textContent: 'X'.repeat(100000) }];
  const snapshot = withPage(fakeDocument('https://example.com/', [control]),
    () => buildPageSnapshot());
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.elements[0].name.length, 240);
});

test('short aria-labelledby references preserve accessible naming', () => {
  const control = button();
  control.getAttribute = key => key === 'aria-labelledby' ? 'first second' : null;
  const doc = fakeDocument('https://example.com/', [control]);
  const values = { first: 'Delete', second: 'draft' };
  doc.getElementById = id => ({ textContent: values[id] || '' });
  const snapshot = withPage(doc, () => buildPageSnapshot());
  assert.equal(snapshot.truncated, false);
  assert.equal(snapshot.elements[0].name, 'Delete draft');
});
