import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticLedger, classifyFailure, sanitizeDiagnosticValue } from '../extension/diagnostics-core.js';

test('diagnostics redact secret-like keys and bound nested collections', () => {
  const value=sanitizeDiagnosticValue({password:'abc',token:'123',safe:'ok',items:Array.from({length:50},(_,i)=>i)});
  assert.equal(value.password,'[REDACTED]'); assert.equal(value.token,'[REDACTED]'); assert.equal(value.safe,'ok'); assert.equal(value.items.length,20);
});
test('failure classifier separates permissions, services, cancellations, and code', () => {
  assert.equal(classifyFailure('Permission denied'),'PERMISSION');
  assert.equal(classifyFailure('Ollama connection timeout'),'EXTERNAL_SERVICE');
  assert.equal(classifyFailure('Task cancelled'),'USER_CANCELLED');
  assert.equal(classifyFailure('stale snapshot'),'CODE');
});
test('diagnostic ledger is hard bounded', () => {
  const ledger=new DiagnosticLedger(10,()=> 't');
  for(let i=0;i<25;i++) ledger.record('x',String(i));
  assert.equal(ledger.export().events.length,10); assert.equal(ledger.export().events[0].message,'15');
});
