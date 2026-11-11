export const PAGE_OBSERVER_LIMITS = Object.freeze({
  maxElements: 300,
  maxTextPerElement: 240,
  maxSnapshotChars: 48000,
  maxVisibleTextChars: 8000,
  maxDomNodesVisited: 12000,
  maxTextNodesVisited: 6000,
  maxTextCharsInspected: 65536,
  maxFrameNodesVisited: 6000,
});

// Caller overrides may reduce work, never expand the hard RAM/CPU ceilings.
export function normalizeObservationLimits(overrides = {}) {
  const limits = {};
  for (const [key, maximum] of Object.entries(PAGE_OBSERVER_LIMITS)) {
    const requested = Number(overrides?.[key]);
    limits[key] = Number.isFinite(requested) && requested > 0
      ? Math.max(1, Math.min(maximum, Math.floor(requested)))
      : maximum;
  }
  return limits;
}

export function incompleteFrameInventory(inventory) {
  return Boolean(inventory?.truncated || inventory?.skippedDepth > 0);
}

// Prevent a single giant DOM text node or accessible name from allocating a
// second giant normalized string. The output and inspected input are both
// bounded; exhausted input budget is reported as incomplete to the collector.
const MAX_TEXT_INPUT_SCAN = 32768;
const WHITESPACE = /\s/;

function normalizeTextPrefix(value, requestedChars, scanBudget = MAX_TEXT_INPUT_SCAN) {
  const source = String(value ?? '');
  const limit = Math.max(0, Math.min(PAGE_OBSERVER_LIMITS.maxVisibleTextChars,
    Math.floor(Number(requestedChars) || 0)));
  const maxScan = Math.max(0, Math.min(MAX_TEXT_INPUT_SCAN,
    Math.floor(Number(scanBudget) || 0)));
  if (source.length <= Math.min(limit, 1024, maxScan))
    return { text: source.replace(/\s+/g, ' ').trim(),
      complete: true, scanned: source.length };

  let text = '';
  let pendingSpace = false;
  let sawNonWhitespace = false;
  const scanned = Math.min(source.length, maxScan);
  for (let i = 0; i < scanned; i += 1) {
    const char = source[i];
    if (WHITESPACE.test(char)) {
      if (text) pendingSpace = true;
      continue;
    }
    sawNonWhitespace = true;
    if (pendingSpace) {
      if (text.length >= limit) return { text, complete: false, scanned: i + 1, sawNonWhitespace };
      text += ' ';
      pendingSpace = false;
    }
    if (text.length >= limit) return { text, complete: false, scanned: i + 1, sawNonWhitespace };
    text += char;
  }
  return { text, complete: scanned === source.length, scanned, sawNonWhitespace };
}

export function cleanPageText(value, maxLength = PAGE_OBSERVER_LIMITS.maxTextPerElement) {
  return normalizeTextPrefix(value, maxLength).text;
}

export function createBoundedTextCollector(
  maxChars = PAGE_OBSERVER_LIMITS.maxVisibleTextChars,
  maxInspectedChars = PAGE_OBSERVER_LIMITS.maxTextCharsInspected) {
  const requested = Number(maxChars);
  const limit = Number.isFinite(requested)
    ? Math.max(0, Math.min(PAGE_OBSERVER_LIMITS.maxVisibleTextChars, Math.floor(requested)))
    : PAGE_OBSERVER_LIMITS.maxVisibleTextChars;
  const requestedScan = Number(maxInspectedChars);
  const scanLimit = Number.isFinite(requestedScan)
    ? Math.max(0, Math.min(PAGE_OBSERVER_LIMITS.maxTextCharsInspected,
      Math.floor(requestedScan)))
    : PAGE_OBSERVER_LIMITS.maxTextCharsInspected;
  let remainingScan = scanLimit;
  let text = '';
  return {
    push(value) {
      if (text.length >= limit || remainingScan === 0) return false;
      const remaining = limit - text.length;
      const { text: chunk, complete, scanned, sawNonWhitespace } = normalizeTextPrefix(value,
        remaining - (text ? 1 : 0), remainingScan);
      remainingScan -= scanned;
      if (chunk) text += (text ? ' ' : '') + chunk;
      else if (text && !complete && sawNonWhitespace) text += ' ';
      return complete && remainingScan > 0 && text.length < limit;
    },
    value() { return text; },
    get full() { return text.length >= limit; },
    get exhausted() { return remainingScan === 0; },
    get scannedChars() {
      return scanLimit - remainingScan;
    },
    get length() { return text.length; },
  };
}

export function safeOrigin(value, base = '') {
  try { return new URL(String(value || ''), base || undefined).origin; }
  catch { return null; }
}

