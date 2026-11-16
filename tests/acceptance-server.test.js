import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function startServer(port) {
  const child=spawn(process.execPath,['tools/serve-acceptance.mjs'],{
    cwd:new URL('../',import.meta.url),
    env:{...process.env,SIGHTLINE_ACCEPTANCE_PORT:String(port)},
    stdio:['ignore','pipe','pipe'],
  });
  let output='';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{output+=chunk;});
  child.stderr.on('data',chunk=>{output+=chunk;});

  const deadline=Date.now()+5000;
  while(!/acceptance fixture:/i.test(output)){
    if(child.exitCode!==null) throw new Error(`server exited early: ${output}`);
    if(Date.now()>deadline) throw new Error(`server did not start: ${output}`);
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  return child;
}

async function stopServer(child) {
  if(!child || child.exitCode!==null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,1000))]);
  if(child.exitCode===null) child.kill('SIGKILL');
}

test('acceptance server serves fixtures and blocks traversal', async () => {
  const port=18765;
  const child=await startServer(port);
  try {
    const root=await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(root.status,200);
    assert.equal(root.headers.get('cache-control'),'no-store');
    assert.match(await root.text(),/Sightline Browser Agent Fixture/);

    const frame=await fetch(`http://127.0.0.1:${port}/same-origin-frame.html`);
    assert.equal(frame.status,200);
    assert.match(await frame.text(),/Frame search/);

    const traversal=await fetch(`http://127.0.0.1:${port}/%2e%2e%2fpackage.json`);
    assert.ok([403,404].includes(traversal.status));
  } finally {
    await stopServer(child);
  }
});
