import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const extensionRoot=join(root,'extension');
const failures=[];
const notes=[];

function fail(message){failures.push(message);}
function note(message){notes.push(message);}

async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(path));
    else if(entry.isFile()) out.push(path);
  }
  return out;
}

const manifest=JSON.parse(await readFile(join(extensionRoot,'manifest.json'),'utf8'));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));

if(manifest.manifest_version!==3) fail('Manifest must remain version 3.');
if(manifest.version!=='0.2.0') fail(`Expected extension version 0.2.0, found ${manifest.version}`);
if(!String(manifest.version_name||'').startsWith('0.2.0-alpha')) fail('Manifest version_name must identify the 0.2.0 alpha.');
if(!String(pkg.version||'').startsWith('0.2.0-alpha')) fail('package.json version must align with 0.2.0-alpha.');

const allowedPermissions=new Set(['sidePanel','activeTab','scripting','storage']);
for(const permission of manifest.permissions||[]){
  if(!allowedPermissions.has(permission)) fail(`Unexpected extension permission: ${permission}`);
}
for(const required of allowedPermissions){
  if(!(manifest.permissions||[]).includes(required)) fail(`Required extension permission missing: ${required}`);
}

const hosts=manifest.host_permissions||[];
const allowedHosts=new Set(['http://127.0.0.1:11434/*','http://localhost:11434/*']);
for(const host of hosts){
  if(!allowedHosts.has(host)) fail(`Unexpected host permission: ${host}`);
}
for(const required of allowedHosts){
  if(!hosts.includes(required)) fail(`Required local Ollama host permission missing: ${required}`);
}
if(JSON.stringify(manifest).includes('<all_urls>')) fail('Manifest must never contain <all_urls>.');

const requiredFiles=[
  'manifest.json','background.js','panel.html','panel.js','agent-panel.js',
  'browser-task-runner.js','browser-bridge.js','page-agent-bootstrap.js',
  'page-agent.js','page-observer.js','action-protocol.js','safety-gate.js'
];
const files=await walk(extensionRoot);
const relFiles=new Set(files.map(path=>relative(extensionRoot,path).replaceAll('\\','/')));
for(const required of requiredFiles){
  if(!relFiles.has(required)) fail(`Required extension file missing: ${required}`);
}

let totalBytes=0;
for(const path of files){
  const info=await stat(path);
  totalBytes+=info.size;
  const rel=relative(extensionRoot,path).replaceAll('\\','/');
  if(rel.includes('node_modules/')) fail(`node_modules must not be packaged: ${rel}`);
  if(extname(path)==='.map') fail(`Source map not expected in alpha extension artifact: ${rel}`);
  if(!['.js','.html','.json','.css'].includes(extname(path).toLowerCase())) continue;

  const source=await readFile(path,'utf8');
  if(/\beval\s*\(/.test(source)) fail(`eval() found in ${rel}`);
  if(/\bnew\s+Function\s*\(/.test(source)) fail(`new Function() found in ${rel}`);
  if(/import\s*\([^)]*https?:\/\//.test(source)) fail(`Remote dynamic import found in ${rel}`);

  for(const match of source.matchAll(/https?:\/\/[^"'\s)<>]+/g)){
    const literal=match[0];
    if(literal.startsWith('http://127.0.0.1:11434') || literal.startsWith('http://localhost:11434')) continue;
    // URLs in user-visible documentation are not part of the extension runtime; runtime JS/HTML should remain local.
    if(extname(path).toLowerCase()==='.js') fail(`Unexpected remote URL literal in extension JS ${rel}: ${literal.slice(0,120)}`);
  }
}

const maxBytes=1_500_000;
if(totalBytes>maxBytes) fail(`Extension artifact exceeds ${maxBytes} byte alpha budget: ${totalBytes}`);
note(`Extension files: ${files.length}`);
note(`Extension bytes: ${totalBytes}`);
note(`Manifest permissions: ${[...(manifest.permissions||[])].join(', ')}`);
note(`Host permissions: ${hosts.join(', ')}`);

for(const message of notes) console.log(`INFO: ${message}`);
if(failures.length){
  for(const message of failures) console.error(`FAIL: ${message}`);
  process.exitCode=1;
}else{
  console.log('PASS: Sightline release audit.');
}
