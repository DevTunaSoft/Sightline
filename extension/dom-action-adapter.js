import { isSensitiveField, cleanPageText, createBoundedTextCollector } from './page-observer-core.js';

function attr(element, name) {
  return typeof element?.getAttribute === 'function' ? element.getAttribute(name) : null;
}

function sensitiveElement(element) {
  return isSensitiveField({
    type: attr(element, 'type') || element?.type,
    autocomplete: attr(element, 'autocomplete') || element?.autocomplete,
    name: attr(element, 'name') || element?.name || element?.id,
  });
}

function boundedElementText(element, maxChars = 4000) {
  if (!element) return '';
  if (typeof element.value === 'string' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(element.tagName || '').toUpperCase())) {
    return cleanPageText(element.value, maxChars);
  }
  const doc = element.ownerDocument || globalThis.document;
  const nodeFilter = doc?.defaultView?.NodeFilter || globalThis.NodeFilter;
  const collector = createBoundedTextCollector(maxChars);
  if (!doc?.createTreeWalker || !nodeFilter) return cleanPageText(element.textContent || '', maxChars);
  const walker = doc.createTreeWalker(element, nodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && !collector.full) {
    const parent = node.parentElement;
    if (parent && !parent.closest?.('[hidden],[aria-hidden="true"]')) collector.push(node.nodeValue);
    node = walker.nextNode();
  }
  return collector.value();
}

function ensureElement(element) {
  if (!element) throw new Error('Element reference is stale or unavailable.');
  if (element.isConnected === false) throw new Error('Element is no longer connected to the page.');
  if (element.disabled === true) throw new Error('Element is disabled.');
  return element;
}

function elementWindow(element, fallbackWindow) {
  return element?.ownerDocument?.defaultView || fallbackWindow || globalThis.window;
}

function dispatch(element, type, windowObject) {
  if (typeof element?.dispatchEvent !== 'function') return;
  const view = elementWindow(element, windowObject);
  const EventCtor = view?.Event || globalThis.Event;
  if (!EventCtor) return;
  element.dispatchEvent(new EventCtor(type, { bubbles: true, composed: true }));
}

function deepestActiveElement(documentObject, maxDepth = 3) {
  let active = documentObject?.activeElement || documentObject?.body || null;
  for (let depth = 0; depth < maxDepth && active; depth += 1) {
    const tag = String(active.tagName || '').toLowerCase();
    if (!['iframe', 'frame'].includes(tag)) break;
    let childActive = null;
    try { childActive = active.contentDocument?.activeElement || active.contentDocument?.body || null; } catch {}
    if (!childActive || childActive === active) break;
    active = childActive;
  }
  return active;
}

function setValue(element, value, windowObject) {
  // Native value setters may live above the immediate prototype (or below an
  // application wrapper). Use the first inherited setter, without invoking getters.
  let prototype = Object.getPrototypeOf(element);
  let setter = null;
  for (let depth = 0; prototype && depth < 12; depth += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) { setter = descriptor.set; break; }
    prototype = Object.getPrototypeOf(prototype);
  }
  if (setter) setter.call(element, value);
  else element.value = value;
  dispatch(element, 'input', windowObject);
  dispatch(element, 'change', windowObject);
}

