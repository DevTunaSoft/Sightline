import test from 'node:test';
import assert from 'node:assert/strict';
import { executeValidatedAction } from '../extension/action-executor-core.js';

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
  assert.equal(result.code,'EXECUTION_ERROR');
});
test('executor honors abort before dispatch', async () => {
  const controller=new AbortController();
  controller.abort();
  const result=await executeValidatedAction({action:'wait',ms:10},{wait:async()=>({ok:true})},controller.signal);
  assert.equal(result.ok,false);
  assert.equal(result.code,'ABORTED');
});
