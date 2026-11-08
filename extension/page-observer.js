import { PAGE_OBSERVER_LIMITS, cleanPageText, inferElementRole, isSensitiveField, boundSnapshot } from './page-observer-core.js';

const DEFAULT_LIMITS = PAGE_OBSERVER_LIMITS;
const INTERACTIVE_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
  '[role="textbox"]', '[role="combobox"]', '[role="menuitem"]', '[tabindex]'
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
  const type = (element.getAttribute('type') || '').toLowerCase();
  const sensitive = isSensitiveField(type);
  const rect = element.getBoundingClientRect();
  const state = {};
  if ('disabled' in element) state.disabled = Boolean(element.disabled);
  if ('checked' in element && ['checkbox', 'radio'].includes(role)) state.checked = Boolean(element.checked);
  if ('readOnly' in element && element.readOnly) state.readOnly = true;
  if (element.getAttribute('aria-expanded') !== null) state.expanded = element.getAttribute('aria-expanded') === 'true';
  return {
    ref: `@e${index + 1}`, role,
    name: sensitive ? '[REDACTED SENSITIVE FIELD]' : accessibleName(element, limits.maxTextPerElement),
    sensitive, state,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
  };
}

export function buildPageSnapshot(options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const candidates = [...document.querySelectorAll(INTERACTIVE_SELECTOR)].filter(isVisible).slice(0, limits.maxElements);
  const elements = candidates.map((el, index) => describeElement(el, index, limits));
  const snapshot = {
    version: 1, url: location.href, title: cleanPageText(document.title, 300),
    viewport: { width: innerWidth, height: innerHeight },
    truncated: candidates.length >= limits.maxElements, elements,
  };
  return boundSnapshot(snapshot, limits.maxSnapshotChars);
}
