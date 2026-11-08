const BLOCKED_PROTOCOLS = new Set(['chrome:', 'edge:', 'about:', 'chrome-extension:', 'moz-extension:', 'view-source:']);

export function isSupportedPageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) && !BLOCKED_PROTOCOLS.has(url.protocol);
  } catch { return false; }
}

function assertSupportedTab(tab) {
  if (!tab?.id) throw new Error('Browser tab is unavailable.');
  if (tab.url && !isSupportedPageUrl(tab.url)) throw new Error('Sightline can only control normal HTTP(S) webpages.');
  return tab;
}

export async function getActiveTab(chromeApi = chrome) {
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  return assertSupportedTab(tab);
}

export async function getTaskTab(tabId, chromeApi = chrome) {
  if (!Number.isInteger(tabId) || tabId <= 0) throw new Error('Task tab id is invalid.');
  if (typeof chromeApi.tabs.get === 'function') {
    const tab = await chromeApi.tabs.get(tabId);
    return assertSupportedTab(tab);
  }
  return { id: tabId };
}

export async function ensurePageAgent(tabId, chromeApi = chrome) {
  await getTaskTab(tabId, chromeApi);
  try {
    const response = await chromeApi.tabs.sendMessage(tabId, { type: 'SIGHTLINE_PING' });
    if (response?.ok) return response;
  } catch {
    // Agent is not loaded yet or navigation replaced it.
  }
  await chromeApi.scripting.executeScript({ target: { tabId }, files: ['page-agent-bootstrap.js'] });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 20));
    try {
      const response = await chromeApi.tabs.sendMessage(tabId, { type: 'SIGHTLINE_PING' });
      if (response?.ok) return response;
    } catch { /* retry briefly while module loads */ }
  }
  throw new Error('Sightline page agent did not become ready.');
}

export async function observeTab(tabId, chromeApi = chrome) {
  await ensurePageAgent(tabId, chromeApi);
  const result = await chromeApi.tabs.sendMessage(tabId, { type: 'SIGHTLINE_OBSERVE' });
  if (!result?.ok) throw new Error(result?.error || result?.code || 'Page observation failed.');
  return { tabId, ...result };
}

export async function observeActiveTab(chromeApi = chrome) {
  const tab = await getActiveTab(chromeApi);
  return observeTab(tab.id, chromeApi);
}

export async function executeOnTab(tabId, { action, snapshotId, mode = 'assist', confirmed = false, confirmationKey = null, taskGoal = '' }, chromeApi = chrome) {
  await ensurePageAgent(tabId, chromeApi);
  return chromeApi.tabs.sendMessage(tabId, {
    type: 'SIGHTLINE_EXECUTE', action, snapshotId, mode, confirmed: confirmed === true, confirmationKey,
    taskGoal: String(taskGoal || '').slice(0, 2000),
  });
}

export async function executeOnActiveTab(args, chromeApi = chrome) {
  const tab = await getActiveTab(chromeApi);
  return executeOnTab(tab.id, args, chromeApi);
}
