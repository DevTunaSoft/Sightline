import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
const host = '127.0.0.1';
const port = Number(process.env.SIGHTLINE_ACCEPTANCE_PORT || 8765);

const types = new Map([
  ['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'],
  ['.json','application/json; charset=utf-8'],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relative = decoded === '/' ? 'browser-agent.html' : decoded.replace(/^\/+/, '');
  const resolved = normalize(join(root, relative));
  return resolved.startsWith(root) ? resolved : null;
}

const server = http.createServer(async (request, response) => {
  const path = safePath(request.url);
  if (!path) {
    response.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'}).end('Forbidden');
    return;
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    const body = await readFile(path);
    response.writeHead(200, {
      'Content-Type': types.get(extname(path).toLowerCase()) || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; frame-src 'self' https://example.org; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    });
    response.end(body);
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Sightline acceptance fixture: http://${host}:${port}/`);
  console.log('Press Ctrl+C to stop.');
});
