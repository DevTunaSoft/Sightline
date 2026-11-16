import { fnv1aHash } from './page-observer-core.js';

const HIGH_IMPACT_PATTERN = /\b(delete|remove|trash|erase|send|submit|publish|post|purchase|buy|pay|checkout|place order|confirm order|close account|security|permission|authorize|transfer|unsubscribe|logout|log out|sign out|block sender|report spam|mark as spam|discard|deactivate|disable|revoke|reset|overwrite|cancel subscription|clear all|archive all|reject all)\b/i;
const CRITICAL_DESTRUCTIVE_PATTERN = /\b(empty\s+trash|delete\s+forever|permanent(?:ly)?\s+delete|purge|erase\s+forever)\b/i;
const EXPLICIT_CRITICAL_INTENT = /\b(empty|clear|purge)\b.{0,30}\btrash\b|\b(delete|erase)\b.{0,20}\b(permanently|forever)\b|\bpermanent(?:ly)?\s+delete\b/i;

function crossOriginLinkActivation(action, target, currentUrl) {
  if (action?.action !== 'click' || target?.role !== 'link' || !target?.state?.hrefOrigin || !currentUrl) return false;
  try { return new URL(target.state.hrefOrigin).origin !== new URL(currentUrl).origin; }
  catch { return true; }
}

function consequentialNavigation(action) {
  if (action?.action !== 'navigate') return false;
  try {
    const url = new URL(action.url);
    const path = decodeURIComponent(url.pathname).toLowerCase();
    if (/(^|\/)(delete|destroy|remove|purge|unsubscribe|checkout|purchase|pay|logout|close-account)(\/|$)/i.test(path)) return true;
    for (const [key, value] of url.searchParams) {
      const pair = `${key}=${value}`.toLowerCase();
      if (/\b(action|do|operation|confirm)=?(delete|destroy|remove|purge|unsubscribe|purchase|pay|close)/i.test(pair)) return true;
    }
    return false;
  } catch { return true; }
}

function crossOriginNavigation(action, currentUrl) {
  if (action?.action !== 'navigate' || !currentUrl) return false;
  try { return new URL(action.url).origin !== new URL(currentUrl).origin; }
  catch { return true; }
}

export function hasExplicitCriticalIntent(goal) {
  return EXPLICIT_CRITICAL_INTENT.test(String(goal || ''));
}

export function classifyActionRisk(action, target = {}, context = {}) {
  if (!action || typeof action !== 'object') return { level: 'blocked', reason: 'Invalid action.' };
  if (target?.sensitive && ['read','type','clear','verify','select','check','uncheck','click'].includes(action.action)) {
    return { level: 'blocked', reason: 'Sensitive fields cannot be read or manipulated by autonomous browser control.' };
  }
  if (action.action === 'pressKey') {
    if (target?.sensitive) return { level: 'blocked', reason: 'Keyboard events cannot target sensitive fields.' };
    if (['Delete', 'Backspace', 'Enter'].includes(action.key)) return { level: 'high', reason: 'Key may trigger a destructive or consequential page handler.' };
  }
  const label = `${target?.name || ''} ${target?.role || ''}`.trim();
  if (action.action === 'click' && CRITICAL_DESTRUCTIVE_PATTERN.test(label)) {
    if (!hasExplicitCriticalIntent(context.taskGoal)) {
      return { level: 'blocked', reason: 'Permanent deletion was not explicitly requested in the original task.' };
    }
    return { level: 'critical', reason: 'Target appears to permanently delete data and cannot be easily reversed.' };
  }
  if (action.action === 'click' && HIGH_IMPACT_PATTERN.test(label)) {
    return { level: 'high', reason: 'Target appears to perform a consequential action.' };
  }
  if (consequentialNavigation(action)) {
    return { level: 'high', reason: 'Navigation target appears to represent a consequential or destructive endpoint.' };
  }
  if (crossOriginNavigation(action, context.currentUrl) || crossOriginLinkActivation(action, target, context.currentUrl)) {
    return { level: 'high', reason: 'Navigation leaves the current website origin.' };
  }
  if (action.action === 'navigate') return { level: 'normal', reason: 'Navigation stays on the current website origin.' };
  return { level: 'normal', reason: 'No high-impact signal detected.' };
}

// Legacy deterministic action fingerprint for diagnostics and compatibility.
// NOT an authorization credential. The page agent issues cryptographically
// random, single-use tokens and validates exact action bindings separately.
export function actionConfirmationKey(snapshotId, action, target = {}, context = {}) {
  const stable = {
    snapshotId: String(snapshotId || ''),
    action: action || null,
    target: { ref: target?.ref || null, role: target?.role || null, name: target?.name || null },
    taskGoal: String(context.taskGoal || '').trim().slice(0, 2000),
  };
  return `confirm-${fnv1aHash(JSON.stringify(stable))}`;
}

export function gateAction(action, target, mode = 'assist', context = {}) {
  const risk = classifyActionRisk(action, target, context);
  if (risk.level === 'blocked') return { allowed: false, confirmationRequired: false, risk };
  if (risk.level === 'high' || risk.level === 'critical') {
    return { allowed: false, confirmationRequired: mode !== 'observe', risk };
  }
  if (mode === 'observe') return { allowed: false, confirmationRequired: false, risk: { level: 'observe-only', reason: 'Observe mode does not mutate pages.' } };
  return { allowed: true, confirmationRequired: false, risk };
}
