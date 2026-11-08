import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskProgressGuard, runTaskLoop } from '../extension/task-loop-core.js';

test('progress guard stops repeated actions', () => {
  const guard=new TaskProgressGuard({limits:{maxRepeatedAction:2,maxRepeatedState:99,maxActions:10}});
  assert.equal(guard.beforeAction({action:'click',ref:'@e1'},'s1').ok,true);
  assert.equal(guard.beforeAction({action:'click',ref:'@e1'},'s2').ok,true);
  const stopped=guard.beforeAction({action:'click',ref:'@e1'},'s3');
  assert.equal(stopped.ok,false); assert.equal(stopped.code,'REPEATED_ACTION_STALL');
});
test('progress guard stops unchanged page states', () => {
  const guard=new TaskProgressGuard({limits:{maxRepeatedState:2,maxRepeatedAction:99,maxActions:10}});
  assert.equal(guard.beforeAction({action:'click',ref:'@e1'},'same').ok,true);
  assert.equal(guard.beforeAction({action:'click',ref:'@e2'},'same').ok,true);
  const stopped=guard.beforeAction({action:'click',ref:'@e3'},'same');
  assert.equal(stopped.ok,false); assert.equal(stopped.code,'REPEATED_STATE_STALL');
});
test('task loop completes with bounded injected dependencies', async () => {
  let step=0;
  const result=await runTaskLoop({
    goal:'open inbox',
    observe:async()=>({snapshotId:`s${step}`,elements:[]}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>({ok:true}),
    verify:async()=>{ step+=1; return step===2?{done:true,result:'opened'}:{ok:true}; },
    limits:{maxActions:5,maxRepeatedState:5,maxRepeatedAction:5},
  });
  assert.equal(result.ok,true); assert.equal(result.result,'opened'); assert.equal(result.timeline.length,2);
});
test('task loop honors action budget instead of looping forever', async () => {
  let i=0;
  const result=await runTaskLoop({
    goal:'impossible', observe:async()=>({snapshotId:`s${i++}`}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}), execute:async()=>({ok:true}), verify:async()=>({ok:true}),
    limits:{maxActions:2,maxRepeatedState:99,maxRepeatedAction:99},
  });
  assert.equal(result.ok,false); assert.equal(result.code,'ACTION_BUDGET_EXCEEDED'); assert.equal(result.timeline.length,2);
});
test('task loop honors cancellation before work', async () => {
  const c=new AbortController(); c.abort();
  const result=await runTaskLoop({goal:'x',observe:async()=>({}),plan:async()=>({}),execute:async()=>({}),verify:async()=>({}),signal:c.signal});
  assert.equal(result.ok,false); assert.equal(result.code,'ABORTED');
});
