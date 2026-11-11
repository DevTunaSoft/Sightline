import {
  PAGE_OBSERVER_LIMITS,
  cleanPageText,
  inferElementRole,
  isSensitiveField,
  boundSnapshot,
  createBoundedTextCollector,
  safeOrigin,
  mayUseValueAsAccessibleName,
  normalizeObservationLimits,
  incompleteFrameInventory,
} from './page-observer-core.js';

const INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
  '[role="textbox"]', '[role="combobox"]', '[role="menuitem"]', '[tabindex]',
].join(',');

export function isVisible(element) {
  if (!element || element.nodeType !== 1) return false;
  const view = element.ownerDocument?.defaultView;
  const style = view?.getComputedStyle?.(element);
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // Empty or unavailable opacity is not zero. Never hide otherwise visible elements.
    const opacity = String(style.opacity ?? '').trim();
    if (opacity !== '' && Number(opacity) === 0) return false;
  }
  const rect = element.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

const SKIPPED_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
const INTERACTIVE_TAGS = new Set([
  'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
  'a', 'button', 'input', 'select', 'textarea',
]);

function appendBoundedPageText(root, collector, maxVisited) {
  if (!root) return { visited: 0, truncated: false };
  if (collector.full || collector.exhausted) return { visited: 0, truncated: true };
  const doc = root.ownerDocument || document;
  const nodeFilter = doc.defaultView?.NodeFilter || globalThis.NodeFilter;
  if (!doc.createTreeWalker || !nodeFilter) return { visited: 0, truncated: true };
  const walker = doc.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  let visited = 0;
  let textLimitReached = false;
  let node = walker.nextNode();
  while (node && !collector.full && !collector.exhausted && visited < maxVisited) {
    visited += 1;
    const parent = node.parentElement;
    if (parent && !SKIPPED_TEXT_TAGS.has(parent.tagName) && !parent.closest?.('[hidden],[aria-hidden="true"]')) {
      const rects = typeof parent.getClientRects === 'function' ? parent.getClientRects() : null;
      if ((!rects || rects.length > 0) && !collector.push(node.nodeValue))
        textLimitReached = true;
    }
    node = walker.nextNode();
  }
  // A full text budget or unvisited nodes means incomplete page context.
  return { visited, truncated: textLimitReached || Boolean(node) };
}

// Shared bounded walker: neither frame discovery nor interactive discovery
// materializes a potentially huge querySelectorAll result collection.
function walkDocumentElements(doc, budget, visit) {
  const root = doc?.documentElement;
  const nodeFilter = doc?.defaultView?.NodeFilter || globalThis.NodeFilter;
  if (!root || !nodeFilter || typeof doc.createTreeWalker !== 'function')
    return { visited: 0, truncated: true };
  const walker = doc.createTreeWalker(root, nodeFilter.SHOW_ELEMENT);
  let node = root;
  let visited = 0;
  while (node && visited < budget) {
    visited += 1;
    if (visit(node) === false) return { visited, truncated: true };
    node = walker.nextNode();
  }
  return { visited, truncated: Boolean(node) };
}

/** Lazy, bounded interactive scan; ordinary layout nodes skip CSS matching. */
export function visitInteractiveNodes(doc, selector, budget, visit) {
  return walkDocumentElements(doc, budget, node => {
    const possiblyInteractive = INTERACTIVE_TAGS.has(node.tagName) ||
      node.hasAttribute?.('role') || node.hasAttribute?.('tabindex');
    if (possiblyInteractive && node.matches?.(selector))
      return visit(node);
    return true;
  });
}

