// Deterministic data extraction and spreadsheet export.
// No dependencies: the .xlsx writer emits a standard OOXML package in a
// ZIP container using the STORE method (no compression).

export const EXPORT_LIMITS = Object.freeze({
  maxInputChars: 200000,
  maxAddresses: 5000,
  maxRows: 100000,
  maxCellChars: 32767,
});

const IPV4 = /(?<![\d.])((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})(?![\d])(?!\.\d)/g;
const IPV6_CANDIDATE = /(?<![0-9A-Fa-f:.])[0-9A-Fa-f:]{2,39}(?![0-9A-Fa-f:])/g;

function isValidIPv6(text) {
  if (!text.includes(':')) return false;
  const doubleColon = text.split('::');
  if (doubleColon.length > 2) return false;
  const groupOk = g => /^[0-9A-Fa-f]{1,4}$/.test(g);
  if (doubleColon.length === 2) {
    const left = doubleColon[0] ? doubleColon[0].split(':') : [];
    const right = doubleColon[1] ? doubleColon[1].split(':') : [];
    return left.length + right.length <= 7 && left.every(groupOk) && right.every(groupOk);
  }
  const groups = text.split(':');
  return groups.length === 8 && groups.every(groupOk);
}

// Returns IP addresses in first-seen order, deduplicated and bounded.
export function extractIpAddresses(text, limits = EXPORT_LIMITS) {
  const source = String(text ?? '');
  const truncated = source.length > limits.maxInputChars;
  const input = truncated ? source.slice(0, limits.maxInputChars) : source;
  const found = new Map();
  const add = (address, kind) => {
    if (found.size >= limits.maxAddresses || found.has(address)) return;
    found.set(address, kind);
  };
  // Collect with positions so IPv4 and IPv6 results keep page order.
  const hits = [];
  for (const m of input.matchAll(IPV4)) hits.push({ index: m.index, value: m[1], kind: 'IPv4' });
  for (const m of input.matchAll(IPV6_CANDIDATE)) {
    if (isValidIPv6(m[0])) hits.push({ index: m.index, value: m[0], kind: 'IPv6' });
  }
  hits.sort((a, b) => a.index - b.index);
  for (const hit of hits) add(hit.value, hit.kind);
  return {
    addresses: [...found].map(([address, kind]) => ({ address, kind })),
    truncated,
    capped: found.size >= limits.maxAddresses,
  };
}

// ---------- ZIP (STORE) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const body = typeof data === 'string' ? encoder.encode(data) : data;
    const crc = crc32(body);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, body.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    localParts.push(new Uint8Array(local.buffer), nameBytes, body);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, 0, true);
    central.setUint16(14, 0x21, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, body.length, true);
    central.setUint32(24, body.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(central.buffer), nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return concatBytes([...localParts, ...centralParts, new Uint8Array(end.buffer)]);
}

function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ---------- XLSX ----------

const XML_INVALID = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;

export function xmlEscape(value) {
  return String(value ?? '')
    .replace(XML_INVALID, '')
    .slice(0, EXPORT_LIMITS.maxCellChars)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

// rows: array of arrays of strings/numbers. First row is the header.
export function buildXlsxBytes(rows, { sheetName = 'Sheet1' } = {}) {
  if (!Array.isArray(rows) || rows.length > EXPORT_LIMITS.maxRows) {
    throw new RangeError('rows must be an array within the row limit');
  }
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  const safeSheetName = xmlEscape(String(sheetName).replace(/[\\/?*[\]:]/g, '').slice(0, 31)) || 'Sheet1';
  const xml = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`;
  const files = [
    { name: '[Content_Types].xml', data: xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
    { name: '_rels/.rels', data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', data: xml(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
    { name: 'xl/worksheets/sheet1.xml', data: xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`) },
  ];
  return buildZip(files);
}
