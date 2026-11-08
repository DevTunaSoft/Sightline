import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageAgentController } from '../extension/page-agent.js';

test('controller requires current snapshot and returns refreshed snapshot after action', async () => {
  let n=0;
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:`s${++n}`,elements:[{ref:'@e1',name:'Inbox',role:'link'}]}),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>({ok:true})}),
    gate:()=>({allowed:true,confirmationRequired:false,risk:{level:'normal'}}),
  });
  const observed=await controller.handle({type:'SIGHTLINE_OBSERVE'});
  assert.equal(observed.snapshot.snapshotId,'s1');
  const result=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'}});
  assert.equal(result.ok,true); assert.equal(result.snapshot.snapshotId,'s2');
});
test('controller rejects stale snapshot before action', async () => {
  let called=false;
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:'new',elements:[]}),
    adapterFactory:()=>({click:async()=>{called=true;return {ok:true};}}),
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const result=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'old',action:{action:'click',ref:'@e1'}});
  assert.equal(result.ok,false); assert.equal(result.code,'STALE_SNAPSHOT'); assert.equal(called,false);
});
test('controller returns confirmation requirement and executes only after explicit confirmation', async () => {
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:'s1',elements:[{ref:'@e1',name:'Delete all',role:'button'}]}),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>({ok:true})}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high'}}),
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const blocked=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'}});
  assert.equal(blocked.code,'CONFIRMATION_REQUIRED');
  const confirmed=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'},confirmed:true});
  assert.equal(confirmed.ok,true);
});