export function collectFrameContexts(
  rootDocument, maxFrames = 20, maxDepth = 3,
  maxVisitedNodes = PAGE_OBSERVER_LIMITS.maxFrameNodesVisited) {
  const contexts = [{
    doc: rootDocument, path: 'top', depth: 0,
    origin: safeOrigin(rootDocument.location?.href || location.href),
  }];
  const inventory = { total: 0, sameOrigin: 0, opaque: 0, skippedDepth: 0, origins: [] };
  const originSet = new Set();
  const frameLimit = Number.isFinite(maxFrames)
    ? Math.max(0, Math.min(20, Math.floor(maxFrames))) : 20;
  const depthLimit = Number.isFinite(maxDepth)
    ? Math.max(0, Math.min(3, Math.floor(maxDepth))) : 3;
  let inspected = 0;
  let remaining = Number.isFinite(maxVisitedNodes)
    ? Math.max(0, Math.min(PAGE_OBSERVER_LIMITS.maxFrameNodesVisited, Math.floor(maxVisitedNodes)))
    : PAGE_OBSERVER_LIMITS.maxFrameNodesVisited;

  for (let contextIndex = 0; contextIndex < contexts.length; contextIndex += 1) {
    const context = contexts[contextIndex];
    let frameIndex = 0;
    const scan = walkDocumentElements(context.doc, remaining, node => {
      const tag = node.tagName;
      if (tag !== 'IFRAME' && tag !== 'FRAME' &&
          tag !== 'iframe' && tag !== 'frame') return true;
      if (inspected >= frameLimit) return false;
      inspected += 1;
      frameIndex += 1;
      inventory.total += 1;
      const origin = safeOrigin(
        node.getAttribute?.('src') || '', context.doc.location?.href || location.href);
      if (origin && origin !== 'null' && !originSet.has(origin) && originSet.size < 10) {
        originSet.add(origin);
        inventory.origins.push(origin);
      }

      let childDocument = null;
      try { childDocument = node.contentDocument || null; } catch {}
      if (!childDocument?.documentElement) {
        inventory.opaque += 1;
        return true;
      }
      inventory.sameOrigin += 1;
      if (context.depth >= depthLimit || !isVisible(node)) {
        if (context.depth >= maxDepth) inventory.skippedDepth += 1;
        return true;
      }
      contexts.push({
        doc: childDocument,
        path: `${context.path}/f${frameIndex}`,
        depth: context.depth + 1,
        origin: safeOrigin(
          childDocument.location?.href || origin || '',
          context.doc.location?.href || location.href),
      });
      return true;
    });
    remaining -= scan.visited;
    if (scan.truncated) {
      inventory.truncated = true;
      break;
    }
  }

  return { contexts, inventory };
}

// Accessible names are untrusted DOM data. Inspect at most 16 references and
// 2,048 attribute code units; do not allocate split/map/join arrays or concatenate
// arbitrarily long label text before normalizing it.
const MAX_LABEL_REFERENCES = 16;
const MAX_LABEL_ID_CHARS = 2048;
const MAX_LABEL_TEXT_SCAN = 4096;

function accessibleName(element, maxLength, allowValueLabel = false) {
  const doc = element.ownerDocument || document;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const collector = createBoundedTextCollector(maxLength, MAX_LABEL_TEXT_SCAN);
    const ids = String(labelledBy);
    const matcher = /\S+/g;
    const boundedIds = ids.slice(0, MAX_LABEL_ID_CHARS);
    let matched;
    let count = 0;
    let incomplete = ids.length > MAX_LABEL_ID_CHARS;
    while ((matched = matcher.exec(boundedIds)) !== null) {
      if (++count > MAX_LABEL_REFERENCES) { incomplete = true; break; }
      const label = doc.getElementById?.(matched[0]);
      if (label && !collector.push(label.textContent || '')) {
        incomplete = true;
        break;
      }
    }
    if (collector.value() || incomplete)
      return { text: collector.value(), incomplete };
  }
  const aria = element.getAttribute('aria-label');
  if (aria) return { text: cleanPageText(aria, maxLength),
    incomplete: aria.length > maxLength };
  const labels = element.labels;
  if (labels?.length) {
    const collector = createBoundedTextCollector(maxLength, MAX_LABEL_TEXT_SCAN);
    const count = Math.min(labels.length, MAX_LABEL_REFERENCES);
    let incomplete = labels.length > MAX_LABEL_REFERENCES;
    for (let index = 0; index < count; index += 1) {
      if (!collector.push(labels[index]?.textContent || '')) {
        incomplete = true;
        break;
      }
    }
    return { text: collector.value(), incomplete };
  }
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return { text: cleanPageText(placeholder, maxLength),
    incomplete: placeholder.length > maxLength };
  const title = element.getAttribute('title');
  if (title) return { text: cleanPageText(title, maxLength),
    incomplete: title.length > maxLength };
  const raw = element.innerText || element.textContent ||
    (allowValueLabel ? element.getAttribute('value') : '') || '';
  return { text: cleanPageText(raw, maxLength),
    incomplete: raw.length > maxLength };
}

