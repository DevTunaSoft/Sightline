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


test('task loop resumes with prior action budget and checkpoint callback', async () => {
  let checkpoint=null;
  const result=await runTaskLoop({
    goal:'resume',
    observe:async()=>({snapshotId:'fresh'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>({ok:true}),
    verify:async()=>({done:true,result:'resumed'}),
    resume:{actionsUsed:2,timeline:[{n:1,snapshotId:'old',action:{action:'click',ref:'@e9'},receipt:{ok:true}},{n:2,snapshotId:'old2',action:{action:'click',ref:'@e8'},receipt:{ok:true}}]},
    onCheckpoint:async value=>{checkpoint=value;},
    limits:{maxActions:5,maxRepeatedAction:5,maxRepeatedState:5},
  });
  assert.equal(result.ok,true);
  assert.equal(result.timeline.length,3);
  assert.equal(result.timeline.at(-1).n,3);
  assert.equal(checkpoint.actionsUsed,3);
  assert.equal(checkpoint.timeline.length,3);
});

test('write-ahead checkpoint is persisted before executing the action', async () => {
  const checkpoints=[];
  let executed=0;
  const result=await runTaskLoop({
    goal:'one action',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>{
      assert.equal(checkpoints.length,1);
      assert.equal(checkpoints[0].timeline.at(-1).receipt.code,'UNKNOWN_EFFECT');
      executed++;
      return {ok:true};
    },
    verify:async()=>({done:true}),
    onCheckpoint:async state=>checkpoints.push(state),
  });
  assert.equal(result.ok,true);
  assert.equal(executed,1);
  assert.equal(checkpoints.length,2);
  assert.equal(checkpoints[1].timeline.at(-1).receipt.ok,true);
});

test('failure to persist write-ahead record blocks execution', async () => {
  let executed=0;
  const result=await runTaskLoop({
    goal:'stop before action',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>{executed++; return {ok:true};},
    verify:async()=>({ok:true}),
    onCheckpoint:async()=>{throw new Error('storage unavailable');},
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'CHECKPOINT_WRITE_FAILED');
  assert.equal(executed,0);
  assert.equal(result.timeline.at(-1).receipt.code,'UNKNOWN_EFFECT');
});

test('an exception during execution retains unknown-effect record', async () => {
  const checkpoints=[];
  const result=await runTaskLoop({
    goal:'unknown mutation',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>{throw new Error('provider disconnected after click');},
    verify:async()=>({ok:true}),
    onCheckpoint:async checkpoint=>checkpoints.push(checkpoint),
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'UNKNOWN_EFFECT');
  assert.equal(result.timeline.length,1);
  assert.equal(result.timeline[0].receipt.code,'UNKNOWN_EFFECT');
  assert.equal(checkpoints.length,1);
});

test('resume with unknown-effect history cannot replan or replay', async () => {
  let calls=0;
  const result=await runTaskLoop({
    goal:'resume',
    observe:async()=>{calls++;return {snapshotId:'new'};},
    plan:async()=>{calls++;return {action:{action:'click',ref:'@e1'}};},
    execute:async()=>{calls++;return {ok:true};},
    verify:async()=>{calls++;return {ok:true};},
    resume:{actionsUsed:1,timeline:[{n:1,snapshotId:'old',action:{action:'click',ref:'@e1'},receipt:{ok:false,code:'UNKNOWN_EFFECT'}}]},
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'ACTION_RECONCILIATION_REQUIRED');
  assert.equal(calls,0);
});

test('post-action checkpoint failure stops with unknown effect instead of retrying', async () => {
  let executed=0, writes=0;
  const result=await runTaskLoop({
    goal:'stop after action',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>{executed++;return {ok:true};},
    verify:async()=>({ok:true}),
    onCheckpoint:async()=>{writes++;if(writes===2)throw new Error('disk full');},
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'CHECKPOINT_WRITE_FAILED');
  assert.equal(executed,1);
  assert.equal(result.timeline.at(-1).receipt.code,'UNKNOWN_EFFECT');
});

test('resuming after unverified page change is blocked before any work', async () => {
  let called=false;
  const result=await runTaskLoop({
    goal:'do not replay',
    observe:async()=>{called=true;return {snapshotId:'new'};},
    plan:async()=>{called=true;return {action:{action:'click',ref:'@e1'}};},
    execute:async()=>{called=true;return {ok:true};},
    verify:async()=>({ok:true}),
    resume:{actionsUsed:1,timeline:[{
      n:1,action:{action:'click',ref:'@e1'},
      receipt:{ok:false,code:'NO_VERIFIED_EFFECT'}
    }]},
  });
  assert.equal(result.code,'ACTION_RECONCILIATION_REQUIRED');
  assert.equal(called,false);
});

test('cancellation during a slow checkpoint prevents late mutation', async () => {
  const aborter=new AbortController();
  let executed=0;
  const result=await runTaskLoop({
    goal:'stop while saving',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>{executed++;return {ok:true};},
    verify:async()=>({ok:true}),
    onCheckpoint:async()=>{aborter.abort();},
    signal:aborter.signal,
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'ABORTED');
  assert.equal(executed,0);
  assert.equal(result.timeline.length,1);
});

test('crash during effect verification leaves a persisted unknown action', async () => {
  const checkpoints=[];
  const result=await runTaskLoop({
    goal:'one consequential action',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:async()=>({ok:true}),
    verify:async()=>{throw new Error('verification disconnected');},
    onCheckpoint:async state=>checkpoints.push(state.timeline.map(item=>({...item}))),
  });
  assert.equal(result.code,'UNKNOWN_EFFECT');
  assert.equal(result.timeline.at(-1).receipt.code,'UNKNOWN_EFFECT');
  assert.equal(checkpoints.length,1);
  assert.equal(checkpoints[0][0].receipt.code,'UNKNOWN_EFFECT');
});

test('verification that cannot confirm effect is recorded and stops replanning', async () => {
  const checkpoints=[];
  let plans=0;
  const result=await runTaskLoop({
    goal:'send once',
    observe:async()=>({snapshotId:'s1'}),
    plan:async()=>{plans++;return {action:{action:'click',ref:'@e1'}};},
    execute:async()=>({ok:true}),
    verify:async()=>({ok:false,fatal:false}),
    onCheckpoint:async state=>checkpoints.push(state.timeline.map(item=>({...item}))),
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'NO_VERIFIED_EFFECT');
  assert.equal(plans,1);
  assert.equal(checkpoints.length,2);
  assert.equal(checkpoints[0][0].receipt.code,'UNKNOWN_EFFECT');
  assert.equal(checkpoints[1][0].receipt.code,'NO_VERIFIED_EFFECT');
});

test('progress guard stores a fixed-size fingerprint instead of private action strings', () => {
  const guard=new TaskProgressGuard({limits:{maxRepeatedState:99,maxRepeatedAction:2,maxActions:12}});
  const privateText='synthetic-private-value-'+ 'x'.repeat(4000);
  const action={action:'type',ref:'@e1',text:privateText};
  assert.equal(guard.beforeAction(action,'s1').ok,true);
  assert.equal(typeof guard.lastActionKey,'number');
  assert.doesNotMatch(JSON.stringify(guard),/synthetic-private-value/);
  assert.equal(guard.beforeAction(action,'s2').ok,true);
  assert.equal(guard.beforeAction(action,'s3').code,'REPEATED_ACTION_STALL');
});

test('progress guard distinguishes scroll amounts and nonidentical typed content', () => {
  const guard=new TaskProgressGuard({limits:{maxRepeatedState:99,maxRepeatedAction:1,maxActions:10}});
  assert.equal(guard.beforeAction({action:'scroll',direction:'down',amount:100},'s1').ok,true);
  assert.equal(guard.beforeAction({action:'scroll',direction:'down',amount:250},'s2').ok,true);
  assert.equal(guard.beforeAction({action:'type',ref:'@e1',text:'first'},'s3').ok,true);
  assert.equal(guard.beforeAction({action:'type',ref:'@e1',text:'second'},'s4').ok,true);
});
