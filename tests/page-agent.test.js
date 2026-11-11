import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageAgentController } from '../extension/page-agent.js';

test('controller requires current live snapshot and returns refreshed snapshot after action', async () => {
  let after=false;
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:after?'s2':'s1',elements:after?[]:[{ref:'@e1',name:'Inbox',role:'link'}]}),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{after=true;return {ok:true};}}),
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
  let after=false;
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:after?'s2':'s1',elements:after?[]:[{ref:'@e1',name:'Delete all',role:'button'}]}),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{after=true;return {ok:true};}}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high'}}),
    sleep:async()=>{},
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const blocked=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'}});
  assert.equal(blocked.code,'CONFIRMATION_REQUIRED');
  const wrong=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'},confirmed:true,confirmationKey:'wrong'});
  assert.equal(wrong.code,'CONFIRMATION_REQUIRED');
  const confirmed=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'},confirmed:true,confirmationKey:blocked.confirmationKey});
  assert.equal(confirmed.ok,true);
});


test('confirmed high-impact action must produce a semantic state change', async () => {
  let observes=0;
  const controller=createPageAgentController({
    observe:async()=>{ observes+=1; return {snapshotId:'same',url:'https://example.com',elements:[{ref:'@e1',name:'Delete item',role:'button'}]}; },
    adapterFactory:()=>({hasRef:()=>true,click:async()=>({ok:true})}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high',reason:'destructive'}}),
    sleep:async()=>{},
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const blocked=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'same',action:{action:'click',ref:'@e1'},taskGoal:'delete item'});
  const result=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'same',action:{action:'click',ref:'@e1'},taskGoal:'delete item',confirmed:true,confirmationKey:blocked.confirmationKey});
  assert.equal(result.ok,false);
  assert.equal(result.code,'NO_VERIFIED_EFFECT');
  assert.equal(result.receipt.changed,false);
  assert.ok(observes>=5);
});

test('confirmed high-impact action returns verified changed receipt when page changes', async () => {
  let after=false;
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:after?'after':'before',url:'https://example.com',elements:after?[]:[{ref:'@e1',name:'Delete item',role:'button'}]}),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{after=true;return {ok:true};}}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high',reason:'destructive'}}),
    sleep:async()=>{},
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const blocked=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'before',action:{action:'click',ref:'@e1'},taskGoal:'delete item'});
  const result=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'before',action:{action:'click',ref:'@e1'},taskGoal:'delete item',confirmed:true,confirmationKey:blocked.confirmationKey});
  assert.equal(result.ok,true);
  assert.equal(result.receipt.changed,true);
  assert.equal(result.receipt.beforeSnapshotId,'before');
  assert.equal(result.receipt.afterSnapshotId,'after');
});


test('page change while planner is thinking is rejected before adapter execution', async () => {
  let observations=0, clicks=0;
  const controller=createPageAgentController({
    observe:async()=>{
      observations+=1;
      return observations===1
        ? {snapshotId:'planned',elements:[{ref:'@e1',name:'Old action',role:'button'}]}
        : {snapshotId:'changed',elements:[{ref:'@e1',name:'New action',role:'button'}]};
    },
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{clicks+=1;return {ok:true};}}),
    gate:()=>({allowed:true,confirmationRequired:false,risk:{level:'normal'}}),
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const result=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'planned',action:{action:'click',ref:'@e1'}});
  assert.equal(result.ok,false);
  assert.equal(result.code,'STALE_SNAPSHOT');
  assert.equal(result.snapshot.snapshotId,'changed');
  assert.equal(clicks,0);
});

test('page change while user reviews confirmation invalidates confirmation before click', async () => {
  let changed=false, clicks=0;
  const controller=createPageAgentController({
    observe:async()=>changed
      ? {snapshotId:'changed',elements:[{ref:'@e1',name:'Delete different item',role:'button'}]}
      : {snapshotId:'original',elements:[{ref:'@e1',name:'Delete item',role:'button'}]},
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{clicks+=1;return {ok:true};}}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high',reason:'destructive'}}),
    sleep:async()=>{},
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const request=await controller.handle({
    type:'SIGHTLINE_EXECUTE',snapshotId:'original',action:{action:'click',ref:'@e1'},taskGoal:'delete item'
  });
  assert.equal(request.code,'CONFIRMATION_REQUIRED');
  changed=true;
  const result=await controller.handle({
    type:'SIGHTLINE_EXECUTE',snapshotId:'original',action:{action:'click',ref:'@e1'},
    taskGoal:'delete item',confirmed:true,confirmationKey:request.confirmationKey
  });
  assert.equal(result.ok,false);
  assert.equal(result.code,'STALE_SNAPSHOT');
  assert.equal(clicks,0);
});

test('a ticking clock cannot verify a consequential click', async () => {
  let clock=0, clicks=0;
  const target={ref:'@e1',name:'Delete item',role:'button',state:{}};
  const controller=createPageAgentController({
    observe:async()=>({snapshotId:clock===0?'s1':`s${clock+1}`,url:'https://example.com',
      visibleText:`Clock ${clock++}`,elements:[target]}),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{clicks++;return {ok:true};}}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high'}}),
    sleep:async()=>{},
  });
  // Live snapshot moves once during preflight; reset snapshot identity to keep
  // the preflight valid and vary only the post-action text.
  const first=await controller.handle({type:'SIGHTLINE_OBSERVE'});
  assert.equal(first.snapshot.snapshotId,'s1');
  const approval=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'s1',action:{action:'click',ref:'@e1'}});
  assert.equal(approval.code,'STALE_SNAPSHOT');
  assert.equal(clicks,0);
});

test('unrelated text changes after an approved click are not verified', async () => {
  let changed=false;
  let clock=0;
  const target={ref:'@e1',name:'Delete item',role:'button',state:{}};
  const controller=createPageAgentController({
    observe:async()=>({
      snapshotId:changed?`clock-${++clock}`:'before',
      url:'https://example.com',
      visibleText:changed?`Clock ${clock}`:'Clock 0',
      elements:[target],
    }),
    adapterFactory:()=>({hasRef:()=>true,click:async()=>{changed=true;return {ok:true};}}),
    gate:()=>({allowed:false,confirmationRequired:true,risk:{level:'high'}}),
    sleep:async()=>{},
  });
  await controller.handle({type:'SIGHTLINE_OBSERVE'});
  const request=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'before',action:{action:'click',ref:'@e1'},taskGoal:'delete'});
  assert.equal(request.code,'CONFIRMATION_REQUIRED');
  const result=await controller.handle({type:'SIGHTLINE_EXECUTE',snapshotId:'before',action:{action:'click',ref:'@e1'},taskGoal:'delete',confirmed:true,confirmationKey:request.confirmationKey});
  assert.equal(result.ok,false);
  assert.equal(result.code,'NO_VERIFIED_EFFECT');
  assert.equal(result.receipt.changed,false);
});