export function createDomActionAdapter({ registry, snapshotId, windowObject = globalThis.window, documentObject = globalThis.document }) {
  if (!registry) throw new Error('Ref registry is required.');
  const resolve = (ref) => ensureElement(registry.resolve(ref, snapshotId));
  const textOf = (element) => boundedElementText(element, 4000);

  return {
    hasRef: (ref) => registry.has(ref, snapshotId),
    async read(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sensitive field content is not readable.' };
      return { ok: true, ref: action.ref, text: textOf(element) };
    },
    async click(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sensitive fields cannot be clicked by the agent.' };
      element.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'auto' });
      element.focus?.({ preventScroll: true });
      if (typeof element.click !== 'function') return { ok: false, code: 'NOT_CLICKABLE', error: 'Target does not support click.' };
      element.click();
      return { ok: true, ref: action.ref };
    },
    async type(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sightline will not type into sensitive credential/payment fields autonomously.' };
      element.focus?.({ preventScroll: true });
      const current = String(element.value ?? '');
      setValue(element, action.replace ? action.text : current + action.text, windowObject);
      return { ok: true, ref: action.ref, length: String(element.value ?? '').length };
    },
    async clear(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sightline will not manipulate sensitive fields autonomously.' };
      setValue(element, '', windowObject);
      return { ok: true, ref: action.ref };
    },
    async select(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sensitive fields cannot be manipulated by the agent.' };
      if (String(element.tagName || '').toUpperCase() !== 'SELECT') return { ok: false, code: 'NOT_SELECTABLE', error: 'Target is not a select element.' };
      const options = Array.from(element.options || []);
      if (options.length && !options.some(option => String(option.value) === action.value)) {
        return { ok: false, code: 'OPTION_NOT_FOUND', error: 'Requested option is unavailable.' };
      }
      setValue(element, action.value, windowObject);
      return { ok: true, ref: action.ref, value: String(element.value ?? '') };
    },
    async check(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sensitive fields cannot be manipulated by the agent.' };
      if (!('checked' in element)) return { ok: false, code: 'NOT_CHECKABLE', error: 'Target is not checkable.' };
      if (!element.checked) element.click?.();
      return { ok: Boolean(element.checked), ref: action.ref, checked: Boolean(element.checked) };
    },
    async uncheck(action) {
      const element = resolve(action.ref);
      if (sensitiveElement(element)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sensitive fields cannot be manipulated by the agent.' };
      if (!('checked' in element)) return { ok: false, code: 'NOT_CHECKABLE', error: 'Target is not checkable.' };
      if (element.checked) element.click?.();
      return { ok: !element.checked, ref: action.ref, checked: Boolean(element.checked) };
    },
    async scroll(action) {
      const sign = ['up','left'].includes(action.direction) ? -1 : 1;
      const x = ['left','right'].includes(action.direction) ? sign * action.amount : 0;
      const y = ['up','down'].includes(action.direction) ? sign * action.amount : 0;
      windowObject?.scrollBy?.({ left: x, top: y, behavior: 'auto' });
      return { ok: true, x, y };
    },
    async navigate(action) {
      if (!windowObject?.location?.assign) return { ok: false, code: 'NAVIGATION_UNAVAILABLE', error: 'Navigation API unavailable.' };
      windowObject.location.assign(action.url);
      return { ok: true, url: action.url };
    },
    async pressKey(action) {
      const target = deepestActiveElement(documentObject);
      if (sensitiveElement(target)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Keyboard events cannot target sensitive fields.' };
      const targetWindow = elementWindow(target, windowObject);
      const KeyboardCtor = targetWindow?.KeyboardEvent || globalThis.KeyboardEvent;
      if (!target?.dispatchEvent || !KeyboardCtor) return { ok: false, code: 'KEYBOARD_UNAVAILABLE', error: 'Keyboard dispatch unavailable.' };
      target.dispatchEvent(new KeyboardCtor('keydown', { key: action.key, bubbles: true, composed: true }));
      target.dispatchEvent(new KeyboardCtor('keyup', { key: action.key, bubbles: true, composed: true }));
      return { ok: true, key: action.key };
    },
    async wait(action, { signal } = {}) {
      if (signal?.aborted) return { ok: false, code: 'ABORTED' };
      await new Promise((resolveWait, reject) => {
        const timer = setTimeout(resolveWait, action.ms);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      });
      return { ok: true, waitedMs: action.ms };
    },
    async verify(action) {
      const target = action.ref ? resolve(action.ref) : null;
      if (target && sensitiveElement(target)) return { ok: false, code: 'SENSITIVE_FIELD', error: 'Sensitive fields cannot be verified by content matching.' };
      const haystack = target ? textOf(target) : boundedElementText(documentObject?.body, 12000);
      const ok = haystack.toLowerCase().includes(action.expect.toLowerCase());
      return { ok, ref: action.ref, matched: ok, expectation: action.expect };
    },
  };
}