function describeElement(element, index, limits, frameContext) {
  const role = inferElementRole(element.tagName, element.getAttribute('role') || '', element.getAttribute('type') || '');
  const sensitive = isSensitiveField({
    type: element.getAttribute('type'),
    autocomplete: element.getAttribute('autocomplete'),
    name: element.getAttribute('name') || element.id,
  });
  const rect = element.getBoundingClientRect();
  const state = {};
  if ('disabled' in element) state.disabled = Boolean(element.disabled);
  if ('checked' in element && ['checkbox', 'radio'].includes(role)) state.checked = Boolean(element.checked);
  if ('readOnly' in element && element.readOnly) state.readOnly = true;
  if (role === 'link' && element.href) {
    try { state.hrefOrigin = new URL(element.href, location.href).origin; } catch {}
  }
  if (!sensitive && ['textbox', 'combobox'].includes(role) && typeof element.value === 'string') state.valueLength = Math.min(4000, element.value.length);
  if (!sensitive && element.tagName?.toLowerCase() === 'select' && Number.isInteger(element.selectedIndex)) state.selectedIndex = element.selectedIndex;
  if (element.getAttribute('aria-expanded') !== null) state.expanded = element.getAttribute('aria-expanded') === 'true';
  const frame = frameContext?.depth > 0
    ? { path: frameContext.path, depth: frameContext.depth, origin: frameContext.origin || null }
    : undefined;
  const label = sensitive
    ? { text: '[REDACTED SENSITIVE FIELD]', incomplete: false }
    : accessibleName(element, limits.maxTextPerElement,
      mayUseValueAsAccessibleName(element.tagName, role, element.getAttribute('type') || ''));
  return {
    ref: `@e${index + 1}`,
    role,
    name: label.text,
    incompleteLabel: label.incomplete,
    sensitive,
    state,
    ...(frame ? { frame } : {}),
    rect: {
      x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.round(rect.width), height: Math.round(rect.height),
    },
  };
}

export function buildPageSnapshot(options = {}) {
  const { registry = null, ...limitOverrides } = options;
  const limits = normalizeObservationLimits(limitOverrides);
  const elements = [];
  const registryEntries = [];
  const { contexts, inventory } = collectFrameContexts(
    document, 20, 3, limits.maxFrameNodesVisited);
  const textCollector = createBoundedTextCollector(
    limits.maxVisibleTextChars, limits.maxTextCharsInspected);
  let truncated = false;
  let textVisitsRemaining = limits.maxTextNodesVisited;
  let domVisitsRemaining = limits.maxDomNodesVisited;

  for (const frameContext of contexts) {
    const textScan = appendBoundedPageText(
      frameContext.doc.body, textCollector, textVisitsRemaining);
    textVisitsRemaining -= textScan.visited;
    if (textScan.truncated) truncated = true;

    const domScan = visitInteractiveNodes(
      frameContext.doc, INTERACTIVE_SELECTOR, domVisitsRemaining, candidate => {
        if (!isVisible(candidate)) return true;
        if (elements.length >= limits.maxElements) return false;
        const description = describeElement(candidate, elements.length, limits, frameContext);
        const { incompleteLabel, ...semantic } = description;
        elements.push(semantic);
        registryEntries.push({ ref: semantic.ref, value: candidate });
        if (incompleteLabel) { truncated = true; return false; }
        return true;
      });
    domVisitsRemaining -= domScan.visited;
    if (domScan.truncated) truncated = true;
    if (truncated) break;
  }

  const snapshot = boundSnapshot({
    version: 1,
    url: location.href,
    title: cleanPageText(document.title, 300),
    visibleText: textCollector.value(),
    frames: inventory,
    viewport: { width: innerWidth, height: innerHeight },
    // Frame enumeration/depth budgets are part of observation coverage too.
    // An unobserved same-origin frame must not appear as a complete snapshot.
    truncated: truncated || incompleteFrameInventory(inventory),
    elements,
  }, limits.maxSnapshotChars);
  if (registry?.replace) registry.replace(snapshot.snapshotId, registryEntries.slice(0, snapshot.elements.length));
  return snapshot;
}
