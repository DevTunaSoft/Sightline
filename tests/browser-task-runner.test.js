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
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot:{snapshotId:`s${state}`,elements:[{ref:'@e1',role:'button',name:'Next',sensitive:false}]}};
        if(msg.type==='SIGHTLINE_EXECUTE') { state+=1; return {ok:true,receipt:{ok:true},snapshot:{snapshotId:`s${state}`,elements:[{ref:'@e1',role:'button',name:'Next',sensitive:false}]}}; }
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
