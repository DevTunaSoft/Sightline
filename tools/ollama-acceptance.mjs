const API = 'http://127.0.0.1:11434';
const CLOUD_TAG = /(?:-cloud|:cloud|\.cloud)(?:$|[-:._])/i;
// Tiny opaque PNG used only to prove image inference plumbing. It is not saved by Sightline.
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAf8CBYkAAAAASUVORK5CYII=';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

async function request(path, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(body?.error || text || `HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function showModel(name) {
  return request('/api/show', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name}),
  }, 30000);
}

async function main() {
  console.log('Sightline Ollama Acceptance');
  console.log('===========================');
  console.log(`Endpoint: ${API}`);

  const started = performance.now();
  let tags;
  try {
    tags = await request('/api/tags', {}, 10000);
  } catch (error) {
    console.error(`FAIL: Cannot reach Ollama: ${error.message}`);
    console.error('Start Ollama, then run this command again.');
    process.exitCode = 2;
    return;
  }

  const installed = (tags?.models || [])
    .map(item => String(item?.name || item?.model || '').trim())
    .filter(Boolean)
    .filter(name => !CLOUD_TAG.test(name));

  if (!installed.length) {
    console.error('FAIL: Ollama is reachable, but no local models are installed.');
    process.exitCode = 3;
    return;
  }

  const requested = argValue('--model');
  const candidates = requested ? [requested] : installed;
  let chosen = null;
  let details = null;

  for (const name of candidates) {
    if (!installed.includes(name)) {
      if (requested) {
        console.error(`FAIL: Requested model is not installed locally: ${name}`);
        process.exitCode = 4;
        return;
      }
      continue;
    }
    if (CLOUD_TAG.test(name)) continue;
    try {
      const shown = await showModel(name);
      const capabilities = Array.isArray(shown?.capabilities)
        ? shown.capabilities.map(value => String(value).toLowerCase())
        : [];
      if (capabilities.includes('vision')) {
        chosen = name;
        details = shown;
        break;
      }
    } catch {}
  }

  if (!chosen) {
    console.error('FAIL: No installed local model declared the vision capability.');
    console.error('Install a local Ollama vision model, then rerun this acceptance check.');
    process.exitCode = 5;
    return;
  }

  console.log(`Vision model: ${chosen}`);
  const inferenceStart = performance.now();
  let response;
  try {
    response = await request('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:chosen,
        stream:false,
        options:{temperature:0},
        messages:[{
          role:'user',
          content:'This is a Sightline local acceptance image. Briefly confirm that you can process the attached image. Do not infer private information.',
          images:[TINY_PNG],
        }],
      }),
    });
  } catch (error) {
    console.error(`FAIL: Vision inference request failed: ${error.message}`);
    process.exitCode = 6;
    return;
  }

  const content = String(response?.message?.content || '').trim();
  if (!content) {
    console.error('FAIL: Ollama returned no readable vision response.');
    process.exitCode = 7;
    return;
  }

  const inferenceMs = performance.now() - inferenceStart;
  const totalMs = performance.now() - started;
  console.log(`PASS: local image inference returned ${content.length} characters in ${inferenceMs.toFixed(0)} ms.`);
  console.log(`Total readiness time: ${totalMs.toFixed(0)} ms.`);
  console.log('No screenshot or model response was persisted by this test.');
}

await main();