export function mayUseValueAsAccessibleName(tagName, role, inputType = '') {
  const tag = String(tagName || '').toLowerCase();
  const semanticRole = String(role || '').toLowerCase();
  const type = String(inputType || '').toLowerCase();
  return tag === 'input' && semanticRole === 'button' && ['button', 'submit', 'reset'].includes(type);
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
const SENSITIVE_NAME_PATTERN = /(?:^|\s)(?:password|passwd|passcode|passphrase|pin|otp|one time code|cvv|cvc|security code|card number|credit card|token|secret)(?:\s|$)/;

function normalizedFieldName(value) {
  return String(value || '').slice(0, 256)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_\-./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isTextEntryField(input, type = String(input?.type || '').toLowerCase()) {
  const tag = String(input?.tagName || '').toLowerCase();
  const role = String(input?.role || '').toLowerCase();
  return input?.isContentEditable === true || tag === 'textarea' ||
    (tag === 'input' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'hidden'].includes(type)) ||
    ['textbox', 'searchbox'].includes(role);
}

/**
 * Check existing, externally associated DOM labels for credential hints.
 * Never enumerate an unbounded labels collection or process whole long texts.
 * Used at action time, independently of the cached page snapshot.
 */
export function hasSensitiveAssociatedLabel(element) {
  const meta = {
    type: element?.getAttribute?.('type') || element?.type,
    tagName: element?.tagName,
    role: element?.getAttribute?.('role'),
    isContentEditable: element?.isContentEditable === true,
  };
  if (!isTextEntryField(meta)) return false;
  const isSecret = text => isSensitiveField({ ...meta, ariaLabel: text });

  const ids = String(element?.getAttribute?.('aria-labelledby') || '');
  if (ids.length > 2048) return true;
  if (ids) {
    let count = 0;
    for (const match of ids.matchAll(/\S+/g)) {
      if (++count > 16) return true;
      const label = element?.ownerDocument?.getElementById?.(match[0]);
      if (label && isSecret(label.textContent || '')) return true;
    }
  }
  const labels = element?.labels;
  if (labels?.length > 16) return true;
  const count = Math.max(0, Math.min(16, Number(labels?.length) || 0));
  for (let index = 0; index < count; index += 1) {
    if (labels[index] && isSecret(labels[index].textContent || '')) return true;
  }
  return false;
}

// Inspect a fixed set of bounded metadata fields. Names, IDs and accessible
// hints are independent: an innocent "name" must never hide a credential ID.
// HTML autocomplete can include tokens such as "section-login current-password".
export function isSensitiveField(input = '') {
  if (typeof input === 'string') return input.toLowerCase() === 'password';
  const type = String(input?.type || '').toLowerCase();
  if (type === 'password') return true;

  const autocomplete = String(input?.autocomplete || '');
  if (autocomplete.length > 256) return true; // Uninspectable metadata fails closed.
  for (const token of autocomplete.toLowerCase().trim().split(/\s+/)) {
    if (SENSITIVE_AUTOCOMPLETE.has(token)) return true;
  }

  const name = String(input?.name || '');
  const id = String(input?.id || '');
  // A secret suffix beyond the inspection prefix must not evade detection.
  if (name.length > 256 || id.length > 256 ||
      SENSITIVE_NAME_PATTERN.test(normalizedFieldName(name)) ||
      SENSITIVE_NAME_PATTERN.test(normalizedFieldName(id))) return true;

  if (!isTextEntryField(input, type)) return false;
  const ariaLabel = String(input?.ariaLabel || '');
  const placeholder = String(input?.placeholder || '');
  return ariaLabel.length > 256 || placeholder.length > 256 ||
    SENSITIVE_NAME_PATTERN.test(normalizedFieldName(ariaLabel)) ||
    SENSITIVE_NAME_PATTERN.test(normalizedFieldName(placeholder));
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

/**
 * Conservative structural evidence, not application-specific proof of success.
 * Ignore volatile page text, snapshot hashes and unrelated control changes.
 * Unavailable or truncated observations are inconclusive.
 */
export function hasTargetStructuralEffect(before, after, action) {
  if (!before || !after || before.truncated || after.truncated) return false;
  if (action?.action === 'navigate') {
    return typeof action.url === 'string' &&
      before.url !== after.url && after.url === action.url;
  }
  if (!action?.ref || !Array.isArray(before.elements) || !Array.isArray(after.elements))
    return false;
  const original = before.elements.find(element => element.ref === action.ref);
  if (!original || !original.role || !original.name || original.sensitive) return false;
  const matches = element => element?.role === original.role &&
    element?.name === original.name && (element?.frame?.path || '') === (original.frame?.path || '');
  if (before.elements.filter(matches).length !== 1) return false;
  const current = after.elements.filter(matches);
  if (current.length === 0) return action.action === 'click';
  if (current.length !== 1) return false;
  // Only observable control state counts. A clock, alert, or unrelated control
  // must not turn a failed consequential action into a verified one.
  const prevState = original.state || {};
  const nextState = current[0].state || {};
  for (const field of ['checked', 'expanded', 'selectedIndex', 'valueLength']) {
    if (Object.hasOwn(prevState, field) &&
        Object.hasOwn(nextState, field) && prevState[field] !== nextState[field])
      return true;
  }
  return false;
}
