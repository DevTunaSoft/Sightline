const ACTION_TYPES = new Set([
  'read', 'click', 'type', 'clear', 'select', 'check', 'uncheck',
  'scroll', 'navigate', 'pressKey', 'wait', 'verify',
]);
const REF_PATTERN = /^@e[1-9]\d{0,4}$/;
const MAX_TEXT = 4000;
const MAX_WAIT_MS = 15000;
const SAFE_KEYS = new Set(['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete']);

function fail(reason) { return { ok: false, reason }; }
function pass(action) { return { ok: true, action: Object.freeze(action) }; }
function validRef(ref) { return typeof ref === 'string' && REF_PATTERN.test(ref); }
function boundedText(value, max = MAX_TEXT) { return typeof value === 'string' && value.length <= max; }

export function validateAction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Action must be an object.');
  const action = String(input.action || '');
  if (!ACTION_TYPES.has(action)) return fail('Unsupported action type.');

  const base = { action };
  if (['read','click','clear','check','uncheck'].includes(action)) {
    if (!validRef(input.ref)) return fail('A valid element ref is required.');
    return pass({ ...base, ref: input.ref });
  }
  if (action === 'type') {
    if (!validRef(input.ref) || !boundedText(input.text)) return fail('Type requires a valid ref and bounded text.');
    return pass({ ...base, ref: input.ref, text: input.text, replace: input.replace !== false });
  }
  if (action === 'select') {
    if (!validRef(input.ref) || !boundedText(input.value, 1000)) return fail('Select requires a valid ref and value.');
    return pass({ ...base, ref: input.ref, value: input.value });
  }
  if (action === 'scroll') {
    const direction = String(input.direction || 'down');
    if (!['up','down','left','right'].includes(direction)) return fail('Invalid scroll direction.');
    const amount = Number(input.amount ?? 600);
    if (!Number.isFinite(amount) || amount < 1 || amount > 5000) return fail('Invalid scroll amount.');
    return pass({ ...base, direction, amount: Math.round(amount) });
  }
  if (action === 'navigate') {
    try {
      const url = new URL(String(input.url || ''));
      if (!['http:','https:'].includes(url.protocol)) return fail('Only HTTP(S) navigation is allowed.');
      return pass({ ...base, url: url.href });
    } catch { return fail('Invalid navigation URL.'); }
  }
  if (action === 'pressKey') {
    if (!SAFE_KEYS.has(input.key)) return fail('Key is not allowed.');
    return pass({ ...base, key: input.key });
  }
  if (action === 'wait') {
    const ms = Number(input.ms ?? 500);
    if (!Number.isFinite(ms) || ms < 0 || ms > MAX_WAIT_MS) return fail('Invalid wait duration.');
    return pass({ ...base, ms: Math.round(ms) });
  }
  if (action === 'verify') {
    if (!boundedText(input.expect, 1000)) return fail('Verify requires bounded expectation text.');
    return pass({ ...base, expect: input.expect, ref: input.ref && validRef(input.ref) ? input.ref : undefined });
  }
  return fail('Action validation fell through.');
}

export const ACTION_PROTOCOL_LIMITS = Object.freeze({ maxText: MAX_TEXT, maxWaitMs: MAX_WAIT_MS });
