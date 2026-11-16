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
test('permanent deletion is blocked unless original task explicitly asks for irreversible deletion', () => {
  const action={action:'click',ref:'@e9'};
  const target={name:'Empty Trash',role:'button'};
  const ordinary=gateAction(action,target,'assist',{taskGoal:'Delete old Amazon emails'});
  assert.equal(ordinary.allowed,false); assert.equal(ordinary.confirmationRequired,false); assert.equal(ordinary.risk.level,'blocked');
  const explicit=gateAction(action,target,'assist',{taskGoal:'Empty Trash permanently'});
  assert.equal(explicit.allowed,false); assert.equal(explicit.confirmationRequired,true); assert.equal(explicit.risk.level,'critical');
});
test('confirmation key is also bound to original task authorization context', () => {
  const action={action:'click',ref:'@e9'}, target={ref:'@e9',name:'Empty Trash',role:'button'};
  const a=actionConfirmationKey('s1',action,target,{taskGoal:'Empty Trash permanently'});
  const b=actionConfirmationKey('s1',action,target,{taskGoal:'Delete old mail'});
  assert.notEqual(a,b);
});


test('cross-origin link clicks require confirmation using origin-only target state', () => {
  const action={action:'click',ref:'@e1'};
  const target={ref:'@e1',role:'link',name:'Continue',state:{hrefOrigin:'https://example.org'}};
  const risk=classifyActionRisk(action,target,{currentUrl:'https://mail.yahoo.com/inbox'});
  assert.equal(risk.level,'high');
  assert.equal(gateAction(action,target,'assist',{currentUrl:'https://mail.yahoo.com/inbox'}).confirmationRequired,true);
});


test('destructive-looking same-origin navigation requires confirmation', () => {
  const context={currentUrl:'https://example.com/account'};
  assert.equal(
    classifyActionRisk({action:'navigate',url:'https://example.com/account/delete'}, {}, context).level,
    'high'
  );
  assert.equal(
    classifyActionRisk({action:'navigate',url:'https://example.com/settings?action=delete'}, {}, context).level,
    'high'
  );
  assert.equal(
    classifyActionRisk({action:'navigate',url:'https://example.com/account/profile'}, {}, context).level,
    'normal'
  );
});


test('session and mail-abuse controls are consequential', () => {
  for (const name of ['Sign out','Log out','Block sender','Report spam']) {
    const gate=gateAction({action:'click',ref:'@e1'},{name,role:'button'},'assist');
    assert.equal(gate.allowed,false,name);
    assert.equal(gate.confirmationRequired,true,name);
  }
});

test('sensitive-field actions cannot be authorized by confirmation', () => {
  for(const action of ['read','type','clear','verify','select','check','uncheck','click']) {
    const risk=classifyActionRisk({action,ref:'@e1'},{sensitive:true});
    assert.equal(risk.level,'blocked',action);
    const gate=gateAction({action,ref:'@e1'},{sensitive:true},'autonomous');
    assert.equal(gate.allowed,false,action);
    assert.equal(gate.confirmationRequired,false,action);
  }
  assert.equal(classifyActionRisk({action:'pressKey',key:'Enter'},{sensitive:true}).level,'blocked');
});
test('key handlers with meaningful side effects require approval', () => {
  for(const key of ['Enter','Backspace','Delete']) {
    const gate=gateAction({action:'pressKey',key},{},'autonomous');
    assert.equal(gate.allowed,false,key);
    assert.equal(gate.confirmationRequired,true,key);
  }
});
test('expanded destructive labels require confirmation', () => {
  for(const name of ['Discard','Deactivate','Disable','Revoke','Reset','Overwrite','Cancel subscription','Clear all']) {
    assert.equal(classifyActionRisk({action:'click',ref:'@e1'},{name,role:'button'}).level,'high',name);
  }
});
