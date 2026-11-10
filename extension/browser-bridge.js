export function isSupportedPageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertSupportedTab(tab) {
  if (!tab?.id) throw codedError('Browser tab is unavailable.', 'TASK_TAB_UNAVAILABLE');
  if (tab.url && !isSupportedPageUrl(tab.url)) {
    throw codedError('Sightline can only control normal HTTP(S) webpages.', 'UNSUPPORTED_TASK_TAB');
  }
  return tab;
}

export async function getActiveTab(chromeApi = chrome) {
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  return assertSupportedTab(tab);
}

export async function getTaskTab(tabId, chromeApi = chrome) {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    throw codedError('Task tab id is invalid.', 'TASK_TAB_UNAVAILABLE');
  }
  if (typeof chromeApi.tabs.get === 'function') {
    try {
      const tab = await chromeApi.tabs.get(tabId);
      return assertSupportedTab(tab);
    } catch (error) {
      if (error?.code === 'UNSUPPORTED_TASK_TAB' || error?.code === 'TASK_TAB_UNAVAILABLE') throw error;
      throw codedError('The browser tab for this Sightline task is no longer available.', 'TASK_TAB_UNAVAILABLE');
    }
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
  // Bounded backoff gives slower module imports time to finish without polling
  // indefinitely. Revalidate the task tab so a navigation cannot inherit approval.
  const retryDelays = [20, 40, 80, 120, 160, 200, 200, 200];
  for (const delay of retryDelays) {
    await new Promise(resolve => setTimeout(resolve, delay));
    await getTaskTab(tabId, chromeApi);
    try {
      const response = await chromeApi.tabs.sendMessage(tabId, { type: 'SIGHTLINE_PING' });
      if (response?.ok) return response;
    } catch { /* Bootstrap is still importing; retry within the fixed budget. */ }
  }
  throw codedError('Sightline page agent did not become ready after bounded startup retries.', 'PAGE_AGENT_NOT_READY');
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


export async function captureTaskTabFrame(tabId, chromeApi = chrome) {
  const tab = await getTaskTab(tabId, chromeApi);
  if (tab.active !== true) {
    throw codedError('Vision fallback requires the Sightline task tab to be the visible active tab.', 'VISION_TAB_NOT_ACTIVE');
  }
  if (typeof chromeApi.tabs.captureVisibleTab !== 'function') {
    throw codedError('Browser screenshot capture is unavailable.', 'VISION_CAPTURE_UNAVAILABLE');
  }
  const dataUrl = await chromeApi.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 65 });
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw codedError('Browser returned an invalid screenshot.', 'VISION_CAPTURE_INVALID');
  if (match[1].length > 6_000_000) {
    throw codedError('Screenshot exceeds Sightline vision input budget.', 'VISION_CAPTURE_TOO_LARGE');
  }
  return { tabId, imageBase64: match[1] };
}
