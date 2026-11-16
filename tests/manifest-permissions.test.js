// Pins the extension's permissions. The permission list and the host list must change only
// with an explicit operator decision recorded in docs/DECISIONS.md (ADR-011 for the fixture host).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

test('the permission list is exactly the allowlist (S-18)', () => {
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ['activeTab', 'debugger', 'scripting', 'sidePanel', 'storage'],
  );
});

test('host access is limited to the local model and the acceptance fixture (ADR-011)', () => {
  assert.deepEqual(
    [...manifest.host_permissions].sort(),
    ['http://127.0.0.1:11434/*', 'http://127.0.0.1:8765/*', 'http://localhost:11434/*'],
  );
});

test('no wildcard or all-URL host access is ever granted', () => {
  const text = JSON.stringify(manifest);
  assert.equal(text.includes('<all_urls>'), false);
  assert.equal(manifest.host_permissions.some(host => host.includes('*://*') || host === 'http://*/*' || host === 'https://*/*'), false);
});
