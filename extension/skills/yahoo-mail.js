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
  analyzeSnapshot(snapshot) {
    const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : [];
    const text = String(snapshot?.visibleText || '');
    const named = (pattern, roles = null) => elements.filter(element => {
      if (roles && !roles.includes(element?.role)) return false;
      return pattern.test(String(element?.name || ''));
    });
    const firstRef = list => list.find(element => element?.ref)?.ref || null;
    const search = named(/\b(search|find)\b.*\b(mail|messages?)\b|\bsearch\b/i, ['textbox', 'combobox']);
    const selectAll = named(/select\s+all|all\s+(?:messages?|mail)/i, ['checkbox', 'button', 'menuitem']);
    const trash = named(/move.*trash|\btrash\b|\bdelete\b/i, ['button', 'menuitem', 'link']);
    const countPatterns = [
      /\b(\d{1,7})\s+(?:search\s+)?results?\b/i,
      /\b(\d{1,7})\s+(?:messages?|emails?)\b/i,
      /\b(?:showing|of)\s+(\d{1,7})\b/i,
    ];
    let visibleCount = null;
    for (const pattern of countPatterns) {
      const match = text.match(pattern);
      if (match) { visibleCount = Number(match[1]); break; }
    }
    const excluded = /inbox|sent|draft|spam|trash|archive|settings|contacts|calendar|compose|search|select all|delete|move/i;
    const messageSamples = [];
    const seen = new Set();
    for (const element of elements) {
      const name = String(element?.name || '').trim();
      if (!element?.ref || element?.sensitive || name.length < 8 || name.length > 240) continue;
      if (!['link', 'checkbox', 'button', 'menuitem'].includes(element.role)) continue;
      if (excluded.test(name) || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      messageSamples.push({ ref: element.ref, role: element.role, name: name.slice(0, 180) });
      if (messageSamples.length >= 5) break;
    }
    return {
      searchRef: firstRef(search),
      selectAllRef: firstRef(selectAll),
      trashRefs: trash.slice(0, 5).map(element => element.ref).filter(Boolean),
      visibleCount: Number.isFinite(visibleCount) ? visibleCount : null,
      messageSamples,
    };
  },
  verifyActionEffect({ action, target, before, after } = {}) {
    const label = String(target?.name || '').trim();
    if (action?.action !== 'click' || !/move.*trash|\btrash\b|\bdelete\b/i.test(label)) {
      return { applicable: false, verified: null, evidence: [] };
    }
    const beforeHints = this.analyzeSnapshot(before || {});
    const afterHints = this.analyzeSnapshot(after || {});
    const evidence = [];
    let verified = null;

    if (Number.isFinite(beforeHints.visibleCount) && Number.isFinite(afterHints.visibleCount)) {
      if (afterHints.visibleCount < beforeHints.visibleCount) {
        verified = true;
        evidence.push(`visible result count decreased from ${beforeHints.visibleCount} to ${afterHints.visibleCount}`);
      } else if (afterHints.visibleCount === beforeHints.visibleCount) {
        evidence.push(`visible result count remained ${afterHints.visibleCount}`);
      }
    }

    const afterText = String(after?.visibleText || '');
    if (/moved?.{0,40}trash|sent to trash|moved selected|conversation(?:s)? moved/i.test(afterText)) {
      verified = true;
      evidence.push('Yahoo displayed a move-to-Trash success signal');
    }

    const beforeNames = new Set(beforeHints.messageSamples.map(item => item.name.toLowerCase()));
    const afterNames = new Set(afterHints.messageSamples.map(item => item.name.toLowerCase()));
    const removedSamples = [...beforeNames].filter(name => !afterNames.has(name));
    if (removedSamples.length > 0) {
      if (verified !== true) verified = true;
      evidence.push(`${removedSamples.length} sampled message(s) disappeared from the result view`);
    }

    return { applicable: true, verified, evidence: evidence.slice(0, 5), before: beforeHints, after: afterHints };
  },
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
  const clean = value => String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200);
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
