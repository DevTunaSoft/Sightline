import { LOCAL_API } from './vision-core.js';

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAf8CBYkAAAAASUVORK5CYII=';
const MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,110}$/;
const CLOUD_TAG = /(?:-cloud|:cloud|\.cloud)(?:$|[-:._])/i;

function check(name, ok, detail = '') {
  return { name, ok: ok === true, detail: String(detail || '').slice(0, 300) };
}

async function request(path, options, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetchImpl(`${LOCAL_API}${path}`, { ...options, signal: controller.signal, cache:'no-store' });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(body?.error || text || `HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function runLocalAIBrowserSelfTest({ model } = {}, fetchImpl = fetch) {
  const checks = [];
  const modelName = String(model || '').trim();
  if (!MODEL_PATTERN.test(modelName) || CLOUD_TAG.test(modelName)) {
    checks.push(check('Selected local model', false, 'Choose an installed local vision model first.'));
    return { ok:false, code:'LOCAL_AI_MODEL_INVALID', checks };
  }
  checks.push(check('Selected local model', true, modelName));

  let tags;
  try {
    tags = await request('/api/tags', {}, fetchImpl, 10000);
    checks.push(check('Extension can reach Ollama', true, LOCAL_API));
  } catch (error) {
    checks.push(check('Extension can reach Ollama', false, error.message));
    return { ok:false, code:'OLLAMA_BROWSER_CONNECTION_FAILED', checks };
  }

  const installed = (tags?.models || [])
    .map(item => String(item?.name || item?.model || '').trim())
    .filter(Boolean);
  const installedMatch = installed.includes(modelName);
  checks.push(check('Selected model is installed', installedMatch, modelName));
  if (!installedMatch) return { ok:false, code:'LOCAL_AI_MODEL_NOT_INSTALLED', checks };

  let shown;
  try {
    shown = await request('/api/show', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:modelName}),
    }, fetchImpl, 30000);
  } catch (error) {
    checks.push(check('Model metadata available', false, error.message));
    return { ok:false, code:'LOCAL_AI_MODEL_SHOW_FAILED', checks };
  }

  const capabilities = Array.isArray(shown?.capabilities)
    ? shown.capabilities.map(value => String(value).toLowerCase())
    : [];
  const vision = capabilities.includes('vision');
  checks.push(check('Model declares vision capability', vision, capabilities.join(', ') || 'none reported'));
  if (!vision) return { ok:false, code:'LOCAL_AI_MODEL_NOT_VISION', checks };

  const started = performance.now();
  let answer;
  try {
    answer = await request('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:modelName,
        stream:false,
        options:{temperature:0},
        messages:[{
          role:'user',
          content:'Sightline local browser-origin acceptance test. Briefly confirm you can process the attached tiny image. Do not infer private information.',
          images:[TINY_PNG],
        }],
      }),
    }, fetchImpl, 120000);
  } catch (error) {
    checks.push(check('Local vision inference', false, error.message));
    return { ok:false, code:'LOCAL_AI_INFERENCE_FAILED', checks };
  }

  const content = String(answer?.message?.content || '').trim();
  const elapsedMs = Math.round(performance.now() - started);
  checks.push(check('Local vision inference', Boolean(content), content ? `${content.length} chars in ${elapsedMs} ms` : 'Empty response'));
  const ok = checks.every(item => item.ok);
  return {
    ok,
    code: ok ? 'LOCAL_AI_SELF_TEST_PASS' : 'LOCAL_AI_SELF_TEST_FAILED',
    model:modelName,
    inferenceMs:elapsedMs,
    responseChars:content.length,
    checks,
  };
}
