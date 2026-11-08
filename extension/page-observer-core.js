export const PAGE_OBSERVER_LIMITS = Object.freeze({ maxElements: 300, maxTextPerElement: 240, maxSnapshotChars: 48000 });
export function cleanPageText(value, maxLength = PAGE_OBSERVER_LIMITS.maxTextPerElement) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength); }
export function inferElementRole(tagName, explicitRole = '', inputType = '') {
  if (explicitRole) return explicitRole;
  const tag = String(tagName).toLowerCase(); const type = String(inputType).toLowerCase();
  if (tag === 'a') return 'link'; if (tag === 'button') return 'button'; if (tag === 'select') return 'combobox'; if (tag === 'textarea') return 'textbox';
  if (tag === 'input') { if (type === 'checkbox') return 'checkbox'; if (type === 'radio') return 'radio'; if (['button','submit','reset'].includes(type)) return 'button'; return 'textbox'; }
  return 'generic';
}
export function isSensitiveField(inputType = '') { return String(inputType).toLowerCase() === 'password'; }
export function boundSnapshot(snapshot, maxChars = PAGE_OBSERVER_LIMITS.maxSnapshotChars) {
  const bounded = { ...snapshot, elements: [...(snapshot.elements || [])] }; let serialized = JSON.stringify(bounded);
  while (bounded.elements.length && serialized.length > maxChars) { bounded.elements.pop(); bounded.truncated = true; serialized = JSON.stringify(bounded); }
  return bounded;
}
