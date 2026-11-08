import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupportedPageUrl, observeActiveTab, observeTab } from '../extension/browser-bridge.js';

test('bridge rejects privileged/non-web URLs', () => {
  assert.equal(isSupportedPageUrl('https://example.com'),true);
  assert.equal(isSupportedPageUrl('http://localhost:3000'),true);
  assert.equal(isSupportedPageUrl('chrome://settings'),false);
  assert.equal(isSupportedPageUrl('file:///tmp/a'),false);
  assert.equal(isSupportedPageUrl('javascript:alert(1)'),false);
});
test('bridge injects agent when absent then observes active tab', async () => {
  let injected=0, pings=0;
  const chromeApi={
    tabs:{
      query:async()=>[{id:7,url:'https://example.com'}],
      sendMessage:async(_id,message)=>{
        if(message.type==='SIGHTLINE_PING') { pings+=1; if(pings===1) throw new Error('no receiver'); return {ok:true}; }
        if(message.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot:{snapshotId:'s1'}};
      }
    },
    scripting:{executeScript:async()=>{injected+=1;}},
  };
  const result=await observeActiveTab(chromeApi);
  assert.equal(injected,1); assert.equal(result.tabId,7); assert.equal(result.snapshot.snapshotId,'s1');
});


test('observeTab stays on requested tab even when another tab becomes active', async () => {
  const sent=[];
  const chromeApi={
    tabs:{
      get:async id=>({id,url:id===7?'https://mail.yahoo.com/':'https://example.com/'}),
      query:async()=>[{id:99,url:'https://example.com/'}],
      sendMessage:async(id,message)=>{ sent.push([id,message.type]); if(message.type==='SIGHTLINE_PING') return {ok:true}; return {ok:true,snapshot:{snapshotId:'s1',elements:[]}}; },
    },
    scripting:{executeScript:async()=>{}},
  };
  const result=await observeTab(7,chromeApi);
  assert.equal(result.tabId,7);
  assert.ok(sent.every(([id])=>id===7));
});
