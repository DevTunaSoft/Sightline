import test from 'node:test';
import assert from 'node:assert/strict';
import { redactForSearch, buildResearchQueries, rankSources, RESEARCH_LIMITS } from '../extension/research-core.js';

test('redaction removes secrets, emails, paths, URLs, IPs and card-like numbers', () => {
  const out = redactForSearch('Login for bob@corp.com at C:\\Users\\bob\\x.txt from 192.168.1.20 password=hunter2 card 4111 1111 1111 1111 see https://intranet.local/a?t=1');
  for (const leaked of ['bob@corp.com', 'C:\\Users', 'hunter2', '192.168.1.20', '4111', 'intranet.local']) {
    assert.equal(out.includes(leaked), false, `leaked ${leaked}`);
  }
  assert.match(out, /see \[redacted-url\]$/);
});

test('redaction removes IPv6 addresses and JWT-shaped tokens', () => {
  const out = redactForSearch('peer 2001:db8::1 token eyJhbGciOiJI.eyJzdWIiOiIxMjM.abcdefghijk');
  assert.equal(out.includes('2001:db8::1'), false);
  assert.equal(out.includes('eyJhbGciOiJI'), false);
});

test('redaction bounds very long input', () => {
  assert.ok(redactForSearch('a'.repeat(100000)).length <= RESEARCH_LIMITS.maxProblemChars);
});

test('queries keep the product and error wording but never raw paths or emails', () => {
  const queries = buildResearchQueries({
    product: 'Sightline',
    problem: 'export not writing to /home/bob/out.xlsx for alice@example.com',
    errorCode: 'WRITE_FAILED',
  });
  assert.ok(queries.length >= 1 && queries.length <= RESEARCH_LIMITS.maxQueries);
  for (const q of queries) {
    assert.match(q, /^Sightline/);
    assert.equal(/\/home\/|@example\.com/.test(q), false);
    assert.ok(q.length <= RESEARCH_LIMITS.maxQueryChars);
  }
  assert.ok(queries.some(q => q.includes('write failed')));
});

test('error codes that are not simple constants are ignored rather than echoed', () => {
  const [first] = buildResearchQueries({ product: 'App', problem: 'broken', errorCode: 'x y; rm -rf' });
  assert.equal(first.includes('rm -rf'), false);
});

test('source ranking prefers vendor docs and forums over other sites', () => {
  const ranked = rankSources([
    { title: 'blog', url: 'https://www.example-blog.net/x' },
    { title: 'docs', url: 'https://learn.microsoft.com/y' },
    { title: 'qa', url: 'https://stackoverflow.com/q' },
    { title: 'bad', url: 'not a url' },
  ]);
  assert.deepEqual(ranked.map(r => r.kind), ['vendor-docs', 'forum', 'other']);
});
