import { LOCAL_API } from './vision-core.js';
import { makePlannerPayload, parsePlannerDecision } from './planner-core.js';

async function responseError(response) {
  const text = await response.text();
  try { return JSON.parse(text)?.error || text.slice(0, 240) || `HTTP ${response.status}`; }
  catch { return text.slice(0, 240) || `HTTP ${response.status}`; }
}

export async function planNextAction(args, fetchImpl = fetch, signal) {
  const payload = makePlannerPayload(args);
  const response = await fetchImpl(`${LOCAL_API}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    signal, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Ollama planner returned ${response.status}: ${await responseError(response)}`);
  const json = await response.json();
  const content = json?.message?.content;
  if (typeof content !== 'string') throw new Error('Planner returned no readable decision.');
  return parsePlannerDecision(content, args.snapshot);
}
