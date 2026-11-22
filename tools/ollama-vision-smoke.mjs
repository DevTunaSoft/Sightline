// Smoke-tests an Ollama model's vision capability with a 1x1 PNG.
import { writeFileSync } from 'node:fs';
const model = process.argv[2] || 'hf.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF:Q4_K_M';
// 1x1 red PNG
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const body = {
  model,
  messages: [{ role: 'user', content: 'Describe this image in one short sentence.', images: [png.toString('base64')] }],
  stream: false,
};
const res = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', body: JSON.stringify(body) });
const json = await res.json();
console.log('model:', model);
console.log('response:', json?.message?.content || json?.error || JSON.stringify(json).slice(0, 500));