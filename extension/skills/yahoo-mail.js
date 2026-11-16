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
    'Prefer visible Yahoo advanced-search/filter controls for sender, subject, folder, and date constraints. Do not invent Yahoo search operator syntax that is not represented by the current page or an approved skill rule.',
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
    const advancedSearch = named(/advanced\s+search|search\s+(?:options|filters?)|filter\s+search/i, ['button', 'menuitem', 'link']);
    const fromField = named(/^(?:from|sender)(?:\s+address)?$/i, ['textbox', 'combobox']);
    const subjectField = named(/^subject(?:\s+contains)?$/i, ['textbox', 'combobox']);
    const dateControls = named(/\b(date|before|after|older|newer|since)\b/i, ['textbox', 'combobox', 'button', 'menuitem']);
    const selectAll = named(/select\s+all|all\s+(?:messages?|mail)/i, ['checkbox', 'button', 'menuitem']);
    const trash = named(/move.*trash|\btrash\b|\bdelete\b/i, ['button', 'menuitem', 'link']);
    // A page range is not a total. Prefer explicit "Showing 1-50 of 300".
    // Do not manufacture a count if the page's scope is ambiguous.
    const totalMatch = text.match(/\bshowing\s+\d{1,7}\s*[-–]\s*\d{1,7}\s+of\s+(\d{1,7})\b/i);
    const resultMatch = text.match(/\b(\d{1,7})\s+(?:search\s+)?results?\b/i);
    const visibleCount = totalMatch ? Number(totalMatch[1]) :
      resultMatch ? Number(resultMatch[1]) : null;
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
      advancedSearchRef: firstRef(advancedSearch),
      fromFieldRef: firstRef(fromField),
      subjectFieldRef: firstRef(subjectField),
      dateControlRefs: dateControls.slice(0, 6).map(element => element.ref).filter(Boolean),
      selectAllRef: firstRef(selectAll),
      trashRefs: trash.slice(0, 5).map(element => element.ref).filter(Boolean),
      visibleCount: Number.isFinite(visibleCount) ? visibleCount : null,
      messageSamples,
    };
  },
  checkDestructiveScope({ goal, snapshot, action, target } = {}) {
    const label = String(target?.name || '');
    const isTrashAction = action?.action === 'click' && /move.*trash|\btrash\b|\bdelete\b/i.test(label);
    if (!isTrashAction) return { applicable: false, allowed: true };

    const text = String(snapshot?.visibleText || '');
    const path = (() => { try { return new URL(snapshot?.url || '').pathname; } catch { return ''; } })();
    const hints = this.analyzeSnapshot(snapshot);
    // Text from messages is untrusted and cannot establish destructive scope.
    // Both the current search route and an actual search control are required.
    const searchEvidence = /\/search(?:\/|$)/i.test(path) &&
      Boolean(hints.searchRef) && Number.isFinite(hints.visibleCount);
    const explicitWholeInbox = /\bentire\s+inbox\b|\bempty\s+(?:my\s+)?inbox\b|\b(?:delete|trash|remove)\s+(?:all|every)\s+(?:messages?|emails?|mail)\s+(?:in|from)\s+(?:my\s+)?inbox\b/i.test(String(goal || ''));

    // Selecting every message without a bounded count has unknown scope.
    // It must not be authorized by route text or an Inbox-wide checkbox alone.
    const selectedAll = (snapshot?.elements || []).some(element =>
      element?.role === 'checkbox' &&
      /select\s+all|all\s+(?:messages?|mail)/i.test(String(element?.name || '')) &&
      element?.state?.checked === true);
    if (selectedAll) {
      return {
        applicable: true, allowed: false, code: 'DESTRUCTIVE_SCOPE_UNVERIFIED',
        reason: 'Select-all may include messages beyond the visible page. Stable selected-message identities are required before bulk Trash.',
      };
    }

    if (!searchEvidence && !explicitWholeInbox) {
      return {
        applicable: true,
        allowed: false,
        code: 'DESTRUCTIVE_SCOPE_UNVERIFIED',
        reason: 'Yahoo Trash action is not visibly scoped to search/filter results. Refusing a potentially Inbox-wide bulk action.',
      };
    }
    return {
      applicable: true,
      allowed: true,
      scope: searchEvidence ? 'search-results' : 'explicit-whole-inbox',
      reason: searchEvidence
        ? 'Yahoo page shows search-result scope.'
        : 'Original task explicitly requests a whole-Inbox action.',
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

    // A route/pagination change is not proof that messages were removed.
    // Count drops are only supporting evidence on the same search URL.
    const sameSearch = before?.url && before.url === after?.url &&
      /\/search(?:\/|$)/i.test((() => { try { return new URL(before.url).pathname; } catch { return ''; } })());
    if (sameSearch && Number.isFinite(beforeHints.visibleCount) && Number.isFinite(afterHints.visibleCount)) {
      if (afterHints.visibleCount < beforeHints.visibleCount) {
        evidence.push(`Search result count decreased from ${beforeHints.visibleCount} to ${afterHints.visibleCount}`);
      } else if (afterHints.visibleCount === beforeHints.visibleCount) {
        evidence.push(`Search result count remained ${afterHints.visibleCount}`);
      }
    }

    // A disappearance from the first few sampled rows can be pagination,
    // reordering or live inbox updates. It is never a success oracle.
    // Only a structured, verified success signal should allow completion;
    // free-text mail bodies are untrusted and cannot certify deletion.
    return { applicable: true, verified, evidence: evidence.slice(0, 5), before: beforeHints, after: afterHints };
  },
  detectBlocker(snapshot) {
    const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : [];
    const hasSensitive = elements.some(element => element?.sensitive === true);
    let path = '';
    try { path = new URL(snapshot?.url || '').pathname; } catch {}
    // Mail bodies and subjects can quote arbitrary challenge phrases. They
    // must never trigger MFA/CAPTCHA handoff while reading the mailbox.
    const inMailbox = /^\/d(?:\/|$)/i.test(path);
    const uiText = elements
      .filter(element => ['textbox', 'combobox', 'dialog', 'alert', 'status'].includes(element?.role))
      .slice(0, 30)
      .map(element => String(element?.name || '').slice(0, 160))
      .join(' ').toLowerCase();
    const text = inMailbox ? uiText :
      (uiText + ' ' + String(snapshot?.visibleText || '').slice(0, 2000)).toLowerCase();
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
