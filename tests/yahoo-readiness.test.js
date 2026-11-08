import test from 'node:test';
import assert from 'node:assert/strict';
import { runYahooReadinessCheck } from '../extension/yahoo-readiness.js';

function chromeFor(snapshot) {
  return {
    tabs:{
      query:async()=>[{id:7,url:snapshot.url,active:true,windowId:1}],
      get:async()=>({id:7,url:snapshot.url,active:true,windowId:1}),
      sendMessage:async(_id,msg)=>{
        if(msg.type==='SIGHTLINE_PING') return {ok:true};
        if(msg.type==='SIGHTLINE_OBSERVE') return {ok:true,snapshot};
        throw new Error('readiness must not execute actions');
      },
    },
    scripting:{executeScript:async()=>{}},
  };
}

test('Yahoo readiness passes signed-in page with visible search control', async () => {
  const snapshot={
    snapshotId:'y1',url:'https://mail.yahoo.com/d/folders/1',title:'Inbox',
    visibleText:'Inbox 42 messages',
    elements:[
      {ref:'@e1',role:'textbox',name:'Search mail',sensitive:false},
      {ref:'@e2',role:'checkbox',name:'Select all messages',sensitive:false},
      {ref:'@e3',role:'button',name:'Move to Trash',sensitive:false},
      {ref:'@e4',role:'link',name:'Amazon order shipped yesterday',sensitive:false},
    ],
  };
  const report=await runYahooReadinessCheck(chromeFor(snapshot));
  assert.equal(report.ok,true);
  assert.equal(report.code,'YAHOO_READINESS_PASS');
  assert.equal(report.summary.visibleCount,42);
  assert.equal(report.checks.find(item=>item.name==='Mail search control visible').ok,true);
});

test('Yahoo readiness refuses unrelated website without acting', async () => {
  const report=await runYahooReadinessCheck(chromeFor({
    snapshotId:'x',url:'https://example.com/',title:'Example',visibleText:'Example',elements:[]
  }));
  assert.equal(report.ok,false);
  assert.equal(report.code,'YAHOO_READINESS_WRONG_SITE');
});

test('Yahoo readiness stops on MFA challenge before declaring ready', async () => {
  const snapshot={
    snapshotId:'mfa',url:'https://mail.yahoo.com/',title:'Verify',
    visibleText:'Enter verification code for two-step verification',
    elements:[{ref:'@e1',role:'textbox',name:'[REDACTED SENSITIVE FIELD]',sensitive:true}],
  };
  const report=await runYahooReadinessCheck(chromeFor(snapshot));
  assert.equal(report.ok,false);
  assert.equal(report.code,'MFA_REQUIRED');
  assert.match(report.checks.at(-1).detail,/MFA_REQUIRED/);
});
