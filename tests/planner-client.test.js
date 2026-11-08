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
