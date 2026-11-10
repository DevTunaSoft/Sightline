import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupportedPageUrl, observeActiveTab, observeTab, getTaskTab, captureTaskTabFrame } from '../extension/browser-bridge.js';

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


test('closed task tab is classified as TASK_TAB_UNAVAILABLE', async () => {
  const chromeApi={
    tabs:{ get:async()=>{ throw new Error('No tab with id: 77'); } },
  };
  await assert.rejects(
    ()=>getTaskTab(77,chromeApi),
    error=>error?.code==='TASK_TAB_UNAVAILABLE' && /no longer available/i.test(error.message)
  );
});


test('vision capture refuses a task tab that is not currently visible', async () => {
  let captures=0;
  const chromeApi={
    tabs:{
      get:async()=>({id:7,url:'https://example.com/',active:false,windowId:1}),
      captureVisibleTab:async()=>{ captures+=1; return 'data:image/jpeg;base64,AAAA'; },
    },
  };
  await assert.rejects(
    ()=>captureTaskTabFrame(7,chromeApi),
    error=>error?.code==='VISION_TAB_NOT_ACTIVE'
  );
  assert.equal(captures,0);
});

test('vision capture returns base64 only for the exact active task tab', async () => {
  const chromeApi={
    tabs:{
      get:async()=>({id:7,url:'https://example.com/',active:true,windowId:4}),
      captureVisibleTab:async(windowId,options)=>{
        assert.equal(windowId,4);
        assert.equal(options.format,'jpeg');
        return 'data:image/jpeg;base64,QUJD';
      },
    },
  };
  const result=await captureTaskTabFrame(7,chromeApi);
  assert.deepEqual(result,{tabId:7,imageBase64:'QUJD'});
});

test('bridge rejects non-web schemes without needing a blacklist', () => {
  for(const url of ['edge://settings','about:blank','chrome-extension://abc/index.html','data:text/html,hi']) {
    assert.equal(isSupportedPageUrl(url),false,url);
  }
});

test('bootstrap tolerates a slower module import without injecting twice', async () => {
  let pingCount=0, injected=0;
  const chromeApi={
    tabs:{
      get:async id=>({id,url:'https://example.com/'}),
      sendMessage:async()=> {
        pingCount++;
        if(pingCount<5) throw new Error('bootstrap not ready');
        return {ok:true};
      },
    },
    scripting:{executeScript:async()=>{injected++;}},
  };
  const { ensurePageAgent } = await import('../extension/browser-bridge.js');
  const result=await ensurePageAgent(7,chromeApi);
  assert.equal(result.ok,true);
  assert.equal(injected,1);
  assert.equal(pingCount,5);
});
