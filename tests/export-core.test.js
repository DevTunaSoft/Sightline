import test from 'node:test';
import assert from 'node:assert/strict';
import { extractIpAddresses, buildXlsxBytes, buildZip, crc32, xmlEscape, EXPORT_LIMITS } from '../extension/export-core.js';

// Independent ZIP reader (central directory walk) used to verify output.
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  assert.ok(eocd >= 0, 'end of central directory present');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = {};
  for (let n = 0; n < count; n++) {
    assert.equal(view.getUint32(p, true), 0x02014b50);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    assert.equal(method, 0, 'stored entries');
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc, `crc matches for ${name}`);
    entries[name] = decoder.decode(data);
    p += 46 + nameLen;
  }
  return entries;
}

test('extracts IPv4 and IPv6, rejects times and out-of-range values, dedupes in page order', () => {
  const result = extractIpAddresses(
    'Host 10.0.0.1, again 10.0.0.1. v6 2001:db8::1 at 12:30:45, bad 256.1.1.1, end 1.2.3.4.');
  assert.deepEqual(result.addresses.map(a => a.address), ['10.0.0.1', '2001:db8::1', '1.2.3.4']);
  assert.equal(result.addresses[1].kind, 'IPv6');
  assert.equal(result.truncated, false);
});

test('IPv6 validator accepts full and compressed forms and rejects malformed ones', () => {
  const found = extractIpAddresses('a 2001:0db8:0000:0000:0000:ff00:0042:8329 b fe80::1 c 1:2:3:4:5:6:7:8:9 d :::1').addresses.map(a => a.address);
  assert.deepEqual(found, ['2001:0db8:0000:0000:0000:ff00:0042:8329', 'fe80::1']);
});

test('input and address counts are bounded', () => {
  const long = 'x'.repeat(EXPORT_LIMITS.maxInputChars) + ' 10.0.0.9';
  assert.equal(extractIpAddresses(long).addresses.length, 0);
  assert.equal(extractIpAddresses(long).truncated, true);
  const many = Array.from({ length: 30 }, (_, i) => `10.0.0.${i}`).join(' ');
  const capped = extractIpAddresses(many, { ...EXPORT_LIMITS, maxAddresses: 5 });
  assert.equal(capped.addresses.length, 5);
  assert.equal(capped.capped, true);
});

test('xlsx package has the parts Excel requires and the cell values round-trip', () => {
  const bytes = buildXlsxBytes([['IP', 'Kind'], ['10.0.0.1', 'IPv4'], [42, 'a & <b>']]);
  const parts = readZip(bytes);
  assert.deepEqual(Object.keys(parts).sort(), [
    '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
  ]);
  const sheet = parts['xl/worksheets/sheet1.xml'];
  assert.match(sheet, /<c r="A2" t="inlineStr"><is><t xml:space="preserve">10\.0\.0\.1<\/t><\/is><\/c>/);
  assert.match(sheet, /<c r="A3"><v>42<\/v><\/c>/);
  assert.match(sheet, /a &amp; &lt;b&gt;/);
});

test('xml escaping strips control characters and escapes markup', () => {
  assert.equal(xmlEscape('a\u0001b<"\'&>'), 'ab&lt;&quot;&apos;&amp;&gt;');
});

test('zip writer rejects nothing valid and computes CRC-32 correctly', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const entries = readZip(buildZip([{ name: 'a.txt', data: 'hello' }, { name: 'b.txt', data: 'world' }]));
  assert.deepEqual(entries, { 'a.txt': 'hello', 'b.txt': 'world' });
});

