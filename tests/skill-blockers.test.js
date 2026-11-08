import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSkillBlocker } from '../extension/skill-blockers.js';

test('Yahoo CAPTCHA, MFA and login states trigger human handoff', () => {
  assert.equal(detectSkillBlocker({url:'https://mail.yahoo.com/',visibleText:'Verify you are human CAPTCHA',elements:[]})?.code,'CAPTCHA_REQUIRED');
  assert.equal(detectSkillBlocker({url:'https://mail.yahoo.com/',visibleText:'Enter verification code for two-step verification',elements:[]})?.code,'MFA_REQUIRED');
  assert.equal(detectSkillBlocker({url:'https://mail.yahoo.com/',visibleText:'Sign in Enter your password',elements:[{sensitive:true}]})?.code,'LOGIN_REQUIRED');
});
test('normal Yahoo inbox and unrelated sites do not trigger a blocker', () => {
  assert.equal(detectSkillBlocker({url:'https://mail.yahoo.com/d/folders/1',visibleText:'Inbox 42 messages',elements:[]}),null);
  assert.equal(detectSkillBlocker({url:'https://example.com/',visibleText:'verification code docs',elements:[]}),null);
});
