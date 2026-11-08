import test from 'node:test';
import assert from 'node:assert/strict';
import { runBrowserTask } from '../extension/browser-task-runner.js';

function fakeChrome() {
  let state=0;
  return {
    tabs:{
      query:async()=>[{id:1,url:'https://example.com'}],
      sendMessage:async(_id,msg)=>{
        if(msg.type==='SIGHTLINE_PING') return {ok:true};
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot:{snapshotId:`s${state}`,url:'https://example.com',elements:[{ref:'@e1',role:'button',name:'Next',sensitive:false}]}};
        if(msg.type==='SIGHTLINE_EXECUTE') { state+=1; return {ok:true,receipt:{ok:true},snapshot:{snapshotId:`s${state}`,url:'https://example.com',elements:[{ref:'@e1',role:'button',name:'Next',sensitive:false}]}}; }
      }
    }, scripting:{executeScript:async()=>{}},
  };
}

test('browser task runner can complete a local planned action loop', async () => {
  let plans=0;
  const fetchImpl=async()=>new Response(JSON.stringify({message:{content: plans++===0 ? '{"done":false,"action":{"action":"click","ref":"@e1"}}' : '{"done":true,"result":"done"}'}}),{status:200});
  const result=await runBrowserTask({goal:'do it',model:'gemma3:4b',chromeApi:fakeChrome(),fetchImpl,limits:{maxActions:5,maxRepeatedAction:5,maxRepeatedState:5}});
  assert.equal(result.ok,true); assert.equal(result.result,'done'); assert.equal(result.timeline.length,1);
});

test('browser task runner recovers from stale snapshot and replans', async () => {
  let executeCount=0, planCount=0;
  const chromeApi={
    tabs:{
      query:async()=>[{id:1,url:'https://example.com'}],
      sendMessage:async(_id,msg)=>{
        if(msg.type==='SIGHTLINE_PING') return {ok:true};
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot:{snapshotId:'s1',url:'https://example.com',elements:[{ref:'@e1',role:'button',name:'Next',sensitive:false}]}};
        if(msg.type==='SIGHTLINE_EXECUTE') {
          executeCount+=1;
          if(executeCount===1) return {ok:false,code:'STALE_SNAPSHOT',snapshot:{snapshotId:'s2',url:'https://example.com',elements:[{ref:'@e2',role:'button',name:'Next',sensitive:false}]}};
          return {ok:true,receipt:{ok:true},snapshot:{snapshotId:'s3',url:'https://example.com',elements:[]}};
        }
      }
    }, scripting:{executeScript:async()=>{}},
  };
  const fetchImpl=async()=>new Response(JSON.stringify({message:{content:
    planCount++===0 ? '{"done":false,"action":{"action":"click","ref":"@e1"}}' :
    planCount===2 ? '{"done":false,"action":{"action":"click","ref":"@e2"}}' :
    '{"done":true,"result":"recovered"}'
  }}),{status:200});
  const events=[];
  const result=await runBrowserTask({goal:'continue',model:'gemma3:4b',chromeApi,fetchImpl,onProgress:e=>events.push(e),limits:{maxActions:5,maxRepeatedAction:5,maxRepeatedState:5}});
  assert.equal(result.ok,true); assert.equal(result.result,'recovered'); assert.ok(events.some(e=>e.type==='recovered'&&e.code==='STALE_SNAPSHOT'));
});

test('Yahoo authentication blocker returns structured failure before planner runs', async () => {
  let planned=false;
  const chromeApi={
    tabs:{
      query:async()=>[{id:1,url:'https://mail.yahoo.com/'}],
      sendMessage:async(_id,msg)=>{
        if(msg.type==='SIGHTLINE_PING') return {ok:true};
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot:{snapshotId:'s1',url:'https://mail.yahoo.com/',visibleText:'Enter verification code for two-step verification',elements:[]}};
      }
    }, scripting:{executeScript:async()=>{}},
  };
  const result=await runBrowserTask({goal:'open inbox',model:'gemma3:4b',chromeApi,fetchImpl:async()=>{planned=true;throw new Error('should not plan');}});
  assert.equal(result.ok,false); assert.equal(result.code,'MFA_REQUIRED'); assert.equal(planned,false);
});
