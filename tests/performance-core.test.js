import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFORMANCE_BUDGETS, TimingBook, InferenceGate } from '../extension/performance-core.js';

test('resource budgets encode lightweight architecture constraints', () => {
  assert.equal(PERFORMANCE_BUDGETS.maxSnapshotElements,300); assert.equal(PERFORMANCE_BUDGETS.maxForegroundInference,1); assert.equal(PERFORMANCE_BUDGETS.targetExtensionWorkingSetMb,150);
});
test('timing book bounds samples and summarizes them', async () => {
  let now=0; const book=new TimingBook(()=>now);
  await book.measure('observe',async()=>{now+=7;});
  await book.measure('observe',async()=>{now+=3;});
  assert.deepEqual(book.summary('observe'),{count:2,minMs:3,maxMs:7,avgMs:5});
});
test('inference gate refuses accidental concurrency and releases after failure', async () => {
  const gate=new InferenceGate(1); let release;
  const first=gate.run(()=>new Promise(resolve=>{release=resolve;}));
  await assert.rejects(()=>gate.run(async()=>1),/concurrency budget/);
  release('ok'); assert.equal(await first,'ok');
  await assert.rejects(()=>gate.run(async()=>{throw new Error('boom');}),/boom/); assert.equal(gate.active,0);
});
