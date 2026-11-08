import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyActionRisk, gateAction } from '../extension/safety-gate.js';

test('destructive-looking controls require confirmation', () => {
  const risk=classifyActionRisk({action:'click',ref:'@e1'},{name:'Delete 327 messages',role:'button'});
  assert.equal(risk.level,'high');
  const gate=gateAction({action:'click',ref:'@e1'},{name:'Move to Trash',role:'button'},'assist');
  assert.equal(gate.allowed,false);
  assert.equal(gate.confirmationRequired,true);
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
