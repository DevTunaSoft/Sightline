import { observeActiveTab, executeOnTab } from './browser-bridge.js';

const ACCEPTANCE_TITLE = 'Sightline Browser Agent Fixture';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

function assertion(name, ok, detail = '') {
  return { name, ok: ok === true, detail: String(detail || '').slice(0, 300) };
}

function findByName(snapshot, pattern, role = null) {
  return (snapshot?.elements || []).find(element =>
    (!role || element.role === role) && pattern.test(String(element.name || ''))
  ) || null;
}

async function act(tabId, snapshot, action, chromeApi) {
  return executeOnTab(tabId, {
    action,
    snapshotId: snapshot.snapshotId,
    mode: 'assist',
    taskGoal: 'Sightline deterministic browser acceptance self-test',
  }, chromeApi);
}

export async function runBrowserAcceptanceSelfTest(chromeApi = chrome) {
  const checks = [];
  let observed;
  try {
    observed = await observeActiveTab(chromeApi);
  } catch (error) {
    return { ok:false, checks:[assertion('Observe fixture',false,error.message)] };
  }

  let url;
  try { url = new URL(observed.snapshot.url); } catch {}
  const safeFixture =
    url &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    observed.snapshot.title === ACCEPTANCE_TITLE;

  checks.push(assertion('Dedicated localhost fixture', Boolean(safeFixture), observed.snapshot.url));
  if (!safeFixture) {
    return { ok:false, code:'SELF_TEST_WRONG_PAGE', checks };
  }

  let snapshot = observed.snapshot;
  const tabId = observed.tabId;

  checks.push(assertion('Semantic controls discovered', snapshot.elements.length >= 6, `${snapshot.elements.length} controls`));
  checks.push(assertion('Sensitive fields redacted', snapshot.elements.filter(e=>e.sensitive).length >= 2));
  checks.push(assertion('Opaque frame reported', Number(snapshot.frames?.opaque || 0) >= 1, JSON.stringify(snapshot.frames || {})));
  checks.push(assertion('Same-origin frame reported', Number(snapshot.frames?.sameOrigin || 0) >= 1, JSON.stringify(snapshot.frames || {})));

  const search = findByName(snapshot, /^Search$/i, 'textbox') || findByName(snapshot, /Search/i, 'textbox');
  checks.push(assertion('Top-page search box found', Boolean(search?.ref)));
  if (!search?.ref) return { ok:false, code:'SELF_TEST_MISSING_SEARCH', checks };

  let result = await act(tabId, snapshot, { action:'type', ref:search.ref, text:'sightline acceptance' }, chromeApi);
  checks.push(assertion('Type action succeeded', result?.ok === true, result?.code || ''));
  if (!result?.ok) return { ok:false, code:result?.code || 'SELF_TEST_TYPE_FAILED', checks };
  snapshot = result.snapshot;

  const searchButton = findByName(snapshot, /^Search$/i, 'button');
  checks.push(assertion('Search button found', Boolean(searchButton?.ref)));
  if (!searchButton?.ref) return { ok:false, code:'SELF_TEST_MISSING_SEARCH_BUTTON', checks };

  result = await act(tabId, snapshot, { action:'click', ref:searchButton.ref }, chromeApi);
  checks.push(assertion('Top-page click succeeded', result?.ok === true, result?.code || ''));
  if (!result?.ok) return { ok:false, code:result?.code || 'SELF_TEST_CLICK_FAILED', checks };
  snapshot = result.snapshot;
  checks.push(assertion('Top-page state change verified', /Search results for:\s*sightline acceptance/i.test(snapshot.visibleText || '')));

  const frameSearch = findByName(snapshot, /Frame search/i, 'textbox');
  const frameButton = findByName(snapshot, /Frame action/i, 'button');
  checks.push(assertion('Same-origin iframe controls found', Boolean(frameSearch?.ref && frameButton?.ref)));
  checks.push(assertion('Iframe control carries frame metadata', Boolean(frameSearch?.frame?.path && frameSearch.frame.depth >= 1)));
  if (!frameSearch?.ref || !frameButton?.ref) return { ok:false, code:'SELF_TEST_IFRAME_MISSING', checks };

  result = await act(tabId, snapshot, { action:'type', ref:frameSearch.ref, text:'inside frame' }, chromeApi);
  checks.push(assertion('Iframe type succeeded', result?.ok === true, result?.code || ''));
  if (!result?.ok) return { ok:false, code:result?.code || 'SELF_TEST_IFRAME_TYPE_FAILED', checks };
  snapshot = result.snapshot;

  const refreshedFrameButton = findByName(snapshot, /Frame action/i, 'button');
  result = await act(tabId, snapshot, { action:'click', ref:refreshedFrameButton?.ref }, chromeApi);
  checks.push(assertion('Iframe click succeeded', result?.ok === true, result?.code || ''));
  if (!result?.ok) return { ok:false, code:result?.code || 'SELF_TEST_IFRAME_CLICK_FAILED', checks };
  snapshot = result.snapshot;
  checks.push(assertion('Iframe state change visible', /Frame action completed:\s*inside frame/i.test(snapshot.visibleText || '')));

  const deleteButton = findByName(snapshot, /Move selected messages to Trash/i, 'button');
  checks.push(assertion('Destructive fixture control found', Boolean(deleteButton?.ref)));
  if (deleteButton?.ref) {
    const blocked = await act(tabId, snapshot, { action:'click', ref:deleteButton.ref }, chromeApi);
    checks.push(assertion('Destructive action requires confirmation', blocked?.code === 'CONFIRMATION_REQUIRED', blocked?.code || ''));
  }

  const external = findByName(snapshot, /External test link/i, 'link');
  checks.push(assertion('Cross-origin fixture link found', Boolean(external?.ref)));
  if (external?.ref) {
    const blocked = await act(tabId, snapshot, { action:'click', ref:external.ref }, chromeApi);
    checks.push(assertion('Cross-origin link requires confirmation', blocked?.code === 'CONFIRMATION_REQUIRED', blocked?.code || ''));
  }

  const ok = checks.every(check => check.ok);
  return { ok, code: ok ? 'SELF_TEST_PASS' : 'SELF_TEST_FAILED', checks };
}
