import test from 'node:test';
import assert from 'node:assert/strict';
import { skillForUrl, skillPlannerContext, listSkills } from '../extension/skill-registry.js';

test('Yahoo Mail skill is scoped only to Yahoo Mail host', () => {
  assert.equal(skillForUrl('https://mail.yahoo.com/d/folders/1')?.id,'yahoo-mail');
  assert.equal(skillForUrl('https://example.com/?next=mail.yahoo.com'),null);
  assert.equal(skillForUrl('https://evilmail.yahoo.com'),null);
});
test('planner context is compact and contains no credentials', () => {
  const context=skillPlannerContext('https://mail.yahoo.com/d/folders/1');
  assert.equal(context.id,'yahoo-mail'); assert.match(context.guidance.join(' '),/Never request/); assert.equal('password' in context,false);
});
test('skill registry exposes stable metadata only', () => {
  assert.deepEqual(listSkills(),[{id:'yahoo-mail',name:'Yahoo Mail',version:1,domain:'mail.yahoo.com'}]);
});
