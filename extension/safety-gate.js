const HIGH_IMPACT_PATTERN = /\b(delete|remove|trash|erase|send|submit|publish|post|purchase|buy|pay|checkout|place order|confirm order|close account|security|permission|authorize|transfer|unsubscribe)\b/i;

export function classifyActionRisk(action, target = {}) {
  if (!action || typeof action !== 'object') return { level: 'blocked', reason: 'Invalid action.' };
  if (target?.sensitive && ['read','type','clear'].includes(action.action)) {
    return { level: 'blocked', reason: 'Sensitive fields cannot be read or manipulated by autonomous browser control.' };
  }
  const label = `${target?.name || ''} ${target?.role || ''}`.trim();
  if (action.action === 'click' && HIGH_IMPACT_PATTERN.test(label)) {
    return { level: 'high', reason: 'Target appears to perform a consequential action.' };
  }
  if (action.action === 'navigate') return { level: 'normal', reason: 'Navigation is reversible.' };
  return { level: 'normal', reason: 'No high-impact signal detected.' };
}

export function gateAction(action, target, mode = 'assist') {
  const risk = classifyActionRisk(action, target);
  if (risk.level === 'blocked') return { allowed: false, confirmationRequired: false, risk };
  if (risk.level === 'high') {
    return { allowed: false, confirmationRequired: mode !== 'observe', risk };
  }
  if (mode === 'observe') return { allowed: false, confirmationRequired: false, risk: { level: 'observe-only', reason: 'Observe mode does not mutate pages.' } };
  return { allowed: true, confirmationRequired: false, risk };
}
