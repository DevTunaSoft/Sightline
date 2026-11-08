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
