import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalAIBrowserSelfTest } from '../extension/local-ai-self-test.js';

test('browser-origin local AI self-test validates tags, vision capability, and inference', async () => {
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push(url);
    if(url.endsWith('/api/tags')) return new Response(JSON.stringify({models:[{name:'gemma3:4b'}]}),{status:200});
    if(url.endsWith('/api/show')) return new Response(JSON.stringify({capabilities:['completion','vision']}),{status:200});
    if(url.endsWith('/api/chat')) {
      const payload=JSON.parse(options.body);
      assert.equal(payload.model,'gemma3:4b');
      assert.ok(payload.messages[0].images[0].length>20);
      return new Response(JSON.stringify({message:{content:'image processed'}}),{status:200});
    }
    throw new Error('unexpected endpoint');
  };
  const report=await runLocalAIBrowserSelfTest({model:'gemma3:4b'},fetchImpl);
  assert.equal(report.ok,true);
  assert.equal(report.code,'LOCAL_AI_SELF_TEST_PASS');
  assert.equal(report.responseChars,15);
  assert.deepEqual(calls.map(url=>url.split('/').slice(-2).join('/')),['api/tags','api/show','api/chat']);
});

test('browser-origin local AI self-test classifies endpoint/CORS-style failures', async () => {
  const report=await runLocalAIBrowserSelfTest({model:'gemma3:4b'},async()=>{ throw new TypeError('Failed to fetch'); });
  assert.equal(report.ok,false);
  assert.equal(report.code,'OLLAMA_BROWSER_CONNECTION_FAILED');
  assert.equal(report.checks.at(-1).ok,false);
});

test('browser-origin local AI self-test blocks cloud-tagged model names', async () => {
  let calls=0;
  const report=await runLocalAIBrowserSelfTest({model:'example:cloud'},async()=>{calls+=1;});
  assert.equal(report.ok,false);
  assert.equal(report.code,'LOCAL_AI_MODEL_INVALID');
  assert.equal(calls,0);
});
