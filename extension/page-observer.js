import {
  PAGE_OBSERVER_LIMITS,
  cleanPageText,
  inferElementRole,
  isSensitiveField,
  boundSnapshot,
  createBoundedTextCollector,
  safeOrigin,
  mayUseValueAsAccessibleName,
} from './page-observer-core.js';

const INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
  '[role="textbox"]', '[role="combobox"]', '[role="menuitem"]', '[tabindex]',
].join(',');

function isVisible(element) {
  if (!element || element.nodeType !== 1) return false;
  const view = element.ownerDocument?.defaultView;
  const style = view?.getComputedStyle?.(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) return false;
  const rect = element.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

function appendBoundedPageText(root, collector) {
  if (!root || collector.full) return;
  const doc = root.ownerDocument || document;
  const nodeFilter = doc.defaultView?.NodeFilter || globalThis.NodeFilter;
  if (!doc.createTreeWalker || !nodeFilter) return;
  const walker = doc.createTreeWalker(root, nodeFilter.SHOW_TEXT);
  const skippedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  let node = walker.nextNode();
  while (node && !collector.full) {
    const parent = node.parentElement;
    if (parent && !skippedTags.has(parent.tagName) && !parent.closest?.('[hidden],[aria-hidden="true"]')) {
      const rects = typeof parent.getClientRects === 'function' ? parent.getClientRects() : null;
      if (!rects || rects.length > 0) collector.push(node.nodeValue);
    }
    node = walker.nextNode();
  }
}

function collectFrameContexts(rootDocument, maxFrames = 20, maxDepth = 3) {
  const contexts = [{ doc: rootDocument, path: 'top', depth: 0, origin: safeOrigin(rootDocument.location?.href || location.href) }];
  const inventory = { total: 0, sameOrigin: 0, opaque: 0, skippedDepth: 0, origins: [] };
  const originSet = new Set();
  let inspected = 0;

  for (let contextIndex = 0; contextIndex < contexts.length; contextIndex += 1) {
    const context = contexts[contextIndex];
    const frames = [...context.doc.querySelectorAll('iframe,frame')];
    inventory.total += frames.length;

    for (let i = 0; i < frames.length; i += 1) {
      if (inspected >= maxFrames) {
        inventory.truncated = true;
        break;
      }
      inspected += 1;
      const frame = frames[i];
      const origin = safeOrigin(frame.getAttribute?.('src') || '', context.doc.location?.href || location.href);
      if (origin && origin !== 'null' && !originSet.has(origin) && originSet.size < 10) {
        originSet.add(origin);
        inventory.origins.push(origin);
      }

      let childDocument = null;
      try { childDocument = frame.contentDocument || null; } catch {}
      if (!childDocument?.documentElement) {
        inventory.opaque += 1;
        continue;
      }

      inventory.sameOrigin += 1;
      if (context.depth >= maxDepth || !isVisible(frame)) {
        inventory.skippedDepth += context.depth >= maxDepth ? 1 : 0;
        continue;
      }

      contexts.push({
        doc: childDocument,
        path: `${context.path}/f${i + 1}`,
        depth: context.depth + 1,
        origin: safeOrigin(childDocument.location?.href || origin || '', context.doc.location?.href || location.href),
      });
    }
    if (inspected >= maxFrames) break;
  }

  return { contexts, inventory };
}

function accessibleName(element, maxLength, allowValueLabel = false) {
  const doc = element.ownerDocument || document;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map(id => doc.getElementById(id)?.textContent || '').join(' ');
    if (text.trim()) return cleanPageText(text, maxLength);
  }
  const aria = element.getAttribute('aria-label');
  if (aria) return cleanPageText(aria, maxLength);
  if (element.labels?.length) return cleanPageText([...element.labels].map(x => x.textContent).join(' '), maxLength);
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return cleanPageText(placeholder, maxLength);
  const title = element.getAttribute('title');
  if (title) return cleanPageText(title, maxLength);
  return cleanPageText(element.innerText || element.textContent || (allowValueLabel ? element.getAttribute('value') : '') || '', maxLength);
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
  return {
    ref: `@e${index + 1}`,
    role,
    name: sensitive ? '[REDACTED SENSITIVE FIELD]' : accessibleName(element, limits.maxTextPerElement, mayUseValueAsAccessibleName(element.tagName, role, element.getAttribute('type') || '')),
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
  const limits = { ...PAGE_OBSERVER_LIMITS, ...limitOverrides };
  const elements = [];
  const registryEntries = [];
  const { contexts, inventory } = collectFrameContexts(document);
  const textCollector = createBoundedTextCollector(limits.maxVisibleTextChars);
  let truncated = false;

  for (const frameContext of contexts) {
    appendBoundedPageText(frameContext.doc.body, textCollector);
    for (const candidate of frameContext.doc.querySelectorAll(INTERACTIVE_SELECTOR)) {
      if (!isVisible(candidate)) continue;
      if (elements.length >= limits.maxElements) { truncated = true; break; }
      const description = describeElement(candidate, elements.length, limits, frameContext);
      elements.push(description);
      registryEntries.push({ ref: description.ref, value: candidate });
    }
    if (truncated) break;
  }

  const snapshot = boundSnapshot({
    version: 1,
    url: location.href,
    title: cleanPageText(document.title, 300),
    visibleText: textCollector.value(),
    frames: inventory,
    viewport: { width: innerWidth, height: innerHeight },
    truncated,
    elements,
  }, limits.maxSnapshotChars);
  if (registry?.replace) registry.replace(snapshot.snapshotId, registryEntries.slice(0, snapshot.elements.length));
  return snapshot;
}
