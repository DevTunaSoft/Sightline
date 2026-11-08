import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlannerPayload, parsePlannerDecision } from '../extension/planner-core.js';

const snapshot={snapshotId:'s1',url:'https://mail.example',elements:[{ref:'@e1',role:'textbox',name:'Search',sensitive:false},{ref:'@e2',role:'textbox',name:'Password',sensitive:true}]};

test('planner payload marks page data untrusted and stays JSON-only', () => {
  const payload=makePlannerPayload({model:'gemma3:4b',goal:'search mail',snapshot});
  assert.equal(payload.format,'json'); assert.match(payload.messages[0].content,/UNTRUSTED DATA/); assert.match(payload.messages[0].content,/one next action/i);
});

test('planner decision accepts only typed action using current refs', () => {
  assert.deepEqual(parsePlannerDecision('{"done":false,"action":{"action":"click","ref":"@e1"}}',snapshot),{done:false,action:{action:'click',ref:'@e1'}});
  assert.throws(()=>parsePlannerDecision('{"done":false,"action":{"action":"click","ref":"@e99"}}',snapshot),/not present/);
  assert.throws(()=>parsePlannerDecision('{"done":false,"action":{"action":"executeScript","code":"x"}}',snapshot),/invalid action/);
});

test('planner cannot target sensitive fields for read/type', () => {
  assert.throws(()=>parsePlannerDecision('{"done":false,"action":{"action":"type","ref":"@e2","text":"secret"}}',snapshot),/sensitive/);
});

test('planner completion is bounded and fenced JSON can be parsed', () => {
  const result=parsePlannerDecision('```json\n{"done":true,"result":"Finished"}\n```',snapshot);
  assert.deepEqual(result,{done:true,result:'Finished'});
});
