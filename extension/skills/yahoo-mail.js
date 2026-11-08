function isYahooMailHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'mail.yahoo.com' || host.endsWith('.mail.yahoo.com');
}

export const yahooMailSkill = Object.freeze({
  id: 'yahoo-mail',
  name: 'Yahoo Mail',
  version: 1,
  domain: 'mail.yahoo.com',
  matches(url) {
    return Boolean(url && ['http:', 'https:'].includes(url.protocol) && isYahooMailHost(url.hostname));
  },
  guidance: Object.freeze([
    'Use the existing signed-in browser session. Never request, read, store, or type the Yahoo password.',
    'Prefer Yahoo search controls for inbox filtering instead of manually scanning message rows.',
    'When the user asks to delete messages, first search/filter, then identify the result scope, then present or obtain a count/sample when available.',
    'Moving messages to Trash is destructive/high-impact and must pass Sightline confirmation before the final Trash/Delete control is activated.',
    'After a move-to-Trash action, verify the page changed and that the requested messages are no longer in the previous result state when possible.',
    'Do not empty Trash automatically unless the user explicitly asks; emptying Trash is more irreversible than moving mail to Trash.',
    'If login, MFA, CAPTCHA, account recovery, or security challenge is shown, stop and hand control to the user.',
  ]),
  destructiveLabels: Object.freeze(['Delete', 'Trash', 'Move to Trash', 'Empty Trash', 'Delete forever']),
  detectBlocker(snapshot) {
    const text = String(snapshot?.visibleText || '').toLowerCase();
    const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : [];
    const hasSensitive = elements.some(element => element?.sensitive === true);
    if (/captcha|prove you(?:'|’)re not a robot|verify you(?:'|’)re human/.test(text)) {
      return { code: 'CAPTCHA_REQUIRED', reason: 'Yahoo is requesting a human verification challenge.' };
    }
    if (/account recovery|recover your account|security challenge|unusual activity/.test(text)) {
      return { code: 'ACCOUNT_CHALLENGE', reason: 'Yahoo is requesting an account/security recovery step.' };
    }
    if (/verification code|two-step verification|two factor|2-step|one-time code/.test(text)) {
      return { code: 'MFA_REQUIRED', reason: 'Yahoo is requesting multi-factor authentication.' };
    }
    if (hasSensitive && /sign in|login|enter your password|password/.test(text)) {
      return { code: 'LOGIN_REQUIRED', reason: 'Yahoo requires the user to sign in manually.' };
    }
    return null;
  },
});

export function buildYahooSearchIntent({ sender = '', terms = '', olderThan = '', newerThan = '' } = {}) {
  const parts = [];
  const clean = value => String(value || '').replace(/[
	]+/g, ' ').trim().slice(0, 200);
  const from = clean(sender);
  if (from) parts.push(`from:${from}`);
  const text = clean(terms);
  if (text) parts.push(text);
  const older = clean(olderThan);
  if (older) parts.push(`before:${older}`);
  const newer = clean(newerThan);
  if (newer) parts.push(`after:${newer}`);
  return parts.join(' ').slice(0, 600);
}
