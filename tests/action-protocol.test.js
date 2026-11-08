import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAction, ACTION_PROTOCOL_LIMITS } from '../extension/action-protocol.js';

const good = action => { const result=validateAction(action); assert.equal(result.ok,true, result.reason); return result.action; };
const bad = action => assert.equal(validateAction(action).ok,false);

test('accepts bounded typed actions', () => {
  assert.equal(good({action:'click',ref:'@e12'}).ref,'@e12');
  assert.equal(good({action:'type',ref:'@e2',text:'hello'}).replace,true);
  assert.equal(good({action:'scroll',direction:'down',amount:900}).amount,900);
  assert.equal(good({action:'navigate',url:'https://example.com/a'}).url,'https://example.com/a');
});
test('rejects arbitrary code and dangerous navigation schemes', () => {
  bad({action:'executeScript',code:'alert(1)'});
  bad({action:'navigate',url:'javascript:alert(1)'});
  bad({action:'navigate',url:'data:text/html,x'});
});
test('rejects malformed refs, huge text, excessive waits and arbitrary keys', () => {
  bad({action:'click',ref:'#submit'});
  bad({action:'type',ref:'@e1',text:'x'.repeat(ACTION_PROTOCOL_LIMITS.maxText+1)});
  bad({action:'wait',ms:999999});
  bad({action:'pressKey',key:'F12'});
});
