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

test('quoted MFA, CAPTCHA, and recovery text in mailbox content does not stop the agent', () => {
  for (const phrase of ['Your verification code is 123456', 'Please solve CAPTCHA', 'Account recovery security challenge']) {
    const snapshot = {
      url: 'https://mail.yahoo.com/d/folders/1',
      visibleText: 'Inbox conversation: ' + phrase,
      elements: [{ref:'@e1', role:'link', name:phrase}],
    };
    assert.equal(detectSkillBlocker(snapshot), null, phrase);
  }
});

test('real challenge controls remain blockers inside Yahoo mailbox routes', () => {
  const snapshot = {
    url:'https://mail.yahoo.com/d/folders/1',
    visibleText:'Inbox',
    elements:[{ref:'@e1',role:'textbox',name:'Enter verification code'}],
  };
  assert.equal(detectSkillBlocker(snapshot)?.code,'MFA_REQUIRED');
});

test('login and account-recovery pages continue to request manual handoff', () => {
  assert.equal(detectSkillBlocker({url:'https://mail.yahoo.com/',visibleText:'Account recovery required',elements:[]})?.code,'ACCOUNT_CHALLENGE');
  assert.equal(detectSkillBlocker({url:'https://mail.yahoo.com/',visibleText:'CAPTCHA prove you are human',elements:[]})?.code,'CAPTCHA_REQUIRED');
});
