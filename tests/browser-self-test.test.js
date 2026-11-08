import test from 'node:test';
import assert from 'node:assert/strict';
import { runBrowserAcceptanceSelfTest } from '../extension/browser-self-test.js';

function fixtureSnapshot(id, visibleText = 'Ready. 3 synthetic messages.') {
  return {
    snapshotId:id,
    url:'http://127.0.0.1:8765/',
    title:'Sightline Browser Agent Fixture',
    visibleText,
    frames:{total:2,sameOrigin:1,opaque:1,origins:['http://127.0.0.1:8765','https://example.org']},
    elements:[
      {ref:'@e1',role:'textbox',name:'Search',sensitive:false,state:{valueLength:0}},
      {ref:'@e2',role:'button',name:'Search',sensitive:false,state:{}},
      {ref:'@e3',role:'textbox',name:'Frame search',sensitive:false,state:{valueLength:0},frame:{path:'top/f1',depth:1,origin:'http://127.0.0.1:8765'}},
      {ref:'@e4',role:'button',name:'Frame action',sensitive:false,state:{},frame:{path:'top/f1',depth:1,origin:'http://127.0.0.1:8765'}},
      {ref:'@e5',role:'button',name:'Move selected messages to Trash',sensitive:false,state:{}},
      {ref:'@e6',role:'link',name:'External test link',sensitive:false,state:{hrefOrigin:'https://example.org'}},
      {ref:'@e7',role:'textbox',name:'[REDACTED SENSITIVE FIELD]',sensitive:true,state:{}},
      {ref:'@e8',role:'textbox',name:'[REDACTED SENSITIVE FIELD]',sensitive:true,state:{}},
    ],
  };
}

test('browser acceptance self-test exercises deterministic extension path', async () => {
  let snapshot=fixtureSnapshot('s0');
  let actionCount=0;
  const chromeApi={
    tabs:{
      query:async()=>[{id:7,url:snapshot.url,active:true,windowId:1}],
      get:async()=>({id:7,url:snapshot.url,active:true,windowId:1}),
      sendMessage:async(_id,msg)=>{
        if(msg.type==='SIGHTLINE_PING') return {ok:true};
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot};
        if(msg.type!=='SIGHTLINE_EXECUTE') throw new Error('unexpected message');
        actionCount+=1;
        if(msg.action.ref==='@e5' || msg.action.ref==='@e6') {
          return {ok:false,code:'CONFIRMATION_REQUIRED',risk:{level:'high'},confirmationKey:'k'};
        }
        if(msg.action.action==='type' && msg.action.ref==='@e1') {
          snapshot={...fixtureSnapshot('s1'),elements:fixtureSnapshot('s1').elements.map(e=>e.ref==='@e1'?{...e,state:{valueLength:20}}:e)};
          return {ok:true,receipt:{ok:true,changed:true},snapshot};
        }
        if(msg.action.action==='click' && msg.action.ref==='@e2') {
          snapshot=fixtureSnapshot('s2','Search results for: sightline acceptance Ready. 3 synthetic messages.');
          return {ok:true,receipt:{ok:true,changed:true},snapshot};
        }
        if(msg.action.action==='type' && msg.action.ref==='@e3') {
          snapshot=fixtureSnapshot('s3','Search results for: sightline acceptance Ready. 3 synthetic messages.');
          return {ok:true,receipt:{ok:true,changed:true},snapshot};
        }
        if(msg.action.action==='click' && msg.action.ref==='@e4') {
          snapshot=fixtureSnapshot('s4','Search results for: sightline acceptance Frame action completed: inside frame');
          return {ok:true,receipt:{ok:true,changed:true},snapshot};
        }
        throw new Error('unexpected action');
      },
    },
    scripting:{executeScript:async()=>{}},
  };
  const report=await runBrowserAcceptanceSelfTest(chromeApi);
  assert.equal(report.ok,true);
  assert.equal(report.code,'SELF_TEST_PASS');
  assert.ok(report.checks.length>=12);
  assert.ok(report.checks.every(check=>check.ok));
  assert.equal(actionCount,6);
});

test('browser acceptance self-test refuses non-fixture websites before acting', async () => {
  let executeCalls=0;
  const chromeApi={
    tabs:{
      query:async()=>[{id:7,url:'https://example.com/',active:true,windowId:1}],
      get:async()=>({id:7,url:'https://example.com/',active:true,windowId:1}),
      sendMessage:async(_id,msg)=>{
        if(msg.type==='SIGHTLINE_PING') return {ok:true};
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot:{snapshotId:'x',url:'https://example.com/',title:'Example',elements:[]}};
        executeCalls+=1;
        return {ok:true};
      },
    },
    scripting:{executeScript:async()=>{}},
  };
  const report=await runBrowserAcceptanceSelfTest(chromeApi);
  assert.equal(report.ok,false);
  assert.equal(report.code,'SELF_TEST_WRONG_PAGE');
  assert.equal(executeCalls,0);
});
