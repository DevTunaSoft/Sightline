import test from 'node:test';
import assert from 'node:assert/strict';
import { executeValidatedAction } from '../extension/action-executor-core.js';
import { runTaskLoop } from '../extension/task-loop-core.js';

test('executor rejects stale refs before invoking adapter', async () => {
  let called=false;
  const adapter={hasRef:()=>false,click:async()=>{called=true;return {ok:true};}};
  const result=await executeValidatedAction({action:'click',ref:'@e1'},adapter);
  assert.equal(result.ok,false);
  assert.equal(result.code,'STALE_REF');
  assert.equal(called,false);
});
test('executor returns structured action receipt', async () => {
  const adapter={hasRef:()=>true,click:async action=>({ok:true,ref:action.ref,changed:true})};
  const result=await executeValidatedAction({action:'click',ref:'@e3'},adapter);
  assert.equal(result.ok,true);
  assert.equal(result.action,'click');
  assert.equal(result.ref,'@e3');
  assert.equal(result.changed,true);
  assert.match(result.timestamp,/T/);
});
test('executor surfaces adapter failure without throwing', async () => {
  const adapter={hasRef:()=>true,type:async()=>{throw new Error('boom');}};
  const result=await executeValidatedAction({action:'type',ref:'@e2',text:'x'},adapter);
  assert.equal(result.ok,false);
  assert.equal(result.code,'UNKNOWN_EFFECT');
});
test('executor honors abort before dispatch', async () => {
  const controller=new AbortController();
  controller.abort();
  const result=await executeValidatedAction({action:'wait',ms:10},{wait:async()=>({ok:true})},controller.signal);
  assert.equal(result.ok,false);
  assert.equal(result.code,'ABORTED');
});

test('a side effect interrupted after dispatch is unknown, never safe to repeat', async () => {
  const controller=new AbortController();
  let calls=0;
  const adapter={hasRef:()=>true,click:async()=>{calls++;controller.abort();return {ok:true};}};
  const result=await executeValidatedAction({action:'click',ref:'@e1'},adapter,controller.signal);
  assert.equal(calls,1);
  assert.equal(result.ok,false);
  assert.equal(result.code,'UNKNOWN_EFFECT');
});

test('mutation exceptions cannot leak private field values to action receipts', async () => {
  const secret='synthetic-secret-93471';
  const adapter={hasRef:()=>true,type:async()=>{throw new Error(secret);}};
  const result=await executeValidatedAction({action:'type',ref:'@e1',text:secret},adapter);
  assert.equal(result.ok,false);
  assert.equal(result.code,'UNKNOWN_EFFECT');
  assert.doesNotMatch(JSON.stringify(result),/synthetic-secret-93471/);
});

test('read-only failures retain ordinary execution error semantics', async () => {
  const result=await executeValidatedAction(
    {action:'read',ref:'@e1'},
    {hasRef:()=>true,read:async()=>{throw new Error('synthetic private text');}});
  assert.equal(result.ok,false);
  assert.equal(result.code,'EXECUTION_ERROR');
  assert.doesNotMatch(JSON.stringify(result),/synthetic private text/);
});

test('cancellation during wait remains a safe aborted result', async () => {
  const controller=new AbortController();
  const result=await executeValidatedAction(
    {action:'wait',ms:5},
    {wait:async()=>{controller.abort();return {ok:false,code:'ABORTED'};}},
    controller.signal);
  assert.equal(result.code,'ABORTED');
});

test('mutating adapter exception survives write-ahead checkpoint and cannot replay on resume', async () => {
  const checkpoints=[];
  let clicks=0;
  const deps={
    goal:'delete synthetic item',
    observe:async()=>({snapshotId:'snap-1'}),
    plan:async()=>({action:{action:'click',ref:'@e1'}}),
    execute:action=>executeValidatedAction(action,{hasRef:()=>true,click:async()=>{
      clicks++;
      throw new Error('provider disconnected after click');
    }}),
    verify:async()=>({ok:true}),
    onCheckpoint:async state=>{checkpoints.push(JSON.parse(JSON.stringify(state)));},
  };
  const result=await runTaskLoop(deps);
  assert.equal(result.code,'UNKNOWN_EFFECT');
  assert.equal(clicks,1);
  assert.equal(result.timeline.at(-1).receipt.code,'UNKNOWN_EFFECT');
  assert.equal(checkpoints.at(-1).timeline.at(-1).receipt.code,'UNKNOWN_EFFECT');
  const resumed=await runTaskLoop({...deps,resume:checkpoints.at(-1)});
  assert.equal(resumed.code,'ACTION_RECONCILIATION_REQUIRED');
  assert.equal(clicks,1);
});
