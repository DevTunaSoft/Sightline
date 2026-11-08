import {
  PAGE_OBSERVER_LIMITS,
  cleanPageText,
  inferElementRole,
  isSensitiveField,
  boundSnapshot,
} from './page-observer-core.js';

const INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
  '[role="textbox"]', '[role="combobox"]', '[role="menuitem"]', '[tabindex]',
].join(',');

function isVisible(element) {
  if (!(element instanceof Element)) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function accessibleName(element, maxLength) {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
    if (text.trim()) return cleanPageText(text, maxLength);
  }
  const aria = element.getAttribute('aria-label');
  if (aria) return cleanPageText(aria, maxLength);
  if (element.labels?.length) return cleanPageText([...element.labels].map(x => x.textContent).join(' '), maxLength);
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return cleanPageText(placeholder, maxLength);
  const title = element.getAttribute('title');
  if (title) return cleanPageText(title, maxLength);
  return cleanPageText(element.innerText || element.textContent || element.getAttribute('value') || '', maxLength);
}

function describeElement(element, index, limits) {
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
  if (element.getAttribute('aria-expanded') !== null) state.expanded = element.getAttribute('aria-expanded') === 'true';
  return {
    ref: `@e${index + 1}`,
    role,
    name: sensitive ? '[REDACTED SENSITIVE FIELD]' : accessibleName(element, limits.maxTextPerElement),
    sensitive,
    state,
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
  let truncated = false;
  for (const candidate of document.querySelectorAll(INTERACTIVE_SELECTOR)) {
    if (!isVisible(candidate)) continue;
    if (elements.length >= limits.maxElements) { truncated = true; break; }
    const description = describeElement(candidate, elements.length, limits);
    elements.push(description);
    registryEntries.push({ ref: description.ref, value: candidate });
  }
  const snapshot = boundSnapshot({
    version: 1,
    url: location.href,
    title: cleanPageText(document.title, 300),
    visibleText: cleanPageText(document.body?.innerText || '', limits.maxVisibleTextChars),
    viewport: { width: innerWidth, height: innerHeight },
    truncated,
    elements,
  }, limits.maxSnapshotChars);
  if (registry?.replace) registry.replace(snapshot.snapshotId, registryEntries.slice(0, snapshot.elements.length));
  return snapshot;
}
