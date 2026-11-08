import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModels, loadVisionModels, analyzeFrame } from '../extension/client.js';
import { LOCAL_API } from '../extension/vision-core.js';
const frame = Buffer.from('this-is-an-example-image').toString('base64');

test('loadModels requests fixed local endpoint only', async () => {
  let requested;
  const models = await loadModels(async (url, opts) => {
    requested = [url,opts];
    return new Response(JSON.stringify({models:[{name:'gemma3:4b'}]}),{status:200});
  });
  assert.deepEqual(models,['gemma3:4b']);
  assert.equal(requested[0],`${LOCAL_API}/api/tags`);
  assert.equal(requested[1].method,'GET');
});

test('analyzeFrame sends an image and accepts a response', async () => {
  let request;
  const answer = await analyzeFrame({model:'gemma3:4b',question:'describe',imageBase64:frame},async (url,options) => {
    request={url,options};
    return new Response(JSON.stringify({message:{content:'A chart is visible.'}}),{status:200});
  });
  assert.equal(answer,'A chart is visible.');
  assert.equal(request.url,`${LOCAL_API}/api/chat`);
  assert.deepEqual(JSON.parse(request.options.body).messages[1].images,[frame]);
});

test('error responses and malformed model output do not masquerade as successful answers', async () => {
  await assert.rejects(() => analyzeFrame({model:'gemma3:4b',question:'describe',imageBase64:frame},async () => new Response(JSON.stringify({error:'model not found'}),{status:404})),/model not found/);
  await assert.rejects(() => analyzeFrame({model:'gemma3:4b',question:'describe',imageBase64:frame},async () => new Response('{}',{status:200})),/no readable answer/);
});

test('abort signal is propagated',async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => analyzeFrame({model:'gemma3:4b',question:'describe',imageBase64:frame},async (url,options) => {
    if(options.signal.aborted) throw new DOMException('Aborted','AbortError');
  },controller.signal),/Aborted/);
});

test('loadVisionModels selects only models reporting vision capability', async () => {
  const names = await loadVisionModels(async (url, options) => {
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({models:[{name:'gemma3:4b'},{name:'llama3.2:3b'},{name:'qwen3-vl:2b-instruct'},{name:'qwen3-vl:235b-cloud'}]}), {status:200});
    }
    const model = JSON.parse(options.body).model;
    return new Response(JSON.stringify({capabilities: model.startsWith('llama') ? ['completion'] : ['completion','vision']}), {status:200});
  });
  assert.deepEqual(names,['gemma3:4b','qwen3-vl:2b-instruct']);
});

test('loadVisionModels ignores inaccessible model metadata', async () => {
  const names = await loadVisionModels(async (url) => {
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({models:[{name:'bad:1b'},{name:'good:4b'}]}),{status:200});
    return url.includes('/api/show') ? new Response('{}',{status:500}) : new Response('{}',{status:200});
  });
  assert.deepEqual(names,[]);
});
