import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyActionRisk, gateAction, actionConfirmationKey } from '../extension/safety-gate.js';

test('destructive-looking controls require confirmation', () => {
  const risk=classifyActionRisk({action:'click',ref:'@e1'},{name:'Delete 327 messages',role:'button'});
  assert.equal(risk.level,'high');
  const gate=gateAction({action:'click',ref:'@e1'},{name:'Move to Trash',role:'button'},'assist');
  assert.equal(gate.allowed,false); assert.equal(gate.confirmationRequired,true);
});
test('sensitive fields are blocked from autonomous read/type', () => {
  assert.equal(classifyActionRisk({action:'read',ref:'@e2'},{sensitive:true}).level,'blocked');
  assert.equal(classifyActionRisk({action:'type',ref:'@e2'},{sensitive:true}).level,'blocked');
});
test('ordinary controls are allowed in assist mode but not observe mode', () => {
  const action={action:'click',ref:'@e1'}, target={name:'Inbox',role:'link'};
  assert.equal(gateAction(action,target,'assist').allowed,true);
  assert.equal(gateAction(action,target,'observe').allowed,false);
});
test('cross-origin navigation requires confirmation while same-origin navigation does not', () => {
  const context={currentUrl:'https://mail.yahoo.com/d/folders/1'};
  assert.equal(classifyActionRisk({action:'navigate',url:'https://mail.yahoo.com/d/search'}, {}, context).level,'normal');
  assert.equal(classifyActionRisk({action:'navigate',url:'https://example.com/'}, {}, context).level,'high');
});
test('confirmation keys bind snapshot, action, and target', () => {
  const a=actionConfirmationKey('s1',{action:'click',ref:'@e1'},{ref:'@e1',name:'Delete',role:'button'});
  assert.equal(a,actionConfirmationKey('s1',{action:'click',ref:'@e1'},{ref:'@e1',name:'Delete',role:'button'}));
  assert.notEqual(a,actionConfirmationKey('s2',{action:'click',ref:'@e1'},{ref:'@e1',name:'Delete',role:'button'}));
  assert.notEqual(a,actionConfirmationKey('s1',{action:'click',ref:'@e2'},{ref:'@e2',name:'Delete',role:'button'}));
});
