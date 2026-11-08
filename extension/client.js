import { LOCAL_API, makePayload, normalizeModels } from './vision-core.js';

async function readError(response) {
  const body = await response.text();
  try { return JSON.parse(body)?.error || body.slice(0, 240) || `HTTP ${response.status}`; }
  catch { return body.slice(0, 240) || `HTTP ${response.status}`; }
}

export async function loadModels(fetchImpl = fetch, signal) {
  const response = await fetchImpl(`${LOCAL_API}/api/tags`, { method: 'GET', signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${await readError(response)}`);
  return normalizeModels(await response.json());
}

export async function analyzeFrame(args, fetchImpl = fetch, signal) {
  const payload = makePayload(args);
  const response = await fetchImpl(`${LOCAL_API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}: ${await readError(response)}`);
  const json = await response.json();
  if (typeof json?.message?.content !== 'string' || !json.message.content.trim()) {
    throw new Error('The model returned no readable answer. Confirm the selected model supports vision.');
  }
  return json.message.content.trim();
}

export async function loadVisionModels(fetchImpl = fetch, signal) {
  const all = await loadModels(fetchImpl, signal);
  const eligible = [];
  const workers = Array.from({ length: Math.min(3, all.length) }, async (_, worker) => {
    for (let i = worker; i < all.length; i += 3) {
      const name = all[i];
      try {
        const response = await fetchImpl(`${LOCAL_API}/api/show`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: name }), signal, cache: 'no-store'
        });
        if (!response.ok) continue;
        const metadata = await response.json();
        if (Array.isArray(metadata.capabilities) && metadata.capabilities.includes('vision')) eligible.push(name);
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
  });
  await Promise.all(workers);
  return eligible.sort();
}
