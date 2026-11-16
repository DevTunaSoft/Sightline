import { observeActiveTab } from './browser-bridge.js';
import { skillPlannerContext } from './skill-registry.js';
import { detectSkillBlocker } from './skill-blockers.js';

function check(name, ok, detail = '', required = true) {
  return { name, ok: ok === true, required: required === true, detail: String(detail || '').slice(0, 300) };
}

export async function runYahooReadinessCheck(chromeApi = chrome) {
  let observed;
  try {
    observed = await observeActiveTab(chromeApi);
  } catch (error) {
    return { ok:false, code:'YAHOO_READINESS_OBSERVE_FAILED', checks:[check('Observe active page',false,error.message)] };
  }

  const snapshot = observed.snapshot;
  const context = skillPlannerContext(snapshot.url, snapshot);
  const isYahoo = context?.id === 'yahoo-mail';
  const checks = [check('Yahoo Mail page detected', isYahoo, (()=>{try{return new URL(snapshot.url).origin}catch{return ''}})())];
  if (!isYahoo) return { ok:false, code:'YAHOO_READINESS_WRONG_SITE', checks };

  const blocker = detectSkillBlocker(snapshot);
  checks.push(check('No login/MFA/CAPTCHA/security blocker', !blocker, blocker ? `${blocker.code}: ${blocker.reason}` : 'No blocker detected'));
  if (blocker) return { ok:false, code:blocker.code || 'YAHOO_READINESS_BLOCKED', checks };

  const hints = context.pageHints || {};
  checks.push(check('Mail search control visible', Boolean(hints.searchRef), hints.searchRef || 'not found'));
  checks.push(check('Advanced search/filter control visible', Boolean(hints.advancedSearchRef), hints.advancedSearchRef || 'not currently visible', false));
  checks.push(check('Sender/From field visible', Boolean(hints.fromFieldRef), hints.fromFieldRef || 'not currently visible', false));
  checks.push(check('Date/filter controls visible', Array.isArray(hints.dateControlRefs) && hints.dateControlRefs.length > 0, (hints.dateControlRefs || []).join(', ') || 'not currently visible', false));
  checks.push(check('Select-all control visible', Boolean(hints.selectAllRef), hints.selectAllRef || 'not currently visible', false));
  checks.push(check('Trash/Delete control visible', Array.isArray(hints.trashRefs) && hints.trashRefs.length > 0, (hints.trashRefs || []).join(', ') || 'not currently visible', false));
  checks.push(check('Visible result count detected', Number.isFinite(hints.visibleCount), Number.isFinite(hints.visibleCount) ? String(hints.visibleCount) : 'not currently detected', false));
  checks.push(check('Message samples detected', Array.isArray(hints.messageSamples) && hints.messageSamples.length > 0, `${hints.messageSamples?.length || 0} sample(s)`, false));

  const requiredPass = checks.filter(item => item.required).every(item => item.ok);
  return {
    ok: requiredPass,
    code: requiredPass ? 'YAHOO_READINESS_PASS' : 'YAHOO_READINESS_INCOMPLETE',
    tabId: observed.tabId,
    summary: {
      visibleCount: Number.isFinite(hints.visibleCount) ? hints.visibleCount : null,
      samples: (hints.messageSamples || []).slice(0, 5).map(item => String(item.name || '').slice(0, 180)),
      advancedSearchAvailable: Boolean(hints.advancedSearchRef),
    },
    checks,
  };
}
