export const PAGE_OBSERVER_LIMITS = Object.freeze({
  maxElements: 300,
  maxTextPerElement: 240,
  maxSnapshotChars: 48000,
  maxVisibleTextChars: 8000,
});

export function cleanPageText(value, maxLength = PAGE_OBSERVER_LIMITS.maxTextPerElement) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function inferElementRole(tagName, explicitRole = '', inputType = '') {
  if (explicitRole) return cleanPageText(explicitRole, 64).toLowerCase();
  const tag = String(tagName).toLowerCase();
  const type = String(inputType).toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (['button', 'submit', 'reset'].includes(type)) return 'button';
    return 'textbox';
  }
  return 'generic';
}

const SENSITIVE_AUTOCOMPLETE = new Set([
  'current-password', 'new-password', 'one-time-code',
  'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year',
]);
const SENSITIVE_NAME_PATTERN = /(pass(word)?|passwd|pin|otp|one.?time|cvv|cvc|security.?code|card.?number|credit.?card|token|secret)/i;

export function isSensitiveField(input = '') {
  if (typeof input === 'string') return input.toLowerCase() === 'password';
  const type = String(input?.type || '').toLowerCase();
  const autocomplete = String(input?.autocomplete || '').toLowerCase();
  const name = String(input?.name || '');
  return type === 'password' || SENSITIVE_AUTOCOMPLETE.has(autocomplete) || SENSITIVE_NAME_PATTERN.test(name);
}

export function fnv1aHash(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function snapshotIdentity(snapshot) {
  const stable = {
    url: snapshot?.url || '',
    title: snapshot?.title || '',
    visibleText: snapshot?.visibleText || '',
    elements: (snapshot?.elements || []).map(({ ref: _ref, rect: _rect, ...element }) => element),
  };
  return `s1-${fnv1aHash(JSON.stringify(stable))}`;
}

function finalizeCandidate(base, elements, visibleText, truncated) {
  const candidate = { ...base, elements, visibleText, truncated };
  candidate.snapshotId = snapshotIdentity(candidate);
  return candidate;
}

function serializedLength(value) {
  return JSON.stringify(value).length;
}

export function boundSnapshot(snapshot, maxChars = PAGE_OBSERVER_LIMITS.maxSnapshotChars) {
  const allElements = [...(snapshot.elements || [])];
  const originalText = String(snapshot.visibleText || '');
  const base = { ...snapshot };
  delete base.elements;
  delete base.visibleText;
  delete base.snapshotId;

  let visibleText = originalText;
  let empty = finalizeCandidate(base, [], visibleText, Boolean(snapshot.truncated || allElements.length));

  if (serializedLength(empty) > maxChars && visibleText) {
    let low = 0;
    let high = visibleText.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = finalizeCandidate(base, [], visibleText.slice(0, mid), true);
      if (serializedLength(candidate) <= maxChars) low = mid;
      else high = mid - 1;
    }
    visibleText = visibleText.slice(0, low);
    empty = finalizeCandidate(base, [], visibleText, true);
  }

  if (!allElements.length || serializedLength(finalizeCandidate(base, allElements, visibleText, Boolean(snapshot.truncated))) <= maxChars) {
    return finalizeCandidate(base, allElements, visibleText, Boolean(snapshot.truncated));
  }

  let low = 0;
  let high = allElements.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = finalizeCandidate(base, allElements.slice(0, mid), visibleText, true);
    if (serializedLength(candidate) <= maxChars) low = mid;
    else high = mid - 1;
  }

  return finalizeCandidate(base, allElements.slice(0, low), visibleText, true);
}
