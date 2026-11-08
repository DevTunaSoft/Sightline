import test from 'node:test';
import assert from 'node:assert/strict';
import { planNextAction } from '../extension/planner-client.js';
import { LOCAL_API } from '../extension/vision-core.js';

const snapshot={snapshotId:'s1',elements:[{ref:'@e1',role:'button',name:'Inbox',sensitive:false}]};

test('planner client uses local Ollama only and parses decision', async () => {
  let request;
  const decision=await planNextAction({model:'gemma3:4b',goal:'open inbox',snapshot},async(url,options)=>{
    request={url,options}; return new Response(JSON.stringify({message:{content:'{"done":false,"action":{"action":"click","ref":"@e1"}}'}}),{status:200});
  });
  assert.equal(request.url,`${LOCAL_API}/api/chat`); assert.equal(decision.action.ref,'@e1');
});

test('planner client rejects malformed model decisions', async () => {
  await assert.rejects(()=>planNextAction({model:'gemma3:4b',goal:'x',snapshot},async()=>new Response(JSON.stringify({message:{content:'not json'}}),{status:200})),/invalid JSON/);
});

test('planner client performs at most one bounded repair retry for malformed JSON', async () => {
  let calls=0;
  const decision=await planNextAction({model:'gemma3:4b',goal:'open inbox',snapshot},async()=>{
    calls+=1;
    const content=calls===1 ? 'not json' : '{"done":false,"action":{"action":"click","ref":"@e1"}}';
    return new Response(JSON.stringify({message:{content}}),{status:200});
  });
  assert.equal(calls,2);
  assert.equal(decision.action.ref,'@e1');
});

test('planner client never loops beyond two malformed attempts', async () => {
  let calls=0;
  await assert.rejects(()=>planNextAction({model:'gemma3:4b',goal:'x',snapshot},async()=>{
    calls+=1;
    return new Response(JSON.stringify({message:{content:'still invalid'}}),{status:200});
  }),/invalid JSON/);
  assert.equal(calls,2);
});


test('planner client aborts a hung request within configured timeout', async () => {
  let observedAbort=false;
  const fetchImpl=async(_url,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>{ observedAbort=true; reject(options.signal.reason || new DOMException('Aborted','AbortError')); },{once:true});
  });
  await assert.rejects(
    ()=>planNextAction({model:'gemma3:4b',goal:'x',snapshot},fetchImpl,undefined,{timeoutMs:10}),
    /timed out|TimeoutError|abort/i
  );
  assert.equal(observedAbort,true);
});

test('planner client propagates external cancellation immediately', async () => {
  const controller=new AbortController();
  const fetchImpl=async(_url,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(options.signal.reason || new DOMException('Aborted','AbortError')),{once:true});
  });
  const pending=planNextAction({model:'gemma3:4b',goal:'x',snapshot},fetchImpl,controller.signal,{timeoutMs:1000});
  controller.abort(new DOMException('User cancelled','AbortError'));
  await assert.rejects(()=>pending,/User cancelled|AbortError|abort/i);
});
