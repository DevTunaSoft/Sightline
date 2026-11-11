import { LOCAL_API } from './vision-core.js';
import { makePlannerPayload, parsePlannerDecision } from './planner-core.js';

export const PLANNER_REQUEST_TIMEOUT_MS = 90000;
export const PLANNER_MAX_ATTEMPTS = 2;

async function responseError(response) {
  const text = await response.text();
  try { return JSON.parse(text)?.error || text.slice(0, 240) || `HTTP ${response.status}`; }
  catch { return text.slice(0, 240) || `HTTP ${response.status}`; }
}

function createRequestAbort(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let externalAbort = null;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else {
      externalAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener('abort', externalAbort, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(new DOMException('Planner request timed out.', 'TimeoutError')), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      if (externalAbort) externalSignal.removeEventListener('abort', externalAbort);
    },
  };
}

async function requestPlanner(payload, fetchImpl, signal) {
  const response = await fetchImpl(`${LOCAL_API}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    signal, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Ollama planner returned ${response.status}: ${await responseError(response)}`);
  const json = await response.json();
  const content = json?.message?.content;
  if (typeof content !== 'string') throw new Error('Planner returned no readable decision.');
  return content;
}

export async function planNextAction(args, fetchImpl = fetch, signal, requestOptions = {}) {
  const payload = makePlannerPayload(args);
  // Validate model refs against exactly what was shown, not hidden elements
  // trimmed out of the bounded prompt.
  const presentedPage = JSON.parse(payload.messages[1].content).page;
  const timeoutMs = Number.isFinite(requestOptions.timeoutMs)
    ? Math.max(1, Math.min(PLANNER_REQUEST_TIMEOUT_MS, Math.round(requestOptions.timeoutMs)))
    : PLANNER_REQUEST_TIMEOUT_MS;
  const requestAbort = createRequestAbort(signal, timeoutMs);
  try {
    let lastError = null;
    for (let attempt = 1; attempt <= PLANNER_MAX_ATTEMPTS; attempt += 1) {
      if (requestAbort.signal.aborted) throw requestAbort.signal.reason || new DOMException('Aborted', 'AbortError');
      const content = await requestPlanner(payload, fetchImpl, requestAbort.signal);
      try {
        return parsePlannerDecision(content, presentedPage);
      } catch (error) {
        lastError = error;
        if (attempt >= PLANNER_MAX_ATTEMPTS) break;
        payload.messages.push({
          role: 'user',
          content: 'Your previous response did not satisfy the required JSON action schema. Return only one valid JSON object matching the schema. Do not add prose or markdown.',
        });
      }
    }
    throw lastError || new Error('Planner could not produce a valid decision.');
  } finally {
    requestAbort.cleanup();
  }
}
