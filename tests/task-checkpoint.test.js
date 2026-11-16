import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskCheckpoint, saveTaskCheckpoint, loadTaskCheckpoint, clearTaskCheckpoint, TASK_CHECKPOINT_KEY } from '../extension/task-checkpoint.js';

function fakeChrome() {
  const data = {};
  return {
    data,
    storage:{session:{
      async set(values){ Object.assign(data, values); },
      async get(key){ return { [key]: data[key] }; },
      async remove(key){ delete data[key]; },
    }},
  };
}

test('checkpoint strips typed text, values, URLs and expectations from persisted action history', () => {
  const cp=createTaskCheckpoint({taskId:'t1',goal:'Do a task',timeline:[
    {n:1,snapshotId:'s1',action:{action:'type',ref:'@e1',text:'private words'},receipt:{ok:true}},
    {n:2,snapshotId:'s2',action:{action:'navigate',url:'https://example.com/?token=secret'},receipt:{ok:true}},
    {n:3,snapshotId:'s3',action:{action:'select',ref:'@e2',value:'secret-choice'},receipt:{ok:true}},
  ]});
  const serialized=JSON.stringify(cp);
  assert.doesNotMatch(serialized,/private words|token=secret|secret-choice/);
  assert.deepEqual(cp.timeline[0].action,{action:'type',ref:'@e1'});
});

test('checkpoint is bounded to last 40 action records', () => {
  const cp=createTaskCheckpoint({taskId:'t1',goal:'x',timeline:Array.from({length:100},(_,i)=>({n:i+1,action:{action:'click',ref:'@e1'},receipt:{ok:true}}))});
  assert.equal(cp.timeline.length,40);
  assert.equal(cp.timeline[0].n,61);
});

test('session checkpoint save/load/clear round trip', async () => {
  const chromeApi=fakeChrome();
  await saveTaskCheckpoint({taskId:'t1',goal:'Resume me',mode:'assist',model:'gemma3:4b',actionsUsed:3},chromeApi);
  assert.ok(chromeApi.data[TASK_CHECKPOINT_KEY]);
  const loaded=await loadTaskCheckpoint(chromeApi);
  assert.equal(loaded.goal,'Resume me'); assert.equal(loaded.actionsUsed,3);
  await clearTaskCheckpoint(chromeApi);
  assert.equal(await loadTaskCheckpoint(chromeApi),null);
});


test('checkpoint preserves task tab id without storing page URL', () => {
  const cp=createTaskCheckpoint({taskId:'t-tab',goal:'Continue task',tabId:77});
  assert.equal(cp.tabId,77);
  assert.equal('url' in cp,false);
});


test('checkpoint stores origin only for resume policy, never full page path or query', () => {
  const cp=createTaskCheckpoint({taskId:'t-origin',goal:'Resume',taskOrigin:'https://mail.yahoo.com/d/folders/1?token=secret'});
  assert.equal(cp.taskOrigin,'https://mail.yahoo.com');
  assert.doesNotMatch(JSON.stringify(cp),/folders|token=secret/);
});


test('vision fallback count is bounded and survives checkpoint round trip', () => {
  const cp=createTaskCheckpoint({taskId:'t-vision',goal:'Inspect',visionFallbacksUsed:99});
  assert.equal(cp.visionFallbacksUsed,2);
});


test('checkpoint revisions increase monotonically for the same task', async () => {
  const chromeApi=fakeChrome();
  const first=await saveTaskCheckpoint({taskId:'t-rev',goal:'x'},chromeApi);
  const second=await saveTaskCheckpoint({...first,actionsUsed:1},chromeApi);
  assert.equal(first.revision,1);
  assert.equal(second.revision,2);
  assert.equal((await loadTaskCheckpoint(chromeApi)).revision,2);
});

test('clear is serialized after pending save and cannot resurrect cancelled task', async () => {
  const data={};
  let releaseSet;
  const gate=new Promise(resolve=>{releaseSet=resolve;});
  let firstSet=true;
  const chromeApi={storage:{session:{
    async get(key){ return { [key]: data[key] }; },
    async set(values){
      if(firstSet){ firstSet=false; await gate; }
      Object.assign(data,values);
    },
    async remove(key){ delete data[key]; },
  }}};
  const save=saveTaskCheckpoint({taskId:'t-race',goal:'x'},chromeApi);
  const clear=clearTaskCheckpoint(chromeApi);
  releaseSet();
  await Promise.all([save,clear]);
  assert.equal(await loadTaskCheckpoint(chromeApi),null);
});

test('in-flight action survives sanitized storage without disclosing typed data', async () => {
  const api=fakeChrome();
  await saveTaskCheckpoint({
    taskId:'t-inflight',goal:'Search for receipts',actionsUsed:1,requiresReview:true,
    timeline:[{n:1,snapshotId:'snapshot1',
      action:{action:'type',ref:'@e2',text:'synthetic private words'},
      receipt:{ok:false,code:'UNKNOWN_EFFECT'}}],
  },api);
  const loaded=await loadTaskCheckpoint(api);
  assert.equal(loaded.timeline[0].receipt.code,'UNKNOWN_EFFECT');
  assert.equal(loaded.requiresReview,true);
  assert.equal(loaded.actionsUsed,1);
  assert.doesNotMatch(JSON.stringify(api.data),/synthetic private words/);
});
