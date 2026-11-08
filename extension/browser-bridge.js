const BLOCKED_PROTOCOLS = new Set(['chrome:', 'edge:', 'about:', 'chrome-extension:', 'moz-extension:', 'view-source:']);

export function isSupportedPageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) && !BLOCKED_PROTOCOLS.has(url.protocol);
  } catch { return false; }
}

export async function getActiveTab(chromeApi = chrome) {
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab is available.');
  if (!isSupportedPageUrl(tab.url)) throw new Error('Sightline can only control normal HTTP(S) webpages.');
  return tab;
}

export async function ensurePageAgent(tabId, chromeApi = chrome) {
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

export async function observeActiveTab(chromeApi = chrome) {
  const tab = await getActiveTab(chromeApi);
  await ensurePageAgent(tab.id, chromeApi);
  const result = await chromeApi.tabs.sendMessage(tab.id, { type: 'SIGHTLINE_OBSERVE' });
  if (!result?.ok) throw new Error(result?.error || result?.code || 'Page observation failed.');
  return { tabId: tab.id, ...result };
}

export async function executeOnActiveTab({ action, snapshotId, mode = 'assist', confirmed = false, confirmationKey = null }, chromeApi = chrome) {
  const tab = await getActiveTab(chromeApi);
  await ensurePageAgent(tab.id, chromeApi);
  return chromeApi.tabs.sendMessage(tab.id, {
    type: 'SIGHTLINE_EXECUTE', action, snapshotId, mode, confirmed: confirmed === true, confirmationKey,
  });
}
